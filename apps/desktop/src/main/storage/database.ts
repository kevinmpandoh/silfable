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

export type AiShadowTradeEvaluationStorageRecord = {
  id: string;
  quoteId: string;
  proposalDigest: string;
  outcome: "hold" | "would-execute" | "blocked";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  signingAttempted: false;
  executionAttempted: false;
  evaluatedAt: string;
  approvalState: "not-actionable" | "pending" | "approved" | "rejected" | "expired";
  approvalExpiresAt: string | null;
  decidedAt: string | null;
};

export type MarketObservationStorageRecord = {
  id: string;
  sourceQuoteId: string;
  observationDigest: string;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  observedAt: string;
  capturedAt: string;
  expiresAt: string;
  modelCallsAttempted: false;
  signingAttempted: false;
  executionAttempted: false;
};

export type MarketWatchStorageRecord = {
  id: string;
  state: "active" | "triggered" | "paused";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  nextCheckAt: string;
  lastCheckedAt: string | null;
  triggeredAt: string | null;
  pausedAt: string | null;
  lastObservationId: string | null;
  consecutiveFailures: number;
  modelCallsAttempted: false;
  executionEnabled: false;
  createdAt: string;
  updatedAt: string;
};

export type MarketWakeReceiptStorageRecord = {
  id: string;
  watchId: string;
  observationId: string | null;
  outcome: "waiting" | "triggered" | "failed";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  evaluatedAt: string;
  modelCallsAttempted: false;
  signingAttempted: false;
  executionAttempted: false;
};

export type AgentSessionStorageRecord = {
  id: string;
  state: "active" | "halted" | "expired";
  provider: "openai" | "anthropic";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  deadlineAt: string;
  haltedAt: string | null;
  haltReason: "operator" | "ai-halt" | "deadline" | "policy-denial" | null;
  executionEnabled: false;
  createdAt: string;
  updatedAt: string;
};

export type AgentIntentEvaluationStorageRecord = {
  id: string;
  sessionId: string;
  observationId: string;
  quoteId: string;
  proposalDigest: string;
  outcome: "pending-approval" | "hold" | "halted" | "blocked";
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  approvalState: "not-actionable" | "pending" | "approved" | "rejected" | "expired";
  approvalExpiresAt: string | null;
  decidedAt: string | null;
  modelCallsAttempted: true;
  signingAttempted: false;
  executionAttempted: false;
  evaluatedAt: string;
};

export type AgentDevnetSimulationStorageRecord = {
  id: string;
  evaluationId: string;
  sessionId: string;
  proposalDigest: string;
  outcome: "simulated" | "failed";
  fixtureManifestDigest: string;
  messageHash: string | null;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  signingAttempted: false;
  broadcastAttempted: false;
  executionAttempted: false;
  simulatedAt: string;
};

export type AgentDevnetSigningArmStorageRecord = {
  id: string;
  simulationId: string;
  evaluationId: string;
  sessionId: string;
  proposalDigest: string;
  fixtureManifestDigest: string;
  messageHash: string;
  scope: "agent-devnet-fixture-sign-once";
  state: "active" | "consumed" | "revoked" | "expired";
  executionId: string | null;
  encryptedPayload: string;
  payloadNonce: string;
  keyId: string;
  executionBridgeConnected: false;
  mainnetEnabled: false;
  armedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
};

export type AgentDevnetPreSignExecutionStorageRecord = {
  id: string; signingArmId: string; simulationId: string; evaluationId: string; sessionId: string;
  proposalDigest: string; fixtureManifestDigest: string; messageHash: string;
  state: "ready-for-signing" | "failed"; failureCode: string | null;
  encryptedPayload: string; payloadNonce: string; keyId: string;
  signingAttempted: false; broadcastAttempted: false; executionAttempted: false; preparedAt: string;
};

export type AgentDevnetSignedExecutionStorageRecord = {
  id: string; preSignExecutionId: string; signingArmId: string; simulationId: string;
  evaluationId: string; sessionId: string; messageHash: string;
  state: "proposed" | "signing" | "signed-awaiting-broadcast" | "failed";
  signatureHash: string | null; failureCode: string | null; encryptedPayload: string;
  payloadNonce: string; keyId: string; signingAttempted: boolean;
  broadcastAttempted: false; executionAttempted: false; createdAt: string; updatedAt: string;
};

export type AgentDevnetBroadcastExecutionStorageRecord = {
  id: string; signedExecutionId: string; preSignExecutionId: string; simulationId: string;
  evaluationId: string; sessionId: string; messageHash: string; signatureHash: string;
  lastValidBlockHeight: string; state: "proposed" | "broadcast" | "confirmed" | "failed" | "ambiguous";
  failureCode: string | null; encryptedPayload: string; payloadNonce: string; keyId: string;
  broadcastAttempted: boolean; executionAttempted: boolean; fixtureTransferPerformed: boolean;
  createdAt: string; updatedAt: string;
};

export type AgentDevnetSwapQuoteStorageRecord = {
  id: string; evaluationId: string; sessionId: string; action: "buy-sol" | "sell-sol"; allowed: boolean;
  encryptedPayload: string; payloadNonce: string; keyId: string; quotedAt: string; expiresAt: string;
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

  insertMarketObservation(record: MarketObservationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO market_observations
        (id, source_quote_id, observation_digest, encrypted_payload, payload_nonce, key_id,
         observed_at, captured_at, expires_at, model_calls_attempted, signing_attempted, execution_attempted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    ).run(
      record.id,
      record.sourceQuoteId,
      record.observationDigest,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.observedAt,
      record.capturedAt,
      record.expiresAt,
    );
  }

  listMarketObservations(limit = 20): MarketObservationStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM market_observations ORDER BY captured_at DESC LIMIT ?",
    ).all(limit).map(toMarketObservationStorageRecord);
  }

  insertMarketWatch(record: MarketWatchStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO market_watches
        (id, state, encrypted_payload, payload_nonce, key_id, next_check_at, last_checked_at,
         triggered_at, paused_at, last_observation_id, consecutive_failures,
         model_calls_attempted, execution_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    ).run(
      record.id, record.state, record.encryptedPayload, record.payloadNonce, record.keyId,
      record.nextCheckAt, record.lastCheckedAt, record.triggeredAt, record.pausedAt,
      record.lastObservationId, record.consecutiveFailures, record.createdAt, record.updatedAt,
    );
  }

  getMarketWatch(id: string): MarketWatchStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM market_watches WHERE id = ?").get(id);
    return row === undefined ? null : toMarketWatchStorageRecord(row);
  }

  getDueMarketWatch(now: string): MarketWatchStorageRecord | null {
    const row = this.#database.prepare(
      "SELECT * FROM market_watches WHERE state = 'active' AND next_check_at <= ? ORDER BY next_check_at LIMIT 1",
    ).get(now);
    return row === undefined ? null : toMarketWatchStorageRecord(row);
  }

  listMarketWatches(limit = 20): MarketWatchStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM market_watches ORDER BY updated_at DESC LIMIT ?",
    ).all(limit).map(toMarketWatchStorageRecord);
  }

  pauseMarketWatch(id: string, pausedAt: string): MarketWatchStorageRecord {
    const result = this.#database.prepare(
      `UPDATE market_watches SET state = 'paused', paused_at = ?, updated_at = ?
       WHERE id = ? AND state = 'active'`,
    ).run(pausedAt, pausedAt, id);
    if (Number(result.changes) !== 1) throw new Error("Active market watch does not exist");
    const record = this.getMarketWatch(id);
    if (record === null) throw new Error("Market watch does not exist");
    return record;
  }

  recordMarketWake(input: {
    watchId: string;
    state: "active" | "triggered" | "paused";
    nextCheckAt: string;
    checkedAt: string;
    triggeredAt: string | null;
    pausedAt: string | null;
    observationId: string | null;
    consecutiveFailures: number;
    receipt: MarketWakeReceiptStorageRecord;
  }): MarketWatchStorageRecord {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(
        `UPDATE market_watches SET state = ?, next_check_at = ?, last_checked_at = ?,
         triggered_at = ?, paused_at = ?, last_observation_id = ?, consecutive_failures = ?, updated_at = ?
         WHERE id = ? AND state = 'active'`,
      ).run(
        input.state, input.nextCheckAt, input.checkedAt, input.triggeredAt, input.pausedAt,
        input.observationId, input.consecutiveFailures, input.checkedAt, input.watchId,
      );
      if (Number(result.changes) !== 1) throw new Error("Market watch changed during evaluation");
      this.#database.prepare(
        `INSERT INTO market_wake_receipts
          (id, watch_id, observation_id, outcome, encrypted_payload, payload_nonce, key_id,
           evaluated_at, model_calls_attempted, signing_attempted, execution_attempted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
      ).run(
        input.receipt.id, input.receipt.watchId, input.receipt.observationId, input.receipt.outcome,
        input.receipt.encryptedPayload, input.receipt.payloadNonce, input.receipt.keyId,
        input.receipt.evaluatedAt,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const record = this.getMarketWatch(input.watchId);
    if (record === null) throw new Error("Market watch does not exist");
    return record;
  }

  listMarketWakeReceipts(limit = 20): MarketWakeReceiptStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM market_wake_receipts ORDER BY evaluated_at DESC LIMIT ?",
    ).all(limit).map(toMarketWakeReceiptStorageRecord);
  }

  insertAgentSession(record: AgentSessionStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_sessions
        (id, state, provider, encrypted_payload, payload_nonce, key_id, deadline_at,
         halted_at, halt_reason, execution_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      record.id, record.state, record.provider, record.encryptedPayload, record.payloadNonce,
      record.keyId, record.deadlineAt, record.haltedAt, record.haltReason, record.createdAt, record.updatedAt,
    );
  }

  expireAgentSessions(now: string): number {
    const result = this.#database.prepare(
      `UPDATE agent_sessions SET state = 'expired', halted_at = ?, halt_reason = 'deadline', updated_at = ?
       WHERE state = 'active' AND deadline_at <= ?`,
    ).run(now, now, now);
    return Number(result.changes);
  }

  getAgentSession(id: string): AgentSessionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(id);
    return row === undefined ? null : toAgentSessionStorageRecord(row);
  }

  listAgentSessions(limit = 20): AgentSessionStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_sessions ORDER BY updated_at DESC LIMIT ?")
      .all(limit).map(toAgentSessionStorageRecord);
  }

  haltAgentSession(id: string, reason: AgentSessionStorageRecord["haltReason"], haltedAt: string): AgentSessionStorageRecord {
    const result = this.#database.prepare(
      `UPDATE agent_sessions SET state = 'halted', halted_at = ?, halt_reason = ?, updated_at = ?
       WHERE id = ? AND state = 'active'`,
    ).run(haltedAt, reason, haltedAt, id);
    if (Number(result.changes) !== 1) throw new Error("Active agent session does not exist");
    const record = this.getAgentSession(id);
    if (record === null) throw new Error("Agent session does not exist");
    return record;
  }

  insertAgentIntentEvaluation(record: AgentIntentEvaluationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_intent_evaluations
        (id, session_id, observation_id, quote_id, proposal_digest, outcome,
         encrypted_payload, payload_nonce, key_id, approval_state, approval_expires_at,
         decided_at, model_calls_attempted, signing_attempted, execution_attempted, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?)`,
    ).run(
      record.id, record.sessionId, record.observationId, record.quoteId, record.proposalDigest,
      record.outcome, record.encryptedPayload, record.payloadNonce, record.keyId,
      record.approvalState, record.approvalExpiresAt, record.decidedAt, record.evaluatedAt,
    );
  }

  expireAgentIntentApprovals(now: string): number {
    const result = this.#database.prepare(
      `UPDATE agent_intent_evaluations SET approval_state = 'expired', decided_at = ?
       WHERE approval_state IN ('pending', 'approved') AND approval_expires_at <= ?`,
    ).run(now, now);
    return Number(result.changes);
  }

  getAgentIntentEvaluation(id: string): AgentIntentEvaluationStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_intent_evaluations WHERE id = ?").get(id);
    return row === undefined ? null : toAgentIntentEvaluationStorageRecord(row);
  }

  listAgentIntentEvaluations(limit = 20): AgentIntentEvaluationStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_intent_evaluations ORDER BY evaluated_at DESC LIMIT ?")
      .all(limit).map(toAgentIntentEvaluationStorageRecord);
  }

  approveAgentIntent(input: { id: string; expectedProposalDigest: string; decidedAt: string }): AgentIntentEvaluationStorageRecord {
    this.expireAgentIntentApprovals(input.decidedAt);
    const result = this.#database.prepare(
      `UPDATE agent_intent_evaluations SET approval_state = 'approved', decided_at = ?
       WHERE id = ? AND proposal_digest = ? AND approval_state = 'pending' AND approval_expires_at > ?`,
    ).run(input.decidedAt, input.id, input.expectedProposalDigest, input.decidedAt);
    if (Number(result.changes) !== 1) throw new Error("Agent intent approval conflict or expiry");
    const record = this.getAgentIntentEvaluation(input.id);
    if (record === null) throw new Error("Agent intent evaluation does not exist");
    return record;
  }

  rejectAgentIntent(input: { id: string; expectedProposalDigest: string; decidedAt: string }): AgentIntentEvaluationStorageRecord {
    this.expireAgentIntentApprovals(input.decidedAt);
    const result = this.#database.prepare(
      `UPDATE agent_intent_evaluations SET approval_state = 'rejected', decided_at = ?
       WHERE id = ? AND proposal_digest = ? AND approval_state IN ('pending', 'approved')`,
    ).run(input.decidedAt, input.id, input.expectedProposalDigest);
    if (Number(result.changes) !== 1) throw new Error("Agent intent rejection conflict or expiry");
    const record = this.getAgentIntentEvaluation(input.id);
    if (record === null) throw new Error("Agent intent evaluation does not exist");
    return record;
  }

  insertAgentDevnetSimulation(record: AgentDevnetSimulationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_simulations
        (id, evaluation_id, session_id, proposal_digest, outcome, fixture_manifest_digest,
         message_hash, encrypted_payload, payload_nonce, key_id, signing_attempted,
         broadcast_attempted, execution_attempted, simulated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    ).run(
      record.id, record.evaluationId, record.sessionId, record.proposalDigest, record.outcome,
      record.fixtureManifestDigest, record.messageHash, record.encryptedPayload, record.payloadNonce,
      record.keyId, record.simulatedAt,
    );
  }

  listAgentDevnetSimulations(limit = 20): AgentDevnetSimulationStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_simulations ORDER BY simulated_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetSimulationStorageRecord);
  }

  getAgentDevnetSimulationByEvaluation(evaluationId: string): AgentDevnetSimulationStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_simulations WHERE evaluation_id = ?").get(evaluationId);
    return row === undefined ? null : toAgentDevnetSimulationStorageRecord(row);
  }

  getAgentDevnetSimulation(id: string): AgentDevnetSimulationStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_simulations WHERE id = ?").get(id);
    return row === undefined ? null : toAgentDevnetSimulationStorageRecord(row);
  }

  insertAgentDevnetSigningArm(record: AgentDevnetSigningArmStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_signing_arms
        (id, simulation_id, evaluation_id, session_id, proposal_digest, fixture_manifest_digest,
         message_hash, scope, state, execution_id, encrypted_payload, payload_nonce, key_id,
         execution_bridge_connected, mainnet_enabled, armed_at, expires_at, consumed_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'agent-devnet-fixture-sign-once', 'active', NULL, ?, ?, ?, 0, 0, ?, ?, NULL, NULL)`,
    ).run(
      record.id, record.simulationId, record.evaluationId, record.sessionId, record.proposalDigest,
      record.fixtureManifestDigest, record.messageHash, record.encryptedPayload, record.payloadNonce,
      record.keyId, record.armedAt, record.expiresAt,
    );
  }

  getActiveAgentDevnetSigningArm(now: string): AgentDevnetSigningArmStorageRecord | null {
    this.#database.prepare(
      `UPDATE agent_devnet_signing_arms SET state = 'expired', revoked_at = ?
       WHERE state = 'active' AND expires_at <= ?`,
    ).run(now, now);
    const row = this.#database.prepare("SELECT * FROM agent_devnet_signing_arms WHERE state = 'active'").get();
    return row === undefined ? null : toAgentDevnetSigningArmStorageRecord(row);
  }

  getAgentDevnetSigningArm(id: string): AgentDevnetSigningArmStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_signing_arms WHERE id = ?").get(id);
    return row === undefined ? null : toAgentDevnetSigningArmStorageRecord(row);
  }

  listAgentDevnetSigningArms(limit = 20): AgentDevnetSigningArmStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_signing_arms ORDER BY armed_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetSigningArmStorageRecord);
  }

  revokeAgentDevnetSigningArm(id: string, revokedAt: string): AgentDevnetSigningArmStorageRecord {
    const result = this.#database.prepare(
      `UPDATE agent_devnet_signing_arms SET state = 'revoked', revoked_at = ? WHERE id = ? AND state = 'active'`,
    ).run(revokedAt, id);
    if (Number(result.changes) !== 1) throw new Error("Agent Devnet signing arm revocation conflict");
    const record = this.getAgentDevnetSigningArm(id);
    if (record === null) throw new Error("Agent Devnet signing arm does not exist");
    return record;
  }

  revokeOpenAgentDevnetSigningArms(revokedAt: string): number {
    const result = this.#database.prepare(
      `UPDATE agent_devnet_signing_arms SET state = 'revoked', revoked_at = ? WHERE state = 'active'`,
    ).run(revokedAt);
    return Number(result.changes);
  }

  insertFailedAgentDevnetPreSignExecution(record: AgentDevnetPreSignExecutionStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_pre_sign_executions
        (id, signing_arm_id, simulation_id, evaluation_id, session_id, proposal_digest,
         fixture_manifest_digest, message_hash, state, failure_code, encrypted_payload,
         payload_nonce, key_id, signing_attempted, broadcast_attempted, execution_attempted, prepared_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, 0, 0, 0, ?)`,
    ).run(record.id, record.signingArmId, record.simulationId, record.evaluationId, record.sessionId,
      record.proposalDigest, record.fixtureManifestDigest, record.messageHash, record.failureCode,
      record.encryptedPayload, record.payloadNonce, record.keyId, record.preparedAt);
  }

  consumeAgentDevnetSigningArmAndCreateExecution(record: AgentDevnetPreSignExecutionStorageRecord): void {
    this.#transaction(() => {
      const result = this.#database.prepare(
        `UPDATE agent_devnet_signing_arms SET state = 'consumed', execution_id = ?, consumed_at = ?
         WHERE id = ? AND state = 'active' AND expires_at > ? AND message_hash = ?`,
      ).run(record.id, record.preparedAt, record.signingArmId, record.preparedAt, record.messageHash);
      if (Number(result.changes) !== 1) throw new Error("Agent Devnet signing arm consumption conflict");
      this.#database.prepare(
        `INSERT INTO agent_devnet_pre_sign_executions
          (id, signing_arm_id, simulation_id, evaluation_id, session_id, proposal_digest,
           fixture_manifest_digest, message_hash, state, failure_code, encrypted_payload,
           payload_nonce, key_id, signing_attempted, broadcast_attempted, execution_attempted, prepared_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready-for-signing', NULL, ?, ?, ?, 0, 0, 0, ?)`,
      ).run(record.id, record.signingArmId, record.simulationId, record.evaluationId, record.sessionId,
        record.proposalDigest, record.fixtureManifestDigest, record.messageHash,
        record.encryptedPayload, record.payloadNonce, record.keyId, record.preparedAt);
    });
  }

  listAgentDevnetPreSignExecutions(limit = 20): AgentDevnetPreSignExecutionStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_pre_sign_executions ORDER BY prepared_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetPreSignExecutionStorageRecord);
  }

  insertAgentDevnetSignedExecution(record: AgentDevnetSignedExecutionStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_signed_executions
        (id, pre_sign_execution_id, signing_arm_id, simulation_id, evaluation_id, session_id,
         message_hash, state, signature_hash, failure_code, encrypted_payload, payload_nonce, key_id,
         signing_attempted, broadcast_attempted, execution_attempted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, NULL, ?, ?, ?, 0, 0, 0, ?, ?)`,
    ).run(record.id, record.preSignExecutionId, record.signingArmId, record.simulationId,
      record.evaluationId, record.sessionId, record.messageHash, record.encryptedPayload,
      record.payloadNonce, record.keyId, record.createdAt, record.updatedAt);
  }

  transitionAgentDevnetSignedExecution(input: {
    id: string; expectedState: AgentDevnetSignedExecutionStorageRecord["state"];
    state: AgentDevnetSignedExecutionStorageRecord["state"]; signatureHash?: string | null;
    failureCode?: string | null; encryptedPayload: string; payloadNonce: string; keyId: string;
    signingAttempted: boolean; updatedAt: string;
  }): AgentDevnetSignedExecutionStorageRecord {
    const result = this.#database.prepare(
      `UPDATE agent_devnet_signed_executions
       SET state = ?, signature_hash = ?, failure_code = ?, encrypted_payload = ?, payload_nonce = ?,
           key_id = ?, signing_attempted = ?, updated_at = ?
       WHERE id = ? AND state = ?`,
    ).run(input.state, input.signatureHash ?? null, input.failureCode ?? null,
      input.encryptedPayload, input.payloadNonce, input.keyId, Number(input.signingAttempted),
      input.updatedAt, input.id, input.expectedState);
    if (Number(result.changes) !== 1) throw new Error("Agent Devnet signing journal transition conflict");
    const row = this.#database.prepare("SELECT * FROM agent_devnet_signed_executions WHERE id = ?").get(input.id);
    if (row === undefined) throw new Error("Agent Devnet signing journal does not exist");
    return toAgentDevnetSignedExecutionStorageRecord(row);
  }

  getAgentDevnetSignedExecutionByPreSign(preSignExecutionId: string): AgentDevnetSignedExecutionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_signed_executions WHERE pre_sign_execution_id = ?").get(preSignExecutionId);
    return row === undefined ? null : toAgentDevnetSignedExecutionStorageRecord(row);
  }

  getAgentDevnetSignedExecution(id: string): AgentDevnetSignedExecutionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_signed_executions WHERE id = ?").get(id);
    return row === undefined ? null : toAgentDevnetSignedExecutionStorageRecord(row);
  }

  listAgentDevnetSignedExecutions(limit = 20): AgentDevnetSignedExecutionStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_signed_executions ORDER BY updated_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetSignedExecutionStorageRecord);
  }

  failOpenAgentDevnetSignedExecutions(updatedAt: string): number {
    const result = this.#database.prepare(
      `UPDATE agent_devnet_signed_executions
       SET state = 'failed', failure_code = 'restart-before-sign-complete', updated_at = ?
       WHERE state IN ('proposed', 'signing')`,
    ).run(updatedAt);
    return Number(result.changes);
  }

  insertAgentDevnetBroadcastExecution(record: AgentDevnetBroadcastExecutionStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_broadcast_executions
        (id, signed_execution_id, pre_sign_execution_id, simulation_id, evaluation_id, session_id,
         message_hash, signature_hash, last_valid_block_height, state, failure_code, encrypted_payload,
         payload_nonce, key_id, broadcast_attempted, execution_attempted, fixture_transfer_performed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, ?, ?, ?, 0, 0, 0, ?, ?)`,
    ).run(record.id, record.signedExecutionId, record.preSignExecutionId, record.simulationId,
      record.evaluationId, record.sessionId, record.messageHash, record.signatureHash,
      record.lastValidBlockHeight, record.encryptedPayload, record.payloadNonce, record.keyId,
      record.createdAt, record.updatedAt);
  }

  transitionAgentDevnetBroadcastExecution(input: {
    id: string; expectedState: AgentDevnetBroadcastExecutionStorageRecord["state"];
    state: AgentDevnetBroadcastExecutionStorageRecord["state"]; failureCode?: string | null;
    encryptedPayload: string; payloadNonce: string; keyId: string; broadcastAttempted: boolean;
    executionAttempted: boolean; fixtureTransferPerformed: boolean; updatedAt: string;
    requireCurrentAuthorization?: boolean;
  }): AgentDevnetBroadcastExecutionStorageRecord {
    const result = this.#database.prepare(
      `UPDATE agent_devnet_broadcast_executions SET state = ?, failure_code = ?, encrypted_payload = ?,
       payload_nonce = ?, key_id = ?, broadcast_attempted = ?, execution_attempted = ?,
       fixture_transfer_performed = ?, updated_at = ? WHERE id = ? AND state = ?
       AND (? = 0 OR EXISTS (
         SELECT 1 FROM agent_intent_evaluations evaluation
         JOIN agent_sessions session ON session.id = evaluation.session_id
         WHERE evaluation.id = agent_devnet_broadcast_executions.evaluation_id
           AND evaluation.approval_state = 'approved' AND evaluation.approval_expires_at IS NOT NULL
           AND evaluation.approval_expires_at > ? AND session.state = 'active'
       ))`,
    ).run(input.state, input.failureCode ?? null, input.encryptedPayload, input.payloadNonce, input.keyId,
      Number(input.broadcastAttempted), Number(input.executionAttempted), Number(input.fixtureTransferPerformed),
      input.updatedAt, input.id, input.expectedState, Number(input.requireCurrentAuthorization ?? false), input.updatedAt);
    if (Number(result.changes) !== 1) throw new Error("Agent Devnet broadcast journal transition conflict");
    const row = this.#database.prepare("SELECT * FROM agent_devnet_broadcast_executions WHERE id = ?").get(input.id);
    if (row === undefined) throw new Error("Agent Devnet broadcast journal does not exist");
    return toAgentDevnetBroadcastExecutionStorageRecord(row);
  }

  getAgentDevnetBroadcastExecutionBySigned(signedExecutionId: string): AgentDevnetBroadcastExecutionStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_broadcast_executions WHERE signed_execution_id = ?").get(signedExecutionId);
    return row === undefined ? null : toAgentDevnetBroadcastExecutionStorageRecord(row);
  }

  listAgentDevnetBroadcastExecutions(limit = 20): AgentDevnetBroadcastExecutionStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_broadcast_executions ORDER BY updated_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetBroadcastExecutionStorageRecord);
  }

  listPendingAgentDevnetBroadcastExecutions(): AgentDevnetBroadcastExecutionStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_broadcast_executions WHERE state IN ('proposed', 'broadcast', 'ambiguous') ORDER BY created_at")
      .all().map(toAgentDevnetBroadcastExecutionStorageRecord);
  }

  insertAgentDevnetSwapQuote(record: AgentDevnetSwapQuoteStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO agent_devnet_swap_quotes (id, evaluation_id, session_id, action, allowed, encrypted_payload,
       payload_nonce, key_id, quoted_at, expires_at, transaction_built, signing_attempted, broadcast_attempted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    ).run(record.id, record.evaluationId, record.sessionId, record.action, Number(record.allowed),
      record.encryptedPayload, record.payloadNonce, record.keyId, record.quotedAt, record.expiresAt);
  }

  getAgentDevnetSwapQuoteByEvaluation(evaluationId: string): AgentDevnetSwapQuoteStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM agent_devnet_swap_quotes WHERE evaluation_id = ?").get(evaluationId);
    return row === undefined ? null : toAgentDevnetSwapQuoteStorageRecord(row);
  }

  listAgentDevnetSwapQuotes(limit = 20): AgentDevnetSwapQuoteStorageRecord[] {
    return this.#database.prepare("SELECT * FROM agent_devnet_swap_quotes ORDER BY quoted_at DESC LIMIT ?")
      .all(limit).map(toAgentDevnetSwapQuoteStorageRecord);
  }

  insertAiShadowTradeEvaluation(record: AiShadowTradeEvaluationStorageRecord): void {
    this.#database.prepare(
      `INSERT INTO ai_shadow_trade_evaluations
        (id, quote_id, proposal_digest, outcome, encrypted_payload, payload_nonce, key_id,
         signing_attempted, execution_attempted, evaluated_at, approval_state, approval_expires_at, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
    ).run(
      record.id,
      record.quoteId,
      record.proposalDigest,
      record.outcome,
      record.encryptedPayload,
      record.payloadNonce,
      record.keyId,
      record.evaluatedAt,
      record.approvalState,
      record.approvalExpiresAt,
      record.decidedAt,
    );
  }

  expireOpenAiShadowTradeApprovals(now: string): number {
    const result = this.#database.prepare(
      `UPDATE ai_shadow_trade_evaluations
       SET approval_state = 'expired', decided_at = ?
       WHERE approval_state IN ('pending', 'approved') AND approval_expires_at <= ?`,
    ).run(now, now);
    return Number(result.changes);
  }

  listAiShadowTradeEvaluations(limit = 20): AiShadowTradeEvaluationStorageRecord[] {
    return this.#database.prepare(
      "SELECT * FROM ai_shadow_trade_evaluations ORDER BY evaluated_at DESC LIMIT ?",
    ).all(limit).map(toAiShadowTradeEvaluationStorageRecord);
  }

  getAiShadowTradeEvaluation(id: string): AiShadowTradeEvaluationStorageRecord | null {
    const row = this.#database.prepare("SELECT * FROM ai_shadow_trade_evaluations WHERE id = ?").get(id);
    return row === undefined ? null : toAiShadowTradeEvaluationStorageRecord(row);
  }

  approveAiShadowTradeEvaluation(input: {
    id: string;
    expectedProposalDigest: string;
    decidedAt: string;
  }): AiShadowTradeEvaluationStorageRecord {
    this.expireOpenAiShadowTradeApprovals(input.decidedAt);
    const result = this.#database.prepare(
      `UPDATE ai_shadow_trade_evaluations SET approval_state = 'approved', decided_at = ?
       WHERE id = ? AND proposal_digest = ? AND approval_state = 'pending' AND approval_expires_at > ?`,
    ).run(input.decidedAt, input.id, input.expectedProposalDigest, input.decidedAt);
    if (Number(result.changes) !== 1) throw new Error("AI shadow approval conflict or expiry");
    const record = this.getAiShadowTradeEvaluation(input.id);
    if (record === null) throw new Error("AI shadow evaluation does not exist");
    return record;
  }

  rejectAiShadowTradeEvaluation(input: {
    id: string;
    expectedProposalDigest: string;
    decidedAt: string;
  }): AiShadowTradeEvaluationStorageRecord {
    this.expireOpenAiShadowTradeApprovals(input.decidedAt);
    const result = this.#database.prepare(
      `UPDATE ai_shadow_trade_evaluations SET approval_state = 'rejected', decided_at = ?
       WHERE id = ? AND proposal_digest = ? AND approval_state IN ('pending', 'approved')`,
    ).run(input.decidedAt, input.id, input.expectedProposalDigest);
    if (Number(result.changes) !== 1) throw new Error("AI shadow rejection conflict or expiry");
    const record = this.getAiShadowTradeEvaluation(input.id);
    if (record === null) throw new Error("AI shadow evaluation does not exist");
    return record;
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

function toAiShadowTradeEvaluationStorageRecord(row: unknown): AiShadowTradeEvaluationStorageRecord {
  const value = row as {
    id: string;
    quote_id: string;
    proposal_digest: string;
    outcome: AiShadowTradeEvaluationStorageRecord["outcome"];
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    signing_attempted: number;
    execution_attempted: number;
    evaluated_at: string;
    approval_state: AiShadowTradeEvaluationStorageRecord["approvalState"];
    approval_expires_at: string | null;
    decided_at: string | null;
  };
  if (value.signing_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("AI shadow evaluation cannot contain execution evidence");
  }
  return {
    id: value.id,
    quoteId: value.quote_id,
    proposalDigest: value.proposal_digest,
    outcome: value.outcome,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    signingAttempted: false,
    executionAttempted: false,
    evaluatedAt: value.evaluated_at,
    approvalState: value.approval_state,
    approvalExpiresAt: value.approval_expires_at,
    decidedAt: value.decided_at,
  };
}

function toMarketObservationStorageRecord(row: unknown): MarketObservationStorageRecord {
  const value = row as {
    id: string;
    source_quote_id: string;
    observation_digest: string;
    encrypted_payload: string;
    payload_nonce: string;
    key_id: string;
    observed_at: string;
    captured_at: string;
    expires_at: string;
    model_calls_attempted: number;
    signing_attempted: number;
    execution_attempted: number;
  };
  if (value.model_calls_attempted !== 0 || value.signing_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Market observation cannot contain model or execution evidence");
  }
  return {
    id: value.id,
    sourceQuoteId: value.source_quote_id,
    observationDigest: value.observation_digest,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce,
    keyId: value.key_id,
    observedAt: value.observed_at,
    capturedAt: value.captured_at,
    expiresAt: value.expires_at,
    modelCallsAttempted: false,
    signingAttempted: false,
    executionAttempted: false,
  };
}

function toMarketWatchStorageRecord(row: unknown): MarketWatchStorageRecord {
  const value = row as {
    id: string; state: MarketWatchStorageRecord["state"]; encrypted_payload: string;
    payload_nonce: string; key_id: string; next_check_at: string; last_checked_at: string | null;
    triggered_at: string | null; paused_at: string | null; last_observation_id: string | null;
    consecutive_failures: number; model_calls_attempted: number; execution_enabled: number;
    created_at: string; updated_at: string;
  };
  if (value.model_calls_attempted !== 0 || value.execution_enabled !== 0) {
    throw new Error("Market watch cannot enable AI or execution");
  }
  return {
    id: value.id, state: value.state, encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce, keyId: value.key_id, nextCheckAt: value.next_check_at,
    lastCheckedAt: value.last_checked_at, triggeredAt: value.triggered_at, pausedAt: value.paused_at,
    lastObservationId: value.last_observation_id, consecutiveFailures: value.consecutive_failures,
    modelCallsAttempted: false, executionEnabled: false, createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function toMarketWakeReceiptStorageRecord(row: unknown): MarketWakeReceiptStorageRecord {
  const value = row as {
    id: string; watch_id: string; observation_id: string | null;
    outcome: MarketWakeReceiptStorageRecord["outcome"]; encrypted_payload: string;
    payload_nonce: string; key_id: string; evaluated_at: string;
    model_calls_attempted: number; signing_attempted: number; execution_attempted: number;
  };
  if (value.model_calls_attempted !== 0 || value.signing_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Market wake receipt cannot contain AI or execution evidence");
  }
  return {
    id: value.id, watchId: value.watch_id, observationId: value.observation_id,
    outcome: value.outcome, encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce, keyId: value.key_id, evaluatedAt: value.evaluated_at,
    modelCallsAttempted: false, signingAttempted: false, executionAttempted: false,
  };
}

function toAgentSessionStorageRecord(row: unknown): AgentSessionStorageRecord {
  const value = row as {
    id: string; state: AgentSessionStorageRecord["state"]; provider: AgentSessionStorageRecord["provider"];
    encrypted_payload: string; payload_nonce: string; key_id: string; deadline_at: string;
    halted_at: string | null; halt_reason: AgentSessionStorageRecord["haltReason"];
    execution_enabled: number; created_at: string; updated_at: string;
  };
  if (value.execution_enabled !== 0) throw new Error("Agent session cannot enable execution");
  return {
    id: value.id, state: value.state, provider: value.provider,
    encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce, keyId: value.key_id,
    deadlineAt: value.deadline_at, haltedAt: value.halted_at, haltReason: value.halt_reason,
    executionEnabled: false, createdAt: value.created_at, updatedAt: value.updated_at,
  };
}

function toAgentIntentEvaluationStorageRecord(row: unknown): AgentIntentEvaluationStorageRecord {
  const value = row as {
    id: string; session_id: string; observation_id: string; quote_id: string; proposal_digest: string;
    outcome: AgentIntentEvaluationStorageRecord["outcome"]; encrypted_payload: string;
    payload_nonce: string; key_id: string; approval_state: AgentIntentEvaluationStorageRecord["approvalState"];
    approval_expires_at: string | null; decided_at: string | null; model_calls_attempted: number;
    signing_attempted: number; execution_attempted: number; evaluated_at: string;
  };
  if (value.model_calls_attempted !== 1 || value.signing_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Agent intent evaluation has invalid privilege evidence");
  }
  return {
    id: value.id, sessionId: value.session_id, observationId: value.observation_id,
    quoteId: value.quote_id, proposalDigest: value.proposal_digest, outcome: value.outcome,
    encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce, keyId: value.key_id,
    approvalState: value.approval_state, approvalExpiresAt: value.approval_expires_at,
    decidedAt: value.decided_at, modelCallsAttempted: true, signingAttempted: false,
    executionAttempted: false, evaluatedAt: value.evaluated_at,
  };
}

function toAgentDevnetSimulationStorageRecord(row: unknown): AgentDevnetSimulationStorageRecord {
  const value = row as {
    id: string; evaluation_id: string; session_id: string; proposal_digest: string;
    outcome: AgentDevnetSimulationStorageRecord["outcome"]; fixture_manifest_digest: string;
    message_hash: string | null; encrypted_payload: string; payload_nonce: string; key_id: string;
    signing_attempted: number; broadcast_attempted: number; execution_attempted: number; simulated_at: string;
  };
  if (value.signing_attempted !== 0 || value.broadcast_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Agent Devnet simulation cannot contain execution evidence");
  }
  return {
    id: value.id, evaluationId: value.evaluation_id, sessionId: value.session_id,
    proposalDigest: value.proposal_digest, outcome: value.outcome,
    fixtureManifestDigest: value.fixture_manifest_digest, messageHash: value.message_hash,
    encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce, keyId: value.key_id,
    signingAttempted: false, broadcastAttempted: false, executionAttempted: false,
    simulatedAt: value.simulated_at,
  };
}

function toAgentDevnetSigningArmStorageRecord(row: unknown): AgentDevnetSigningArmStorageRecord {
  const value = row as {
    id: string; simulation_id: string; evaluation_id: string; session_id: string;
    proposal_digest: string; fixture_manifest_digest: string; message_hash: string;
    scope: AgentDevnetSigningArmStorageRecord["scope"];
    state: AgentDevnetSigningArmStorageRecord["state"]; execution_id: string | null; encrypted_payload: string;
    payload_nonce: string; key_id: string; execution_bridge_connected: number;
    mainnet_enabled: number; armed_at: string; expires_at: string; consumed_at: string | null; revoked_at: string | null;
  };
  if (value.execution_bridge_connected !== 0 || value.mainnet_enabled !== 0) {
    throw new Error("Agent Devnet signing arm cannot connect execution or Mainnet");
  }
  return {
    id: value.id, simulationId: value.simulation_id, evaluationId: value.evaluation_id,
    sessionId: value.session_id, proposalDigest: value.proposal_digest,
    fixtureManifestDigest: value.fixture_manifest_digest, messageHash: value.message_hash,
    scope: value.scope, state: value.state, executionId: value.execution_id,
    encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce, keyId: value.key_id, executionBridgeConnected: false,
    mainnetEnabled: false, armedAt: value.armed_at, expiresAt: value.expires_at,
    consumedAt: value.consumed_at,
    revokedAt: value.revoked_at,
  };
}

function toAgentDevnetPreSignExecutionStorageRecord(row: unknown): AgentDevnetPreSignExecutionStorageRecord {
  const value = row as {
    id: string; signing_arm_id: string; simulation_id: string; evaluation_id: string; session_id: string;
    proposal_digest: string; fixture_manifest_digest: string; message_hash: string;
    state: AgentDevnetPreSignExecutionStorageRecord["state"]; failure_code: string | null;
    encrypted_payload: string; payload_nonce: string; key_id: string; signing_attempted: number;
    broadcast_attempted: number; execution_attempted: number; prepared_at: string;
  };
  if (value.signing_attempted !== 0 || value.broadcast_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Agent pre-sign execution cannot contain execution evidence");
  }
  return {
    id: value.id, signingArmId: value.signing_arm_id, simulationId: value.simulation_id,
    evaluationId: value.evaluation_id, sessionId: value.session_id, proposalDigest: value.proposal_digest,
    fixtureManifestDigest: value.fixture_manifest_digest, messageHash: value.message_hash,
    state: value.state, failureCode: value.failure_code, encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce, keyId: value.key_id, signingAttempted: false,
    broadcastAttempted: false, executionAttempted: false, preparedAt: value.prepared_at,
  };
}

function toAgentDevnetSignedExecutionStorageRecord(row: unknown): AgentDevnetSignedExecutionStorageRecord {
  const value = row as {
    id: string; pre_sign_execution_id: string; signing_arm_id: string; simulation_id: string;
    evaluation_id: string; session_id: string; message_hash: string;
    state: AgentDevnetSignedExecutionStorageRecord["state"]; signature_hash: string | null;
    failure_code: string | null; encrypted_payload: string; payload_nonce: string; key_id: string;
    signing_attempted: number; broadcast_attempted: number; execution_attempted: number;
    created_at: string; updated_at: string;
  };
  if (value.broadcast_attempted !== 0 || value.execution_attempted !== 0) {
    throw new Error("Agent signed execution cannot contain broadcast or execution evidence");
  }
  return {
    id: value.id, preSignExecutionId: value.pre_sign_execution_id, signingArmId: value.signing_arm_id,
    simulationId: value.simulation_id, evaluationId: value.evaluation_id, sessionId: value.session_id,
    messageHash: value.message_hash, state: value.state, signatureHash: value.signature_hash,
    failureCode: value.failure_code, encryptedPayload: value.encrypted_payload,
    payloadNonce: value.payload_nonce, keyId: value.key_id, signingAttempted: value.signing_attempted === 1,
    broadcastAttempted: false, executionAttempted: false, createdAt: value.created_at, updatedAt: value.updated_at,
  };
}

function toAgentDevnetBroadcastExecutionStorageRecord(row: unknown): AgentDevnetBroadcastExecutionStorageRecord {
  const value = row as {
    id: string; signed_execution_id: string; pre_sign_execution_id: string; simulation_id: string;
    evaluation_id: string; session_id: string; message_hash: string; signature_hash: string;
    last_valid_block_height: string; state: AgentDevnetBroadcastExecutionStorageRecord["state"];
    failure_code: string | null; encrypted_payload: string; payload_nonce: string; key_id: string;
    broadcast_attempted: number; execution_attempted: number; fixture_transfer_performed: number;
    created_at: string; updated_at: string;
  };
  return {
    id: value.id, signedExecutionId: value.signed_execution_id, preSignExecutionId: value.pre_sign_execution_id,
    simulationId: value.simulation_id, evaluationId: value.evaluation_id, sessionId: value.session_id,
    messageHash: value.message_hash, signatureHash: value.signature_hash,
    lastValidBlockHeight: value.last_valid_block_height, state: value.state, failureCode: value.failure_code,
    encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce, keyId: value.key_id,
    broadcastAttempted: value.broadcast_attempted === 1, executionAttempted: value.execution_attempted === 1,
    fixtureTransferPerformed: value.fixture_transfer_performed === 1,
    createdAt: value.created_at, updatedAt: value.updated_at,
  };
}

function toAgentDevnetSwapQuoteStorageRecord(row: unknown): AgentDevnetSwapQuoteStorageRecord {
  const value = row as { id: string; evaluation_id: string; session_id: string; action: "buy-sol" | "sell-sol";
    allowed: number; encrypted_payload: string; payload_nonce: string; key_id: string; quoted_at: string; expires_at: string;
    transaction_built: number; signing_attempted: number; broadcast_attempted: number };
  if (value.transaction_built !== 0 || value.signing_attempted !== 0 || value.broadcast_attempted !== 0) {
    throw new Error("Agent Devnet swap quote cannot contain execution evidence");
  }
  return { id: value.id, evaluationId: value.evaluation_id, sessionId: value.session_id, action: value.action,
    allowed: value.allowed === 1, encryptedPayload: value.encrypted_payload, payloadNonce: value.payload_nonce,
    keyId: value.key_id, quotedAt: value.quoted_at, expiresAt: value.expires_at };
}
