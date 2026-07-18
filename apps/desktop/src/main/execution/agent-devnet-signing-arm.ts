import { randomUUID } from "node:crypto";

import {
  AgentDevnetSigningArmViewSchema,
  type AgentDevnetSimulationView,
  type AgentDevnetSigningArmView,
  type AgentIntentEvaluationView,
} from "@silfable/contracts";

import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance.js";
import {
  RuntimeDatabase,
  type AgentDevnetSigningArmStorageRecord,
} from "../storage/database.js";

const ARM_LIFETIME_MS = 60 * 1_000;
const MAX_SIMULATION_AGE_MS = 30 * 1_000;

type KeystoreState = { isLocked(): boolean };
type SigningArmCipher = {
  encryptString(plaintext: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};
type SimulationSource = { list(): Promise<AgentDevnetSimulationView[]> };
type AgentSource = { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
type FixtureSource = { loadActiveManifest(): Promise<GuardedFixtureManifest> };

export class AgentDevnetSigningArmService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: SigningArmCipher;
  readonly #keystore: KeystoreState;
  readonly #simulations: SimulationSource;
  readonly #agents: AgentSource;
  readonly #fixtures: FixtureSource;
  readonly #now: () => Date;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: SigningArmCipher;
    keystore: KeystoreState;
    simulations: SimulationSource;
    agents: AgentSource;
    fixtures: FixtureSource;
    now?: () => Date;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#simulations = input.simulations;
    this.#agents = input.agents;
    this.#fixtures = input.fixtures;
    this.#now = input.now ?? (() => new Date());
  }

  async arm(input: {
    simulationId: string;
    expectedProposalDigest: string;
    expectedMessageHash: string;
  }): Promise<AgentDevnetSigningArmView> {
    this.#assertUnlocked();
    const now = this.#now();
    if (this.#database.getActiveAgentDevnetSigningArm(now.toISOString()) !== null) {
      throw new Error("An agent Devnet signing arm is already active");
    }
    const simulation = (await this.#simulations.list()).find((candidate) => candidate.id === input.simulationId);
    if (
      simulation === undefined || simulation.outcome !== "simulated" || simulation.messageHash === null
      || simulation.proposalDigest !== input.expectedProposalDigest
      || simulation.messageHash !== input.expectedMessageHash
      || simulation.economicValueMapping !== "none" || simulation.marketSwapPerformed
      || simulation.signingAttempted || simulation.broadcastAttempted || simulation.executionAttempted
    ) throw new Error("An exact successful no-execution simulation proof is required");
    const simulatedAtMs = Date.parse(simulation.simulatedAt);
    if (
      !Number.isFinite(simulatedAtMs) || simulatedAtMs > now.getTime()
      || now.getTime() - simulatedAtMs > MAX_SIMULATION_AGE_MS
    ) throw new Error("The exact simulation proof is too old to arm");

    const evaluation = (await this.#agents.list()).evaluations.find(
      (candidate) => candidate.receipt.id === simulation.evaluationId,
    );
    if (
      evaluation === undefined || evaluation.session.id !== simulation.sessionId
      || evaluation.session.state !== "active" || evaluation.approval.state !== "approved"
      || evaluation.receipt.proposalDigest !== simulation.proposalDigest
      || evaluation.receipt.outcome !== "pending-approval"
      || (evaluation.proposal.action !== "buy-sol" && evaluation.proposal.action !== "sell-sol")
      || evaluation.approval.expiresAt === null
    ) throw new Error("The simulation is no longer bound to an approved active intent");

    const activeManifest = await this.#fixtures.loadActiveManifest();
    if (getGuardedFixtureManifestDigest(activeManifest) !== simulation.fixtureManifestDigest) {
      throw new Error("The active fixture binding changed after simulation");
    }
    const expiresAtMs = Math.min(
      now.getTime() + ARM_LIFETIME_MS,
      simulatedAtMs + ARM_LIFETIME_MS,
      Date.parse(evaluation.approval.expiresAt),
      Date.parse(evaluation.session.deadlineAt),
    );
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
      throw new Error("The approved intent is already expired");
    }
    const view = AgentDevnetSigningArmViewSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      simulationId: simulation.id,
      evaluationId: simulation.evaluationId,
      sessionId: simulation.sessionId,
      proposalDigest: simulation.proposalDigest,
      fixtureManifestDigest: simulation.fixtureManifestDigest,
      messageHash: simulation.messageHash,
      scope: "agent-devnet-fixture-sign-once",
      state: "active",
      executionId: null,
      oneShotSigningAuthorized: true,
      executionBridgeConnected: false,
      economicValueMapping: "none",
      marketSwapPerformed: false,
      mainnetEnabled: false,
      armedAt: now.toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      consumedAt: null,
      revokedAt: null,
    });
    const envelope = await this.#cipher.encryptString(JSON.stringify(view));
    this.#database.insertAgentDevnetSigningArm({
      id: view.id,
      simulationId: view.simulationId,
      evaluationId: view.evaluationId,
      sessionId: view.sessionId,
      proposalDigest: view.proposalDigest,
      fixtureManifestDigest: view.fixtureManifestDigest,
      messageHash: view.messageHash,
      scope: view.scope,
      state: view.state,
      executionId: null,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      executionBridgeConnected: false,
      mainnetEnabled: false,
      armedAt: view.armedAt,
      expiresAt: view.expiresAt,
      consumedAt: null,
      revokedAt: null,
    });
    return view;
  }

  async revoke(id: string): Promise<AgentDevnetSigningArmView> {
    this.#assertUnlocked();
    return this.#hydrate(this.#database.revokeAgentDevnetSigningArm(id, this.#now().toISOString()));
  }

  async list(): Promise<AgentDevnetSigningArmView[]> {
    this.#assertUnlocked();
    this.#database.getActiveAgentDevnetSigningArm(this.#now().toISOString());
    return Promise.all(this.#database.listAgentDevnetSigningArms().map((record) => this.#hydrate(record)));
  }

  #assertUnlocked(): void {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
  }

  async #hydrate(record: AgentDevnetSigningArmStorageRecord): Promise<AgentDevnetSigningArmView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Agent Devnet signing arm key is unsupported");
    const payload = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as Record<string, unknown>;
    const view = AgentDevnetSigningArmViewSchema.parse({
      ...payload,
      state: record.state,
      executionId: record.executionId,
      consumedAt: record.consumedAt,
      revokedAt: record.revokedAt,
    });
    if (
      view.id !== record.id || view.simulationId !== record.simulationId
      || view.evaluationId !== record.evaluationId || view.sessionId !== record.sessionId
      || view.proposalDigest !== record.proposalDigest
      || view.fixtureManifestDigest !== record.fixtureManifestDigest
      || view.messageHash !== record.messageHash || view.scope !== record.scope
      || view.armedAt !== record.armedAt || view.expiresAt !== record.expiresAt
    ) throw new Error("Agent Devnet signing arm metadata mismatch");
    return view;
  }
}
