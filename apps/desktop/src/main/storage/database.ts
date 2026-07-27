import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

export const MAINNET_PROFILE_ID = "mainnet-guarded" as const;

export type EncryptedWalletMetadata = {
  id: string;
  profileId: typeof MAINNET_PROFILE_ID;
  ciphertext: string;
  nonce: string;
  keyId: string;
  createdAt: string;
};

export type EncryptedSessionRecord = {
  id: string;
  ciphertext: string;
  nonce: string;
  tag: string;
  updatedAt: string;
};

export type EncryptedPumpRiskLedgerRecord = {
  ciphertext: string;
  nonce: string;
  tag: string;
  updatedAt: string;
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
    database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS wallet_metadata (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL UNIQUE CHECK (profile_id = 'mainnet-guarded'),
        encrypted_address TEXT NOT NULL,
        address_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS session_records (
        id TEXT PRIMARY KEY,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_risk_ledger (
        id TEXT PRIMARY KEY CHECK (id = 'ledger-v1'),
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_receipt_records (
        id TEXT PRIMARY KEY,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS robinhood_receipt_records (
        id TEXT PRIMARY KEY,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_blocked_creators (
        creator_address TEXT PRIMARY KEY,
        blocked_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_ignored_mints (
        mint_address TEXT PRIMARY KEY,
        ignored_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_watchlist (
        mint_address TEXT PRIMARY KEY,
        added_at TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_explanation TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_active_positions (
        id TEXT PRIMARY KEY,
        mint_address TEXT NOT NULL,
        entry_price REAL NOT NULL,
        amount TEXT NOT NULL,
        stop_loss_price REAL,
        take_profit_price REAL,
        trailing_stop_percent REAL,
        highest_price_seen REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pump_dca_schedules (
        id TEXT PRIMARY KEY,
        mint_address TEXT NOT NULL,
        total_budget_lamports TEXT NOT NULL,
        order_amount_lamports TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL,
        executed_count INTEGER NOT NULL,
        total_executed_lamports TEXT NOT NULL,
        next_execution_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `);
    database.enableDefensive(true);
    return new RuntimeDatabase(database);
  }

  close(): void {
    if (this.#database.isOpen) this.#database.close();
  }

  async backupTo(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await backup(this.#database, path);
  }

  resetVaultData(): void {
    this.#database.exec("BEGIN IMMEDIATE;");
    try {
      this.#database.exec("DELETE FROM robinhood_receipt_records; DELETE FROM pump_receipt_records; DELETE FROM pump_risk_ledger; DELETE FROM session_records; DELETE FROM wallet_metadata; DELETE FROM app_settings; COMMIT;");
    } catch (error) {
      this.#database.exec("ROLLBACK;");
      throw error;
    }
  }

  getSetting(key: string): unknown | null {
    const row = this.#database.prepare("SELECT value_json FROM app_settings WHERE key = ?").get(key) as { value_json: string } | undefined;
    return row === undefined ? null : JSON.parse(row.value_json) as unknown;
  }

  setSetting(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("Setting is not serializable");
    this.#database.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(key, serialized, new Date().toISOString());
  }

  deleteSetting(key: string): void {
    this.#database.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  }

  hasWallet(profileId: typeof MAINNET_PROFILE_ID): boolean {
    return this.#database.prepare("SELECT 1 FROM wallet_metadata WHERE profile_id = ? LIMIT 1").get(profileId) !== undefined;
  }

  getWallet(profileId: typeof MAINNET_PROFILE_ID): EncryptedWalletMetadata | null {
    const row = this.#database.prepare("SELECT * FROM wallet_metadata WHERE profile_id = ?").get(profileId) as {
      id: string;
      profile_id: typeof MAINNET_PROFILE_ID;
      encrypted_address: string;
      address_nonce: string;
      key_id: string;
      created_at: string;
    } | undefined;
    return row === undefined ? null : {
      id: row.id,
      profileId: row.profile_id,
      ciphertext: row.encrypted_address,
      nonce: row.address_nonce,
      keyId: row.key_id,
      createdAt: row.created_at,
    };
  }

  insertWallet(metadata: EncryptedWalletMetadata): void {
    this.#database.prepare(`
      INSERT INTO wallet_metadata (id, profile_id, encrypted_address, address_nonce, key_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET
        encrypted_address = excluded.encrypted_address,
        address_nonce = excluded.address_nonce,
        key_id = excluded.key_id
    `).run(metadata.id, metadata.profileId, metadata.ciphertext, metadata.nonce, metadata.keyId, metadata.createdAt);
  }

  listSessionRecords(): EncryptedSessionRecord[] {
    const rows = this.#database.prepare("SELECT id, ciphertext, nonce, auth_tag, updated_at FROM session_records ORDER BY updated_at DESC").all() as Array<{ id: string; ciphertext: string; nonce: string; auth_tag: string; updated_at: string }>;
    return rows.map((row) => ({ id: row.id, ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at }));
  }

  upsertSessionRecord(record: EncryptedSessionRecord): void {
    this.#database.prepare(`
      INSERT INTO session_records (id, ciphertext, nonce, auth_tag, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at
    `).run(record.id, record.ciphertext, record.nonce, record.tag, record.updatedAt);
  }

  getPumpRiskLedgerRecord(): EncryptedPumpRiskLedgerRecord | null {
    const row = this.#database.prepare("SELECT ciphertext, nonce, auth_tag, updated_at FROM pump_risk_ledger WHERE id = 'ledger-v1'").get() as {
      ciphertext: string;
      nonce: string;
      auth_tag: string;
      updated_at: string;
    } | undefined;
    return row === undefined ? null : { ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at };
  }

  upsertPumpRiskLedgerRecord(record: EncryptedPumpRiskLedgerRecord): void {
    this.#database.prepare(`
      INSERT INTO pump_risk_ledger (id, ciphertext, nonce, auth_tag, updated_at) VALUES ('ledger-v1', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at
    `).run(record.ciphertext, record.nonce, record.tag, record.updatedAt);
  }

  listPumpReceiptRecords(): EncryptedSessionRecord[] {
    const rows = this.#database.prepare("SELECT id, ciphertext, nonce, auth_tag, updated_at FROM pump_receipt_records ORDER BY updated_at DESC").all() as Array<{ id: string; ciphertext: string; nonce: string; auth_tag: string; updated_at: string }>;
    return rows.map((row) => ({ id: row.id, ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at }));
  }

  getPumpReceiptRecord(id: string): EncryptedSessionRecord | null {
    const row = this.#database.prepare("SELECT id, ciphertext, nonce, auth_tag, updated_at FROM pump_receipt_records WHERE id = ?").get(id) as {
      id: string;
      ciphertext: string;
      nonce: string;
      auth_tag: string;
      updated_at: string;
    } | undefined;
    return row === undefined ? null : { id: row.id, ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at };
  }

  upsertPumpReceiptRecord(record: EncryptedSessionRecord): void {
    this.#database.prepare(`
      INSERT INTO pump_receipt_records (id, ciphertext, nonce, auth_tag, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at
    `).run(record.id, record.ciphertext, record.nonce, record.tag, record.updatedAt);
  }

  listRobinhoodReceiptRecords(): EncryptedSessionRecord[] {
    const rows = this.#database.prepare("SELECT id, ciphertext, nonce, auth_tag, updated_at FROM robinhood_receipt_records ORDER BY updated_at DESC").all() as Array<{ id: string; ciphertext: string; nonce: string; auth_tag: string; updated_at: string }>;
    return rows.map((row) => ({ id: row.id, ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at }));
  }

  getRobinhoodReceiptRecord(id: string): EncryptedSessionRecord | null {
    const row = this.#database.prepare("SELECT id, ciphertext, nonce, auth_tag, updated_at FROM robinhood_receipt_records WHERE id = ?").get(id) as { id: string; ciphertext: string; nonce: string; auth_tag: string; updated_at: string } | undefined;
    return row === undefined ? null : { id: row.id, ciphertext: row.ciphertext, nonce: row.nonce, tag: row.auth_tag, updatedAt: row.updated_at };
  }

  upsertRobinhoodReceiptRecord(record: EncryptedSessionRecord): void {
    this.#database.prepare(`
      INSERT INTO robinhood_receipt_records (id, ciphertext, nonce, auth_tag, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at
    `).run(record.id, record.ciphertext, record.nonce, record.tag, record.updatedAt);
  }

  // Blocked Creators
  isCreatorBlocked(address: string): boolean {
    return this.#database.prepare("SELECT 1 FROM pump_blocked_creators WHERE creator_address = ? LIMIT 1").get(address) !== undefined;
  }

  blockCreator(address: string): void {
    this.#database.prepare("INSERT INTO pump_blocked_creators (creator_address, blocked_at) VALUES (?, ?) ON CONFLICT DO NOTHING").run(address, new Date().toISOString());
  }

  unblockCreator(address: string): void {
    this.#database.prepare("DELETE FROM pump_blocked_creators WHERE creator_address = ?").run(address);
  }

  listBlockedCreators(): string[] {
    const rows = this.#database.prepare("SELECT creator_address FROM pump_blocked_creators ORDER BY blocked_at DESC").all() as Array<{ creator_address: string }>;
    return rows.map((r) => r.creator_address);
  }

  // Ignored Mints
  isMintIgnored(address: string): boolean {
    return this.#database.prepare("SELECT 1 FROM pump_ignored_mints WHERE mint_address = ? LIMIT 1").get(address) !== undefined;
  }

  ignoreMint(address: string): void {
    this.#database.prepare("INSERT INTO pump_ignored_mints (mint_address, ignored_at) VALUES (?, ?) ON CONFLICT DO NOTHING").run(address, new Date().toISOString());
  }

  unignoreMint(address: string): void {
    this.#database.prepare("DELETE FROM pump_ignored_mints WHERE mint_address = ?").run(address);
  }

  listIgnoredMints(): string[] {
    const rows = this.#database.prepare("SELECT mint_address FROM pump_ignored_mints ORDER BY ignored_at DESC").all() as Array<{ mint_address: string }>;
    return rows.map((r) => r.mint_address);
  }

  // Watchlist
  addToWatchlist(mint: string, riskScore: number, riskExplanation: string): void {
    this.#database.prepare(`
      INSERT INTO pump_watchlist (mint_address, added_at, risk_score, risk_explanation) VALUES (?, ?, ?, ?)
      ON CONFLICT(mint_address) DO UPDATE SET risk_score = excluded.risk_score, risk_explanation = excluded.risk_explanation
    `).run(mint, new Date().toISOString(), riskScore, riskExplanation);
  }

  removeFromWatchlist(mint: string): void {
    this.#database.prepare("DELETE FROM pump_watchlist WHERE mint_address = ?").run(mint);
  }

  listWatchlist(): Array<{ mintAddress: string; addedAt: string; riskScore: number; riskExplanation: string }> {
    const rows = this.#database.prepare("SELECT mint_address, added_at, risk_score, risk_explanation FROM pump_watchlist ORDER BY added_at DESC").all() as Array<{
      mint_address: string;
      added_at: string;
      risk_score: number;
      risk_explanation: string;
    }>;
    return rows.map((r) => ({
      mintAddress: r.mint_address,
      addedAt: r.added_at,
      riskScore: r.risk_score,
      riskExplanation: r.risk_explanation,
    }));
  }

  // Active Positions
  upsertActivePosition(position: {
    id: string;
    mintAddress: string;
    entryPrice: number;
    amount: string;
    stopLossPrice?: number | null;
    takeProfitPrice?: number | null;
    trailingStopPercent?: number | null;
    highestPriceSeen: number;
  }): void {
    const now = new Date().toISOString();
    this.#database.prepare(`
      INSERT INTO pump_active_positions (
        id, mint_address, entry_price, amount, stop_loss_price, take_profit_price, trailing_stop_percent, highest_price_seen, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        entry_price = excluded.entry_price,
        amount = excluded.amount,
        stop_loss_price = excluded.stop_loss_price,
        take_profit_price = excluded.take_profit_price,
        trailing_stop_percent = excluded.trailing_stop_percent,
        highest_price_seen = excluded.highest_price_seen,
        updated_at = excluded.updated_at
    `).run(
      position.id,
      position.mintAddress,
      position.entryPrice,
      position.amount,
      position.stopLossPrice ?? null,
      position.takeProfitPrice ?? null,
      position.trailingStopPercent ?? null,
      position.highestPriceSeen,
      now,
      now
    );
  }

  removeActivePosition(id: string): void {
    this.#database.prepare("DELETE FROM pump_active_positions WHERE id = ?").run(id);
  }

  listActivePositions(): Array<{
    id: string;
    mintAddress: string;
    entryPrice: number;
    amount: string;
    stopLossPrice: number | null;
    takeProfitPrice: number | null;
    trailingStopPercent: number | null;
    highestPriceSeen: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const rows = this.#database.prepare("SELECT * FROM pump_active_positions ORDER BY created_at DESC").all() as Array<{
      id: string;
      mint_address: string;
      entry_price: number;
      amount: string;
      stop_loss_price: number | null;
      take_profit_price: number | null;
      trailing_stop_percent: number | null;
      highest_price_seen: number;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      mintAddress: r.mint_address,
      entryPrice: r.entry_price,
      amount: r.amount,
      stopLossPrice: r.stop_loss_price,
      takeProfitPrice: r.take_profit_price,
      trailingStopPercent: r.trailing_stop_percent,
      highestPriceSeen: r.highest_price_seen,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // DCA Schedules
  upsertDcaSchedule(schedule: {
    id: string;
    mintAddress: string;
    totalBudgetLamports: string;
    orderAmountLamports: string;
    intervalSeconds: number;
    executedCount: number;
    totalExecutedLamports: string;
    nextExecutionAt: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  }): void {
    const now = new Date().toISOString();
    this.#database.prepare(`
      INSERT INTO pump_dca_schedules (
        id, mint_address, total_budget_lamports, order_amount_lamports, interval_seconds, executed_count, total_executed_lamports, next_execution_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        executed_count = excluded.executed_count,
        total_executed_lamports = excluded.total_executed_lamports,
        next_execution_at = excluded.next_execution_at,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      schedule.id,
      schedule.mintAddress,
      schedule.totalBudgetLamports,
      schedule.orderAmountLamports,
      schedule.intervalSeconds,
      schedule.executedCount,
      schedule.totalExecutedLamports,
      schedule.nextExecutionAt,
      schedule.status,
      now,
      now
    );
  }

  removeDcaSchedule(id: string): void {
    this.#database.prepare("DELETE FROM pump_dca_schedules WHERE id = ?").run(id);
  }

  listDcaSchedules(): Array<{
    id: string;
    mintAddress: string;
    totalBudgetLamports: string;
    orderAmountLamports: string;
    intervalSeconds: number;
    executedCount: number;
    totalExecutedLamports: string;
    nextExecutionAt: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    createdAt: string;
    updatedAt: string;
  }> {
    const rows = this.#database.prepare("SELECT * FROM pump_dca_schedules ORDER BY created_at DESC").all() as Array<{
      id: string;
      mint_address: string;
      total_budget_lamports: string;
      order_amount_lamports: string;
      interval_seconds: number;
      executed_count: number;
      total_executed_lamports: string;
      next_execution_at: string;
      status: "ACTIVE" | "COMPLETED" | "CANCELLED";
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      mintAddress: r.mint_address,
      totalBudgetLamports: r.total_budget_lamports,
      orderAmountLamports: r.order_amount_lamports,
      intervalSeconds: r.interval_seconds,
      executedCount: r.executed_count,
      totalExecutedLamports: r.total_executed_lamports,
      nextExecutionAt: r.next_execution_at,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
}
