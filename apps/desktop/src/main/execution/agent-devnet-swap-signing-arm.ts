import { randomUUID } from "node:crypto";

import { AgentDevnetSwapSigningArmViewSchema, type AgentDevnetSwapBuildView,
  type AgentDevnetSwapSigningArmView, type AgentIntentEvaluationView } from "@silfable/contracts";

import { RuntimeDatabase, type AgentDevnetSwapSigningArmStorageRecord } from "../storage/database.js";

const ARM_LIFETIME_MS = 15_000;
const MAX_BUILD_AGE_MS = 15_000;
type Cipher = { encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string> };

export class AgentDevnetSwapSigningArmService {
  readonly #database: RuntimeDatabase; readonly #cipher: Cipher; readonly #keystore: { isLocked(): boolean };
  readonly #health: { isHealthyFresh(): boolean }; readonly #builds: { list(): Promise<AgentDevnetSwapBuildView[]> };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> }; readonly #now: () => Date;
  constructor(input: { database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean };
    health: { isHealthyFresh(): boolean }; builds: { list(): Promise<AgentDevnetSwapBuildView[]> };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> }; now?: () => Date }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore;
    this.#health = input.health; this.#builds = input.builds; this.#agents = input.agents;
    this.#now = input.now ?? (() => new Date());
  }
  async arm(input: { buildId: string; expectedMessageHash: string; expectedOutputTokenAccount: string;
    expectedOutputAmountDelta: string }): Promise<AgentDevnetSwapSigningArmView> {
    this.#assertReady(); const now = this.#now(); const nowIso = now.toISOString();
    if (this.#database.getActiveAgentDevnetSwapSigningArm(nowIso) !== null) throw new Error("An economic swap signing arm is already active");
    const build = (await this.#builds.list()).find((candidate) => candidate.id === input.buildId);
    if (build === undefined || build.state !== "simulated" || build.messageHash === null || !build.exactAmountBound
      || !build.associatedTokenAccountVerified || !build.balanceDeltaVerified || build.outputAmountDelta === null
      || build.walletLamportsDelta === null || build.messageHash !== input.expectedMessageHash
      || build.outputTokenAccount !== input.expectedOutputTokenAccount || build.outputAmountDelta !== input.expectedOutputAmountDelta
      || build.signingAttempted || build.broadcastAttempted || build.marketSwapPerformed || build.mainnetEnabled) {
      throw new Error("An exact successful economic balance proof is required");
    }
    const builtAtMs = Date.parse(build.builtAt);
    if (!Number.isFinite(builtAtMs) || builtAtMs > now.getTime() || now.getTime() - builtAtMs > MAX_BUILD_AGE_MS
      || Date.parse(build.expiresAt) <= now.getTime()) throw new Error("The economic swap build is too old to arm");
    const evaluation = (await this.#agents.list()).evaluations.find((candidate) => candidate.receipt.id === build.evaluationId);
    if (evaluation === undefined || evaluation.session.id !== build.sessionId || evaluation.session.state !== "active"
      || evaluation.approval.state !== "approved" || evaluation.approval.expiresAt === null
      || evaluation.receipt.outcome !== "pending-approval" || evaluation.proposal.action !== "sell-sol") {
      throw new Error("The economic build is no longer bound to an approved sell intent");
    }
    this.#assertReady();
    const expiresAtMs = Math.min(now.getTime() + ARM_LIFETIME_MS, builtAtMs + ARM_LIFETIME_MS,
      Date.parse(build.expiresAt), Date.parse(evaluation.approval.expiresAt), Date.parse(evaluation.session.deadlineAt));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) throw new Error("The economic signing authority is already expired");
    const view = AgentDevnetSwapSigningArmViewSchema.parse({ schemaVersion: 1, id: randomUUID(), buildId: build.id,
      quoteId: build.quoteId, evaluationId: build.evaluationId, sessionId: build.sessionId,
      proposalDigest: evaluation.receipt.proposalDigest, messageHash: build.messageHash,
      outputTokenAccount: build.outputTokenAccount, outputAmountDelta: build.outputAmountDelta,
      walletLamportsDelta: build.walletLamportsDelta, scope: "agent-raydium-devnet-sell-sign-once", state: "active",
      consumerId: null, oneShotSigningAuthorized: true, signingBridgeConnected: false, signingAttempted: false,
      broadcastAttempted: false, economicValueMapping: "direction-only-capped-devnet", marketSwapPerformed: false,
      mainnetEnabled: false, armedAt: nowIso, expiresAt: new Date(expiresAtMs).toISOString(), consumedAt: null, revokedAt: null });
    const envelope = await this.#cipher.encryptString(JSON.stringify(view));
    this.#database.insertAgentDevnetSwapSigningArm({ id: view.id, buildId: view.buildId, quoteId: view.quoteId,
      evaluationId: view.evaluationId, sessionId: view.sessionId, proposalDigest: view.proposalDigest,
      messageHash: view.messageHash, outputTokenAccount: view.outputTokenAccount, outputAmountDelta: view.outputAmountDelta,
      walletLamportsDelta: view.walletLamportsDelta, scope: view.scope, state: "active", consumerId: null,
      encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
      signingBridgeConnected: false, signingAttempted: false, broadcastAttempted: false, mainnetEnabled: false,
      armedAt: view.armedAt, expiresAt: view.expiresAt, consumedAt: null, revokedAt: null });
    return view;
  }
  async revoke(id: string) { this.#assertUnlocked(); return this.#hydrate(this.#database.revokeAgentDevnetSwapSigningArm(id, this.#now().toISOString())); }
  async list() { this.#assertUnlocked(); this.#database.getActiveAgentDevnetSwapSigningArm(this.#now().toISOString());
    return Promise.all(this.#database.listAgentDevnetSwapSigningArms().map((record) => this.#hydrate(record))); }
  #assertReady() { this.#assertUnlocked(); if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy"); }
  #assertUnlocked() { if (this.#keystore.isLocked()) throw new Error("Keystore is locked"); }
  async #hydrate(record: AgentDevnetSwapSigningArmStorageRecord) {
    if (record.keyId !== "local-data-key-v1") throw new Error("Economic swap signing arm key is unsupported");
    const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce, keyId: record.keyId })) as Record<string, unknown>;
    const view = AgentDevnetSwapSigningArmViewSchema.parse({ ...payload, state: record.state, consumerId: record.consumerId,
      consumedAt: record.consumedAt, revokedAt: record.revokedAt });
    if (view.id !== record.id || view.buildId !== record.buildId || view.quoteId !== record.quoteId
      || view.evaluationId !== record.evaluationId || view.sessionId !== record.sessionId
      || view.proposalDigest !== record.proposalDigest || view.messageHash !== record.messageHash
      || view.outputTokenAccount !== record.outputTokenAccount || view.outputAmountDelta !== record.outputAmountDelta
      || view.walletLamportsDelta !== record.walletLamportsDelta || view.scope !== record.scope
      || view.armedAt !== record.armedAt || view.expiresAt !== record.expiresAt) throw new Error("Economic swap signing arm metadata mismatch");
    return view;
  }
}
