import { randomUUID } from "node:crypto";

import {
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  AgentDevnetSimulationViewSchema,
  type AgentDevnetSimulationView,
  type AgentIntentEvaluationView,
} from "@silfable/contracts";

import type { DevnetFixtureRpcPort, DevnetTransactionRpcPort } from "../rpc/devnet.js";
import {
  RuntimeDatabase,
  type AgentDevnetSimulationStorageRecord,
} from "../storage/database.js";
import {
  getGuardedFixtureManifestDigest,
  observeGuardedFixture,
  validateGuardedFixtureProvenance,
  type GuardedFixtureManifest,
} from "./fixture-provenance.js";
import { buildGuardedSplTransferFixture, getTransactionMessageHash } from "./spl-fixture.js";

const MAX_SIMULATION_FEE_LAMPORTS = 20_000n;

type SimulationCipher = {
  encryptString(plaintext: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};
type KeystoreState = { isLocked(): boolean };
type HealthState = { isHealthyFresh(): boolean };
type FixtureSource = { loadActiveManifest(): Promise<GuardedFixtureManifest> };
type AgentSource = { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };

export type AgentDevnetSimulationEvidence = {
  fixtureManifestDigest: string;
  messageHash: string;
  simulationWireTransaction: string;
  programIds: string[];
  unitsConsumed: bigint;
  feeLamports: bigint;
  initialContextSlot: string;
  finalContextSlot: string;
  lastValidBlockHeight: bigint;
};

export type AgentDevnetSimulationAdapter = {
  simulate(manifest: GuardedFixtureManifest): Promise<AgentDevnetSimulationEvidence>;
};

export class SolanaAgentDevnetSimulationAdapter implements AgentDevnetSimulationAdapter {
  readonly #rpc: DevnetTransactionRpcPort & DevnetFixtureRpcPort;

  constructor(rpc: DevnetTransactionRpcPort & DevnetFixtureRpcPort) {
    this.#rpc = rpc;
  }

  async simulate(manifest: GuardedFixtureManifest): Promise<AgentDevnetSimulationEvidence> {
    const fixture = buildGuardedSplTransferFixture({
      source: manifest.sourceTokenAccount,
      mint: manifest.mintAddress,
      destination: manifest.destinationTokenAccount,
      authority: address(manifest.walletAuthority),
      amount: BigInt(manifest.transferAmountAtomic),
      decimals: manifest.mintDecimals,
    });
    const initial = await observeGuardedFixture(this.#rpc, manifest, new Date());
    const initialValidation = validateGuardedFixtureProvenance({ manifest, observation: initial, instruction: fixture, now: new Date() });
    if (!initialValidation.allowed) throw new Error("agent-devnet-provenance-denied");
    const lifetime = await this.#rpc.getLatestBlockhash();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayer(address(manifest.walletAuthority), value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({
        blockhash: blockhash(lifetime.blockhash),
        lastValidBlockHeight: lifetime.lastValidBlockHeight,
      }, value),
      (value) => appendTransactionMessageInstruction(fixture.instruction, value),
    );
    const transaction = compileTransaction(message);
    const messageHash = getTransactionMessageHash(transaction);
    const simulationWireTransaction = getBase64EncodedWireTransaction(transaction);
    const simulation = await this.#rpc.simulateTransaction(simulationWireTransaction);
    if (simulation.error) throw new Error("agent-devnet-simulation-failed");
    if (simulation.fee === null || simulation.fee > MAX_SIMULATION_FEE_LAMPORTS) {
      throw new Error("agent-devnet-fee-exceeded");
    }
    const finalObservation = await observeGuardedFixture(this.#rpc, manifest, new Date());
    const finalValidation = validateGuardedFixtureProvenance({
      manifest,
      observation: finalObservation,
      instruction: fixture,
      now: new Date(),
    });
    if (!finalValidation.allowed || finalValidation.manifestDigest !== initialValidation.manifestDigest) {
      throw new Error("agent-devnet-provenance-denied");
    }
    return {
      fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest),
      messageHash,
      simulationWireTransaction,
      programIds: fixture.programIds,
      unitsConsumed: simulation.unitsConsumed ?? 0n,
      feeLamports: simulation.fee,
      initialContextSlot: initial.contextSlot,
      finalContextSlot: finalObservation.contextSlot,
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
    };
  }
}

export class AgentDevnetSimulationService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: SimulationCipher;
  readonly #keystore: KeystoreState;
  readonly #health: HealthState;
  readonly #fixtures: FixtureSource;
  readonly #agents: AgentSource;
  readonly #adapter: AgentDevnetSimulationAdapter;
  readonly #now: () => Date;
  #running = false;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: SimulationCipher;
    keystore: KeystoreState;
    health: HealthState;
    fixtures: FixtureSource;
    agents: AgentSource;
    adapter: AgentDevnetSimulationAdapter;
    now?: () => Date;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#health = input.health;
    this.#fixtures = input.fixtures;
    this.#agents = input.agents;
    this.#adapter = input.adapter;
    this.#now = input.now ?? (() => new Date());
  }

  async simulate(evaluationId: string, expectedProposalDigest: string): Promise<AgentDevnetSimulationView> {
    if (this.#running) throw new Error("Agent Devnet simulation is already active");
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    if (this.#database.getAgentDevnetSimulationByEvaluation(evaluationId) !== null) {
      throw new Error("Agent intent already has a Devnet simulation proof");
    }
    const evaluation = await this.#resolveApproved(evaluationId, expectedProposalDigest);
    const manifest = await this.#fixtures.loadActiveManifest();
    const fixtureManifestDigest = getGuardedFixtureManifestDigest(manifest);
    this.#running = true;
    try {
      let evidence: AgentDevnetSimulationEvidence | null = null;
      let failureCode: AgentDevnetSimulationView["failureCode"] = null;
      try {
        evidence = await this.#adapter.simulate(manifest);
      } catch (error) {
        failureCode = classifyFailure(error);
      }
      if (evidence !== null) {
        try {
          const activeManifest = await this.#fixtures.loadActiveManifest();
          if (getGuardedFixtureManifestDigest(activeManifest) !== fixtureManifestDigest) {
            evidence = null;
            failureCode = "binding-changed";
          }
        } catch {
          evidence = null;
          failureCode = "binding-changed";
        }
      }
      const current = await this.#resolveApprovedOrNull(evaluationId, expectedProposalDigest);
      if (current === null || current.session.id !== evaluation.session.id) {
        evidence = null;
        failureCode = "binding-changed";
      }
      const simulatedAt = this.#now().toISOString();
      const view = AgentDevnetSimulationViewSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        evaluationId: evaluation.receipt.id,
        sessionId: evaluation.session.id,
        agentAction: evaluation.proposal.action,
        proposalDigest: evaluation.receipt.proposalDigest,
        profile: "devnet-simulation",
        proofKind: "spl-transfer-checked-simulation-v1",
        outcome: evidence === null ? "failed" : "simulated",
        fixtureManifestDigest,
        messageHash: evidence?.messageHash ?? null,
        programIds: evidence?.programIds ?? [],
        unitsConsumed: evidence?.unitsConsumed.toString() ?? null,
        feeLamports: evidence?.feeLamports.toString() ?? null,
        failureCode: evidence === null ? failureCode ?? "simulation-failed" : null,
        economicValueMapping: "none",
        marketSwapPerformed: false,
        signingAttempted: false,
        broadcastAttempted: false,
        executionAttempted: false,
        simulatedAt,
      });
      const envelope = await this.#cipher.encryptString(JSON.stringify({
        ...view,
        simulationWireTransaction: evidence?.simulationWireTransaction ?? null,
        initialContextSlot: evidence?.initialContextSlot ?? null,
        finalContextSlot: evidence?.finalContextSlot ?? null,
        lastValidBlockHeight: evidence?.lastValidBlockHeight.toString() ?? null,
      }));
      this.#database.insertAgentDevnetSimulation({
        id: view.id,
        evaluationId: view.evaluationId,
        sessionId: view.sessionId,
        proposalDigest: view.proposalDigest,
        outcome: view.outcome,
        fixtureManifestDigest: view.fixtureManifestDigest,
        messageHash: view.messageHash,
        encryptedPayload: envelope.ciphertext,
        payloadNonce: envelope.nonce,
        keyId: envelope.keyId,
        signingAttempted: false,
        broadcastAttempted: false,
        executionAttempted: false,
        simulatedAt: view.simulatedAt,
      });
      return view;
    } finally {
      this.#running = false;
    }
  }

  async list(): Promise<AgentDevnetSimulationView[]> {
    return Promise.all(this.#database.listAgentDevnetSimulations().map((record) => this.#hydrate(record)));
  }

  async #resolveApproved(id: string, digest: string): Promise<AgentIntentEvaluationView> {
    const evaluation = await this.#resolveApprovedOrNull(id, digest);
    if (evaluation === null) throw new Error("Exact approved agent intent is required");
    return evaluation;
  }

  async #resolveApprovedOrNull(id: string, digest: string): Promise<AgentIntentEvaluationView | null> {
    const evaluation = (await this.#agents.list()).evaluations.find((candidate) => candidate.receipt.id === id);
    if (
      evaluation === undefined || evaluation.receipt.proposalDigest !== digest
      || evaluation.receipt.outcome !== "pending-approval" || evaluation.approval.state !== "approved"
      || evaluation.session.state !== "active"
      || (evaluation.proposal.action !== "buy-sol" && evaluation.proposal.action !== "sell-sol")
    ) return null;
    return evaluation;
  }

  async #hydrate(record: AgentDevnetSimulationStorageRecord): Promise<AgentDevnetSimulationView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Agent Devnet simulation key is unsupported");
    const payload = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as Record<string, unknown>;
    const view = AgentDevnetSimulationViewSchema.parse({
      schemaVersion: payload.schemaVersion,
      id: payload.id,
      evaluationId: payload.evaluationId,
      sessionId: payload.sessionId,
      agentAction: payload.agentAction,
      proposalDigest: payload.proposalDigest,
      profile: payload.profile,
      proofKind: payload.proofKind,
      outcome: payload.outcome,
      fixtureManifestDigest: payload.fixtureManifestDigest,
      messageHash: payload.messageHash,
      programIds: payload.programIds,
      unitsConsumed: payload.unitsConsumed,
      feeLamports: payload.feeLamports,
      failureCode: payload.failureCode,
      economicValueMapping: payload.economicValueMapping,
      marketSwapPerformed: payload.marketSwapPerformed,
      signingAttempted: payload.signingAttempted,
      broadcastAttempted: payload.broadcastAttempted,
      executionAttempted: payload.executionAttempted,
      simulatedAt: payload.simulatedAt,
    });
    if (
      view.id !== record.id || view.evaluationId !== record.evaluationId
      || view.sessionId !== record.sessionId || view.proposalDigest !== record.proposalDigest
      || view.outcome !== record.outcome || view.fixtureManifestDigest !== record.fixtureManifestDigest
      || view.messageHash !== record.messageHash || view.simulatedAt !== record.simulatedAt
    ) throw new Error("Agent Devnet simulation metadata mismatch");
    return view;
  }
}

function classifyFailure(error: unknown): AgentDevnetSimulationView["failureCode"] {
  const message = error instanceof Error ? error.message : "";
  if (/provenance/u.test(message)) return "provenance-denied";
  if (/fee/u.test(message)) return "fee-exceeded";
  return "simulation-failed";
}
