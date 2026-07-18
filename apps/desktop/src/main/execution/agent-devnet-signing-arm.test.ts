import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AgentDevnetSimulationViewSchema,
  type AgentIntentEvaluationView,
} from "@silfable/contracts";

import { AgentDevnetSigningArmService } from "./agent-devnet-signing-arm";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import { RuntimeDatabase } from "../storage/database";

test("exact approved simulation creates one encrypted short-lived no-bridge signing arm", async () => {
  const fixture = await setup();
  try {
    const arm = await fixture.service().arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    });
    assert.equal(arm.state, "active");
    assert.equal(arm.expiresAt, "2026-07-18T00:01:00.000Z");
    assert.equal(arm.oneShotSigningAuthorized, true);
    assert.equal(arm.executionBridgeConnected, false);
    assert.equal(arm.economicValueMapping, "none");
    assert.equal(arm.marketSwapPerformed, false);
    assert.equal(arm.mainnetEnabled, false);
    const stored = fixture.database.getAgentDevnetSigningArm(arm.id);
    assert.ok(stored);
    assert.equal(stored.encryptedPayload.includes(arm.messageHash), false);
    await assert.rejects(() => fixture.service().arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    }), /already active/u);
    const revoked = await fixture.service().revoke(arm.id);
    assert.equal(revoked.state, "revoked");
    assert.equal(revoked.executionBridgeConnected, false);
  } finally {
    await fixture.close();
  }
});

test("message, approval, fixture, expiry, and session changes fail closed", async () => {
  const fixture = await setup();
  try {
    await assert.rejects(() => fixture.service().arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: "e".repeat(64),
    }), /exact successful/u);
    await assert.rejects(() => fixture.service({ approval: "rejected" }).arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    }), /no longer bound/u);
    await assert.rejects(() => fixture.service({ changedFixture: true }).arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    }), /fixture binding changed/u);
    await assert.rejects(() => fixture.service({ sessionState: "halted" }).arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    }), /no longer bound/u);
    await assert.rejects(() => fixture.service({ now: "2026-07-18T00:00:31.000Z" }).arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    }), /too old/u);
  } finally {
    await fixture.close();
  }
});

test("database triggers revoke an active arm when its intent is rejected", async () => {
  const fixture = await setup();
  try {
    const service = fixture.service();
    const arm = await service.arm({
      simulationId: fixture.simulation.id,
      expectedProposalDigest: fixture.simulation.proposalDigest,
      expectedMessageHash: fixture.simulation.messageHash!,
    });
    fixture.database.rejectAgentIntent({
      id: fixture.evaluation.receipt.id,
      expectedProposalDigest: fixture.evaluation.receipt.proposalDigest,
      decidedAt: "2026-07-18T00:01:00.000Z",
    });
    const [updated] = await service.list();
    assert.equal(updated?.id, arm.id);
    assert.equal(updated?.state, "revoked");
    assert.equal(updated?.revokedAt, "2026-07-18T00:01:00.000Z");
  } finally {
    await fixture.close();
  }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-signing-arm-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const manifest = manifestFixture();
  const simulation = AgentDevnetSimulationViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000501",
    evaluationId: "00000000-0000-4000-8000-000000000504",
    sessionId: "00000000-0000-4000-8000-000000000503",
    agentAction: "sell-sol",
    proposalDigest: "d".repeat(64),
    profile: "devnet-simulation",
    proofKind: "spl-transfer-checked-simulation-v1",
    outcome: "simulated",
    fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest),
    messageHash: "c".repeat(64),
    programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    unitsConsumed: "1500",
    feeLamports: "5000",
    failureCode: null,
    economicValueMapping: "none",
    marketSwapPerformed: false,
    signingAttempted: false,
    broadcastAttempted: false,
    executionAttempted: false,
    simulatedAt: "2026-07-18T00:00:00.000Z",
  });
  const evaluation = evaluationFixture(simulation);
  seed(database, evaluation, simulation);
  return {
    directory,
    database,
    simulation,
    evaluation,
    service(options: { approval?: "approved" | "rejected"; sessionState?: "active" | "halted"; changedFixture?: boolean; now?: string } = {}) {
      const activeManifest = options.changedFixture ? { ...manifest, transferAmountAtomic: "2" } : manifest;
      return new AgentDevnetSigningArmService({
        database,
        cipher,
        keystore: { isLocked: () => false },
        simulations: { async list() { return [simulation]; } },
        agents: {
          async list() {
            return { evaluations: [{
              ...evaluation,
              session: { ...evaluation.session, state: options.sessionState ?? "active" },
              approval: { ...evaluation.approval, state: options.approval ?? "approved" },
            }] as AgentIntentEvaluationView[] };
          },
        },
        fixtures: { async loadActiveManifest() { return activeManifest; } },
        now: () => new Date(options.now ?? "2026-07-18T00:00:00.000Z"),
      });
    },
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

const cipher = {
  async encryptString(plaintext: string) {
    return { ciphertext: Buffer.from(plaintext).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const };
  },
  async decryptString(input: { ciphertext: string }) {
    return Buffer.from(input.ciphertext, "base64").toString("utf8");
  },
};

function manifestFixture(): GuardedFixtureManifest {
  return {
    schemaVersion: 1,
    fixtureId: "00000000-0000-4000-8000-000000000505",
    cluster: "devnet",
    mintAddress: "So11111111111111111111111111111111111111112",
    mintDecimals: 6,
    sourceTokenAccount: "11111111111111111111111111111111",
    destinationTokenAccount: "Stake11111111111111111111111111111111111111",
    walletAuthority: "Vote111111111111111111111111111111111111111",
    destinationOwner: "BPFLoaderUpgradeab1e11111111111111111111111",
    transferAmountAtomic: "1000000",
    instructionFingerprint: "a".repeat(64),
    reviewedAt: "2026-07-18T00:00:00.000Z",
  };
}

function evaluationFixture(simulation: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>): AgentIntentEvaluationView {
  return {
    schemaVersion: 1,
    provider: "openai",
    model: "test-model",
    session: {
      schemaVersion: 1, id: simulation.sessionId, state: "active", provider: "openai",
      objective: "Protect capital with a bounded one-shot Devnet signing proof only.", venue: "jupiter-swap-v2",
      maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100,
      deadlineAt: "2026-07-18T01:00:00.000Z", haltedAt: null, haltReason: null,
      executionEnabled: false, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z",
    },
    observation: {} as AgentIntentEvaluationView["observation"],
    quote: {} as AgentIntentEvaluationView["quote"],
    proposal: {
      schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: simulation.sessionId,
      observationId: "00000000-0000-4000-8000-000000000502", quoteId: "00000000-0000-4000-8000-000000000500",
      action: "sell-sol", notionalUsdcMicros: "15000000", confidenceBps: 8000,
      rationale: "Bounded approved intent.", riskFlags: [],
    },
    receipt: {
      schemaVersion: 1, id: simulation.evaluationId, sessionId: simulation.sessionId,
      observationId: "00000000-0000-4000-8000-000000000502", proposalDigest: simulation.proposalDigest,
      outcome: "pending-approval", denialCodes: [], evaluatedAt: "2026-07-18T00:00:00.000Z",
      modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, persistedLocally: true,
    },
    approval: { state: "approved", expiresAt: "2026-07-18T00:30:00.000Z", decidedAt: "2026-07-18T00:00:00.000Z", executionEnabled: false },
  };
}

function seed(database: RuntimeDatabase, evaluation: AgentIntentEvaluationView, simulation: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>) {
  const quoteId = evaluation.proposal.quoteId;
  const observationId = evaluation.proposal.observationId;
  database.insertJupiterShadowQuote({ id: quoteId, encryptedPayload: "quote", payloadNonce: "nonce", keyId: "local-data-key-v1", allowed: true, createdAt: "2026-07-18T00:00:00.000Z" });
  database.insertMarketObservation({ id: observationId, sourceQuoteId: quoteId, observationDigest: "a".repeat(64), encryptedPayload: "observation", payloadNonce: "nonce", keyId: "local-data-key-v1", observedAt: "2026-07-18T00:00:00.000Z", capturedAt: "2026-07-18T00:00:00.000Z", expiresAt: "2026-07-18T00:10:00.000Z", modelCallsAttempted: false, signingAttempted: false, executionAttempted: false });
  database.insertAgentSession({ id: evaluation.session.id, state: "active", provider: "openai", encryptedPayload: "session", payloadNonce: "nonce", keyId: "local-data-key-v1", deadlineAt: evaluation.session.deadlineAt, haltedAt: null, haltReason: null, executionEnabled: false, createdAt: evaluation.session.createdAt, updatedAt: evaluation.session.updatedAt });
  database.insertAgentIntentEvaluation({ id: evaluation.receipt.id, sessionId: evaluation.session.id, observationId, quoteId, proposalDigest: evaluation.receipt.proposalDigest, outcome: "pending-approval", encryptedPayload: "evaluation", payloadNonce: "nonce", keyId: "local-data-key-v1", approvalState: "approved", approvalExpiresAt: evaluation.approval.expiresAt, decidedAt: evaluation.approval.decidedAt, modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, evaluatedAt: evaluation.receipt.evaluatedAt });
  database.insertAgentDevnetSimulation({ id: simulation.id, evaluationId: simulation.evaluationId, sessionId: simulation.sessionId, proposalDigest: simulation.proposalDigest, outcome: "simulated", fixtureManifestDigest: simulation.fixtureManifestDigest, messageHash: simulation.messageHash, encryptedPayload: "simulation", payloadNonce: "nonce", keyId: "local-data-key-v1", signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: simulation.simulatedAt });
}
