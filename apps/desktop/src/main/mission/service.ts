import { createHash, randomUUID } from "node:crypto";

import {
  DcaPlanV1Schema,
  SimulationReceiptViewSchema,
  type DcaCycleAudit,
  MissionViewSchema,
  type DcaPlanV1,
  type MissionView,
} from "@silfable/contracts";
import { decideNextDcaAction, simulateDcaCycle } from "@silfable/core";

import { DevnetWalletRpcService, NetworkHealthMonitor } from "../rpc/devnet.js";
import { RuntimeDatabase, type MissionStorageRecord } from "../storage/database.js";
import {
  LocalDataCipher,
  parseEnvelope,
  serializeEnvelope,
} from "../storage/encryption.js";

export const SIMULATION_MINTS = {
  input: "11111111111111111111111111111111",
  output: "22222222222222222222222222222222",
} as const;

export type MissionRuntimeEvent = {
  missionId: string;
  type: "halted" | "skipped" | "receipted" | "complete";
  detail: string;
};

type KeystoreState = { isLocked(): boolean };

export class MissionService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #keystore: KeystoreState;
  readonly #health: NetworkHealthMonitor;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    keystore: KeystoreState;
    health: NetworkHealthMonitor;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#health = input.health;
  }

  async list(): Promise<MissionView[]> {
    return Promise.all(this.#database.listMissionRecords().map((record) => this.#toView(record)));
  }

  async saveDraft(input: { plan: DcaPlanV1; expectedRevision?: number }): Promise<MissionView> {
    this.#assertKeystoreUnlocked();
    const plan = DcaPlanV1Schema.parse(input.plan);
    if (plan.profile !== "devnet-simulation") throw new Error("Only Devnet Simulation plans are supported");
    if (!isSimulationMint(plan.inputMint) || !isSimulationMint(plan.outputMint)) {
      throw new Error("Devnet Simulation plan uses an unsupported local mint identifier");
    }
    const encryptedPlan = serializeEnvelope(await this.#cipher.encryptString(JSON.stringify(plan)));
    const record = this.#database.saveMissionDraft({
      id: plan.id,
      ...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
      encryptedPlan,
      now: new Date().toISOString(),
    });
    return this.#toView(record);
  }

  async authorize(input: {
    missionId: string;
    expectedRevision: number;
    expectedPlanDigest: string;
  }): Promise<MissionView> {
    this.#assertKeystoreUnlocked();
    const current = await this.#requireView(input.missionId);
    if (current.revision !== input.expectedRevision || current.planDigest !== input.expectedPlanDigest) {
      throw new Error("Mission authorization digest conflict");
    }
    const rules = compileDeskRules(current.plan, current.planDigest);
    const encryptedRules = serializeEnvelope(await this.#cipher.encryptString(JSON.stringify(rules)));
    return this.#toView(
      this.#database.authorizeMission({
        id: input.missionId,
        expectedRevision: input.expectedRevision,
        encryptedRules,
        authorizedAt: new Date().toISOString(),
      }),
    );
  }

  async start(missionId: string, expectedRevision: number): Promise<MissionView> {
    this.#assertKeystoreUnlocked();
    if (!this.#database.hasWallet("devnet-simulation")) throw new Error("Devnet wallet is not configured");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    return this.#toView(this.#database.startMission(missionId, expectedRevision, new Date().toISOString()));
  }

  async halt(missionId: string, expectedRevision: number, reason = "manual"): Promise<MissionView> {
    return this.#toView(
      this.#database.haltMission(missionId, expectedRevision, reason, new Date().toISOString()),
    );
  }

  async getAudit(missionId: string): Promise<DcaCycleAudit[]> {
    this.#assertKeystoreUnlocked();
    if (this.#database.getMissionRecord(missionId) === null) throw new Error("Mission does not exist");
    return Promise.all(
      this.#database.listMissionCycles(missionId).map(async (cycle) => {
        if (cycle.receipt === null) return { ...cycle, receipt: null };
        if (cycle.receipt.keyId !== "local-data-key-v1") throw new Error("Receipt key is unsupported");
        const payload: unknown = JSON.parse(
          await this.#cipher.decryptString({
            ciphertext: cycle.receipt.encryptedPayload,
            nonce: cycle.receipt.payloadNonce,
            keyId: "local-data-key-v1",
          }),
        );
        if (typeof payload !== "object" || payload === null) throw new Error("Receipt payload is invalid");
        const value = payload as Record<string, unknown>;
        if (value.missionId !== missionId || value.revision !== cycle.revision || value.cycle !== cycle.cycle) {
          throw new Error("Receipt integrity context does not match cycle");
        }
        return {
          ...cycle,
          receipt: SimulationReceiptViewSchema.parse({
            receiptId: cycle.receipt.id,
            createdAt: cycle.receipt.createdAt,
            revision: value.revision,
            planDigest: value.planDigest,
            outcome: value.outcome,
            signingAttempted: value.signingAttempted,
            observedAt: value.observedAt,
          }),
        };
      }),
    );
  }

  async #requireView(id: string): Promise<MissionView> {
    const record = this.#database.getMissionRecord(id);
    if (record === null) throw new Error("Mission does not exist");
    return this.#toView(record);
  }

  async #toView(record: MissionStorageRecord): Promise<MissionView> {
    this.#assertKeystoreUnlocked();
    const plan = DcaPlanV1Schema.parse(
      JSON.parse(await this.#cipher.decryptString(parseEnvelope(record.encryptedPlan))),
    );
    return MissionViewSchema.parse({
      schemaVersion: 1,
      id: record.id,
      state: record.state,
      revision: record.revision,
      planDigest: digestPlan(plan),
      plan,
      authorizedAt: record.authorizedAt,
      haltReason: record.haltReason,
      completedCycles: this.#database.countMissionCycles(record.id, record.revision),
      updatedAt: record.updatedAt,
    });
  }

  #assertKeystoreUnlocked(): void {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
  }
}

export class MissionSimulationScheduler {
  readonly #database: RuntimeDatabase;
  readonly #missions: MissionService;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #walletRpc: DevnetWalletRpcService;
  readonly #onEvent: (event: MissionRuntimeEvent) => void;
  #timer: ReturnType<typeof setInterval> | null = null;
  #ticking = false;
  #lastTickAt = new Date();

  constructor(input: {
    database: RuntimeDatabase;
    missions: MissionService;
    cipher: LocalDataCipher;
    health: NetworkHealthMonitor;
    keystore: KeystoreState;
    walletRpc: DevnetWalletRpcService;
    onEvent?: (event: MissionRuntimeEvent) => void;
  }) {
    this.#database = input.database;
    this.#missions = input.missions;
    this.#cipher = input.cipher;
    this.#health = input.health;
    this.#keystore = input.keystore;
    this.#walletRpc = input.walletRpc;
    this.#onEvent = input.onEvent ?? (() => undefined);
  }

  initialize(): void {
    this.#database.haltAllRunningMissions("application-restarted", new Date().toISOString());
  }

  start(): void {
    if (this.#timer !== null) return;
    void this.tick();
    this.#timer = setInterval(() => void this.tick(), 5_000);
  }

  stop(reason = "runtime-stopped", emitEvents = true): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
    const missionIds = this.#database.haltAllRunningMissions(reason, new Date().toISOString());
    if (emitEvents) {
      for (const missionId of missionIds) this.#emit({ missionId, type: "halted", detail: reason });
    }
  }

  async tick(): Promise<void> {
    if (this.#ticking) return;
    this.#ticking = true;
    const now = new Date();
    try {
      if (!this.#health.isHealthyFresh()) {
        this.#haltAll("network-unhealthy", now);
        return;
      }
      if (this.#keystore.isLocked()) {
        this.#haltAll("keystore-locked", now);
        return;
      }

      const running = (await this.#missions.list()).filter((mission) => mission.state === "running");
      for (const mission of running) await this.#tickMission(mission, now);
    } finally {
      this.#lastTickAt = now;
      this.#ticking = false;
    }
  }

  async #tickMission(mission: MissionView, now: Date): Promise<void> {
    try {
      const schedule = decideNextDcaAction({
        plan: mission.plan,
        completedCycles: mission.completedCycles,
        now,
        lastSchedulerTickAt: this.#lastTickAt,
      });
      if (schedule.action === "wait") return;
      if (schedule.action === "complete") {
        this.#database.markMissionComplete(mission.id, mission.revision, now.toISOString());
        this.#emit({ missionId: mission.id, type: "complete", detail: "simulation-complete" });
        return;
      }
      if (schedule.action === "skip") {
        this.#database.recordSkippedCycle({
          id: randomUUID(),
          missionId: mission.id,
          revision: mission.revision,
          cycle: schedule.cycle,
          dueAt: schedule.dueAt.toISOString(),
          reason: schedule.reason,
        });
        this.#emit({ missionId: mission.id, type: "skipped", detail: schedule.reason });
        return;
      }

      const balance = await this.#walletRpc.getBalance();
      const evaluationNow = new Date();
      const utcDate = evaluationNow.toISOString().slice(0, 10);
      const risk = this.#database.getDailyRiskCounter(mission.id, utcDate);
      const simulation = simulateDcaCycle({
        schemaVersion: 1,
        requestId: randomUUID(),
        plan: mission.plan,
        completedCycles: mission.completedCycles,
        lastSchedulerTickAt: this.#lastTickAt.toISOString(),
        now: evaluationNow.toISOString(),
        snapshot: {
          observedAt: balance.observedAt,
          quoteExpiresAt: new Date(evaluationNow.getTime() + 30_000).toISOString(),
          networkHealth: "healthy",
          keystoreUnlocked: true,
          globalKillSwitch: false,
          missionKillSwitch: false,
          walletBalanceAtomic: balance.lamportsAtomic,
          spentTodayAtomic: risk.spentAtomic,
          price: "1",
          priceImpactBps: 10,
          feeLamports: "1000",
          inputMintAllowed: isSimulationMint(mission.plan.inputMint),
          outputMintAllowed: isSimulationMint(mission.plan.outputMint),
          marketEligible: true,
          simulationSucceeded: true,
        },
      });

      if (simulation.outcome !== "would-execute") {
        const denialReason = simulation.denialCodes.join(",") || `scheduler-${simulation.outcome}`;
        this.#database.recordHaltedCycle({
          id: randomUUID(),
          missionId: mission.id,
          revision: mission.revision,
          cycle: simulation.cycle ?? mission.completedCycles + 1,
          dueAt: simulation.dueAt ?? evaluationNow.toISOString(),
          reason: denialReason,
        });
        this.#database.haltMission(
          mission.id,
          mission.revision,
          denialReason,
          evaluationNow.toISOString(),
        );
        this.#emit({ missionId: mission.id, type: "halted", detail: denialReason });
        return;
      }

      const receipt = await this.#cipher.encryptString(
        JSON.stringify({
          version: 1,
          mode: "devnet-simulation",
          missionId: mission.id,
          revision: mission.revision,
          planDigest: mission.planDigest,
          cycle: simulation.cycle,
          dueAt: simulation.dueAt,
          outcome: simulation.outcome,
          signingAttempted: false,
          observedAt: balance.observedAt,
        }),
      );
      this.#database.recordSimulationReceipt({
        cycleId: randomUUID(),
        executionId: randomUUID(),
        receiptId: randomUUID(),
        missionId: mission.id,
        revision: mission.revision,
        cycle: simulation.cycle ?? mission.completedCycles + 1,
        dueAt: simulation.dueAt ?? evaluationNow.toISOString(),
        encryptedPayload: receipt.ciphertext,
        payloadNonce: receipt.nonce,
        keyId: receipt.keyId,
        spentAtomic: (BigInt(risk.spentAtomic) + BigInt(mission.plan.amountPerCycleAtomic)).toString(),
        tradeCount: risk.tradeCount + 1,
        utcDate,
        now: evaluationNow.toISOString(),
      });
      this.#emit({ missionId: mission.id, type: "receipted", detail: `cycle-${simulation.cycle}` });
    } catch {
      this.#database.haltMission(mission.id, mission.revision, "simulation-runtime-failure", now.toISOString());
      this.#emit({ missionId: mission.id, type: "halted", detail: "simulation-runtime-failure" });
    }
  }

  #haltAll(reason: string, now: Date): void {
    const missionIds = this.#database.haltAllRunningMissions(reason, now.toISOString());
    for (const missionId of missionIds) this.#emit({ missionId, type: "halted", detail: reason });
  }

  #emit(event: MissionRuntimeEvent): void {
    try {
      this.#onEvent(event);
    } catch {
      // Operator notifications are best-effort and must never alter mission state.
    }
  }
}

export function digestPlan(plan: DcaPlanV1): string {
  return createHash("sha256").update(JSON.stringify(DcaPlanV1Schema.parse(plan))).digest("hex");
}

function compileDeskRules(plan: DcaPlanV1, planDigest: string) {
  return {
    version: 1,
    mode: "devnet-simulation",
    planDigest,
    immutablePlanRevision: true,
    mintAllowlist: [SIMULATION_MINTS.input, SIMULATION_MINTS.output],
    amountPerCycleAtomic: plan.amountPerCycleAtomic,
    maxSlippageBps: plan.maxSlippageBps,
    maxPriceImpactBps: plan.maxPriceImpactBps,
    maxFeeLamports: plan.maxFeeLamports,
    dailySpendLimitAtomic: plan.dailySpendLimitAtomic,
    minimumWalletReserveAtomic: plan.minimumWalletReserveAtomic,
    missedCyclePolicy: "skip",
    failurePolicy: "halt",
    signingEnabled: false,
  } as const;
}

function isSimulationMint(mint: string): boolean {
  return mint === SIMULATION_MINTS.input || mint === SIMULATION_MINTS.output;
}
