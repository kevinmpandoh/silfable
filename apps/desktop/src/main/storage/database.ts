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

export type DevnetCanaryStorageRecord = {
  id: string;
  kind: "self-transfer-zero-lamports";
  state: "proposed" | "simulated" | "signed" | "broadcast" | "confirmed" | "failed" | "ambiguous";
  encryptedWire: string | null;
  wireNonce: string | null;
  encryptedSignature: string | null;
  signatureNonce: string | null;
  keyId: string | null;
  lastValidBlockHeight: string | null;
  simulationUnits: string | null;
  failureCode: string | null;
  signingAttempted: boolean;
  broadcastAttempted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JupiterShadowQuoteStorageRecord = {
  id: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  allowed: boolean;
  createdAt: string;
};

export type CrashReportStorageRecord = {
  id: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  transmitted: false;
  createdAt: string;
};

export type GuardedExecutionStorageState =
  | "proposed" | "validated" | "simulated" | "signed" | "broadcast"
  | "confirmed" | "receipted" | "failed" | "ambiguous";

export type GuardedExecutionStorageRecord = {
  id: string;
  missionId: string;
  missionRevision: number;
  cycle: number;
  fixtureManifestDigest: string;
  state: GuardedExecutionStorageState;
  messageHash: string | null;
  signingAttempted: boolean;
  broadcastAttempted: boolean;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuardedExecutionEventStorageRecord = {
  id: string;
  executionId: string;
  fromState: GuardedExecutionStorageState | null;
  toState: GuardedExecutionStorageState;
  eventName: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  createdAt: string;
};

export type FixtureProvisionStorageRecord = {
  id: string;
  mintAddress: string;
  state: "proposed" | "simulated" | "signed" | "broadcast" | "confirmed" | "failed" | "ambiguous";
  messageHash: string;
  encryptedPayload: string | null;
  payloadNonce: string | null;
  keyId: string | null;
  lastValidBlockHeight: string;
  simulationUnits: string | null;
  failureCode: string | null;
  signingAttempted: boolean;
  broadcastAttempted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FixtureReviewStorageRecord = {
  provisionId: string;
  manifestDigest: string;
  mintAddress: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  walletAuthority: string;
  destinationOwner: string;
  observedSlot: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  active: true;
  createdAt: string;
};

export type GuardedFixtureTransferStorageRecord = {
  id: string;
  fixtureManifestDigest: string;
  state: "proposed" | "simulated" | "signed" | "broadcast" | "confirmed" | "failed" | "ambiguous";
  messageHash: string;
  encryptedPayload: string | null;
  payloadNonce: string | null;
  keyId: string | null;
  lastValidBlockHeight: string;
  simulationUnits: string | null;
  failureCode: string | null;
  signingAttempted: boolean;
  broadcastAttempted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuardedFixtureTransferApprovalStorageRecord = {
  transferId: string;
  fixtureManifestDigest: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  approvedAt: string;
};

export type GuardedMissionAuthorizationStorageRecord = {
  id: string;
  missionId: string;
  missionRevision: number;
  planDigest: string;
  deskRuleDigest: string;
  fixtureManifestDigest: string;
  fixtureTransferId: string;
  state: "active" | "revoked";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  authorizedAt: string;
  revokedAt: string | null;
};

export type GuardedSchedulerEvaluationStorageRecord = {
  id: string;
  missionId: string;
  missionRevision: number;
  cycle: number;
  authorizationId: string | null;
  outcome: "inactive" | "ready" | "denied";
  reasonCode: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  evaluatedAt: string;
};

export type GuardedSchedulerArmStorageRecord = {
  id: string;
  authorizationId: string;
  missionId: string;
  missionRevision: number;
  planDigest: string;
  deskRuleDigest: string;
  fixtureManifestDigest: string;
  scope: "devnet-fixture-cycle-once";
  state: "active" | "consumed" | "revoked" | "expired";
  executionId: string | null;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  armedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
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

  insertCrashReport(input: CrashReportStorageRecord): void {
    this.#database
      .prepare(
        `INSERT INTO crash_reports
          (id, encrypted_payload, payload_nonce, key_id, transmitted, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .run(input.id, input.encryptedPayload, input.payloadNonce, input.keyId, input.createdAt);
  }

  listCrashReports(limit = 20): CrashReportStorageRecord[] {
    return (this.#database
      .prepare("SELECT * FROM crash_reports ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Array<{
      id: string;
      encrypted_payload: string;
      payload_nonce: string;
      key_id: string;
      transmitted: number;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      encryptedPayload: row.encrypted_payload,
      payloadNonce: row.payload_nonce,
      keyId: row.key_id,
      transmitted: false,
      createdAt: row.created_at,
    }));
  }

  countCrashReports(): number {
    const row = this.#database.prepare("SELECT COUNT(*) AS count FROM crash_reports").get() as { count: number };
    return row.count;
  }

  deleteCrashReports(): void {
    this.#database.prepare("DELETE FROM crash_reports").run();
  }

  setCrashTelemetryConsent(key: string, consent: boolean): void {
    this.#transaction(() => {
      this.setSetting(key, { schemaVersion: 1, consent });
      if (!consent) this.deleteCrashReports();
    });
  }

  createGuardedExecution(input: {
    id: string;
    missionId: string;
    missionRevision: number;
    cycle: number;
    fixtureManifestDigest: string;
    eventId: string;
    encryptedPayload: string;
    payloadNonce: string;
    keyId: string;
    now: string;
  }): GuardedExecutionStorageRecord {
    this.#transaction(() => {
      this.#database.prepare(
        `INSERT INTO guarded_devnet_executions
          (id, mission_id, mission_revision, cycle_number, fixture_manifest_digest, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'proposed', ?, ?)`,
      ).run(input.id, input.missionId, input.missionRevision, input.cycle, input.fixtureManifestDigest, input.now, input.now);
      this.#database.prepare(
        `INSERT INTO guarded_devnet_execution_events
          (id, execution_id, from_state, to_state, event_name, encrypted_payload, payload_nonce, key_id, created_at)
         VALUES (?, ?, NULL, 'proposed', 'proposal-created', ?, ?, ?, ?)`,
      ).run(input.eventId, input.id, input.encryptedPayload, input.payloadNonce, input.keyId, input.now);
    });
    return this.#requireGuardedExecution(input.id);
  }

  transitionGuardedExecution(input: {
    id: string;
    expectedState: GuardedExecutionStorageState;
    state: GuardedExecutionStorageState;
    eventId: string;
    eventName: string;
    encryptedPayload: string;
    payloadNonce: string;
    keyId: string;
    messageHash?: string;
    signingAttempted?: boolean;
    broadcastAttempted?: boolean;
    failureCode?: string | null;
    now: string;
  }): GuardedExecutionStorageRecord {
    this.#transaction(() => {
      const current = this.#requireGuardedExecution(input.id);
      if (current.state !== input.expectedState) throw new Error("Guarded execution state conflict");
      if (current.messageHash !== null && input.messageHash !== undefined && current.messageHash !== input.messageHash) {
        throw new Error("Guarded execution message hash conflict");
      }
      const result = this.#database.prepare(
        `UPDATE guarded_devnet_executions SET state = ?, message_hash = ?, signing_attempted = ?,
           broadcast_attempted = ?, failure_code = ?, updated_at = ? WHERE id = ? AND state = ?`,
      ).run(
        input.state,
        input.messageHash ?? current.messageHash,
        Number(input.signingAttempted ?? current.signingAttempted),
        Number(input.broadcastAttempted ?? current.broadcastAttempted),
        input.failureCode === undefined ? current.failureCode : input.failureCode,
        input.now,
        input.id,
        input.expectedState,
      );
      if (Number(result.changes) !== 1) throw new Error("Guarded execution state conflict");
      this.#database.prepare(
        `INSERT INTO guarded_devnet_execution_events
          (id, execution_id, from_state, to_state, event_name, encrypted_payload, payload_nonce, key_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.eventId, input.id, input.expectedState, input.state, input.eventName,
        input.encryptedPayload, input.payloadNonce, input.keyId, input.now,
      );
    });
    return this.#requireGuardedExecution(input.id);
  }

  getGuardedExecution(id: string): GuardedExecutionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM guarded_devnet_executions WHERE id = ?").get(id);
    return row === undefined ? null : toGuardedExecutionStorageRecord(row);
  }

  listPendingGuardedExecutions(): GuardedExecutionStorageRecord[] {
    return (this.#database.prepare(
      `SELECT * FROM guarded_devnet_executions
       WHERE state IN ('proposed', 'validated', 'simulated', 'signed', 'broadcast', 'confirmed', 'ambiguous')
       ORDER BY created_at`,
    ).all() as Array<Record<string, unknown>>).map(toGuardedExecutionStorageRecord);
  }

  listGuardedExecutions(limit = 20): GuardedExecutionStorageRecord[] {
    return (this.#database.prepare(
      "SELECT * FROM guarded_devnet_executions ORDER BY created_at DESC LIMIT ?",
    ).all(limit) as Array<Record<string, unknown>>).map(toGuardedExecutionStorageRecord);
  }

  listGuardedExecutionEvents(executionId: string): GuardedExecutionEventStorageRecord[] {
    return (this.#database.prepare(
      "SELECT * FROM guarded_devnet_execution_events WHERE execution_id = ? ORDER BY created_at, rowid",
    ).all(executionId) as Array<Record<string, unknown>>).map(toGuardedExecutionEventStorageRecord);
  }

  createFixtureProvision(input: {
    id: string;
    mintAddress: string;
    messageHash: string;
    lastValidBlockHeight: string;
    now: string;
  }): FixtureProvisionStorageRecord {
    this.#database.prepare(
      `INSERT INTO devnet_fixture_provisions
        (id, mint_address, state, message_hash, last_valid_block_height, created_at, updated_at)
       VALUES (?, ?, 'proposed', ?, ?, ?, ?)`,
    ).run(input.id, input.mintAddress, input.messageHash, input.lastValidBlockHeight, input.now, input.now);
    return this.#requireFixtureProvision(input.id);
  }

  updateFixtureProvision(input: {
    id: string;
    expectedState: FixtureProvisionStorageRecord["state"];
    state: FixtureProvisionStorageRecord["state"];
    now: string;
    encryptedPayload?: string;
    payloadNonce?: string;
    keyId?: string;
    simulationUnits?: string;
    failureCode?: string | null;
    signingAttempted?: boolean;
    broadcastAttempted?: boolean;
  }): FixtureProvisionStorageRecord {
    const current = this.#requireFixtureProvision(input.id);
    if (current.state !== input.expectedState) throw new Error("Fixture provision state conflict");
    const result = this.#database.prepare(
      `UPDATE devnet_fixture_provisions SET state = ?, encrypted_payload = ?, payload_nonce = ?, key_id = ?,
         simulation_units = ?, failure_code = ?, signing_attempted = ?, broadcast_attempted = ?, updated_at = ?
       WHERE id = ? AND state = ?`,
    ).run(
      input.state,
      input.encryptedPayload ?? current.encryptedPayload,
      input.payloadNonce ?? current.payloadNonce,
      input.keyId ?? current.keyId,
      input.simulationUnits ?? current.simulationUnits,
      input.failureCode === undefined ? current.failureCode : input.failureCode,
      Number(input.signingAttempted ?? current.signingAttempted),
      Number(input.broadcastAttempted ?? current.broadcastAttempted),
      input.now,
      input.id,
      input.expectedState,
    );
    if (Number(result.changes) !== 1) throw new Error("Fixture provision state conflict");
    return this.#requireFixtureProvision(input.id);
  }

  getFixtureProvision(id: string): FixtureProvisionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM devnet_fixture_provisions WHERE id = ?").get(id);
    return row === undefined ? null : toFixtureProvisionStorageRecord(row);
  }

  listPendingFixtureProvisions(): FixtureProvisionStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM devnet_fixture_provisions WHERE state IN ('proposed', 'simulated', 'signed', 'broadcast', 'ambiguous') ORDER BY created_at",
    ).all().map(toFixtureProvisionStorageRecord);
  }

  listFixtureProvisions(limit = 20): FixtureProvisionStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM devnet_fixture_provisions ORDER BY created_at DESC LIMIT ?",
    ).all(limit).map(toFixtureProvisionStorageRecord);
  }

  hasBlockingFixtureProvision(): boolean {
    const row = this.#database.prepare(
      `SELECT COUNT(*) AS count FROM devnet_fixture_provisions
       WHERE state IN ('proposed', 'simulated', 'signed', 'broadcast', 'confirmed', 'ambiguous')`,
    ).get() as { count: number };
    return row.count > 0;
  }

  insertFixtureReview(record: FixtureReviewStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO devnet_fixture_reviews
        (provision_id, manifest_digest, mint_address, source_token_account, destination_token_account,
         wallet_authority, destination_owner, observed_slot, encrypted_payload, payload_nonce, key_id, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      record.provisionId,
      record.manifestDigest,
      record.mintAddress,
      record.sourceTokenAccount,
      record.destinationTokenAccount,
      record.walletAuthority,
      record.destinationOwner,
      record.observedSlot,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.createdAt,
    );
  }

  getActiveFixtureReview(): FixtureReviewStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM devnet_fixture_reviews WHERE active = 1").get();
    return row === undefined ? null : toFixtureReviewStorageRecord(row);
  }

  getFixtureReview(provisionId: string): FixtureReviewStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM devnet_fixture_reviews WHERE provision_id = ?").get(provisionId);
    return row === undefined ? null : toFixtureReviewStorageRecord(row);
  }

  createGuardedFixtureTransfer(input: {
    id: string;
    fixtureManifestDigest: string;
    messageHash: string;
    lastValidBlockHeight: string;
    now: string;
  }): GuardedFixtureTransferStorageRecord {
    this.#database.prepare(
      `INSERT INTO guarded_fixture_transfers
        (id, fixture_manifest_digest, state, message_hash, last_valid_block_height, created_at, updated_at)
       VALUES (?, ?, 'proposed', ?, ?, ?, ?)`,
    ).run(input.id, input.fixtureManifestDigest, input.messageHash, input.lastValidBlockHeight, input.now, input.now);
    return this.#requireGuardedFixtureTransfer(input.id);
  }

  updateGuardedFixtureTransfer(input: {
    id: string;
    expectedState: GuardedFixtureTransferStorageRecord["state"];
    state: GuardedFixtureTransferStorageRecord["state"];
    now: string;
    encryptedPayload?: string;
    payloadNonce?: string;
    keyId?: string;
    simulationUnits?: string;
    failureCode?: string | null;
    signingAttempted?: boolean;
    broadcastAttempted?: boolean;
  }): GuardedFixtureTransferStorageRecord {
    const current = this.#requireGuardedFixtureTransfer(input.id);
    if (current.state !== input.expectedState) throw new Error("Guarded fixture transfer state conflict");
    const result = this.#database.prepare(
      `UPDATE guarded_fixture_transfers SET state = ?, encrypted_payload = ?, payload_nonce = ?, key_id = ?,
         simulation_units = ?, failure_code = ?, signing_attempted = ?, broadcast_attempted = ?, updated_at = ?
       WHERE id = ? AND state = ?`,
    ).run(
      input.state,
      input.encryptedPayload ?? current.encryptedPayload,
      input.payloadNonce ?? current.payloadNonce,
      input.keyId ?? current.keyId,
      input.simulationUnits ?? current.simulationUnits,
      input.failureCode === undefined ? current.failureCode : input.failureCode,
      Number(input.signingAttempted ?? current.signingAttempted),
      Number(input.broadcastAttempted ?? current.broadcastAttempted),
      input.now,
      input.id,
      input.expectedState,
    );
    if (Number(result.changes) !== 1) throw new Error("Guarded fixture transfer state conflict");
    return this.#requireGuardedFixtureTransfer(input.id);
  }

  getGuardedFixtureTransfer(id: string): GuardedFixtureTransferStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM guarded_fixture_transfers WHERE id = ?").get(id);
    return row === undefined ? null : toGuardedFixtureTransferStorageRecord(row);
  }

  listGuardedFixtureTransfers(limit = 20): GuardedFixtureTransferStorageRecord[] {
    return this.#database.prepare("SELECT * FROM guarded_fixture_transfers ORDER BY created_at DESC LIMIT ?")
      .all(limit).map(toGuardedFixtureTransferStorageRecord);
  }

  listPendingGuardedFixtureTransfers(): GuardedFixtureTransferStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM guarded_fixture_transfers WHERE state IN ('proposed', 'simulated', 'signed', 'broadcast', 'ambiguous') ORDER BY created_at",
    ).all().map(toGuardedFixtureTransferStorageRecord);
  }

  insertGuardedFixtureTransferApproval(record: GuardedFixtureTransferApprovalStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO guarded_fixture_transfer_approvals
        (transfer_id, fixture_manifest_digest, encrypted_payload, payload_nonce, key_id, approved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      record.transferId,
      record.fixtureManifestDigest,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.approvedAt,
    );
  }

  getGuardedFixtureTransferApproval(): GuardedFixtureTransferApprovalStorageRecord | null {
    const row = this.#database.prepare(
      "SELECT * FROM guarded_fixture_transfer_approvals ORDER BY approved_at DESC LIMIT 1",
    ).get();
    return row === undefined ? null : toGuardedFixtureTransferApprovalStorageRecord(row);
  }

  insertGuardedMissionAuthorization(record: GuardedMissionAuthorizationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO guarded_mission_authorizations
        (id, mission_id, mission_revision, plan_digest, desk_rule_digest, fixture_manifest_digest, fixture_transfer_id,
         state, encrypted_payload, payload_nonce, key_id, authorized_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL)`,
    ).run(
      record.id,
      record.missionId,
      record.missionRevision,
      record.planDigest,
      record.deskRuleDigest,
      record.fixtureManifestDigest,
      record.fixtureTransferId,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.authorizedAt,
    );
  }

  getActiveGuardedMissionAuthorization(): GuardedMissionAuthorizationStorageRecord | null {
    const row = this.#database.prepare(
      "SELECT * FROM guarded_mission_authorizations WHERE state = 'active'",
    ).get();
    return row === undefined ? null : toGuardedMissionAuthorizationStorageRecord(row);
  }

  listGuardedMissionAuthorizations(limit = 20): GuardedMissionAuthorizationStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM guarded_mission_authorizations ORDER BY authorized_at DESC LIMIT ?",
    ).all(limit).map(toGuardedMissionAuthorizationStorageRecord);
  }

  revokeGuardedMissionAuthorization(id: string, revokedAt: string): GuardedMissionAuthorizationStorageRecord {
    const result = this.#database.prepare(
      `UPDATE guarded_mission_authorizations SET state = 'revoked', revoked_at = ?
       WHERE id = ? AND state = 'active'`,
    ).run(revokedAt, id);
    if (Number(result.changes) !== 1) throw new Error("Guarded mission authorization revocation conflict");
    const row = this.#database.prepare("SELECT * FROM guarded_mission_authorizations WHERE id = ?").get(id);
    if (row === undefined) throw new Error("Guarded mission authorization does not exist");
    return toGuardedMissionAuthorizationStorageRecord(row);
  }

  insertGuardedSchedulerEvaluation(record: GuardedSchedulerEvaluationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO guarded_scheduler_evaluations
        (id, mission_id, mission_revision, cycle_number, authorization_id, outcome, reason_code,
         encrypted_payload, payload_nonce, key_id, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.id,
      record.missionId,
      record.missionRevision,
      record.cycle,
      record.authorizationId,
      record.outcome,
      record.reasonCode,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.evaluatedAt,
    );
  }

  getGuardedSchedulerEvaluation(
    missionId: string,
    missionRevision: number,
    cycle: number,
  ): GuardedSchedulerEvaluationStorageRecord | null {
    const row = this.#database.prepare(
      `SELECT * FROM guarded_scheduler_evaluations
       WHERE mission_id = ? AND mission_revision = ? AND cycle_number = ?`,
    ).get(missionId, missionRevision, cycle);
    return row === undefined ? null : toGuardedSchedulerEvaluationStorageRecord(row);
  }

  insertGuardedSchedulerArm(record: GuardedSchedulerArmStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO guarded_scheduler_arms
        (id, authorization_id, mission_id, mission_revision, plan_digest, desk_rule_digest,
         fixture_manifest_digest, scope, state, execution_id, encrypted_payload, payload_nonce,
         key_id, armed_at, expires_at, consumed_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'devnet-fixture-cycle-once', 'active', NULL, ?, ?, ?, ?, ?, NULL, NULL)`,
    ).run(record.id, record.authorizationId, record.missionId, record.missionRevision, record.planDigest,
      record.deskRuleDigest, record.fixtureManifestDigest, record.encryptedPayload, record.payloadNonce,
      record.keyId, record.armedAt, record.expiresAt);
  }

  getActiveGuardedSchedulerArm(now: string): GuardedSchedulerArmStorageRecord | null {
    this.#database.prepare(
      `UPDATE guarded_scheduler_arms SET state = 'expired', revoked_at = ?
       WHERE state = 'active' AND expires_at <= ?`,
    ).run(now, now);
    const row = this.#database.prepare("SELECT * FROM guarded_scheduler_arms WHERE state = 'active'").get();
    return row === undefined ? null : toGuardedSchedulerArmStorageRecord(row);
  }

  getGuardedSchedulerArm(id: string): GuardedSchedulerArmStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM guarded_scheduler_arms WHERE id = ?").get(id);
    return row === undefined ? null : toGuardedSchedulerArmStorageRecord(row);
  }

  listGuardedSchedulerArms(limit = 20): GuardedSchedulerArmStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM guarded_scheduler_arms ORDER BY armed_at DESC LIMIT ?",
    ).all(limit).map(toGuardedSchedulerArmStorageRecord);
  }

  consumeGuardedSchedulerArm(id: string, executionId: string, consumedAt: string): GuardedSchedulerArmStorageRecord {
    const result = this.#database.prepare(
      `UPDATE guarded_scheduler_arms SET state = 'consumed', execution_id = ?, consumed_at = ?
       WHERE id = ? AND state = 'active' AND expires_at > ?`,
    ).run(executionId, consumedAt, id, consumedAt);
    if (Number(result.changes) !== 1) throw new Error("Guarded scheduler arm consumption conflict");
    const record = this.getGuardedSchedulerArm(id);
    if (record === null) throw new Error("Guarded scheduler arm does not exist");
    return record;
  }

  revokeGuardedSchedulerArm(id: string, revokedAt: string): GuardedSchedulerArmStorageRecord {
    const result = this.#database.prepare(
      `UPDATE guarded_scheduler_arms SET state = 'revoked', revoked_at = ?
       WHERE id = ? AND state IN ('active', 'consumed')`,
    ).run(revokedAt, id);
    if (Number(result.changes) !== 1) throw new Error("Guarded scheduler arm revocation conflict");
    const record = this.getGuardedSchedulerArm(id);
    if (record === null) throw new Error("Guarded scheduler arm does not exist");
    return record;
  }

  revokeOpenGuardedSchedulerArms(revokedAt: string): number {
    const result = this.#database.prepare(
      `UPDATE guarded_scheduler_arms SET state = 'revoked', revoked_at = ?
       WHERE state IN ('active', 'consumed')`,
    ).run(revokedAt);
    return Number(result.changes);
  }

  createDevnetCanary(id: string, now: string): DevnetCanaryStorageRecord {
    this.#database
      .prepare(
        `INSERT INTO devnet_canary_executions (id, kind, state, created_at, updated_at)
         VALUES (?, 'self-transfer-zero-lamports', 'proposed', ?, ?)`,
      )
      .run(id, now, now);
    return this.#requireDevnetCanary(id);
  }

  updateDevnetCanary(input: {
    id: string;
    expectedState: DevnetCanaryStorageRecord["state"];
    state: DevnetCanaryStorageRecord["state"];
    now: string;
    encryptedWire?: string;
    wireNonce?: string;
    encryptedSignature?: string;
    signatureNonce?: string;
    keyId?: string;
    lastValidBlockHeight?: string;
    simulationUnits?: string;
    failureCode?: string | null;
    signingAttempted?: boolean;
    broadcastAttempted?: boolean;
  }): DevnetCanaryStorageRecord {
    const current = this.#requireDevnetCanary(input.id);
    if (current.state !== input.expectedState) throw new Error("Canary execution state conflict");
    const result = this.#database
      .prepare(
        `UPDATE devnet_canary_executions SET
           state = ?, encrypted_wire = ?, wire_nonce = ?, encrypted_signature = ?, signature_nonce = ?,
           key_id = ?, last_valid_block_height = ?, simulation_units = ?, failure_code = ?,
           signing_attempted = ?, broadcast_attempted = ?, updated_at = ?
         WHERE id = ? AND state = ?`,
      )
      .run(
        input.state,
        input.encryptedWire ?? current.encryptedWire,
        input.wireNonce ?? current.wireNonce,
        input.encryptedSignature ?? current.encryptedSignature,
        input.signatureNonce ?? current.signatureNonce,
        input.keyId ?? current.keyId,
        input.lastValidBlockHeight ?? current.lastValidBlockHeight,
        input.simulationUnits ?? current.simulationUnits,
        input.failureCode === undefined ? current.failureCode : input.failureCode,
        input.signingAttempted === undefined ? Number(current.signingAttempted) : Number(input.signingAttempted),
        input.broadcastAttempted === undefined ? Number(current.broadcastAttempted) : Number(input.broadcastAttempted),
        input.now,
        input.id,
        input.expectedState,
      );
    if (Number(result.changes) !== 1) throw new Error("Canary execution state conflict");
    return this.#requireDevnetCanary(input.id);
  }

  listDevnetCanaries(limit = 20): DevnetCanaryStorageRecord[] {
    return this.#database
      .prepare("SELECT * FROM devnet_canary_executions ORDER BY created_at DESC LIMIT ?")
      .all(limit)
      .map(toDevnetCanaryStorageRecord);
  }

  listPendingDevnetCanaries(): DevnetCanaryStorageRecord[] {
    return this.#database
      .prepare(
        "SELECT * FROM devnet_canary_executions WHERE state IN ('signed', 'broadcast', 'ambiguous') ORDER BY created_at",
      )
      .all()
      .map(toDevnetCanaryStorageRecord);
  }

  insertJupiterShadowQuote(record: JupiterShadowQuoteStorageRecord): void {
    this.#database
      .prepare(
        `INSERT INTO jupiter_shadow_quotes
          (id, encrypted_payload, payload_nonce, key_id, allowed, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.encryptedPayload,
        record.payloadNonce,
        record.keyId,
        Number(record.allowed),
        record.createdAt,
      );
  }

  listJupiterShadowQuotes(limit = 20): JupiterShadowQuoteStorageRecord[] {
    return (
      this.#database
        .prepare("SELECT * FROM jupiter_shadow_quotes ORDER BY created_at DESC LIMIT ?")
        .all(limit) as Array<{
        id: string;
        encrypted_payload: string;
        payload_nonce: string;
        key_id: string;
        allowed: number;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      encryptedPayload: row.encrypted_payload,
      payloadNonce: row.payload_nonce,
      keyId: row.key_id,
      allowed: row.allowed === 1,
      createdAt: row.created_at,
    }));
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

  #requireDevnetCanary(id: string): DevnetCanaryStorageRecord {
    const row = this.#database.prepare("SELECT * FROM devnet_canary_executions WHERE id = ?").get(id);
    if (row === undefined) throw new Error("Canary execution does not exist");
    return toDevnetCanaryStorageRecord(row);
  }

  #requireGuardedExecution(id: string): GuardedExecutionStorageRecord {
    const record = this.getGuardedExecution(id);
    if (record === null) throw new Error("Guarded execution does not exist");
    return record;
  }

  #requireFixtureProvision(id: string): FixtureProvisionStorageRecord {
    const record = this.getFixtureProvision(id);
    if (record === null) throw new Error("Fixture provision does not exist");
    return record;
  }

  #requireGuardedFixtureTransfer(id: string): GuardedFixtureTransferStorageRecord {
    const record = this.getGuardedFixtureTransfer(id);
    if (record === null) throw new Error("Guarded fixture transfer does not exist");
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

function toDevnetCanaryStorageRecord(row: unknown): DevnetCanaryStorageRecord {
  const value = row as {
    id: string;
    kind: DevnetCanaryStorageRecord["kind"];
    state: DevnetCanaryStorageRecord["state"];
    encrypted_wire: string | null;
    wire_nonce: string | null;
    encrypted_signature: string | null;
    signature_nonce: string | null;
    key_id: string | null;
    last_valid_block_height: string | null;
    simulation_units: string | null;
    failure_code: string | null;
    signing_attempted: number;
    broadcast_attempted: number;
    created_at: string;
    updated_at: string;
  };
  return {
    id: value.id,
    kind: value.kind,
    state: value.state,
    encryptedWire: value.encrypted_wire,
    wireNonce: value.wire_nonce,
    encryptedSignature: value.encrypted_signature,
    signatureNonce: value.signature_nonce,
    keyId: value.key_id,
    lastValidBlockHeight: value.last_valid_block_height,
    simulationUnits: value.simulation_units,
    failureCode: value.failure_code,
    signingAttempted: value.signing_attempted === 1,
    broadcastAttempted: value.broadcast_attempted === 1,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function toGuardedExecutionStorageRecord(row: unknown): GuardedExecutionStorageRecord {
  const value = row as {
    id: string;
    mission_id: string;
    mission_revision: number;
    cycle_number: number;
    fixture_manifest_digest: string;
    state: GuardedExecutionStorageState;
    message_hash: string | null;
    signing_attempted: number;
    broadcast_attempted: number;
    failure_code: string | null;
    created_at: string;
    updated_at: string;
  };
  return {
    id: value.id,
    missionId: value.mission_id,
    missionRevision: value.mission_revision,
    cycle: value.cycle_number,
    fixtureManifestDigest: value.fixture_manifest_digest,
    state: value.state,
    messageHash: value.message_hash,
    signingAttempted: value.signing_attempted === 1,
    broadcastAttempted: value.broadcast_attempted === 1,
    failureCode: value.failure_code,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function toGuardedExecutionEventStorageRecord(row: unknown): GuardedExecutionEventStorageRecord {
  const value = row as {
    id: string;
    execution_id: string;
    from_state: GuardedExecutionStorageState | null;
    to_state: GuardedExecutionStorageState;
    event_name: string;
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    created_at: string;
  };
  return {
    id: value.id,
    executionId: value.execution_id,
    fromState: value.from_state,
    toState: value.to_state,
    eventName: value.event_name,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    createdAt: value.created_at,
  };
}

function toFixtureProvisionStorageRecord(row: unknown): FixtureProvisionStorageRecord {
  const value = row as {
    id: string;
    mint_address: string;
    state: FixtureProvisionStorageRecord["state"];
    message_hash: string;
    encrypted_payload: string | null;
    payload_nonce: string | null;
    key_id: string | null;
    last_valid_block_height: string;
    simulation_units: string | null;
    failure_code: string | null;
    signing_attempted: number;
    broadcast_attempted: number;
    created_at: string;
    updated_at: string;
  };
  return {
    id: value.id,
    mintAddress: value.mint_address,
    state: value.state,
    messageHash: value.message_hash,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    lastValidBlockHeight: value.last_valid_block_height,
    simulationUnits: value.simulation_units,
    failureCode: value.failure_code,
    signingAttempted: value.signing_attempted === 1,
    broadcastAttempted: value.broadcast_attempted === 1,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function toFixtureReviewStorageRecord(row: unknown): FixtureReviewStorageRecord {
  const value = row as {
    provision_id: string;
    manifest_digest: string;
    mint_address: string;
    source_token_account: string;
    destination_token_account: string;
    wallet_authority: string;
    destination_owner: string;
    observed_slot: string;
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    active: number;
    created_at: string;
  };
  return {
    provisionId: value.provision_id,
    manifestDigest: value.manifest_digest,
    mintAddress: value.mint_address,
    sourceTokenAccount: value.source_token_account,
    destinationTokenAccount: value.destination_token_account,
    walletAuthority: value.wallet_authority,
    destinationOwner: value.destination_owner,
    observedSlot: value.observed_slot,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    active: true,
    createdAt: value.created_at,
  };
}

function toGuardedFixtureTransferStorageRecord(row: unknown): GuardedFixtureTransferStorageRecord {
  const value = row as {
    id: string;
    fixture_manifest_digest: string;
    state: GuardedFixtureTransferStorageRecord["state"];
    message_hash: string;
    encrypted_payload: string | null;
    payload_nonce: string | null;
    key_id: string | null;
    last_valid_block_height: string;
    simulation_units: string | null;
    failure_code: string | null;
    signing_attempted: number;
    broadcast_attempted: number;
    created_at: string;
    updated_at: string;
  };
  return {
    id: value.id,
    fixtureManifestDigest: value.fixture_manifest_digest,
    state: value.state,
    messageHash: value.message_hash,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    lastValidBlockHeight: value.last_valid_block_height,
    simulationUnits: value.simulation_units,
    failureCode: value.failure_code,
    signingAttempted: value.signing_attempted === 1,
    broadcastAttempted: value.broadcast_attempted === 1,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function toGuardedFixtureTransferApprovalStorageRecord(row: unknown): GuardedFixtureTransferApprovalStorageRecord {
  const value = row as {
    transfer_id: string;
    fixture_manifest_digest: string;
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    approved_at: string;
  };
  return {
    transferId: value.transfer_id,
    fixtureManifestDigest: value.fixture_manifest_digest,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    approvedAt: value.approved_at,
  };
}

function toGuardedMissionAuthorizationStorageRecord(row: unknown): GuardedMissionAuthorizationStorageRecord {
  const value = row as {
    id: string;
    mission_id: string;
    mission_revision: number;
    plan_digest: string;
    desk_rule_digest: string;
    fixture_manifest_digest: string;
    fixture_transfer_id: string;
    state: "active" | "revoked";
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    authorized_at: string;
    revoked_at: string | null;
  };
  return {
    id: value.id,
    missionId: value.mission_id,
    missionRevision: value.mission_revision,
    planDigest: value.plan_digest,
    deskRuleDigest: value.desk_rule_digest,
    fixtureManifestDigest: value.fixture_manifest_digest,
    fixtureTransferId: value.fixture_transfer_id,
    state: value.state,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    authorizedAt: value.authorized_at,
    revokedAt: value.revoked_at,
  };
}

function toGuardedSchedulerEvaluationStorageRecord(row: unknown): GuardedSchedulerEvaluationStorageRecord {
  const value = row as {
    id: string;
    mission_id: string;
    mission_revision: number;
    cycle_number: number;
    authorization_id: string | null;
    outcome: "inactive" | "ready" | "denied";
    reason_code: string;
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    evaluated_at: string;
  };
  return {
    id: value.id,
    missionId: value.mission_id,
    missionRevision: value.mission_revision,
    cycle: value.cycle_number,
    authorizationId: value.authorization_id,
    outcome: value.outcome,
    reasonCode: value.reason_code,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    evaluatedAt: value.evaluated_at,
  };
}

function toGuardedSchedulerArmStorageRecord(row: unknown): GuardedSchedulerArmStorageRecord {
  const value = row as {
    id: string; authorization_id: string; mission_id: string; mission_revision: number;
    plan_digest: string; desk_rule_digest: string; fixture_manifest_digest: string;
    scope: "devnet-fixture-cycle-once"; state: GuardedSchedulerArmStorageRecord["state"];
    execution_id: string | null; encrypted_payload: string; payload_nonce: string; key_id: string;
    armed_at: string; expires_at: string; consumed_at: string | null; revoked_at: string | null;
  };
  return {
    id: value.id, authorizationId: value.authorization_id, missionId: value.mission_id,
    missionRevision: value.mission_revision, planDigest: value.plan_digest,
    deskRuleDigest: value.desk_rule_digest, fixtureManifestDigest: value.fixture_manifest_digest,
    scope: value.scope, state: value.state, executionId: value.execution_id,
    encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce, keyId: value.key_id,
    armedAt: value.armed_at, expiresAt: value.expires_at, consumedAt: value.consumed_at,
    revokedAt: value.revoked_at,
  };
}
