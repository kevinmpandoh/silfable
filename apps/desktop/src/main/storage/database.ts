import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { SCHEMA_MIGRATIONS } from "./migrations.js";

export type EncryptedWalletMetadata = {
  id: string;
  profileId: "devnet-simulation";
  ciphertext: string;
  nonce: string;
  keyId: string;
  createdAt: string;
};

export type MissionStorageRecord = {
  id: string;
  state: "draft" | "authorized" | "running" | "halted" | "complete";
  revision: number;
  encryptedPlan: string;
  authorizedAt: string | null;
  haltReason: string | null;
  updatedAt: string;
};

export type MissionCycleStorageRecord = {
  id: string;
  revision: number;
  cycle: number;
  dueAt: string;
  state: "skipped" | "halted" | "receipted";
  reason: string | null;
  receipt: null | {
    id: string;
    encryptedPayload: string;
    payloadNonce: string;
    keyId: string;
    createdAt: string;
  };
};

export class RuntimeDatabase {
  readonly #database: DatabaseSync;

  private constructor(database: DatabaseSync) {
    this.#database = database;
  }

  static async open(path: string): Promise<RuntimeDatabase> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });
    const runtime = new RuntimeDatabase(database);
    runtime.#configure();
    runtime.#migrate();
    database.enableDefensive(true);
    return runtime;
  }

  close(): void {
    if (this.#database.isOpen) this.#database.close();
  }

  getSetting(key: string): unknown | null {
    const row = this.#database.prepare("SELECT value_json FROM app_settings WHERE key = ?").get(key) as
      | { value_json: string }
      | undefined;
    if (row === undefined) return null;
    return JSON.parse(row.value_json) as unknown;
  }

  setSetting(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("Setting is not serializable");
    this.#database
      .prepare(
        `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, serialized, new Date().toISOString());
  }

  deleteSetting(key: string): void {
    this.#database.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  }

  hasWallet(profileId: "devnet-simulation"): boolean {
    const row = this.#database
      .prepare("SELECT COUNT(*) AS count FROM wallet_metadata WHERE profile_id = ?")
      .get(profileId) as { count: number };
    return row.count > 0;
  }

  getWallet(profileId: "devnet-simulation"): EncryptedWalletMetadata | null {
    const row = this.#database
      .prepare(
        `SELECT id, profile_id, encrypted_address, address_nonce, key_id, created_at
         FROM wallet_metadata WHERE profile_id = ?`,
      )
      .get(profileId) as
      | {
          id: string;
          profile_id: "devnet-simulation";
          encrypted_address: string;
          address_nonce: string;
          key_id: string;
          created_at: string;
        }
      | undefined;
    return row === undefined
      ? null
      : {
          id: row.id,
          profileId: row.profile_id,
          ciphertext: row.encrypted_address,
          nonce: row.address_nonce,
          keyId: row.key_id,
          createdAt: row.created_at,
        };
  }

  insertWallet(metadata: EncryptedWalletMetadata): void {
    this.#transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO wallet_metadata
            (id, profile_id, encrypted_address, address_nonce, key_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          metadata.id,
          metadata.profileId,
          metadata.ciphertext,
          metadata.nonce,
          metadata.keyId,
          metadata.createdAt,
        );
    });
  }

  listMissionRecords(): MissionStorageRecord[] {
    return this.#database
      .prepare(
        `SELECT m.id, m.state, m.current_revision, m.halt_reason, m.updated_at,
                r.plan_json, r.authorized_at
         FROM missions m
         JOIN mission_revisions r ON r.mission_id = m.id AND r.revision = m.current_revision
         ORDER BY m.updated_at DESC`,
      )
      .all()
      .map(toMissionStorageRecord);
  }

  getMissionRecord(id: string): MissionStorageRecord | null {
    const row = this.#database
      .prepare(
        `SELECT m.id, m.state, m.current_revision, m.halt_reason, m.updated_at,
                r.plan_json, r.authorized_at
         FROM missions m
         JOIN mission_revisions r ON r.mission_id = m.id AND r.revision = m.current_revision
         WHERE m.id = ?`,
      )
      .get(id);
    return row === undefined ? null : toMissionStorageRecord(row);
  }

  saveMissionDraft(input: {
    id: string;
    expectedRevision?: number;
    encryptedPlan: string;
    now: string;
  }): MissionStorageRecord {
    this.#transaction(() => {
      const existing = this.#database
        .prepare("SELECT state, current_revision FROM missions WHERE id = ?")
        .get(input.id) as { state: string; current_revision: number } | undefined;

      if (existing === undefined) {
        if (input.expectedRevision !== undefined) throw new Error("Mission revision conflict");
        this.#database
          .prepare(
            `INSERT INTO missions
              (id, profile_id, kind, state, current_revision, created_at, updated_at, halt_reason)
             VALUES (?, 'devnet-simulation', 'auto-dca-v1', 'draft', 1, ?, ?, NULL)`,
          )
          .run(input.id, input.now, input.now);
        this.#database
          .prepare("INSERT INTO mission_revisions (mission_id, revision, plan_json) VALUES (?, 1, ?)")
          .run(input.id, input.encryptedPlan);
        return;
      }

      if (existing.state === "running") throw new Error("Running mission cannot be edited");
      if (input.expectedRevision !== existing.current_revision) throw new Error("Mission revision conflict");
      const nextRevision = existing.current_revision + 1;
      this.#database
        .prepare("INSERT INTO mission_revisions (mission_id, revision, plan_json) VALUES (?, ?, ?)")
        .run(input.id, nextRevision, input.encryptedPlan);
      this.#database
        .prepare(
          `UPDATE missions SET state = 'draft', current_revision = ?, updated_at = ?, halt_reason = NULL
           WHERE id = ?`,
        )
        .run(nextRevision, input.now, input.id);
    });
    return this.#requireMissionRecord(input.id);
  }

  authorizeMission(input: {
    id: string;
    expectedRevision: number;
    encryptedRules: string;
    authorizedAt: string;
  }): MissionStorageRecord {
    this.#transaction(() => {
      const result = this.#database
        .prepare(
          `UPDATE missions SET state = 'authorized', updated_at = ?, halt_reason = NULL
           WHERE id = ? AND current_revision = ? AND state = 'draft'`,
        )
        .run(input.authorizedAt, input.id, input.expectedRevision);
      if (Number(result.changes) !== 1) throw new Error("Mission authorization conflict");
      this.#database
        .prepare("UPDATE mission_revisions SET authorized_at = ? WHERE mission_id = ? AND revision = ?")
        .run(input.authorizedAt, input.id, input.expectedRevision);
      this.#database
        .prepare(
          `INSERT INTO desk_rule_revisions (mission_id, revision, rules_json, authorized_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(input.id, input.expectedRevision, input.encryptedRules, input.authorizedAt);
    });
    return this.#requireMissionRecord(input.id);
  }

  startMission(id: string, expectedRevision: number, now: string): MissionStorageRecord {
    const result = this.#database
      .prepare(
        `UPDATE missions SET state = 'running', updated_at = ?, halt_reason = NULL
         WHERE id = ? AND current_revision = ? AND state IN ('authorized', 'halted')
           AND EXISTS (
             SELECT 1 FROM mission_revisions r
             WHERE r.mission_id = missions.id AND r.revision = missions.current_revision
               AND r.authorized_at IS NOT NULL
           )`,
      )
      .run(now, id, expectedRevision);
    if (Number(result.changes) !== 1) throw new Error("Mission start conflict");
    return this.#requireMissionRecord(id);
  }

  haltMission(id: string, expectedRevision: number, reason: string, now: string): MissionStorageRecord {
    const result = this.#database
      .prepare(
        `UPDATE missions SET state = 'halted', updated_at = ?, halt_reason = ?
         WHERE id = ? AND current_revision = ? AND state IN ('authorized', 'running')`,
      )
      .run(now, reason, id, expectedRevision);
    if (Number(result.changes) !== 1) throw new Error("Mission halt conflict");
    return this.#requireMissionRecord(id);
  }

  haltAllRunningMissions(reason: string, now: string): string[] {
    const ids = this.listRunningMissionIds();
    this.#database
      .prepare("UPDATE missions SET state = 'halted', updated_at = ?, halt_reason = ? WHERE state = 'running'")
      .run(now, reason);
    return ids;
  }

  listRunningMissionIds(): string[] {
    return (
      this.#database.prepare("SELECT id FROM missions WHERE state = 'running' ORDER BY id").all() as Array<{
        id: string;
      }>
    ).map((row) => row.id);
  }

  countMissionCycles(missionId: string, revision: number): number {
    const row = this.#database
      .prepare("SELECT COUNT(*) AS count FROM dca_cycles WHERE mission_id = ? AND mission_revision = ?")
      .get(missionId, revision) as { count: number };
    return row.count;
  }

  countRunningMissions(): number {
    const row = this.#database.prepare("SELECT COUNT(*) AS count FROM missions WHERE state = 'running'").get() as {
      count: number;
    };
    return row.count;
  }

  getDailyRiskCounter(missionId: string, utcDate: string): { spentAtomic: string; tradeCount: number } {
    const row = this.#database
      .prepare("SELECT spent_atomic, trade_count FROM daily_risk_counters WHERE mission_id = ? AND utc_date = ?")
      .get(missionId, utcDate) as { spent_atomic: string; trade_count: number } | undefined;
    return row === undefined ? { spentAtomic: "0", tradeCount: 0 } : { spentAtomic: row.spent_atomic, tradeCount: row.trade_count };
  }

  recordSkippedCycle(input: { id: string; missionId: string; revision: number; cycle: number; dueAt: string; reason: string }): void {
    this.#database
      .prepare(
        `INSERT INTO dca_cycles (id, mission_id, mission_revision, cycle_number, due_at, state, reason)
         VALUES (?, ?, ?, ?, ?, 'skipped', ?)`,
      )
      .run(input.id, input.missionId, input.revision, input.cycle, input.dueAt, input.reason);
  }

  recordHaltedCycle(input: { id: string; missionId: string; revision: number; cycle: number; dueAt: string; reason: string }): void {
    this.#database
      .prepare(
        `INSERT INTO dca_cycles (id, mission_id, mission_revision, cycle_number, due_at, state, reason)
         VALUES (?, ?, ?, ?, ?, 'halted', ?)`,
      )
      .run(input.id, input.missionId, input.revision, input.cycle, input.dueAt, input.reason);
  }

  listMissionCycles(missionId: string, limit = 100): MissionCycleStorageRecord[] {
    const rows = this.#database
      .prepare(
        `SELECT c.id, c.mission_revision, c.cycle_number, c.due_at, c.state, c.reason,
                r.id AS receipt_id, r.encrypted_payload, r.payload_nonce, r.key_id, r.created_at
         FROM dca_cycles c
         LEFT JOIN execution_attempts e ON e.cycle_id = c.id
         LEFT JOIN receipts r ON r.execution_id = e.id
         WHERE c.mission_id = ?
         ORDER BY c.cycle_number DESC
         LIMIT ?`,
      )
      .all(missionId, limit) as Array<{
      id: string;
      mission_revision: number;
      cycle_number: number;
      due_at: string;
      state: MissionCycleStorageRecord["state"];
      reason: string | null;
      receipt_id: string | null;
      encrypted_payload: string | null;
      payload_nonce: string | null;
      key_id: string | null;
      created_at: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      revision: row.mission_revision,
      cycle: row.cycle_number,
      dueAt: row.due_at,
      state: row.state,
      reason: row.reason,
      receipt:
        row.receipt_id === null ||
        row.encrypted_payload === null ||
        row.payload_nonce === null ||
        row.key_id === null ||
        row.created_at === null
          ? null
          : {
              id: row.receipt_id,
              encryptedPayload: row.encrypted_payload,
              payloadNonce: row.payload_nonce,
              keyId: row.key_id,
              createdAt: row.created_at,
            },
    }));
  }

  recordSimulationReceipt(input: {
    cycleId: string;
    executionId: string;
    receiptId: string;
    missionId: string;
    revision: number;
    cycle: number;
    dueAt: string;
    encryptedPayload: string;
    payloadNonce: string;
    keyId: string;
    spentAtomic: string;
    tradeCount: number;
    utcDate: string;
    now: string;
  }): void {
    this.#transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO dca_cycles (id, mission_id, mission_revision, cycle_number, due_at, state)
           VALUES (?, ?, ?, ?, ?, 'receipted')`,
        )
        .run(input.cycleId, input.missionId, input.revision, input.cycle, input.dueAt);
      this.#database
        .prepare(
          `INSERT INTO execution_attempts (id, cycle_id, state, started_at, finished_at)
           VALUES (?, ?, 'simulated', ?, ?)`,
        )
        .run(input.executionId, input.cycleId, input.now, input.now);
      this.#database
        .prepare(
          `INSERT INTO receipts
            (id, execution_id, encrypted_payload, payload_nonce, key_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.receiptId,
          input.executionId,
          input.encryptedPayload,
          input.payloadNonce,
          input.keyId,
          input.now,
        );
      this.#database
        .prepare(
          `INSERT INTO daily_risk_counters (mission_id, utc_date, spent_atomic, trade_count)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(mission_id, utc_date) DO UPDATE SET
             spent_atomic = excluded.spent_atomic,
             trade_count = excluded.trade_count`,
        )
        .run(input.missionId, input.utcDate, input.spentAtomic, input.tradeCount);
    });
  }

  markMissionComplete(id: string, revision: number, now: string): void {
    this.#database
      .prepare(
        "UPDATE missions SET state = 'complete', updated_at = ?, halt_reason = NULL WHERE id = ? AND current_revision = ?",
      )
      .run(now, id, revision);
  }

  #configure(): void {
    this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const applied = new Set(
      (
        this.#database.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
          version: number;
        }>
      ).map((row) => row.version),
    );

    for (const migration of SCHEMA_MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.#transaction(() => {
        this.#database.exec(migration.sql);
        this.#database
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(migration.version, migration.name, new Date().toISOString());
      });
    }

    this.#database
      .prepare(
        `INSERT OR IGNORE INTO profiles (id, environment, created_at, selected)
         VALUES (?, ?, ?, 1)`,
      )
      .run("devnet-simulation", "devnet-simulation", new Date().toISOString());
  }

  #transaction(operation: () => void): void {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  #requireMissionRecord(id: string): MissionStorageRecord {
    const record = this.getMissionRecord(id);
    if (record === null) throw new Error("Mission does not exist");
    return record;
  }
}

function toMissionStorageRecord(row: unknown): MissionStorageRecord {
  const value = row as {
    id: string;
    state: MissionStorageRecord["state"];
    current_revision: number;
    plan_json: string;
    authorized_at: string | null;
    halt_reason: string | null;
    updated_at: string;
  };
  return {
    id: value.id,
    state: value.state,
    revision: value.current_revision,
    encryptedPlan: value.plan_json,
    authorizedAt: value.authorized_at,
    haltReason: value.halt_reason,
    updatedAt: value.updated_at,
  };
}
