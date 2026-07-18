import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { DcaPlanV1, GuardedFixtureCycleProposal } from "@silfable/contracts";

import { DevnetWalletRpcService, NetworkHealthMonitor, type DevnetRpcPort } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import {
  MissionService,
  MissionSimulationScheduler,
  SIMULATION_MINTS,
  type MissionRuntimeEvent,
} from "./service";

class MemoryDataKeyStore {
  locked = false;
  dataKey: string | null = null;

  isLocked() {
    return this.locked;
  }

  async getSecret() {
    if (this.locked) throw new Error("locked");
    return this.dataKey;
  }

  async setSecret(_name: "database-data-key", plaintext: string) {
    if (this.locked) throw new Error("locked");
    this.dataKey = plaintext;
  }
}

class FakeRpc implements DevnetRpcPort {
  async probeHealth() {
    return { latencyMs: 10 };
  }

  async getBalance() {
    return 10_000_000_000n;
  }

  async requestAirdrop() {
    return "5".repeat(88);
  }
}

class DeferredBalanceRpc extends FakeRpc {
  balanceCalls = 0;
  releaseBalance: (() => void) | null = null;

  override async getBalance() {
    this.balanceCalls += 1;
    await new Promise<void>((resolve) => { this.releaseBalance = resolve; });
    return 10_000_000_000n;
  }
}

function plan(id: string): DcaPlanV1 {
  return {
    schemaVersion: 1,
    id,
    profile: "devnet-simulation",
    inputMint: SIMULATION_MINTS.input,
    outputMint: SIMULATION_MINTS.output,
    amountPerCycleAtomic: "100000000",
    intervalSeconds: 3_600,
    startAt: new Date(Date.now() - 1_000).toISOString(),
    maxCycles: 2,
    maxSlippageBps: 100,
    maxPriceImpactBps: 50,
    maxFeeLamports: "5000",
    dailySpendLimitAtomic: "1000000000",
    minimumWalletReserveAtomic: "1000000000",
    missedCyclePolicy: "skip",
    failurePolicy: "halt",
  };
}

test("authorized mission records one simulation receipt without signing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-mission-test-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    database.insertWallet({
      id: "wallet-test",
      profileId: "devnet-simulation",
      ciphertext: "encrypted",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: new Date().toISOString(),
    });
    const keyStore = new MemoryDataKeyStore();
    const cipher = new LocalDataCipher(keyStore);
    const rpc = new FakeRpc();
    const health = new NetworkHealthMonitor(rpc);
    await health.checkNow();
    const missions = new MissionService({ database, cipher, keystore: keyStore, health });
    const id = "1f397753-2d70-4c18-8ea6-e0bc1e1e557b";

    const draft = await missions.saveDraft({ plan: plan(id) });
    await assert.rejects(
      missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: "0".repeat(64) }),
      /digest conflict/u,
    );
    const authorized = await missions.authorize({
      missionId: id,
      expectedRevision: 1,
      expectedPlanDigest: draft.planDigest,
    });
    assert.equal(authorized.state, "authorized");
    assert.equal((await missions.start(id, 1)).state, "running");
    await assert.rejects(missions.saveDraft({ plan: plan(id), expectedRevision: 1 }), /cannot be edited/u);

    const walletRpc = new DevnetWalletRpcService({
      rpc,
      health,
      getWalletAddress: async () => "11111111111111111111111111111111",
    });
    const events: MissionRuntimeEvent[] = [];
    const scheduler = new MissionSimulationScheduler({
      database,
      missions,
      cipher,
      health,
      keystore: keyStore,
      walletRpc,
      onEvent: (event) => events.push(event),
    });
    await scheduler.tick();

    const [afterCycle] = await missions.list();
    assert.ok(afterCycle);
    assert.equal(afterCycle.completedCycles, 1);
    assert.equal(afterCycle.state, "running");
    assert.equal(database.getDailyRiskCounter(id, new Date().toISOString().slice(0, 10)).spentAtomic, "100000000");
    const audit = await missions.getAudit(id);
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.state, "receipted");
    assert.equal(audit[0]?.receipt?.signingAttempted, false);
    assert.equal(events[0]?.type, "receipted");

    await missions.halt(id, 1);
    const revisionTwo = await missions.saveDraft({
      plan: { ...plan(id), amountPerCycleAtomic: "200000000" },
      expectedRevision: 1,
    });
    assert.equal(revisionTwo.revision, 2);
    assert.equal(revisionTwo.completedCycles, 0);
    await missions.authorize({ missionId: id, expectedRevision: 2, expectedPlanDigest: revisionTwo.planDigest });
    await missions.start(id, 2);
    await scheduler.tick();
    const auditAcrossRevisions = await missions.getAudit(id);
    assert.equal(auditAcrossRevisions.length, 2);
    assert.deepEqual(new Set(auditAcrossRevisions.map((cycle) => cycle.revision)), new Set([1, 2]));
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("editing a halted authorized mission creates an unauthorized next revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-revision-test-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    const keyStore = new MemoryDataKeyStore();
    const health = new NetworkHealthMonitor(new FakeRpc());
    await health.checkNow();
    const missions = new MissionService({
      database,
      cipher: new LocalDataCipher(keyStore),
      keystore: keyStore,
      health,
    });
    const id = "2927bef5-d468-41eb-8558-853be9b48bac";
    const draft = await missions.saveDraft({ plan: plan(id) });
    await missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: draft.planDigest });
    await missions.halt(id, 1);
    const revised = await missions.saveDraft({ plan: { ...plan(id), amountPerCycleAtomic: "200000000" }, expectedRevision: 1 });
    assert.equal(revised.revision, 2);
    assert.equal(revised.state, "draft");
    assert.equal(revised.authorizedAt, null);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("overlapping scheduler wakes produce exactly one cycle receipt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-scheduler-race-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    database.insertWallet({
      id: "wallet-race",
      profileId: "devnet-simulation",
      ciphertext: "encrypted",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: new Date().toISOString(),
    });
    const keyStore = new MemoryDataKeyStore();
    const cipher = new LocalDataCipher(keyStore);
    const rpc = new DeferredBalanceRpc();
    const health = new NetworkHealthMonitor(rpc);
    await health.checkNow();
    const missions = new MissionService({ database, cipher, keystore: keyStore, health });
    const id = "35debe43-37bb-4a5f-bfb0-85f69096dfb1";
    const draft = await missions.saveDraft({ plan: plan(id) });
    await missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: draft.planDigest });
    await missions.start(id, 1);
    const scheduler = new MissionSimulationScheduler({
      database,
      missions,
      cipher,
      health,
      keystore: keyStore,
      walletRpc: new DevnetWalletRpcService({
        rpc,
        health,
        getWalletAddress: async () => "11111111111111111111111111111111",
      }),
    });
    const first = scheduler.tick();
    const duplicate = scheduler.tick();
    while (rpc.releaseBalance === null) await new Promise((resolve) => setTimeout(resolve, 1));
    rpc.releaseBalance();
    await Promise.all([first, duplicate]);
    assert.equal(rpc.balanceCalls, 1);
    assert.equal((await missions.getAudit(id)).length, 1);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("restart initialization halts running missions without executing catch-up", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-scheduler-restart-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    database.insertWallet({
      id: "wallet-restart",
      profileId: "devnet-simulation",
      ciphertext: "encrypted",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: new Date().toISOString(),
    });
    const keyStore = new MemoryDataKeyStore();
    const cipher = new LocalDataCipher(keyStore);
    const rpc = new FakeRpc();
    const health = new NetworkHealthMonitor(rpc);
    await health.checkNow();
    const missions = new MissionService({ database, cipher, keystore: keyStore, health });
    const id = "7bb0d511-d07a-43d9-96a1-63377b64cf07";
    const draft = await missions.saveDraft({ plan: plan(id) });
    await missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: draft.planDigest });
    await missions.start(id, 1);
    const scheduler = new MissionSimulationScheduler({
      database,
      missions,
      cipher,
      health,
      keystore: keyStore,
      walletRpc: new DevnetWalletRpcService({
        rpc,
        health,
        getWalletAddress: async () => "11111111111111111111111111111111",
      }),
    });
    scheduler.initialize();
    await scheduler.tick();
    const [mission] = await missions.list();
    assert.equal(mission?.state, "halted");
    assert.equal(mission?.haltReason, "application-restarted");
    assert.equal((await missions.getAudit(id)).length, 0);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a denied guarded readiness evaluation halts before any signing-capable path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-readiness-denial-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    database.insertWallet({
      id: "wallet-guarded-denial",
      profileId: "devnet-simulation",
      ciphertext: "encrypted",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: new Date().toISOString(),
    });
    const keyStore = new MemoryDataKeyStore();
    const cipher = new LocalDataCipher(keyStore);
    const rpc = new FakeRpc();
    const health = new NetworkHealthMonitor(rpc);
    await health.checkNow();
    const missions = new MissionService({ database, cipher, keystore: keyStore, health });
    const id = "00000000-0000-4000-8000-000000000951";
    const draft = await missions.saveDraft({ plan: plan(id) });
    await missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: draft.planDigest });
    await missions.start(id, 1);
    let evaluations = 0;
    const scheduler = new MissionSimulationScheduler({
      database,
      missions,
      cipher,
      health,
      keystore: keyStore,
      walletRpc: new DevnetWalletRpcService({
        rpc,
        health,
        getWalletAddress: async () => "11111111111111111111111111111111",
      }),
      guardedReadiness: {
        evaluate: async () => {
          evaluations += 1;
          return {
            evaluationId: "00000000-0000-4000-8000-000000000953",
            outcome: "denied",
            reasonCode: "authorization-plan-mismatch",
            authorizationId: "00000000-0000-4000-8000-000000000952",
            evaluatedAt: new Date().toISOString(),
            executionEnabled: false,
            signingAttempted: false,
          };
        },
      },
    });
    await scheduler.tick();
    const [mission] = await missions.list();
    assert.equal(evaluations, 1);
    assert.equal(mission?.state, "halted");
    assert.equal(mission?.haltReason, "guarded-authorization-plan-mismatch");
    assert.equal((await missions.getAudit(id))[0]?.receipt, null);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("an armed ready cycle executes once after its simulation receipt and then halts for review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-scheduler-execution-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    database.insertWallet({
      id: "wallet-guarded-execution",
      profileId: "devnet-simulation",
      ciphertext: "encrypted",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: new Date().toISOString(),
    });
    const keyStore = new MemoryDataKeyStore();
    const cipher = new LocalDataCipher(keyStore);
    const rpc = new FakeRpc();
    const health = new NetworkHealthMonitor(rpc);
    await health.checkNow();
    const missions = new MissionService({ database, cipher, keystore: keyStore, health });
    const id = "00000000-0000-4000-8000-000000000961";
    const draft = await missions.saveDraft({ plan: plan(id) });
    await missions.authorize({ missionId: id, expectedRevision: 1, expectedPlanDigest: draft.planDigest });
    await missions.start(id, 1);
    let executions = 0;
    let proposalId = "";
    const scheduler = new MissionSimulationScheduler({
      database,
      missions,
      cipher,
      health,
      keystore: keyStore,
      walletRpc: new DevnetWalletRpcService({
        rpc,
        health,
        getWalletAddress: async () => "11111111111111111111111111111111",
      }),
      guardedReadiness: {
        evaluate: async () => ({
          evaluationId: "00000000-0000-4000-8000-000000000962",
          outcome: "ready",
          reasonCode: "guarded-prerequisites-ready",
          authorizationId: "00000000-0000-4000-8000-000000000963",
          evaluatedAt: new Date().toISOString(),
          executionEnabled: false,
          signingAttempted: false,
        }),
      },
      guardedProposal: {
        prepare: async (mission, cycle): Promise<GuardedFixtureCycleProposal> => {
          proposalId = "00000000-0000-4000-8000-000000000964";
          return {
            schemaVersion: 1,
            id: proposalId,
            proposalKind: "spl-transfer-checked-cycle-v1",
            purpose: "devnet-execution-path-proof",
            missionId: mission.id,
            missionRevision: mission.revision,
            cycle,
            planDigest: mission.planDigest,
            deskRuleDigest: "a".repeat(64),
            authorizationId: "00000000-0000-4000-8000-000000000963",
            schedulerArmId: "00000000-0000-4000-8000-000000000965",
            readinessEvaluationId: "00000000-0000-4000-8000-000000000962",
            fixtureManifestDigest: "b".repeat(64),
            sourceTokenAccount: "1".repeat(32),
            mintAddress: "2".repeat(32),
            destinationTokenAccount: "3".repeat(32),
            walletAuthority: "4".repeat(32),
            fixtureAmountAtomic: "1000000",
            mintDecimals: 6,
            authorizedDcaAmountAtomic: mission.plan.amountPerCycleAtomic,
            economicValueMapping: "none",
            marketSwapPerformed: false,
            executionEnabled: false,
            observedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15_000).toISOString(),
          };
        },
      },
      guardedExecution: {
        execute: async (proposal) => {
          executions += 1;
          assert.equal((await missions.getAudit(id)).length, 1);
          assert.equal(proposal.id, proposalId);
          const now = new Date().toISOString();
          return {
            id: proposal.id,
            missionId: proposal.missionId,
            missionRevision: proposal.missionRevision,
            cycle: proposal.cycle,
            fixtureManifestDigest: proposal.fixtureManifestDigest,
            state: "receipted",
            messageHash: "c".repeat(64),
            signingAttempted: true,
            broadcastAttempted: true,
            failureCode: null,
            createdAt: now,
            updatedAt: now,
          };
        },
      },
    });
    await scheduler.tick();
    await scheduler.tick();
    const [mission] = await missions.list();
    assert.equal(executions, 1);
    assert.equal(mission?.state, "halted");
    assert.equal(mission?.haltReason, "guarded-one-shot-complete");
    assert.equal((await missions.getAudit(id)).length, 1);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
