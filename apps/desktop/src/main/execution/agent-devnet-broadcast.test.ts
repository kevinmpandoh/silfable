import assert from "node:assert/strict";
import test from "node:test";

import { AgentDevnetSignedExecutionViewSchema, AgentDevnetSimulationViewSchema, type AgentIntentEvaluationView } from "@silfable/contracts";

import { AgentDevnetBroadcastService, SolanaAgentDevnetBroadcastAdapter } from "./agent-devnet-broadcast";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import type { AgentDevnetBroadcastExecutionStorageRecord, RuntimeDatabase } from "../storage/database";

test("default broadcast adapter requires the RPC signature to match", async () => {
  let sends = 0;
  const adapter = new SolanaAgentDevnetBroadcastAdapter({ async sendTransaction() { sends += 1; return "expected"; } } as never);
  await adapter.broadcast("signed-wire", "expected");
  assert.equal(sends, 1);
  const mismatch = new SolanaAgentDevnetBroadcastAdapter({ async sendTransaction() { return "other"; } } as never);
  await assert.rejects(() => mismatch.broadcast("signed-wire", "expected"), /signature-mismatch/u);
});

test("broadcast marker precedes one send and confirmed receipt remains a no-market fixture", async () => {
  const f = fixture(); let sends = 0;
  const service = f.service({ async broadcast() { assert.equal(f.database.record?.state, "broadcast"); sends += 1; },
    async getSignatureStatus() { return { found: true, error: false, confirmationStatus: "confirmed" as const }; } });
  const result = await service.broadcast(f.signed.view.id, f.signed.view.messageHash, f.signed.view.signatureHash!);
  assert.equal(result.state, "confirmed"); assert.equal(result.broadcastAttempted, true);
  assert.equal(result.fixtureTransferPerformed, true); assert.equal(result.marketSwapPerformed, false);
  assert.equal(result.mainnetEnabled, false); assert.equal(sends, 1);
  await assert.rejects(() => service.broadcast(f.signed.view.id, f.signed.view.messageHash, f.signed.view.signatureHash!), /already has/u);
  assert.equal(sends, 1);
});

test("unknown send result becomes ambiguous and restart reconciliation never resends", async () => {
  const f = fixture(); let sends = 0; let confirmed = false;
  const service = f.service({ async broadcast() { sends += 1; throw new Error("rpc response lost"); },
    async getSignatureStatus() { return confirmed
      ? { found: true, error: false, confirmationStatus: "confirmed" as const }
      : { found: false, error: false, confirmationStatus: null }; } });
  const result = await service.broadcast(f.signed.view.id, f.signed.view.messageHash, f.signed.view.signatureHash!);
  assert.equal(result.state, "ambiguous"); assert.equal(result.failureCode, "broadcast-status-unknown"); assert.equal(sends, 1);
  confirmed = true; await service.reconcilePending();
  assert.equal(f.database.record?.state, "confirmed"); assert.equal(f.database.record?.fixtureTransferPerformed, true);
  assert.equal(sends, 1);
});

test("network denial and restart before marker fail without sending", async () => {
  const offline = fixture(); let sends = 0;
  const denied = await offline.service({ healthy: false, async broadcast() { sends += 1; } })
    .broadcast(offline.signed.view.id, offline.signed.view.messageHash, offline.signed.view.signatureHash!);
  assert.equal(denied.state, "failed"); assert.equal(denied.failureCode, "network-unhealthy");
  assert.equal(denied.broadcastAttempted, false); assert.equal(sends, 0);

  const restart = fixture();
  restart.database.insertAgentDevnetBroadcastExecution(restart.proposedRecord());
  await restart.service().reconcilePending();
  assert.equal(restart.database.record?.state, "failed");
  assert.equal(restart.database.record?.failureCode, "restart-before-broadcast");
});

function fixture() {
  const database = new FakeDatabase();
  const manifest: GuardedFixtureManifest = { schemaVersion: 1, fixtureId: "00000000-0000-4000-8000-000000000805",
    cluster: "devnet", mintAddress: "So11111111111111111111111111111111111111112", mintDecimals: 6,
    sourceTokenAccount: "11111111111111111111111111111111", destinationTokenAccount: "Stake11111111111111111111111111111111111111",
    walletAuthority: "BPFLoaderUpgradeab1e11111111111111111111111", destinationOwner: "11111111111111111111111111111111",
    transferAmountAtomic: "1000000", instructionFingerprint: "a".repeat(64), reviewedAt: "2026-07-19T00:00:00.000Z" };
  const simulationView = AgentDevnetSimulationViewSchema.parse({ schemaVersion: 1, id: "00000000-0000-4000-8000-000000000801",
    evaluationId: "00000000-0000-4000-8000-000000000804", sessionId: "00000000-0000-4000-8000-000000000803",
    agentAction: "sell-sol", proposalDigest: "d".repeat(64), profile: "devnet-simulation",
    proofKind: "spl-transfer-checked-simulation-v1", outcome: "simulated", fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest),
    messageHash: "c".repeat(64), programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"], unitsConsumed: "1",
    feeLamports: "5000", failureCode: null, economicValueMapping: "none", marketSwapPerformed: false,
    signingAttempted: false, broadcastAttempted: false, executionAttempted: false, simulatedAt: "2026-07-19T00:00:00.000Z" });
  const signed = { view: AgentDevnetSignedExecutionViewSchema.parse({ schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000808", preSignExecutionId: "00000000-0000-4000-8000-000000000807",
    signingArmId: "00000000-0000-4000-8000-000000000806", simulationId: simulationView.id,
    evaluationId: simulationView.evaluationId, sessionId: simulationView.sessionId, messageHash: simulationView.messageHash,
    state: "signed-awaiting-broadcast", signatureHash: "b".repeat(64), failureCode: null, signingAttempted: true,
    broadcastAttempted: false, executionAttempted: false, marketSwapPerformed: false, mainnetEnabled: false,
    createdAt: "2026-07-19T00:00:10.000Z", updatedAt: "2026-07-19T00:00:10.000Z" }), signedWire: "wire", signature: "signature" };
  const simulation = { view: simulationView, fixtureManifestDigest: simulationView.fixtureManifestDigest,
    messageHash: simulationView.messageHash!, simulationWireTransaction: "wire", programIds: simulationView.programIds,
    unitsConsumed: 1n, feeLamports: 5000n, initialContextSlot: "1", finalContextSlot: "2", lastValidBlockHeight: 1000n };
  const evaluation = { session: { id: simulationView.sessionId, state: "active" }, approval: { state: "approved",
    expiresAt: "2026-07-19T01:00:00.000Z" }, receipt: { id: simulationView.evaluationId,
    proposalDigest: simulationView.proposalDigest } } as AgentIntentEvaluationView;
  const service = (options: { healthy?: boolean; broadcast?: () => Promise<void>; getSignatureStatus?: () => Promise<{ found: boolean; error: boolean; confirmationStatus: "processed" | "confirmed" | "finalized" | null }> } = {}) =>
    new AgentDevnetBroadcastService({ database: database as unknown as RuntimeDatabase, cipher, keystore: { isLocked: () => false },
      health: { isHealthyFresh: () => options.healthy ?? true }, fixtures: { async loadActiveManifest() { return manifest; } },
      agents: { async list() { return { evaluations: [evaluation] }; } }, simulations: { async loadExactEvidence() { return simulation; } },
      signing: { async loadExactSignedEvidence() { return signed; } }, chain: { async revalidate() { return true; },
        async getBlockHeight() { return 999n; }, async broadcast() { await options.broadcast?.(); },
        async getSignatureStatus() { return options.getSignatureStatus?.() ?? { found: false, error: false, confirmationStatus: null }; } },
      now: () => new Date("2026-07-19T00:00:20.000Z"), confirmationTimeoutMs: 2, confirmationPollMs: 1 });
  const proposedRecord = (): AgentDevnetBroadcastExecutionStorageRecord => {
    const view = { schemaVersion: 1, id: "00000000-0000-4000-8000-000000000809", signedExecutionId: signed.view.id,
      preSignExecutionId: signed.view.preSignExecutionId, simulationId: signed.view.simulationId, evaluationId: signed.view.evaluationId,
      sessionId: signed.view.sessionId, messageHash: signed.view.messageHash, signatureHash: signed.view.signatureHash!, state: "proposed" as const,
      failureCode: null, broadcastAttempted: false, executionAttempted: false, fixtureTransferPerformed: false,
      economicValueMapping: "none" as const, marketSwapPerformed: false as const, mainnetEnabled: false as const,
      createdAt: "2026-07-19T00:00:20.000Z", updatedAt: "2026-07-19T00:00:20.000Z" };
    return { ...view, lastValidBlockHeight: "1000", encryptedPayload: Buffer.from(JSON.stringify(view)).toString("base64"),
      payloadNonce: "nonce", keyId: "local-data-key-v1" };
  };
  return { database, signed, service, proposedRecord };
}

class FakeDatabase {
  record: AgentDevnetBroadcastExecutionStorageRecord | null = null;
  getAgentDevnetBroadcastExecutionBySigned() { return this.record; }
  insertAgentDevnetBroadcastExecution(record: AgentDevnetBroadcastExecutionStorageRecord) { this.record = record; }
  transitionAgentDevnetBroadcastExecution(input: { id: string; expectedState: AgentDevnetBroadcastExecutionStorageRecord["state"];
    state: AgentDevnetBroadcastExecutionStorageRecord["state"]; failureCode?: string | null; encryptedPayload: string;
    payloadNonce: string; keyId: string; broadcastAttempted: boolean; executionAttempted: boolean;
    fixtureTransferPerformed: boolean; updatedAt: string }) {
    if (this.record === null || this.record.id !== input.id || this.record.state !== input.expectedState) throw new Error("transition conflict");
    this.record = { ...this.record, ...input, failureCode: input.failureCode ?? null }; return this.record;
  }
  listAgentDevnetBroadcastExecutions() { return this.record === null ? [] : [this.record]; }
  listPendingAgentDevnetBroadcastExecutions() { return this.record !== null && ["proposed", "broadcast", "ambiguous"].includes(this.record.state) ? [this.record] : []; }
}
const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; },
  async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };
