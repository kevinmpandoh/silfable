import { randomUUID } from "node:crypto";

import {
  AgentDevnetPreSignExecutionViewSchema,
  type AgentDevnetPreSignExecutionView,
  type AgentDevnetSigningArmView,
  type AgentIntentEvaluationView,
} from "@silfable/contracts";
import { address } from "@solana/kit";

import type { DevnetFixtureRpcPort, DevnetTransactionRpcPort } from "../rpc/devnet.js";
import { RuntimeDatabase, type AgentDevnetPreSignExecutionStorageRecord } from "../storage/database.js";
import { buildGuardedSplTransferFixture } from "./spl-fixture.js";
import {
  getGuardedFixtureManifestDigest,
  observeGuardedFixture,
  validateGuardedFixtureProvenance,
  type GuardedFixtureManifest,
} from "./fixture-provenance.js";
import type { AgentDevnetSimulationExactEvidence } from "./agent-devnet-simulation.js";

const MAX_FEE_LAMPORTS = 20_000n;
type Cipher = {
  encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};
type Adapter = {
  revalidate(manifest: GuardedFixtureManifest): Promise<boolean>;
  simulateExact(wire: string): Promise<{ error: boolean; unitsConsumed: bigint | null; fee: bigint | null }>;
  getBlockHeight(): Promise<bigint>;
};

export class SolanaAgentDevnetPreSignAdapter implements Adapter {
  readonly #rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort;
  constructor(rpc: DevnetFixtureRpcPort & DevnetTransactionRpcPort) { this.#rpc = rpc; }
  async revalidate(manifest: GuardedFixtureManifest): Promise<boolean> {
    const fixture = buildGuardedSplTransferFixture({
      source: manifest.sourceTokenAccount, mint: manifest.mintAddress,
      destination: manifest.destinationTokenAccount, authority: address(manifest.walletAuthority),
      amount: BigInt(manifest.transferAmountAtomic), decimals: manifest.mintDecimals,
    });
    const observation = await observeGuardedFixture(this.#rpc, manifest, new Date());
    return validateGuardedFixtureProvenance({ manifest, observation, instruction: fixture, now: new Date() }).allowed;
  }
  simulateExact(wire: string) { return this.#rpc.simulateTransaction(wire); }
  getBlockHeight() { return this.#rpc.getBlockHeight(); }
}

export class AgentDevnetPreSignService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: Cipher;
  readonly #keystore: { isLocked(): boolean };
  readonly #health: { isHealthyFresh(): boolean };
  readonly #fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
  readonly #simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
  readonly #arms: { list(): Promise<AgentDevnetSigningArmView[]> };
  readonly #adapter: Adapter;
  readonly #now: () => Date;
  #running = false;

  constructor(input: {
    database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean };
    health: { isHealthyFresh(): boolean }; fixtures: { loadActiveManifest(): Promise<GuardedFixtureManifest> };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
    simulations: { loadExactEvidence(id: string): Promise<AgentDevnetSimulationExactEvidence> };
    arms: { list(): Promise<AgentDevnetSigningArmView[]> }; adapter: Adapter; now?: () => Date;
  }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore;
    this.#health = input.health; this.#fixtures = input.fixtures; this.#agents = input.agents;
    this.#simulations = input.simulations; this.#arms = input.arms; this.#adapter = input.adapter;
    this.#now = input.now ?? (() => new Date());
  }

  async prepare(signingArmId: string, expectedMessageHash: string): Promise<AgentDevnetPreSignExecutionView> {
    if (this.#running) throw new Error("Agent Devnet pre-sign preparation is already active");
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    const arm = (await this.#arms.list()).find((item) => item.id === signingArmId);
    if (arm === undefined || arm.state !== "active" || arm.messageHash !== expectedMessageHash) {
      throw new Error("Exact active signing arm is required");
    }
    this.#running = true;
    let exactRevalidated = false;
    try {
      if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
      const evidence = await this.#simulations.loadExactEvidence(arm.simulationId);
      this.#assertEvidence(arm, evidence);
      const manifest = await this.#fixtures.loadActiveManifest();
      if (getGuardedFixtureManifestDigest(manifest) !== arm.fixtureManifestDigest) throw new Error("binding-changed");
      await this.#assertAgentCurrent(arm);
      if ((await this.#adapter.getBlockHeight()) > evidence.lastValidBlockHeight) throw new Error("blockhash-expired");
      if (!(await this.#adapter.revalidate(manifest))) throw new Error("provenance-denied");
      const simulation = await this.#adapter.simulateExact(evidence.simulationWireTransaction);
      if (simulation.error) throw new Error("simulation-failed");
      if (simulation.fee === null || simulation.fee > MAX_FEE_LAMPORTS) throw new Error("fee-exceeded");
      exactRevalidated = true;
      if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
      const [currentArm, currentManifest] = await Promise.all([
        this.#arms.list().then((items) => items.find((item) => item.id === arm.id)),
        this.#fixtures.loadActiveManifest(),
      ]);
      if (currentArm?.state !== "active" || currentArm.messageHash !== arm.messageHash
        || getGuardedFixtureManifestDigest(currentManifest) !== arm.fixtureManifestDigest) throw new Error("binding-changed");
      await this.#assertAgentCurrent(arm);
      const view = this.#view(arm, "ready-for-signing", null, true, true);
      const record = await this.#record(view, {
        exactWire: evidence.simulationWireTransaction,
        simulation: { error: simulation.error, unitsConsumed: simulation.unitsConsumed?.toString() ?? null, fee: simulation.fee?.toString() ?? null },
      });
      this.#database.consumeAgentDevnetSigningArmAndCreateExecution(record);
      return view;
    } catch (error) {
      const code = failureCode(error);
      const view = this.#view(arm, "failed", code, false, exactRevalidated);
      this.#database.insertFailedAgentDevnetPreSignExecution(await this.#record(view, { failureCode: code }));
      return view;
    } finally {
      this.#running = false;
    }
  }

  async list(): Promise<AgentDevnetPreSignExecutionView[]> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    return Promise.all(this.#database.listAgentDevnetPreSignExecutions().map(async (record) => {
      const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload, nonce: record.payloadNonce, keyId: "local-data-key-v1" })) as Record<string, unknown>;
      const view = AgentDevnetPreSignExecutionViewSchema.parse({
        schemaVersion: payload.schemaVersion, id: payload.id, signingArmId: payload.signingArmId,
        simulationId: payload.simulationId, evaluationId: payload.evaluationId, sessionId: payload.sessionId,
        proposalDigest: payload.proposalDigest, fixtureManifestDigest: payload.fixtureManifestDigest,
        messageHash: payload.messageHash, state: payload.state, failureCode: payload.failureCode,
        signingArmConsumed: payload.signingArmConsumed, exactMessageRevalidated: payload.exactMessageRevalidated,
        executionBridgeConnected: payload.executionBridgeConnected, signingAttempted: payload.signingAttempted,
        broadcastAttempted: payload.broadcastAttempted, executionAttempted: payload.executionAttempted,
        marketSwapPerformed: payload.marketSwapPerformed, mainnetEnabled: payload.mainnetEnabled,
        preparedAt: payload.preparedAt,
      });
      if (view.id !== record.id || view.state !== record.state || view.messageHash !== record.messageHash) throw new Error("Agent pre-sign journal metadata mismatch");
      return view;
    }));
  }

  #assertEvidence(arm: AgentDevnetSigningArmView, evidence: AgentDevnetSimulationExactEvidence) {
    if (evidence.view.id !== arm.simulationId || evidence.messageHash !== arm.messageHash
      || evidence.view.evaluationId !== arm.evaluationId || evidence.view.sessionId !== arm.sessionId
      || evidence.view.proposalDigest !== arm.proposalDigest || evidence.fixtureManifestDigest !== arm.fixtureManifestDigest) {
      throw new Error("binding-changed");
    }
  }
  async #assertAgentCurrent(arm: AgentDevnetSigningArmView) {
    const value = (await this.#agents.list()).evaluations.find((item) => item.receipt.id === arm.evaluationId);
    if (value === undefined || value.session.id !== arm.sessionId || value.session.state !== "active"
      || value.approval.state !== "approved" || value.receipt.proposalDigest !== arm.proposalDigest) throw new Error("binding-changed");
  }
  #view(arm: AgentDevnetSigningArmView, state: "ready-for-signing" | "failed", code: AgentDevnetPreSignExecutionView["failureCode"], consumed: boolean, revalidated: boolean) {
    return AgentDevnetPreSignExecutionViewSchema.parse({
      schemaVersion: 1, id: randomUUID(), signingArmId: arm.id, simulationId: arm.simulationId,
      evaluationId: arm.evaluationId, sessionId: arm.sessionId, proposalDigest: arm.proposalDigest,
      fixtureManifestDigest: arm.fixtureManifestDigest, messageHash: arm.messageHash, state, failureCode: code,
      signingArmConsumed: consumed, exactMessageRevalidated: revalidated, executionBridgeConnected: false,
      signingAttempted: false, broadcastAttempted: false, executionAttempted: false,
      marketSwapPerformed: false, mainnetEnabled: false, preparedAt: this.#now().toISOString(),
    });
  }
  async #record(view: AgentDevnetPreSignExecutionView, secretEvidence: unknown): Promise<AgentDevnetPreSignExecutionStorageRecord> {
    const envelope = await this.#cipher.encryptString(JSON.stringify({ ...view, secretEvidence }));
    return { ...view, signingArmId: view.signingArmId, encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce, keyId: envelope.keyId };
  }
}

function failureCode(error: unknown): AgentDevnetPreSignExecutionView["failureCode"] {
  const message = error instanceof Error ? error.message : "";
  if (/network/u.test(message)) return "network-unhealthy";
  if (/provenance/u.test(message)) return "provenance-denied";
  if (/blockhash/u.test(message)) return "blockhash-expired";
  if (/simulation/u.test(message)) return "simulation-failed";
  if (/fee/u.test(message)) return "fee-exceeded";
  if (/arm/u.test(message)) return "arm-invalid";
  return "binding-changed";
}
