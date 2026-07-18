import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getTransferSolInstruction } from "@solana-program/system";
import { appendTransactionMessageInstruction, blockhash, compileTransaction, createTransactionMessage, generateKeyPairSigner, getBase64EncodedWireTransaction, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash } from "@solana/kit";
import { AgentDevnetBroadcastExecutionViewSchema, AgentDevnetPreSignExecutionViewSchema, AgentDevnetSignedExecutionViewSchema, AgentDevnetSimulationViewSchema, type AgentIntentEvaluationView } from "@silfable/contracts";

import { AgentDevnetSigningService, SolanaAgentDevnetSigningAdapter } from "./agent-devnet-signing";
import { getTransactionMessageHash } from "./spl-fixture";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import { RuntimeDatabase } from "../storage/database";

test("default adapter signs the exact decoded message without broadcasting", async () => {
  const signer = await generateKeyPairSigner();
  const message = pipe(createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayerSigner(signer, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 100n }, value),
    (value) => appendTransactionMessageInstruction(getTransferSolInstruction({ source: signer, destination: signer.address, amount: 0 }), value));
  const transaction = compileTransaction(message);
  const hash = getTransactionMessageHash(transaction);
  const adapter = new SolanaAgentDevnetSigningAdapter({} as never);
  const signed = await adapter.signExact(signer, getBase64EncodedWireTransaction(transaction), hash);
  assert.ok(signed.signature.length > 20);
  assert.notEqual(signed.signedWire, getBase64EncodedWireTransaction(transaction));
  await assert.rejects(() => adapter.signExact(signer, getBase64EncodedWireTransaction(transaction), "a".repeat(64)), /hash changed/u);
});

test("ready receipt signs once, stores wire encrypted, and never broadcasts", async () => {
  const f = await setup();
  try {
    let signCalls = 0;
    const service = f.service({ onSign: () => { signCalls += 1; } });
    const result = await service.sign(f.preSign.id, f.preSign.messageHash);
    assert.equal(result.state, "signed-awaiting-broadcast");
    assert.equal(result.signingAttempted, true);
    assert.equal(result.broadcastAttempted, false);
    assert.ok(result.signatureHash);
    assert.equal(signCalls, 1);
    const stored = f.database.getAgentDevnetSignedExecutionByPreSign(f.preSign.id);
    assert.ok(stored);
    assert.equal(stored.encryptedPayload.includes("signed-secret-wire"), false);
    await assert.rejects(() => service.sign(f.preSign.id, f.preSign.messageHash), /already has/u);
    assert.equal(signCalls, 1);
  } finally { await f.close(); }
});

test("network and approval races fail closed with no broadcast", async () => {
  const offline = await setup();
  try {
    const result = await offline.service({ healthy: false }).sign(offline.preSign.id, offline.preSign.messageHash);
    assert.equal(result.state, "failed"); assert.equal(result.failureCode, "network-unhealthy");
    assert.equal(result.signingAttempted, false); assert.equal(result.broadcastAttempted, false);
  } finally { await offline.close(); }
  const race = await setup();
  try {
    let approved = true; let calls = 0;
    const result = await race.service({ isApproved: () => approved, beforeWallet: () => { approved = false; }, onSign: () => { calls += 1; } }).sign(race.preSign.id, race.preSign.messageHash);
    assert.equal(result.state, "failed"); assert.equal(result.failureCode, "binding-changed");
    assert.equal(result.signingAttempted, true); assert.equal(calls, 0); assert.equal(result.broadcastAttempted, false);
  } finally { await race.close(); }
});

test("restart fails an unfinished signing journal without retrying the signer", async () => {
  const f = await setup();
  try {
    const view = AgentDevnetSignedExecutionViewSchema.parse({ schemaVersion: 1,
      id: "00000000-0000-4000-8000-000000000708", preSignExecutionId: f.preSign.id,
      signingArmId: f.preSign.signingArmId, simulationId: f.preSign.simulationId,
      evaluationId: f.preSign.evaluationId, sessionId: f.preSign.sessionId,
      messageHash: f.preSign.messageHash, state: "proposed", signatureHash: null,
      failureCode: null, signingAttempted: false, broadcastAttempted: false,
      executionAttempted: false, marketSwapPerformed: false, mainnetEnabled: false,
      createdAt: "2026-07-19T00:00:20.000Z", updatedAt: "2026-07-19T00:00:20.000Z" });
    const envelope = await cipher.encryptString(JSON.stringify(view));
    f.database.insertAgentDevnetSignedExecution({ ...view, encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce, keyId: envelope.keyId });
    assert.equal(f.database.failOpenAgentDevnetSignedExecutions("2026-07-19T00:00:21.000Z"), 1);
    const [recovered] = await f.service().list();
    assert.equal(recovered?.state, "failed");
    assert.equal(recovered?.failureCode, "restart-before-sign-complete");
    assert.equal(recovered?.signingAttempted, false);
    assert.equal(recovered?.broadcastAttempted, false);
  } finally { await f.close(); }
});

test("database commits a broadcast marker only while the bound approval is current", async () => {
  const f = await setup();
  try {
    const signed = await f.service().sign(f.preSign.id, f.preSign.messageHash);
    const view = AgentDevnetBroadcastExecutionViewSchema.parse({ schemaVersion: 1,
      id: "00000000-0000-4000-8000-000000000709", signedExecutionId: signed.id,
      preSignExecutionId: f.preSign.id, simulationId: f.simulation.id, evaluationId: f.simulation.evaluationId,
      sessionId: f.simulation.sessionId, messageHash: f.preSign.messageHash, signatureHash: signed.signatureHash,
      state: "proposed", failureCode: null, broadcastAttempted: false, executionAttempted: false,
      fixtureTransferPerformed: false, economicValueMapping: "none", marketSwapPerformed: false,
      mainnetEnabled: false, createdAt: "2026-07-19T00:00:20.000Z", updatedAt: "2026-07-19T00:00:20.000Z" });
    const envelope = await cipher.encryptString(JSON.stringify(view));
    f.database.insertAgentDevnetBroadcastExecution({ ...view, lastValidBlockHeight: "1000",
      encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId });
    const marked = f.database.transitionAgentDevnetBroadcastExecution({ id: view.id, expectedState: "proposed",
      state: "broadcast", encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
      broadcastAttempted: true, executionAttempted: true, fixtureTransferPerformed: false,
      updatedAt: "2026-07-19T00:00:21.000Z", requireCurrentAuthorization: true });
    assert.equal(marked.state, "broadcast"); assert.equal(marked.broadcastAttempted, true);
  } finally { await f.close(); }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-sign-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const signer = await generateKeyPairSigner();
  const manifest: GuardedFixtureManifest = { schemaVersion: 1, fixtureId: "00000000-0000-4000-8000-000000000705", cluster: "devnet", mintAddress: "So11111111111111111111111111111111111111112", mintDecimals: 6, sourceTokenAccount: "11111111111111111111111111111111", destinationTokenAccount: "Stake11111111111111111111111111111111111111", walletAuthority: signer.address, destinationOwner: "BPFLoaderUpgradeab1e11111111111111111111111", transferAmountAtomic: "1000000", instructionFingerprint: "a".repeat(64), reviewedAt: "2026-07-19T00:00:00.000Z" };
  const simulation = AgentDevnetSimulationViewSchema.parse({ schemaVersion: 1, id: "00000000-0000-4000-8000-000000000701", evaluationId: "00000000-0000-4000-8000-000000000704", sessionId: "00000000-0000-4000-8000-000000000703", agentAction: "sell-sol", proposalDigest: "d".repeat(64), profile: "devnet-simulation", proofKind: "spl-transfer-checked-simulation-v1", outcome: "simulated", fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest), messageHash: "c".repeat(64), programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"], unitsConsumed: "1500", feeLamports: "5000", failureCode: null, economicValueMapping: "none", marketSwapPerformed: false, signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: "2026-07-19T00:00:00.000Z" });
  const preSign = AgentDevnetPreSignExecutionViewSchema.parse({ schemaVersion: 1, id: "00000000-0000-4000-8000-000000000707", signingArmId: "00000000-0000-4000-8000-000000000706", simulationId: simulation.id, evaluationId: simulation.evaluationId, sessionId: simulation.sessionId, proposalDigest: simulation.proposalDigest, fixtureManifestDigest: simulation.fixtureManifestDigest, messageHash: simulation.messageHash, state: "ready-for-signing", failureCode: null, signingArmConsumed: true, exactMessageRevalidated: true, executionBridgeConnected: false, signingAttempted: false, broadcastAttempted: false, executionAttempted: false, marketSwapPerformed: false, mainnetEnabled: false, preparedAt: "2026-07-19T00:00:10.000Z" });
  const evaluation = evaluationFixture(simulation); seed(database, evaluation, simulation, preSign);
  return { database, signer, simulation, preSign, service(options: { healthy?: boolean; isApproved?: () => boolean; beforeWallet?: () => void; onSign?: () => void } = {}) { return new AgentDevnetSigningService({ database, cipher, keystore: { isLocked: () => false }, health: { isHealthyFresh: () => options.healthy ?? true }, wallet: { async withWalletSigner(operation) { options.beforeWallet?.(); return operation(signer); } }, fixtures: { async loadActiveManifest() { return manifest; } }, agents: { async list() { return { evaluations: [{ ...evaluation, approval: { ...evaluation.approval, state: (options.isApproved?.() ?? true) ? "approved" as const : "rejected" as const } }] }; } }, simulations: { async loadExactEvidence() { return { view: simulation, fixtureManifestDigest: simulation.fixtureManifestDigest, messageHash: simulation.messageHash!, simulationWireTransaction: "exact-wire", programIds: simulation.programIds, unitsConsumed: 1500n, feeLamports: 5000n, initialContextSlot: "1", finalContextSlot: "2", lastValidBlockHeight: 1000n }; } }, preSigns: { async list() { return [preSign]; } }, adapter: { async revalidate() { return true; }, async getBlockHeight() { return 999n; }, async signExact() { options.onSign?.(); return { signedWire: "signed-secret-wire", signature: "signature-secret" }; } }, now: () => new Date("2026-07-19T00:00:20.000Z") }); }, async close() { database.close(); await rm(directory, { recursive: true, force: true }); } };
}

const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; }, async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };
function evaluationFixture(sim: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>): AgentIntentEvaluationView { return { schemaVersion: 1, provider: "openai", model: "test", session: { schemaVersion: 1, id: sim.sessionId, state: "active", provider: "openai", objective: "Bounded exact Devnet fixture signature only with no broadcast.", venue: "jupiter-swap-v2", maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100, deadlineAt: "2026-07-19T01:00:00.000Z", haltedAt: null, haltReason: null, executionEnabled: false, createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }, observation: {} as AgentIntentEvaluationView["observation"], quote: {} as AgentIntentEvaluationView["quote"], proposal: { schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: sim.sessionId, observationId: "00000000-0000-4000-8000-000000000702", quoteId: "00000000-0000-4000-8000-000000000700", action: "sell-sol", notionalUsdcMicros: "1", confidenceBps: 8000, rationale: "Bounded", riskFlags: [] }, receipt: { schemaVersion: 1, id: sim.evaluationId, sessionId: sim.sessionId, observationId: "00000000-0000-4000-8000-000000000702", proposalDigest: sim.proposalDigest, outcome: "pending-approval", denialCodes: [], evaluatedAt: "2026-07-19T00:00:00.000Z", modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, persistedLocally: true }, approval: { state: "approved", expiresAt: "2026-07-19T00:30:00.000Z", decidedAt: "2026-07-19T00:00:00.000Z", executionEnabled: false } }; }
function seed(db: RuntimeDatabase, e: AgentIntentEvaluationView, s: ReturnType<typeof AgentDevnetSimulationViewSchema.parse>, p: ReturnType<typeof AgentDevnetPreSignExecutionViewSchema.parse>) { db.insertJupiterShadowQuote({ id: e.proposal.quoteId, encryptedPayload: "q", payloadNonce: "n", keyId: "local-data-key-v1", allowed: true, createdAt: e.receipt.evaluatedAt }); db.insertMarketObservation({ id: e.proposal.observationId, sourceQuoteId: e.proposal.quoteId, observationDigest: "a".repeat(64), encryptedPayload: "o", payloadNonce: "n", keyId: "local-data-key-v1", observedAt: e.receipt.evaluatedAt, capturedAt: e.receipt.evaluatedAt, expiresAt: "2026-07-19T00:10:00.000Z", modelCallsAttempted: false, signingAttempted: false, executionAttempted: false }); db.insertAgentSession({ id: e.session.id, state: "active", provider: "openai", encryptedPayload: "s", payloadNonce: "n", keyId: "local-data-key-v1", deadlineAt: e.session.deadlineAt, haltedAt: null, haltReason: null, executionEnabled: false, createdAt: e.session.createdAt, updatedAt: e.session.updatedAt }); db.insertAgentIntentEvaluation({ id: e.receipt.id, sessionId: e.session.id, observationId: e.proposal.observationId, quoteId: e.proposal.quoteId, proposalDigest: e.receipt.proposalDigest, outcome: "pending-approval", encryptedPayload: "e", payloadNonce: "n", keyId: "local-data-key-v1", approvalState: "approved", approvalExpiresAt: e.approval.expiresAt, decidedAt: e.approval.decidedAt, modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, evaluatedAt: e.receipt.evaluatedAt }); db.insertAgentDevnetSimulation({ id: s.id, evaluationId: s.evaluationId, sessionId: s.sessionId, proposalDigest: s.proposalDigest, outcome: "simulated", fixtureManifestDigest: s.fixtureManifestDigest, messageHash: s.messageHash, encryptedPayload: "sim", payloadNonce: "n", keyId: "local-data-key-v1", signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: s.simulatedAt }); db.insertAgentDevnetSigningArm({ id: p.signingArmId, simulationId: p.simulationId, evaluationId: p.evaluationId, sessionId: p.sessionId, proposalDigest: p.proposalDigest, fixtureManifestDigest: p.fixtureManifestDigest, messageHash: p.messageHash, scope: "agent-devnet-fixture-sign-once", state: "active", executionId: null, encryptedPayload: "arm", payloadNonce: "n", keyId: "local-data-key-v1", executionBridgeConnected: false, mainnetEnabled: false, armedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T00:01:00.000Z", consumedAt: null, revokedAt: null }); db.consumeAgentDevnetSigningArmAndCreateExecution({ id: p.id, signingArmId: p.signingArmId, simulationId: p.simulationId, evaluationId: p.evaluationId, sessionId: p.sessionId, proposalDigest: p.proposalDigest, fixtureManifestDigest: p.fixtureManifestDigest, messageHash: p.messageHash, state: "ready-for-signing", failureCode: null, encryptedPayload: "pre", payloadNonce: "n", keyId: "local-data-key-v1", signingAttempted: false, broadcastAttempted: false, executionAttempted: false, preparedAt: p.preparedAt }); }
