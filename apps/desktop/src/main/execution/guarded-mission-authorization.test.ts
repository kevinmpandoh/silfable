import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import type { DcaPlanV1, MissionView } from "@silfable/contracts";

import { NetworkHealthMonitor } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import { GuardedMissionAuthorizationService } from "./guarded-mission-authorization";
import { GuardedSchedulerReadinessService } from "./guarded-scheduler-readiness";
import { GuardedFixtureCycleProposalService } from "./guarded-fixture-cycle-proposal";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import { GuardedFixtureCycleExecutionBridge } from "./guarded-fixture-cycle-bridge";
import type { GuardedFixtureTransferChainPort, GuardedTransferPreparation } from "./guarded-fixture-transfer";
import { GuardedSchedulerArmService } from "./guarded-scheduler-arm";

class FakeCycleChain implements GuardedFixtureTransferChainPort {
  signCalls = 0;
  broadcastCalls = 0;
  throwAfterBroadcast = false;
  throwOnSign = false;
  onSimulate: (() => void | Promise<void>) | null = null;

  async prepare(_payer: KeyPairSigner, manifest: GuardedFixtureManifest): Promise<GuardedTransferPreparation> {
    const manifestDigest = getGuardedFixtureManifestDigest(manifest);
    return {
      messageHash: "e".repeat(64),
      simulationWireTransaction: "cycle-unsigned-wire",
      lastValidBlockHeight: 1000n,
      initialValidation: { allowed: true, manifestDigest, denialCodes: [], validatedAt: new Date().toISOString() },
      sign: async () => {
        this.signCalls += 1;
        if (this.throwOnSign) throw new Error("signer-failed");
        return { wireTransaction: "cycle-signed-wire", signature: "s".repeat(64) };
      },
    };
  }

  async simulate() {
    await this.onSimulate?.();
    return { unitsConsumed: 500n };
  }
  async revalidate(manifest: GuardedFixtureManifest) {
    return { allowed: true, manifestDigest: getGuardedFixtureManifestDigest(manifest), denialCodes: [], validatedAt: new Date().toISOString() };
  }
  async broadcast() {
    this.broadcastCalls += 1;
    if (this.throwAfterBroadcast) throw new Error("network-dropped");
  }
  async getSignatureStatus() { return { found: true, error: false, confirmationStatus: "confirmed" as const }; }
  async getBlockHeight() { return 900n; }
}

class MemoryKeystore {
  value: string | null = null;
  isLocked() { return false; }
  async getSecret() { return this.value; }
  async setSecret(_name: "database-data-key", value: string) { this.value = value; }
}

test("guarded authority alone cannot sign and an exact arm permits only one fixture execution", async () => {
  const fixture = await setup();
  try {
    const authorization = await fixture.service.authorize({
      missionId: fixture.mission.id,
      expectedRevision: fixture.mission.revision,
      expectedPlanDigest: fixture.mission.planDigest,
    });
    assert.equal(authorization.state, "active");
    assert.equal(authorization.missionRevision, 1);
    assert.match(authorization.deskRuleDigest, /^[a-f0-9]{64}$/u);
    assert.equal(authorization.encryptedPayload.includes(fixture.mission.planDigest), false);
    const payload = JSON.parse(await fixture.cipher.decryptString({
      ciphertext: authorization.encryptedPayload,
      nonce: authorization.payloadNonce,
      keyId: "local-data-key-v1",
    })) as { schedulerSigningEnabled: boolean; mainnetEnabled: boolean; deskRuleDigest: string };
    assert.equal(payload.schedulerSigningEnabled, false);
    assert.equal(payload.mainnetEnabled, false);
    assert.equal(payload.deskRuleDigest, authorization.deskRuleDigest);
    const health = new NetworkHealthMonitor({ probeHealth: async () => ({ latencyMs: 1 }) });
    await health.checkNow();
    const readiness = new GuardedSchedulerReadinessService({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
    });
    const schedulerArm = await armScheduler(fixture, authorization.id);
    const evaluation = await readiness.evaluate({ ...fixture.mission, state: "running" }, 1);
    assert.equal(evaluation.outcome, "ready");
    assert.equal(evaluation.executionEnabled, false);
    assert.equal(evaluation.signingAttempted, false);
    assert.equal(fixture.database.getGuardedSchedulerEvaluation(fixture.mission.id, 1, 1)?.outcome, "ready");
    const proposal = await new GuardedFixtureCycleProposalService({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
      fixtureReview: { loadActiveManifest: async () => fixture.manifest },
    }).prepare({ ...fixture.mission, state: "running" }, 1);
    assert.equal(proposal.proposalKind, "spl-transfer-checked-cycle-v1");
    assert.equal(proposal.marketSwapPerformed, false);
    assert.equal(proposal.economicValueMapping, "none");
    assert.equal(proposal.executionEnabled, false);
    assert.notEqual(proposal.fixtureAmountAtomic, proposal.authorizedDcaAmountAtomic);
    assert.equal(proposal.readinessEvaluationId, evaluation.evaluationId);
    assert.equal(proposal.schedulerArmId, schedulerArm.id);
    const chain = new FakeCycleChain();
    const execution = await new GuardedFixtureCycleExecutionBridge({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
      wallet: { withWalletSigner: async (operation) => operation(fixture.wallet) },
      fixtureReview: { loadActiveManifest: async () => fixture.manifest },
      missions: { get: async () => ({ ...fixture.mission, state: "running" }) },
      chain,
      confirmationTimeoutMs: 20,
      confirmationPollMs: 1,
    }).execute(proposal);
    assert.equal(execution.state, "receipted");
    assert.equal(chain.signCalls, 1);
    assert.equal(chain.broadcastCalls, 1);
    assert.equal(execution.signingAttempted, true);
    assert.equal(execution.broadcastAttempted, true);
    assert.equal(fixture.database.listGuardedExecutions(20)[0]?.state, "receipted");
    assert.deepEqual(
      fixture.database.listGuardedExecutionEvents(execution.id).map((event) => event.eventName),
      ["proposal-created", "validation-passed", "simulation-passed", "signed", "broadcast-attempted", "confirmed", "receipt-stored"],
    );
    assert.equal(fixture.database.getGuardedSchedulerArm(schedulerArm.id)?.state, "consumed");
    await assert.rejects(new GuardedFixtureCycleExecutionBridge({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
      wallet: { withWalletSigner: async (operation) => operation(fixture.wallet) },
      fixtureReview: { loadActiveManifest: async () => fixture.manifest },
      missions: { get: async () => ({ ...fixture.mission, state: "running" }) },
      chain,
    }).execute(proposal), /authority binding changed/u);
    assert.equal(chain.signCalls, 1);
    assert.equal(chain.broadcastCalls, 1);
    assert.equal(fixture.database.revokeOpenGuardedSchedulerArms(new Date().toISOString()), 1);
    assert.equal(fixture.database.getGuardedSchedulerArm(schedulerArm.id)?.state, "revoked");
    health.stop();
    await assert.rejects(fixture.service.authorize({
      missionId: fixture.mission.id,
      expectedRevision: 1,
      expectedPlanDigest: fixture.mission.planDigest,
    }), /already active/u);
    const revoked = fixture.service.revoke(authorization.id);
    assert.equal(revoked.state, "revoked");
    assert.ok(revoked.revokedAt);
  } finally {
    await fixture.close();
  }
});

test("digest conflicts fail closed and editing the mission revision automatically revokes authority", async () => {
  const fixture = await setup();
  try {
    await assert.rejects(fixture.service.authorize({
      missionId: fixture.mission.id,
      expectedRevision: 1,
      expectedPlanDigest: "f".repeat(64),
    }), /revision conflict/u);
    const authorization = await fixture.service.authorize({
      missionId: fixture.mission.id,
      expectedRevision: 1,
      expectedPlanDigest: fixture.mission.planDigest,
    });
    fixture.database.saveMissionDraft({
      id: fixture.mission.id,
      expectedRevision: 1,
      encryptedPlan: "new-encrypted-plan",
      now: new Date().toISOString(),
    });
    assert.equal(fixture.database.getActiveGuardedMissionAuthorization(), null);
    const history = fixture.database.listGuardedMissionAuthorizations();
    assert.equal(history[0]?.id, authorization.id);
    assert.equal(history[0]?.state, "revoked");
    assert.ok(history[0]?.revokedAt);
  } finally {
    await fixture.close();
  }
});

test("authority revoked after simulation prevents signing and broadcast", async () => {
  const fixture = await setup();
  const runtime = await prepareBridgeFixture(fixture);
  try {
    runtime.chain.onSimulate = () => {
      const active = fixture.database.getActiveGuardedMissionAuthorization();
      assert.ok(active);
      fixture.service.revoke(active.id);
    };
    const execution = await runtime.bridge.execute(runtime.proposal);
    assert.equal(execution.state, "failed");
    assert.equal(runtime.chain.signCalls, 0);
    assert.equal(runtime.chain.broadcastCalls, 0);
  } finally {
    runtime.health.stop();
    await fixture.close();
  }
});

test("guarded readiness stays simulation-only without an explicit scheduler arm", async () => {
  const fixture = await setup();
  try {
    await fixture.service.authorize({
      missionId: fixture.mission.id,
      expectedRevision: fixture.mission.revision,
      expectedPlanDigest: fixture.mission.planDigest,
    });
    const health = new NetworkHealthMonitor({ probeHealth: async () => ({ latencyMs: 1 }) });
    await health.checkNow();
    const evaluation = await new GuardedSchedulerReadinessService({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
    }).evaluate({ ...fixture.mission, state: "running" }, 1);
    assert.equal(evaluation.outcome, "inactive");
    assert.equal(evaluation.reasonCode, "scheduler-not-armed");
    await assert.rejects(new GuardedFixtureCycleProposalService({
      database: fixture.database,
      cipher: fixture.cipher,
      keystore: fixture.keystore,
      health,
      fixtureReview: { loadActiveManifest: async () => fixture.manifest },
    }).prepare({ ...fixture.mission, state: "running" }, 1), /ready guarded scheduler evaluation/u);
    health.stop();
  } finally {
    await fixture.close();
  }
});

test("revoking only the scheduler arm during simulation blocks signing", async () => {
  const fixture = await setup();
  const runtime = await prepareBridgeFixture(fixture);
  try {
    runtime.chain.onSimulate = () => {
      fixture.database.revokeGuardedSchedulerArm(runtime.proposal.schedulerArmId, new Date().toISOString());
    };
    const execution = await runtime.bridge.execute(runtime.proposal);
    assert.equal(execution.state, "failed");
    assert.equal(runtime.chain.signCalls, 0);
    assert.equal(runtime.chain.broadcastCalls, 0);
    assert.ok(fixture.database.getActiveGuardedMissionAuthorization());
  } finally {
    runtime.health.stop();
    await fixture.close();
  }
});

test("a pre-broadcast signing failure revokes the consumed arm", async () => {
  const fixture = await setup();
  const runtime = await prepareBridgeFixture(fixture);
  try {
    runtime.chain.throwOnSign = true;
    const execution = await runtime.bridge.execute(runtime.proposal);
    assert.equal(execution.state, "failed");
    assert.equal(execution.broadcastAttempted, false);
    assert.equal(runtime.chain.broadcastCalls, 0);
    assert.equal(fixture.database.getGuardedSchedulerArm(runtime.proposal.schedulerArmId)?.state, "revoked");
  } finally {
    runtime.health.stop();
    await fixture.close();
  }
});

test("post-broadcast uncertainty reconciles by signature without rebroadcast", async () => {
  const fixture = await setup();
  const runtime = await prepareBridgeFixture(fixture);
  try {
    runtime.chain.throwAfterBroadcast = true;
    const uncertain = await runtime.bridge.execute(runtime.proposal);
    assert.equal(uncertain.state, "ambiguous");
    assert.equal(runtime.chain.broadcastCalls, 1);
    fixture.database.revokeOpenGuardedSchedulerArms(new Date().toISOString());
    await assert.rejects(
      armScheduler(fixture, runtime.proposal.authorizationId),
      /unresolved guarded execution/u,
    );
    await runtime.bridge.reconcilePending();
    assert.equal(fixture.database.getGuardedExecution(runtime.proposal.id)?.state, "receipted");
    assert.equal(runtime.chain.broadcastCalls, 1);
  } finally {
    runtime.health.stop();
    await fixture.close();
  }
});

async function prepareBridgeFixture(fixture: Awaited<ReturnType<typeof setup>>) {
  const authorization = await fixture.service.authorize({
    missionId: fixture.mission.id,
    expectedRevision: fixture.mission.revision,
    expectedPlanDigest: fixture.mission.planDigest,
  });
  const health = new NetworkHealthMonitor({ probeHealth: async () => ({ latencyMs: 1 }) });
  await health.checkNow();
  await armScheduler(fixture, authorization.id);
  await new GuardedSchedulerReadinessService({
    database: fixture.database,
    cipher: fixture.cipher,
    keystore: fixture.keystore,
    health,
  }).evaluate({ ...fixture.mission, state: "running" }, 1);
  const proposal = await new GuardedFixtureCycleProposalService({
    database: fixture.database,
    cipher: fixture.cipher,
    keystore: fixture.keystore,
    health,
    fixtureReview: { loadActiveManifest: async () => fixture.manifest },
  }).prepare({ ...fixture.mission, state: "running" }, 1);
  const chain = new FakeCycleChain();
  const bridge = new GuardedFixtureCycleExecutionBridge({
    database: fixture.database,
    cipher: fixture.cipher,
    keystore: fixture.keystore,
    health,
    wallet: { withWalletSigner: async (operation) => operation(fixture.wallet) },
    fixtureReview: { loadActiveManifest: async () => fixture.manifest },
    missions: { get: async () => ({ ...fixture.mission, state: "running" }) },
    chain,
    confirmationTimeoutMs: 20,
    confirmationPollMs: 1,
  });
  return { bridge, chain, health, proposal };
}

async function armScheduler(fixture: Awaited<ReturnType<typeof setup>>, authorizationId: string) {
  return new GuardedSchedulerArmService({
    database: fixture.database,
    cipher: fixture.cipher,
    keystore: fixture.keystore,
  }).arm({
    authorizationId,
    acknowledgedAutomaticSigning: true,
    acknowledgedHotWallet: true,
    acknowledgedDevnetFixtureOnly: true,
  });
}

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-authority-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const keystore = new MemoryKeystore();
  const cipher = new LocalDataCipher(keystore);
  const [wallet, mint, source, destination, destinationOwner] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const missionId = "00000000-0000-4000-8000-000000000901";
  const provisionId = "00000000-0000-4000-8000-000000000902";
  const transferId = "00000000-0000-4000-8000-000000000903";
  const planDigest = "b".repeat(64);
  const now = new Date().toISOString();
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1,
    fixtureId: provisionId,
    cluster: "devnet",
    mintAddress: mint.address,
    mintDecimals: 6,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: wallet.address,
    destinationOwner: destinationOwner.address,
    transferAmountAtomic: "1000000",
    instructionFingerprint: "a".repeat(64),
    reviewedAt: now,
  };
  const manifestDigest = getGuardedFixtureManifestDigest(manifest);
  database.saveMissionDraft({ id: missionId, encryptedPlan: "encrypted-plan", now });
  database.authorizeMission({ id: missionId, expectedRevision: 1, encryptedRules: "encrypted-rules", authorizedAt: now });
  database.createFixtureProvision({
    id: provisionId,
    mintAddress: mint.address,
    messageHash: "c".repeat(64),
    lastValidBlockHeight: "1000",
    now,
  });
  database.insertFixtureReview({
    provisionId,
    manifestDigest,
    mintAddress: mint.address,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: wallet.address,
    destinationOwner: destinationOwner.address,
    observedSlot: "1",
    encryptedPayload: "encrypted-review",
    payloadNonce: "review-nonce",
    keyId: "local-data-key-v1",
    active: true,
    createdAt: now,
  });
  let transfer = database.createGuardedFixtureTransfer({
    id: transferId,
    fixtureManifestDigest: manifestDigest,
    messageHash: "d".repeat(64),
    lastValidBlockHeight: "1000",
    now,
  });
  transfer = database.updateGuardedFixtureTransfer({ id: transfer.id, expectedState: "proposed", state: "simulated", simulationUnits: "500", now });
  transfer = database.updateGuardedFixtureTransfer({
    id: transfer.id,
    expectedState: "simulated",
    state: "signed",
    encryptedPayload: "encrypted-transfer",
    payloadNonce: "transfer-nonce",
    keyId: "local-data-key-v1",
    signingAttempted: true,
    now,
  });
  transfer = database.updateGuardedFixtureTransfer({ id: transfer.id, expectedState: "signed", state: "broadcast", broadcastAttempted: true, now });
  database.updateGuardedFixtureTransfer({ id: transfer.id, expectedState: "broadcast", state: "confirmed", now });
  const approvalEnvelope = await cipher.encryptString(JSON.stringify({
    schemaVersion: 1,
    transferId,
    manifestDigest,
    approvedAt: now,
    automaticTradingEnabled: false,
  }));
  database.insertGuardedFixtureTransferApproval({
    transferId,
    fixtureManifestDigest: manifestDigest,
    encryptedPayload: approvalEnvelope.ciphertext,
    payloadNonce: approvalEnvelope.nonce,
    keyId: approvalEnvelope.keyId,
    approvedAt: now,
  });
  const plan: DcaPlanV1 = {
    schemaVersion: 1,
    id: missionId,
    profile: "devnet-simulation",
    inputMint: "11111111111111111111111111111111",
    outputMint: "22222222222222222222222222222222",
    amountPerCycleAtomic: "100000000",
    intervalSeconds: 3600,
    startAt: now,
    maxCycles: 12,
    maxSlippageBps: 100,
    maxPriceImpactBps: 50,
    maxFeeLamports: "5000",
    dailySpendLimitAtomic: "1200000000",
    minimumWalletReserveAtomic: "500000000",
    missedCyclePolicy: "skip",
    failurePolicy: "halt",
  };
  const mission: MissionView = {
    schemaVersion: 1,
    id: missionId,
    state: "authorized",
    revision: 1,
    planDigest,
    plan,
    authorizedAt: now,
    haltReason: null,
    completedCycles: 0,
    updatedAt: now,
  };
  const service = new GuardedMissionAuthorizationService({
    database,
    cipher,
    keystore,
    missions: { get: async () => mission },
  });
  return {
    database,
    cipher,
    keystore,
    service,
    mission,
    manifest,
    wallet,
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
