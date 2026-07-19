import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AgentDevnetSwapBuildViewSchema, type AgentIntentEvaluationView } from "@silfable/contracts";

import { AgentDevnetSwapSigningArmService } from "./agent-devnet-swap-signing-arm";
import { RuntimeDatabase, type AgentDevnetSwapSigningArmStorageRecord } from "../storage/database";

test("exact economic balance proof creates one short-lived no-bridge signing arm", async () => {
  const fixture = setup(); const service = fixture.service();
  const arm = await service.arm(expected());
  assert.equal(arm.state, "active"); assert.equal(arm.expiresAt, "2026-07-19T00:00:15.000Z");
  assert.equal(arm.oneShotSigningAuthorized, true); assert.equal(arm.signingBridgeConnected, false);
  assert.equal(arm.signingAttempted, false); assert.equal(arm.broadcastAttempted, false);
  assert.ok(fixture.database.record); assert.equal(fixture.database.record.encryptedPayload.includes(arm.messageHash), false);
  await assert.rejects(() => service.arm(expected()), /already active/u);
  const revoked = await service.revoke(arm.id); assert.equal(revoked.state, "revoked");
});

test("mutated proof, stale build, network loss, and approval change fail closed", async () => {
  await assert.rejects(() => setup().service().arm({ ...expected(), expectedOutputAmountDelta: "1" }), /exact successful/u);
  await assert.rejects(() => setup().service({ now: "2026-07-19T00:00:16.000Z" }).arm(expected()), /too old/u);
  await assert.rejects(() => setup().service({ healthy: false }).arm(expected()), /network is not healthy/u);
  await assert.rejects(() => setup().service({ approved: false }).arm(expected()), /no longer bound/u);
});

test("database trigger revokes an economic signing arm when approval is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-economic-arm-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const approved = evaluation(true);
  try {
    seed(database, approved);
    const service = new AgentDevnetSwapSigningArmService({ database, cipher, keystore: { isLocked: () => false },
      health: { isHealthyFresh: () => true }, builds: { async list() { return [build]; } },
      agents: { async list() { return { evaluations: [approved] }; } }, now: () => new Date("2026-07-19T00:00:10.000Z") });
    const arm = await service.arm(expected());
    database.rejectAgentIntent({ id: approved.receipt.id, expectedProposalDigest: approved.receipt.proposalDigest,
      decidedAt: "2026-07-19T00:00:11.000Z" });
    const [revoked] = await service.list();
    assert.equal(revoked?.id, arm.id); assert.equal(revoked?.state, "revoked");
    assert.equal(revoked?.revokedAt, "2026-07-19T00:00:11.000Z");
    await assert.rejects(() => service.arm(expected()), /approval changed before signing authority commit/u);
  } finally { database.close(); await rm(directory, { recursive: true, force: true }); }
});

function setup() {
  const database = new FakeDatabase();
  const service = (options: { now?: string; healthy?: boolean; approved?: boolean } = {}) => new AgentDevnetSwapSigningArmService({
    database: database as unknown as RuntimeDatabase, cipher, keystore: { isLocked: () => false },
    health: { isHealthyFresh: () => options.healthy ?? true }, builds: { async list() { return [build]; } },
    agents: { async list() { return { evaluations: [evaluation(options.approved ?? true)] }; } },
    now: () => new Date(options.now ?? "2026-07-19T00:00:10.000Z"),
  });
  return { database, service };
}
const build = AgentDevnetSwapBuildViewSchema.parse({ schemaVersion: 1, id: "00000000-0000-4000-8000-000000000b01",
  quoteId: "00000000-0000-4000-8000-000000000b02", evaluationId: "00000000-0000-4000-8000-000000000b03",
  sessionId: "00000000-0000-4000-8000-000000000b04", action: "sell-sol", state: "simulated", failureCode: null,
  messageHash: "a".repeat(64), programIds: ["DRaybByLpbUL57LJARs3j8BitTxVfzBg351EaMr5UTCd"], inputAmount: "1000000",
  minimumOutputAmount: "90000", feeLamports: "5000", unitsConsumed: "2000",
  outputTokenAccount: "E7iCLAZw5ikohzbsNycEtEHFtYVguc1ByojNHL7suUPX", preOutputAmount: "0", postOutputAmount: "92717",
  outputAmountDelta: "92717", walletLamportsDelta: "1005000", preContextSlot: "100", simulationContextSlot: "101",
  associatedTokenAccountVerified: true, balanceDeltaVerified: true, exactAmountBound: true, transactionBuilt: true,
  simulationAttempted: true, signingAttempted: false, broadcastAttempted: false, marketSwapPerformed: false,
  mainnetEnabled: false, builtAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T00:00:20.000Z" });
function expected() { return { buildId: build.id, expectedMessageHash: build.messageHash!,
  expectedOutputTokenAccount: build.outputTokenAccount, expectedOutputAmountDelta: build.outputAmountDelta! }; }
function evaluation(approved: boolean): AgentIntentEvaluationView { return { schemaVersion: 1, provider: "openai", model: "test",
  session: { schemaVersion: 1, id: build.sessionId, state: "active", provider: "openai", objective: "Bounded Devnet sell.",
    venue: "jupiter-swap-v2", maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100,
    deadlineAt: "2026-07-19T01:00:00.000Z", haltedAt: null, haltReason: null, executionEnabled: false,
    createdAt: build.builtAt, updatedAt: build.builtAt }, observation: {} as AgentIntentEvaluationView["observation"],
  quote: {} as AgentIntentEvaluationView["quote"], proposal: { schemaVersion: 1, intentType: "restricted-agent-intent",
    sessionId: build.sessionId, observationId: "00000000-0000-4000-8000-000000000b05",
    quoteId: "00000000-0000-4000-8000-000000000b06", action: "sell-sol", notionalUsdcMicros: "1000000",
    confidenceBps: 8000, rationale: "Bounded", riskFlags: [] }, receipt: { schemaVersion: 1, id: build.evaluationId,
    sessionId: build.sessionId, observationId: "00000000-0000-4000-8000-000000000b05", proposalDigest: "b".repeat(64),
    outcome: "pending-approval", denialCodes: [], evaluatedAt: build.builtAt, modelCallsAttempted: true,
    signingAttempted: false, executionAttempted: false, persistedLocally: true }, approval: { state: approved ? "approved" : "rejected",
    expiresAt: approved ? "2026-07-19T00:30:00.000Z" : null, decidedAt: build.builtAt, executionEnabled: false } }; }
class FakeDatabase { record: AgentDevnetSwapSigningArmStorageRecord | null = null;
  getActiveAgentDevnetSwapSigningArm() { return this.record?.state === "active" ? this.record : null; }
  insertAgentDevnetSwapSigningArm(record: AgentDevnetSwapSigningArmStorageRecord) { this.record = record; }
  revokeAgentDevnetSwapSigningArm(id: string, revokedAt: string) { if (this.record?.id !== id || this.record.state !== "active") throw new Error("not active");
    this.record = { ...this.record, state: "revoked", revokedAt }; return this.record; }
  listAgentDevnetSwapSigningArms() { return this.record ? [this.record] : []; } }
const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; },
  async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };

function seed(database: RuntimeDatabase, approved: AgentIntentEvaluationView) {
  const quoteId = approved.proposal.quoteId; const observationId = approved.proposal.observationId; const createdAt = build.builtAt;
  database.insertJupiterShadowQuote({ id: quoteId, encryptedPayload: "quote", payloadNonce: "nonce", keyId: "local-data-key-v1", allowed: true, createdAt });
  database.insertMarketObservation({ id: observationId, sourceQuoteId: quoteId, observationDigest: "c".repeat(64),
    encryptedPayload: "observation", payloadNonce: "nonce", keyId: "local-data-key-v1", observedAt: createdAt,
    capturedAt: createdAt, expiresAt: "2026-07-19T00:10:00.000Z", modelCallsAttempted: false, signingAttempted: false, executionAttempted: false });
  database.insertAgentSession({ id: approved.session.id, state: "active", provider: "openai", encryptedPayload: "session",
    payloadNonce: "nonce", keyId: "local-data-key-v1", deadlineAt: approved.session.deadlineAt, haltedAt: null, haltReason: null,
    executionEnabled: false, createdAt, updatedAt: createdAt });
  database.insertAgentIntentEvaluation({ id: approved.receipt.id, sessionId: approved.session.id, observationId, quoteId,
    proposalDigest: approved.receipt.proposalDigest, outcome: "pending-approval", encryptedPayload: "evaluation", payloadNonce: "nonce",
    keyId: "local-data-key-v1", approvalState: "approved", approvalExpiresAt: approved.approval.expiresAt, decidedAt: createdAt,
    modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, evaluatedAt: createdAt });
  database.insertAgentDevnetSwapQuote({ id: build.quoteId, evaluationId: build.evaluationId, sessionId: build.sessionId,
    action: "sell-sol", allowed: true, encryptedPayload: "swap-quote", payloadNonce: "nonce", keyId: "local-data-key-v1",
    quotedAt: createdAt, expiresAt: build.expiresAt });
  database.insertAgentDevnetSwapBuild({ id: build.id, quoteId: build.quoteId, evaluationId: build.evaluationId,
    sessionId: build.sessionId, state: "simulated", messageHash: build.messageHash, encryptedPayload: "swap-build",
    payloadNonce: "nonce", keyId: "local-data-key-v1", transactionBuilt: true, simulationAttempted: true,
    builtAt: build.builtAt, expiresAt: build.expiresAt });
}
