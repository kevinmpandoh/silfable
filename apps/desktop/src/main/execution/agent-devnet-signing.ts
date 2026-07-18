import { createHash, randomUUID } from "node:crypto";

import {
  getBase64EncodedWireTransaction, getSignatureFromTransaction, getTransactionDecoder,
  signTransactionWithSigners, address, type KeyPairSigner,
} from "@solana/kit";
import { AgentDevnetSignedExecutionViewSchema, type AgentDevnetPreSignExecutionView, type AgentDevnetSignedExecutionView, type AgentIntentEvaluationView } from "@silfable/contracts";

import type { DevnetFixtureRpcPort, DevnetTransactionRpcPort } from "../rpc/devnet.js";
import { RuntimeDatabase, type AgentDevnetSignedExecutionStorageRecord } from "../storage/database.js";
import type { AgentDevnetSimulationExactEvidence } from "./agent-devnet-simulation.js";
import { buildGuardedSplTransferFixture, getTransactionMessageHash } from "./spl-fixture.js";
import { getGuardedFixtureManifestDigest, observeGuardedFixture, validateGuardedFixtureProvenance, type GuardedFixtureManifest } from "./fixture-provenance.js";

type Cipher = { encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>; decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string> };
type Wallet = { withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T> };
type SigningAdapter = {
  revalidate(manifest: GuardedFixtureManifest): Promise<boolean>; getBlockHeight(): Promise<bigint>;
  signExact(signer: KeyPairSigner, wire: string, expectedMessageHash: string): Promise<{ signedWire: string; signature: string }>;
};

export type AgentDevnetSignedExactEvidence = {
  view: AgentDevnetSignedExecutionView; signedWire: string; signature: string;
};

export class SolanaAgentDevnetSigningAdapter implements SigningAdapter {
  readonly #rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort;
  constructor(rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort) { this.#rpc = rpc; }
  async revalidate(manifest: GuardedFixtureManifest) {
    const fixture = buildGuardedSplTransferFixture({ source: manifest.sourceTokenAccount, mint: manifest.mintAddress,
      destination: manifest.destinationTokenAccount, authority: address(manifest.walletAuthority),
      amount: BigInt(manifest.transferAmountAtomic), decimals: manifest.mintDecimals });
    const now = new Date();
    const observation = await observeGuardedFixture(this.#rpc, manifest, now);
    return validateGuardedFixtureProvenance({ manifest, observation, instruction: fixture, now }).allowed;
  }
  getBlockHeight() { return this.#rpc.getBlockHeight(); }
  async signExact(signer: KeyPairSigner, wire: string, expectedMessageHash: string) {
    const transaction = getTransactionDecoder().decode(Buffer.from(wire, "base64"));
    if (getTransactionMessageHash(transaction) !== expectedMessageHash) throw new Error("Exact transaction message hash changed");
    const signed = await signTransactionWithSigners([signer], transaction);
    if (getTransactionMessageHash(signed) !== expectedMessageHash) throw new Error("Signed transaction message hash changed");
    return { signedWire: getBase64EncodedWireTransaction(signed), signature: getSignatureFromTransaction(signed) };
  }
}

export class AgentDevnetSigningService {
  readonly #database: RuntimeDatabase; readonly #cipher: Cipher; readonly #keystore: { isLocked(): boolean };
  readonly #health: { isHealthyFresh(): boolean }; readonly #wallet: Wallet;
  readonly #fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
  readonly #simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
  readonly #preSigns: { list(): Promise<AgentDevnetPreSignExecutionView[]> };
  readonly #adapter: SigningAdapter; readonly #now: () => Date; #running = false;
  constructor(input: { database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean }; health: { isHealthyFresh(): boolean };
    wallet: Wallet; fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
    simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
    preSigns: { list(): Promise<AgentDevnetPreSignExecutionView[]> }; adapter: SigningAdapter; now?: () => Date }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore; this.#health = input.health;
    this.#wallet = input.wallet; this.#fixtures = input.fixtures; this.#agents = input.agents; this.#simulations = input.simulations;
    this.#preSigns = input.preSigns; this.#adapter = input.adapter; this.#now = input.now ?? (() => new Date());
  }
  async sign(preSignExecutionId: string, expectedMessageHash: string): Promise<AgentDevnetSignedExecutionView> {
    if (this.#running) throw new Error("Agent Devnet signing is already active");
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (this.#database.getAgentDevnetSignedExecutionByPreSign(preSignExecutionId) !== null) throw new Error("Pre-sign receipt already has a signing journal");
    const preSign = (await this.#preSigns.list()).find((value) => value.id === preSignExecutionId);
    if (preSign === undefined || preSign.state !== "ready-for-signing" || !preSign.signingArmConsumed
      || !preSign.exactMessageRevalidated || preSign.messageHash !== expectedMessageHash) throw new Error("Exact ready-for-signing receipt is required");
    const evidence = await this.#simulations.loadExactEvidence(preSign.simulationId);
    this.#assertEvidence(preSign, evidence);
    const createdAt = this.#now().toISOString(); const id = randomUUID();
    let view = this.#view(preSign, id, "proposed", null, null, false, createdAt, createdAt);
    let envelope = await this.#cipher.encryptString(JSON.stringify(view));
    this.#database.insertAgentDevnetSignedExecution(this.#record(view, envelope));
    this.#running = true;
    try {
      if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
      await this.#assertCurrent(preSign, evidence);
      view = this.#view(preSign, id, "signing", null, null, true, createdAt, this.#now().toISOString());
      envelope = await this.#cipher.encryptString(JSON.stringify(view));
      this.#database.transitionAgentDevnetSignedExecution({ id, expectedState: "proposed", state: "signing",
        encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
        signingAttempted: true, updatedAt: view.updatedAt });
      const signed = await this.#wallet.withWalletSigner(async (signer) => {
        const manifest = await this.#assertCurrent(preSign, evidence);
        if (signer.address !== manifest.walletAuthority) throw new Error("binding-changed");
        return this.#adapter.signExact(signer, evidence.simulationWireTransaction, preSign.messageHash);
      });
      const signatureHash = createHash("sha256").update(signed.signature).digest("hex");
      view = this.#view(preSign, id, "signed-awaiting-broadcast", signatureHash, null, true, createdAt, this.#now().toISOString());
      envelope = await this.#cipher.encryptString(JSON.stringify({ ...view, signedWire: signed.signedWire, signature: signed.signature }));
      this.#database.transitionAgentDevnetSignedExecution({ id, expectedState: "signing", state: "signed-awaiting-broadcast",
        signatureHash, encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
        signingAttempted: true, updatedAt: view.updatedAt });
      return view;
    } catch (error) {
      const current = this.#database.getAgentDevnetSignedExecutionByPreSign(preSignExecutionId);
      if (current === null || current.state === "signed-awaiting-broadcast" || current.state === "failed") throw error;
      const code = classify(error); const attempted = current.signingAttempted;
      view = this.#view(preSign, id, "failed", null, code, attempted, createdAt, this.#now().toISOString());
      envelope = await this.#cipher.encryptString(JSON.stringify(view));
      this.#database.transitionAgentDevnetSignedExecution({ id, expectedState: current.state, state: "failed", failureCode: code,
        encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
        signingAttempted: attempted, updatedAt: view.updatedAt });
      return view;
    } finally { this.#running = false; }
  }
  async list(): Promise<AgentDevnetSignedExecutionView[]> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    return Promise.all(this.#database.listAgentDevnetSignedExecutions().map((record) => this.#toView(record)));
  }
  async loadExactSignedEvidence(id: string): Promise<AgentDevnetSignedExactEvidence> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    const record = this.#database.getAgentDevnetSignedExecution(id);
    if (record === null || record.state !== "signed-awaiting-broadcast" || record.signatureHash === null) {
      throw new Error("Exact signed Devnet journal is required");
    }
    const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce, keyId: "local-data-key-v1" })) as Record<string, unknown>;
    if (typeof payload.signedWire !== "string" || typeof payload.signature !== "string") throw new Error("Signed journal integrity error");
    const transaction = getTransactionDecoder().decode(Buffer.from(payload.signedWire, "base64"));
    const messageHash = getTransactionMessageHash(transaction);
    const signatureValue = getSignatureFromTransaction(transaction);
    const signatureHash = createHash("sha256").update(signatureValue).digest("hex");
    if (messageHash !== record.messageHash || signatureValue !== payload.signature || signatureHash !== record.signatureHash) {
      throw new Error("Signed journal integrity error");
    }
    const view = await this.#toView(record);
    if (view.preSignExecutionId !== record.preSignExecutionId) throw new Error("Signed journal metadata mismatch");
    return { view, signedWire: payload.signedWire, signature: signatureValue };
  }
  async #toView(record: AgentDevnetSignedExecutionStorageRecord) {
    const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload, nonce: record.payloadNonce, keyId: "local-data-key-v1" })) as Record<string, unknown>;
    const view = AgentDevnetSignedExecutionViewSchema.parse({ schemaVersion: payload.schemaVersion, id: payload.id,
      preSignExecutionId: payload.preSignExecutionId, signingArmId: payload.signingArmId, simulationId: payload.simulationId,
      evaluationId: payload.evaluationId, sessionId: payload.sessionId, messageHash: payload.messageHash,
      state: record.state, signatureHash: record.signatureHash, failureCode: record.failureCode,
      signingAttempted: record.signingAttempted, broadcastAttempted: payload.broadcastAttempted,
      executionAttempted: payload.executionAttempted, marketSwapPerformed: payload.marketSwapPerformed,
      mainnetEnabled: payload.mainnetEnabled, createdAt: payload.createdAt, updatedAt: record.updatedAt });
    if (view.id !== record.id || view.state !== record.state || view.signatureHash !== record.signatureHash) throw new Error("Agent signing journal metadata mismatch");
    return view;
  }
  async #assertCurrent(preSign: AgentDevnetPreSignExecutionView, evidence: AgentDevnetSimulationExactEvidence) {
    if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
    const manifest = await this.#fixtures.loadActiveManifest();
    if (getGuardedFixtureManifestDigest(manifest) !== preSign.fixtureManifestDigest) throw new Error("binding-changed");
    if ((await this.#adapter.getBlockHeight()) > evidence.lastValidBlockHeight) throw new Error("blockhash-expired");
    if (!(await this.#adapter.revalidate(manifest))) throw new Error("provenance-denied");
    const evaluation = (await this.#agents.list()).evaluations.find((value) => value.receipt.id === preSign.evaluationId);
    if (evaluation === undefined || evaluation.session.id !== preSign.sessionId || evaluation.session.state !== "active"
      || evaluation.approval.state !== "approved" || evaluation.receipt.proposalDigest !== evidence.view.proposalDigest) throw new Error("binding-changed");
    return manifest;
  }
  #assertEvidence(preSign: AgentDevnetPreSignExecutionView, evidence: AgentDevnetSimulationExactEvidence) {
    if (evidence.view.id !== preSign.simulationId || evidence.messageHash !== preSign.messageHash
      || evidence.view.evaluationId !== preSign.evaluationId || evidence.view.sessionId !== preSign.sessionId
      || evidence.fixtureManifestDigest !== preSign.fixtureManifestDigest) throw new Error("binding-changed");
  }
  #view(preSign: AgentDevnetPreSignExecutionView, id: string, state: AgentDevnetSignedExecutionView["state"], signatureHash: string | null,
    failureCode: AgentDevnetSignedExecutionView["failureCode"], attempted: boolean, createdAt: string, updatedAt: string) {
    return AgentDevnetSignedExecutionViewSchema.parse({ schemaVersion: 1, id, preSignExecutionId: preSign.id,
      signingArmId: preSign.signingArmId, simulationId: preSign.simulationId, evaluationId: preSign.evaluationId,
      sessionId: preSign.sessionId, messageHash: preSign.messageHash, state, signatureHash, failureCode,
      signingAttempted: attempted, broadcastAttempted: false, executionAttempted: false,
      marketSwapPerformed: false, mainnetEnabled: false, createdAt, updatedAt });
  }
  #record(view: AgentDevnetSignedExecutionView, envelope: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): AgentDevnetSignedExecutionStorageRecord {
    return { ...view, encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId };
  }
}

function classify(error: unknown): AgentDevnetSignedExecutionView["failureCode"] {
  const message = error instanceof Error ? error.message : "";
  if (/network/u.test(message)) return "network-unhealthy"; if (/provenance/u.test(message)) return "provenance-denied";
  if (/blockhash/u.test(message)) return "blockhash-expired"; if (/journal|conflict/u.test(message)) return "journal-conflict";
  if (/sign|transaction/u.test(message)) return "signing-failed"; return "binding-changed";
}
