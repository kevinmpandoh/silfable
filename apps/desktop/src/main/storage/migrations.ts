export type SchemaMigration = {
  version: number;
  name: string;
  sql: string;
};

export const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  {
    version: 1,
    name: "initial-runtime-schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        environment TEXT NOT NULL CHECK (environment IN ('devnet-simulation', 'mainnet-shadow', 'mainnet-guarded')),
        created_at TEXT NOT NULL,
        selected INTEGER NOT NULL DEFAULT 0 CHECK (selected IN (0, 1))
      ) STRICT;

      CREATE TABLE wallet_metadata (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id),
        encrypted_address TEXT NOT NULL,
        address_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE missions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id),
        kind TEXT NOT NULL CHECK (kind = 'auto-dca-v1'),
        state TEXT NOT NULL CHECK (state IN ('draft', 'authorized', 'running', 'halted', 'complete')),
        current_revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE mission_revisions (
        mission_id TEXT NOT NULL REFERENCES missions(id),
        revision INTEGER NOT NULL,
        plan_json TEXT NOT NULL,
        authorized_at TEXT,
        PRIMARY KEY (mission_id, revision)
      ) STRICT;

      CREATE TABLE desk_rule_revisions (
        mission_id TEXT NOT NULL REFERENCES missions(id),
        revision INTEGER NOT NULL,
        rules_json TEXT NOT NULL,
        authorized_at TEXT NOT NULL,
        PRIMARY KEY (mission_id, revision)
      ) STRICT;

      CREATE TABLE dca_cycles (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        mission_revision INTEGER NOT NULL,
        cycle_number INTEGER NOT NULL,
        due_at TEXT NOT NULL,
        state TEXT NOT NULL,
        reason TEXT,
        FOREIGN KEY (mission_id, mission_revision) REFERENCES mission_revisions(mission_id, revision),
        UNIQUE (mission_id, mission_revision, cycle_number)
      ) STRICT;

      CREATE TABLE execution_attempts (
        id TEXT PRIMARY KEY,
        cycle_id TEXT NOT NULL REFERENCES dca_cycles(id),
        state TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        failure_code TEXT
      ) STRICT;

      CREATE TABLE transaction_signatures (
        execution_id TEXT PRIMARY KEY REFERENCES execution_attempts(id),
        encrypted_signature TEXT NOT NULL,
        signature_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL
      ) STRICT;

      CREATE TABLE receipts (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL UNIQUE REFERENCES execution_attempts(id),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE daily_risk_counters (
        mission_id TEXT NOT NULL REFERENCES missions(id),
        utc_date TEXT NOT NULL,
        spent_atomic TEXT NOT NULL,
        trade_count INTEGER NOT NULL,
        PRIMARY KEY (mission_id, utc_date)
      ) STRICT;

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 2,
    name: "mission-halt-reason",
    sql: `
      ALTER TABLE missions ADD COLUMN halt_reason TEXT;
      CREATE INDEX missions_state_index ON missions(state);
      CREATE INDEX dca_cycles_mission_index ON dca_cycles(mission_id, mission_revision, cycle_number);
    `,
  },
] as const;
