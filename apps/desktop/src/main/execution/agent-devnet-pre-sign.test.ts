import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AgentDevnetSigningArmViewSchema, AgentDevnetSimulationViewSchema, type AgentIntentEvaluationView } from "@silfable/contracts";
import { AgentDevnetPreSignService } from "./agent-devnet-pre-sign";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import { RuntimeDatabase } from "../storage/database";

test("exact revalidation atomically consumes one arm and records encrypted pre-sign evidence", async () => {
  const f = await setup();
  try {
    const service = f.service();
    const result = await service.prepare(f.arm.id, f.arm.messageHash);
    assert.equal(result.state, "ready-for-signing", JSON.stringify(result));
    assert.equal(result.signingArmConsumed, true);
    assert.equal(result.exactMessageRevalidated, true);
    assert.equal(result.executionBridgeConnected, false);
    assert.equal(result.signingAttempted, false);
    const arm = f.database.getAgentDevnetSigningArm(f.arm.id);
    assert.equal(arm?.state, "consumed");
    assert.equal(arm?.executionId, result.id);
    const stored = f.database.listAgentDevnetPreSignExecutions()[0];
    assert.ok(stored);
    assert.equal(stored.encryptedPayload.includes("exact-secret-wire"), false);
    await assert.rejects(() => service.prepare(f.arm.id, f.arm.messageHash), /active signing arm/u);
    assert.equal(f.database.listAgentDevnetPreSignExecutions().length, 1);
  } finally { await f.close(); }
});

test("network, expiry, blockhash, and post-RPC approval races fail without consuming the arm", async () => {
  const f = await setup();
  try {
    let calls = 0;
    const offline = await f.service({ healthy: false, onSimulate: () => { calls += 1; } }).prepare(f.arm.id, f.arm.messageHash);
    assert.equal(offline.failureCode, "network-unhealthy");
    assert.equal(calls, 0);
    assert.equal(f.database.getAgentDevnetSigningArm(f.arm.id)?.state, "active");

    const expiredBlockhash = await f.service({ blockHeight: 1_001n }).prepare(f.arm.id, f.arm.messageHash);
    assert.equal(expiredBlockhash.failureCode, "blockhash-expired");
    assert.equal(f.database.getAgentDevnetSigningArm(f.arm.id)?.state, "active");

    let approved = true;
    const race = await f.service({
      isApproved: () => approved,
      onSimulate: () => { approved = false; },
    }).prepare(f.arm.id, f.arm.messageHash);
    assert.equal(race.failureCode, "binding-changed");
    assert.equal(race.signingArmConsumed, false);
    assert.equal(f.database.getAgentDevnetSigningArm(f.arm.id)?.state, "active");
  } finally { await f.close(); }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-pre-sign-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1, fixtureId: "00000000-0000-4000-8000-000000000605", cluster: "devnet",
    mintAddress: "So11111111111111111111111111111111111111112", mintDecimals: 6,
    sourceTokenAccount: "11111111111111111111111111111111",
    destinationTokenAccount: "Stake11111111111111111111111111111111111111",
    walletAuthority: "Vote111111111111111111111111111111111111111",
    destinationOwner: "BPFLoaderUpgradeab1e11111111111111111111111", transferAmountAtomic: "1000000",
    instructionFingerprint: "a".repeat(64), reviewedAt: "2026-07-18T00:00:00.000Z",
  };
  const simulation = AgentDevnetSimulationViewSchema.parse({
    schemaVersion: 1, id: "00000000-0000-4000-8000-000000000601",
    evaluationId: "00000000-0000-4000-8000-000000000604", sessionId: "00000000-0000-4000-8000-000000000603",
    agentAction: "sell-sol", proposalDigest: "d".repeat(64), profile: "devnet-simulation",
    proofKind: "spl-transfer-checked-simulation-v1", outcome: "simulated",
    fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest), messageHash: "c".repeat(64),
    programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"], unitsConsumed: "1500", feeLamports: "5000",
    failureCode: null, economicValueMapping: "none", marketSwapPerformed: false,
    signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: "2026-07-18T00:00:00.000Z",
  });
  const arm = AgentDevnetSigningArmViewSchema.parse({
    schemaVersion: 1, id: "00000000-0000-4000-8000-000000000606", simulationId: simulation.id,
    evaluationId: simulation.evaluationId, sessionId: simulation.sessionId, proposalDigest: simulation.proposalDigest,
    fixtureManifestDigest: simulation.fixtureManifestDigest, messageHash: simulation.messageHash,
    scope: "agent-devnet-fixture-sign-once", state: "active", executionId: null,
    oneShotSigningAuthorized: true, executionBridgeConnected: false, economicValueMapping: "none",
    marketSwapPerformed: false, mainnetEnabled: false, armedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-18T00:01:00.000Z", consumedAt: null, revokedAt: null,
  });
  const evaluation = evaluationFixture(simulation);
  seed(database, evaluation, simulation, arm);
  return {
    database, simulation, arm,
    service(options: { healthy?: boolean; blockHeight?: bigint; isApproved?: () => boolean; onSimulate?: () => void } = {}) {
      return new AgentDevnetPreSignService({
        database, cipher, keystore: { isLocked: () => false }, health: { isHealthyFresh: () => options.healthy ?? true },
        fixtures: { async loadActiveManifest() { return manifest; } },
        agents: { async list() { return { evaluations: [{
          ...evaluation,
          approval: { ...evaluation.approval, state: (options.isApproved?.() ?? true) ? "approved" as const : "rejected" as const },
        }] }; } },
        simulations: { async loadExactEvidence() { return { view: simulation, fixtureManifestDigest: simulation.fixtureManifestDigest, messageHash: simulation.messageHash!, simulationWireTransaction: "exact-secret-wire", programIds: simulation.programIds, unitsConsumed: 1500n, feeLamports: 5000n, initialContextSlot: "1", finalContextSlot: "2", lastValidBlockHeight: 1000n }; } },
        arms: { async list() { const stored = database.getAgentDevnetSigningArm(arm.id); return stored === null ? [] : [{ ...arm, state: stored.state, executionId: stored.executionId, consumedAt: stored.consumedAt, revokedAt: stored.revokedAt }]; } },
        adapter: { async revalidate() { return true; }, async simulateExact() { options.onSimulate?.(); return { error: false, unitsConsumed: 1600n, fee: 5000n }; }, async getBlockHeight() { return options.blockHeight ?? 999n; } },
        now: () => new Date("2026-07-18T00:00:10.000Z"),
      });
    },
    async close() { database.close(); await rm(directory, { recursive: true, force: true }); },
  };
}

const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; }, async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };

function evaluationFixture(sim: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>): AgentIntentEvaluationView {
  return { schemaVersion: 1, provider: "openai", model: "test", session: { schemaVersion: 1, id: sim.sessionId, state: "active", provider: "openai", objective: "Bounded exact-message pre-sign fixture validation only.", venue: "jupiter-swap-v2", maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100, deadlineAt: "2026-07-18T01:00:00.000Z", haltedAt: null, haltReason: null, executionEnabled: false, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z" }, observation: {} as AgentIntentEvaluationView["observation"], quote: {} as AgentIntentEvaluationView["quote"], proposal: { schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: sim.sessionId, observationId: "00000000-0000-4000-8000-000000000602", quoteId: "00000000-0000-4000-8000-000000000600", action: "sell-sol", notionalUsdcMicros: "15000000", confidenceBps: 8000, rationale: "Bounded intent", riskFlags: [] }, receipt: { schemaVersion: 1, id: sim.evaluationId, sessionId: sim.sessionId, observationId: "00000000-0000-4000-8000-000000000602", proposalDigest: sim.proposalDigest, outcome: "pending-approval", denialCodes: [], evaluatedAt: "2026-07-18T00:00:00.000Z", modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, persistedLocally: true }, approval: { state: "approved", expiresAt: "2026-07-18T00:30:00.000Z", decidedAt: "2026-07-18T00:00:00.000Z", executionEnabled: false } };
}

function seed(db: RuntimeDatabase, e: AgentIntentEvaluationView, s: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>, arm: ReturnType<typeof AgentDevnetSigningArmViewSchema.parse>) {
  db.insertJupiterShadowQuote({ id: e.proposal.quoteId, encryptedPayload: "q", payloadNonce: "n", keyId: "local-data-key-v1", allowed: true, createdAt: e.receipt.evaluatedAt });
  db.insertMarketObservation({ id: e.proposal.observationId, sourceQuoteId: e.proposal.quoteId, observationDigest: "a".repeat(64), encryptedPayload: "o", payloadNonce: "n", keyId: "local-data-key-v1", observedAt: e.receipt.evaluatedAt, capturedAt: e.receipt.evaluatedAt, expiresAt: "2026-07-18T00:10:00.000Z", modelCallsAttempted: false, signingAttempted: false, executionAttempted: false });
  db.insertAgentSession({ id: e.session.id, state: "active", provider: "openai", encryptedPayload: "s", payloadNonce: "n", keyId: "local-data-key-v1", deadlineAt: e.session.deadlineAt, haltedAt: null, haltReason: null, executionEnabled: false, createdAt: e.session.createdAt, updatedAt: e.session.updatedAt });
  db.insertAgentIntentEvaluation({ id: e.receipt.id, sessionId: e.session.id, observationId: e.proposal.observationId, quoteId: e.proposal.quoteId, proposalDigest: e.receipt.proposalDigest, outcome: "pending-approval", encryptedPayload: "e", payloadNonce: "n", keyId: "local-data-key-v1", approvalState: "approved", approvalExpiresAt: e.approval.expiresAt, decidedAt: e.approval.decidedAt, modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, evaluatedAt: e.receipt.evaluatedAt });
  db.insertAgentDevnetSimulation({ id: s.id, evaluationId: s.evaluationId, sessionId: s.sessionId, proposalDigest: s.proposalDigest, outcome: "simulated", fixtureManifestDigest: s.fixtureManifestDigest, messageHash: s.messageHash, encryptedPayload: "sim", payloadNonce: "n", keyId: "local-data-key-v1", signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: s.simulatedAt });
  db.insertAgentDevnetSigningArm({ id: arm.id, simulationId: arm.simulationId, evaluationId: arm.evaluationId, sessionId: arm.sessionId, proposalDigest: arm.proposalDigest, fixtureManifestDigest: arm.fixtureManifestDigest, messageHash: arm.messageHash, scope: arm.scope, state: "active", executionId: null, encryptedPayload: "arm", payloadNonce: "n", keyId: "local-data-key-v1", executionBridgeConnected: false, mainnetEnabled: false, armedAt: arm.armedAt, expiresAt: arm.expiresAt, consumedAt: null, revokedAt: null });
}
