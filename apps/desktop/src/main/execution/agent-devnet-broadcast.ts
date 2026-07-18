import { randomUUID } from "node:crypto";

import { address } from "@solana/kit";
import { AgentDevnetBroadcastExecutionViewSchema, type AgentDevnetBroadcastExecutionView, type AgentIntentEvaluationView } from "@silfable/contracts";

import type { DevnetFixtureRpcPort, DevnetTransactionRpcPort } from "../rpc/devnet.js";
import { RuntimeDatabase, type AgentDevnetBroadcastExecutionStorageRecord } from "../storage/database.js";
import type { AgentDevnetSimulationExactEvidence } from "./agent-devnet-simulation.js";
import type { AgentDevnetSignedExactEvidence } from "./agent-devnet-signing.js";
import { buildGuardedSplTransferFixture } from "./spl-fixture.js";
import { getGuardedFixtureManifestDigest, observeGuardedFixture, validateGuardedFixtureProvenance, type GuardedFixtureManifest } from "./fixture-provenance.js";

const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_MS = 750;
type Cipher = { encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>; decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string> };
type Chain = {
  revalidate(manifest: GuardedFixtureManifest): Promise<boolean>; getBlockHeight(): Promise<bigint>;
  broadcast(wire: string, expectedSignature: string): Promise<void>;
  getSignatureStatus(signatureValue: string): ReturnType<DevnetTransactionRpcPort["getSignatureStatus"]>;
};

export class SolanaAgentDevnetBroadcastAdapter implements Chain {
  readonly #rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort;
  constructor(rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort) { this.#rpc = rpc; }
  async revalidate(manifest: GuardedFixtureManifest) {
    const fixture = buildGuardedSplTransferFixture({ source: manifest.sourceTokenAccount, mint: manifest.mintAddress,
      destination: manifest.destinationTokenAccount, authority: address(manifest.walletAuthority),
      amount: BigInt(manifest.transferAmountAtomic), decimals: manifest.mintDecimals });
    const now = new Date(); const observation = await observeGuardedFixture(this.#rpc, manifest, now);
    return validateGuardedFixtureProvenance({ manifest, observation, instruction: fixture, now }).allowed;
  }
  getBlockHeight() { return this.#rpc.getBlockHeight(); }
  getSignatureStatus(signatureValue: string) { return this.#rpc.getSignatureStatus(signatureValue); }
  async broadcast(wire: string, expectedSignature: string) {
    const returned = await this.#rpc.sendTransaction(wire);
    if (returned !== expectedSignature) throw new Error("broadcast-signature-mismatch");
  }
}

export class AgentDevnetBroadcastService {
  readonly #database: RuntimeDatabase; readonly #cipher: Cipher; readonly #keystore: { isLocked(): boolean };
  readonly #health: { isHealthyFresh(): boolean }; readonly #fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
  readonly #simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
  readonly #signing: { loadExactSignedEvidence(id: string): Promise<AgentDevnetSignedExactEvidence> };
  readonly #chain: Chain; readonly #now: () => Date; readonly #timeoutMs: number; readonly #pollMs: number; #running = false;
  constructor(input: { database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean };
    health: { isHealthyFresh(): boolean }; fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
    simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
    signing: { loadExactSignedEvidence(id: string): Promise<AgentDevnetSignedExactEvidence> }; chain: Chain;
    now?: () => Date; confirmationTimeoutMs?: number; confirmationPollMs?: number }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore;
    this.#health = input.health; this.#fixtures = input.fixtures; this.#agents = input.agents;
    this.#simulations = input.simulations; this.#signing = input.signing; this.#chain = input.chain;
    this.#now = input.now ?? (() => new Date()); this.#timeoutMs = input.confirmationTimeoutMs ?? CONFIRMATION_TIMEOUT_MS;
    this.#pollMs = input.confirmationPollMs ?? CONFIRMATION_POLL_MS;
  }

  async broadcast(signedExecutionId: string, expectedMessageHash: string, expectedSignatureHash: string): Promise<AgentDevnetBroadcastExecutionView> {
    if (this.#running) throw new Error("Agent Devnet broadcast is already active");
    this.#assertUnlocked();
    if (this.#database.getAgentDevnetBroadcastExecutionBySigned(signedExecutionId) !== null) throw new Error("Signed receipt already has a broadcast journal");
    const signed = await this.#signing.loadExactSignedEvidence(signedExecutionId);
    if (signed.view.messageHash !== expectedMessageHash || signed.view.signatureHash !== expectedSignatureHash) throw new Error("binding-changed");
    const simulation = await this.#simulations.loadExactEvidence(signed.view.simulationId);
    this.#assertEvidence(signed, simulation);
    const createdAt = this.#now().toISOString(); const id = randomUUID();
    let view = this.#view(signed, id, "proposed", null, false, false, false, createdAt, createdAt);
    let envelope = await this.#cipher.encryptString(JSON.stringify(view));
    this.#database.insertAgentDevnetBroadcastExecution(this.#record(view, simulation.lastValidBlockHeight, envelope));
    this.#running = true;
    try {
      await this.#assertCurrent(signed, simulation);
      view = this.#view(signed, id, "broadcast", null, true, true, false, createdAt, this.#now().toISOString());
      envelope = await this.#cipher.encryptString(JSON.stringify(view));
      this.#assertUnlocked();
      if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
      let record = this.#database.transitionAgentDevnetBroadcastExecution({ id, expectedState: "proposed", state: "broadcast",
        encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
        broadcastAttempted: true, executionAttempted: true, fixtureTransferPerformed: false,
        updatedAt: view.updatedAt, requireCurrentAuthorization: true });
      this.#assertUnlocked();
      if (!this.#health.isHealthyFresh()) throw new Error("network-lost-after-broadcast");
      await this.#chain.broadcast(signed.signedWire, signed.signature);
      record = await this.#waitForConfirmation(record, signed.signature);
      return this.#toView(record);
    } catch (error) {
      const current = this.#database.getAgentDevnetBroadcastExecutionBySigned(signedExecutionId);
      if (current === null || current.state === "confirmed" || current.state === "failed" || current.state === "ambiguous") {
        if (current !== null) return this.#toView(current); throw error;
      }
      const attempted = current.broadcastAttempted;
      return this.#transition(current, attempted ? "ambiguous" : "failed", attempted ? afterBroadcastCode(error) : beforeBroadcastCode(error));
    } finally { this.#running = false; }
  }

  async list(): Promise<AgentDevnetBroadcastExecutionView[]> {
    this.#assertUnlocked();
    return Promise.all(this.#database.listAgentDevnetBroadcastExecutions().map((record) => this.#toView(record)));
  }

  async reconcilePending(): Promise<void> {
    this.#assertUnlocked();
    for (const record of this.#database.listPendingAgentDevnetBroadcastExecutions()) {
      if (record.state === "proposed") { await this.#transition(record, "failed", "restart-before-broadcast"); continue; }
      if (!this.#health.isHealthyFresh()) {
        if (record.state === "broadcast") await this.#transition(record, "ambiguous", "reconciliation-unavailable");
        continue;
      }
      try {
        const signed = await this.#signing.loadExactSignedEvidence(record.signedExecutionId);
        if (signed.view.signatureHash !== record.signatureHash || signed.view.messageHash !== record.messageHash) throw new Error("journal-integrity-error");
        const status = await this.#chain.getSignatureStatus(signed.signature);
        if (status.error) { await this.#transition(record, "failed", "transaction-error"); continue; }
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          await this.#transition(record, "confirmed", null, true); continue;
        }
        if ((await this.#chain.getBlockHeight()) > BigInt(record.lastValidBlockHeight)) {
          await this.#transition(record, "failed", "blockhash-expired-unconfirmed"); continue;
        }
        if (record.state === "broadcast") await this.#transition(record, "ambiguous", "reconciliation-pending");
      } catch (error) {
        if (error instanceof Error && error.message === "journal-integrity-error") await this.#transition(record, "failed", "journal-integrity-error");
        else if (record.state === "broadcast") await this.#transition(record, "ambiguous", "reconciliation-unavailable");
      }
    }
  }

  async #waitForConfirmation(record: AgentDevnetBroadcastExecutionStorageRecord, signature: string) {
    const deadline = Date.now() + this.#timeoutMs;
    while (Date.now() < deadline) {
      if (!this.#health.isHealthyFresh()) return this.#transitionRecord(record, "ambiguous", "network-lost-after-broadcast");
      const status = await this.#chain.getSignatureStatus(signature);
      if (status.error) return this.#transitionRecord(record, "failed", "transaction-error");
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return this.#transitionRecord(record, "confirmed", null, true);
      if ((await this.#chain.getBlockHeight()) > BigInt(record.lastValidBlockHeight)) return this.#transitionRecord(record, "failed", "blockhash-expired-unconfirmed");
      await delay(this.#pollMs);
    }
    return this.#transitionRecord(record, "ambiguous", "confirmation-timeout");
  }

  async #assertCurrent(signed: AgentDevnetSignedExactEvidence, simulation: AgentDevnetSimulationExactEvidence) {
    if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
    const manifest = await this.#fixtures.loadActiveManifest();
    if (getGuardedFixtureManifestDigest(manifest) !== simulation.fixtureManifestDigest) throw new Error("binding-changed");
    if ((await this.#chain.getBlockHeight()) > simulation.lastValidBlockHeight) throw new Error("blockhash-expired");
    if (!(await this.#chain.revalidate(manifest))) throw new Error("provenance-denied");
    const evaluation = (await this.#agents.list()).evaluations.find((value) => value.receipt.id === signed.view.evaluationId);
    if (evaluation === undefined || evaluation.session.id !== signed.view.sessionId || evaluation.session.state !== "active"
      || evaluation.approval.state !== "approved" || evaluation.approval.expiresAt === null
      || new Date(evaluation.approval.expiresAt).getTime() <= this.#now().getTime()
      || evaluation.receipt.proposalDigest !== simulation.view.proposalDigest) throw new Error("binding-changed");
    this.#assertUnlocked();
    if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
  }
  #assertEvidence(signed: AgentDevnetSignedExactEvidence, simulation: AgentDevnetSimulationExactEvidence) {
    if (simulation.view.id !== signed.view.simulationId || simulation.messageHash !== signed.view.messageHash
      || simulation.view.evaluationId !== signed.view.evaluationId || simulation.view.sessionId !== signed.view.sessionId) throw new Error("binding-changed");
  }
  #assertUnlocked() { if (this.#keystore.isLocked()) throw new Error("Keystore is locked"); }
  async #transition(record: AgentDevnetBroadcastExecutionStorageRecord, state: AgentDevnetBroadcastExecutionView["state"],
    failureCode: AgentDevnetBroadcastExecutionView["failureCode"], performed = false) {
    return this.#toView(await this.#transitionRecord(record, state, failureCode, performed));
  }
  async #transitionRecord(record: AgentDevnetBroadcastExecutionStorageRecord, state: AgentDevnetBroadcastExecutionView["state"],
    failureCode: AgentDevnetBroadcastExecutionView["failureCode"], performed = false) {
    const view = AgentDevnetBroadcastExecutionViewSchema.parse({ ...await this.#toView(record), state, failureCode,
      fixtureTransferPerformed: performed, updatedAt: this.#now().toISOString() });
    const envelope = await this.#cipher.encryptString(JSON.stringify(view));
    return this.#database.transitionAgentDevnetBroadcastExecution({ id: record.id, expectedState: record.state, state,
      failureCode, encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
      broadcastAttempted: record.broadcastAttempted, executionAttempted: record.executionAttempted,
      fixtureTransferPerformed: performed, updatedAt: view.updatedAt });
  }
  async #toView(record: AgentDevnetBroadcastExecutionStorageRecord) {
    const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce, keyId: "local-data-key-v1" })) as Record<string, unknown>;
    return AgentDevnetBroadcastExecutionViewSchema.parse({ ...payload, state: record.state, failureCode: record.failureCode,
      broadcastAttempted: record.broadcastAttempted, executionAttempted: record.executionAttempted,
      fixtureTransferPerformed: record.fixtureTransferPerformed, updatedAt: record.updatedAt });
  }
  #view(signed: AgentDevnetSignedExactEvidence, id: string, state: AgentDevnetBroadcastExecutionView["state"],
    failureCode: AgentDevnetBroadcastExecutionView["failureCode"], broadcastAttempted: boolean, executionAttempted: boolean,
    performed: boolean, createdAt: string, updatedAt: string) {
    return AgentDevnetBroadcastExecutionViewSchema.parse({ schemaVersion: 1, id, signedExecutionId: signed.view.id,
      preSignExecutionId: signed.view.preSignExecutionId, simulationId: signed.view.simulationId,
      evaluationId: signed.view.evaluationId, sessionId: signed.view.sessionId, messageHash: signed.view.messageHash,
      signatureHash: signed.view.signatureHash, state, failureCode, broadcastAttempted, executionAttempted,
      fixtureTransferPerformed: performed, economicValueMapping: "none", marketSwapPerformed: false,
      mainnetEnabled: false, createdAt, updatedAt });
  }
  #record(view: AgentDevnetBroadcastExecutionView, lastValidBlockHeight: bigint,
    envelope: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): AgentDevnetBroadcastExecutionStorageRecord {
    return { ...view, lastValidBlockHeight: lastValidBlockHeight.toString(), encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce, keyId: envelope.keyId };
  }
}

function beforeBroadcastCode(error: unknown): AgentDevnetBroadcastExecutionView["failureCode"] {
  const message = error instanceof Error ? error.message : "";
  if (/network/u.test(message)) return "network-unhealthy"; if (/provenance/u.test(message)) return "provenance-denied";
  if (/blockhash/u.test(message)) return "blockhash-expired"; return "binding-changed";
}
function afterBroadcastCode(error: unknown): AgentDevnetBroadcastExecutionView["failureCode"] {
  return error instanceof Error && /network/u.test(error.message) ? "network-lost-after-broadcast" : "broadcast-status-unknown";
}
function delay(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }
