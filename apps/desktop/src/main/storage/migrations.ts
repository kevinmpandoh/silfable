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
  {
    version: 3,
    name: "devnet-canary-execution-journal",
    sql: `
      CREATE TABLE devnet_canary_executions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind = 'self-transfer-zero-lamports'),
        state TEXT NOT NULL CHECK (state IN ('proposed', 'simulated', 'signed', 'broadcast', 'confirmed', 'failed', 'ambiguous')),
        encrypted_wire TEXT,
        wire_nonce TEXT,
        encrypted_signature TEXT,
        signature_nonce TEXT,
        key_id TEXT,
        last_valid_block_height TEXT,
        simulation_units TEXT,
        failure_code TEXT,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted IN (0, 1)),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (encrypted_wire IS NULL AND wire_nonce IS NULL AND encrypted_signature IS NULL AND signature_nonce IS NULL AND key_id IS NULL)
          OR
          (encrypted_wire IS NOT NULL AND wire_nonce IS NOT NULL AND encrypted_signature IS NOT NULL AND signature_nonce IS NOT NULL AND key_id IS NOT NULL)
        )
      ) STRICT;
      CREATE INDEX devnet_canary_state_index ON devnet_canary_executions(state, updated_at);
    `,
  },
  {
    version: 4,
    name: "jupiter-mainnet-shadow-quotes",
    sql: `
      CREATE TABLE jupiter_shadow_quotes (
        id TEXT PRIMARY KEY,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX jupiter_shadow_quotes_created_index ON jupiter_shadow_quotes(created_at);
    `,
  },
  {
    version: 5,
    name: "opt-in-local-crash-journal",
    sql: `
      CREATE TABLE crash_reports (
        id TEXT PRIMARY KEY,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        transmitted INTEGER NOT NULL DEFAULT 0 CHECK (transmitted = 0),
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX crash_reports_created_index ON crash_reports(created_at);
    `,
  },
  {
    version: 6,
    name: "guarded-devnet-execution-journal",
    sql: `
      CREATE TABLE guarded_devnet_executions (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        mission_revision INTEGER NOT NULL,
        cycle_number INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('proposed', 'validated', 'simulated', 'signed', 'broadcast', 'confirmed', 'receipted', 'failed', 'ambiguous')),
        message_hash TEXT,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted IN (0, 1)),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted IN (0, 1)),
        failure_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (mission_id, mission_revision, cycle_number),
        CHECK (message_hash IS NULL OR (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*')),
        CHECK (signing_attempted = 0 OR message_hash IS NOT NULL),
        CHECK (broadcast_attempted = 0 OR signing_attempted = 1),
        CHECK (state NOT IN ('signed', 'broadcast', 'confirmed', 'receipted', 'ambiguous') OR signing_attempted = 1),
        CHECK (state NOT IN ('broadcast', 'confirmed', 'receipted', 'ambiguous') OR broadcast_attempted = 1)
      ) STRICT;
      CREATE TABLE guarded_devnet_execution_events (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES guarded_devnet_executions(id) ON DELETE CASCADE,
        from_state TEXT CHECK (from_state IS NULL OR from_state IN ('proposed', 'validated', 'simulated', 'signed', 'broadcast', 'confirmed', 'receipted', 'failed', 'ambiguous')),
        to_state TEXT NOT NULL CHECK (to_state IN ('proposed', 'validated', 'simulated', 'signed', 'broadcast', 'confirmed', 'receipted', 'failed', 'ambiguous')),
        event_name TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX guarded_devnet_execution_state_index ON guarded_devnet_executions(state, updated_at);
      CREATE INDEX guarded_devnet_event_execution_index ON guarded_devnet_execution_events(execution_id, created_at);
    `,
  },
  {
    version: 7,
    name: "bind-guarded-execution-to-fixture-manifest",
    sql: `
      ALTER TABLE guarded_devnet_executions ADD COLUMN fixture_manifest_digest TEXT NOT NULL
        DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
        CHECK (length(fixture_manifest_digest) = 64 AND fixture_manifest_digest NOT GLOB '*[^0-9a-f]*');
    `,
  },
  {
    version: 8,
    name: "devnet-fixture-provisioning-journal",
    sql: `
      CREATE TABLE devnet_fixture_provisions (
        id TEXT PRIMARY KEY,
        mint_address TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK (state IN ('proposed', 'simulated', 'signed', 'broadcast', 'confirmed', 'failed', 'ambiguous')),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        encrypted_payload TEXT,
        payload_nonce TEXT,
        key_id TEXT,
        last_valid_block_height TEXT NOT NULL,
        simulation_units TEXT,
        failure_code TEXT,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted IN (0, 1)),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (encrypted_payload IS NULL AND payload_nonce IS NULL AND key_id IS NULL)
          OR (encrypted_payload IS NOT NULL AND payload_nonce IS NOT NULL AND key_id IS NOT NULL)
        ),
        CHECK (broadcast_attempted = 0 OR signing_attempted = 1),
        CHECK (state NOT IN ('signed', 'broadcast', 'confirmed', 'ambiguous') OR signing_attempted = 1),
        CHECK (state NOT IN ('broadcast', 'confirmed', 'ambiguous') OR broadcast_attempted = 1)
      ) STRICT;
      CREATE INDEX devnet_fixture_provision_state_index ON devnet_fixture_provisions(state, updated_at);
    `,
  },
  {
    version: 9,
    name: "reviewed-devnet-fixture-manifest",
    sql: `
      CREATE TABLE devnet_fixture_reviews (
        provision_id TEXT PRIMARY KEY REFERENCES devnet_fixture_provisions(id),
        manifest_digest TEXT NOT NULL UNIQUE CHECK (length(manifest_digest) = 64 AND manifest_digest NOT GLOB '*[^0-9a-f]*'),
        mint_address TEXT NOT NULL UNIQUE,
        source_token_account TEXT NOT NULL,
        destination_token_account TEXT NOT NULL,
        wallet_authority TEXT NOT NULL,
        destination_owner TEXT NOT NULL,
        observed_slot TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active = 1),
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX one_active_devnet_fixture_index ON devnet_fixture_reviews(active) WHERE active = 1;
    `,
  },
  {
    version: 10,
    name: "guarded-fixture-transfer-canary-journal",
    sql: `
      CREATE TABLE guarded_fixture_transfers (
        id TEXT PRIMARY KEY,
        fixture_manifest_digest TEXT NOT NULL UNIQUE REFERENCES devnet_fixture_reviews(manifest_digest),
        state TEXT NOT NULL CHECK (state IN ('proposed', 'simulated', 'signed', 'broadcast', 'confirmed', 'failed', 'ambiguous')),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        encrypted_payload TEXT,
        payload_nonce TEXT,
        key_id TEXT,
        last_valid_block_height TEXT NOT NULL,
        simulation_units TEXT,
        failure_code TEXT,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted IN (0, 1)),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (encrypted_payload IS NULL AND payload_nonce IS NULL AND key_id IS NULL)
          OR (encrypted_payload IS NOT NULL AND payload_nonce IS NOT NULL AND key_id IS NOT NULL)
        ),
        CHECK (broadcast_attempted = 0 OR signing_attempted = 1),
        CHECK (state NOT IN ('signed', 'broadcast', 'confirmed', 'ambiguous') OR signing_attempted = 1),
        CHECK (state NOT IN ('broadcast', 'confirmed', 'ambiguous') OR broadcast_attempted = 1)
      ) STRICT;
      CREATE INDEX guarded_fixture_transfer_state_index ON guarded_fixture_transfers(state, updated_at);
    `,
  },
  {
    version: 11,
    name: "operator-approved-guarded-fixture-transfer",
    sql: `
      CREATE TABLE guarded_fixture_transfer_approvals (
        transfer_id TEXT PRIMARY KEY REFERENCES guarded_fixture_transfers(id),
        fixture_manifest_digest TEXT NOT NULL UNIQUE REFERENCES devnet_fixture_reviews(manifest_digest),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        approved_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 12,
    name: "revocable-guarded-mission-authorization",
    sql: `
      CREATE TABLE guarded_mission_authorizations (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        mission_revision INTEGER NOT NULL,
        plan_digest TEXT NOT NULL CHECK (length(plan_digest) = 64 AND plan_digest NOT GLOB '*[^0-9a-f]*'),
        desk_rule_digest TEXT NOT NULL CHECK (length(desk_rule_digest) = 64 AND desk_rule_digest NOT GLOB '*[^0-9a-f]*'),
        fixture_manifest_digest TEXT NOT NULL REFERENCES devnet_fixture_reviews(manifest_digest),
        fixture_transfer_id TEXT NOT NULL REFERENCES guarded_fixture_transfer_approvals(transfer_id),
        state TEXT NOT NULL CHECK (state IN ('active', 'revoked')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        authorized_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (mission_id, mission_revision) REFERENCES mission_revisions(mission_id, revision),
        CHECK ((state = 'active' AND revoked_at IS NULL) OR (state = 'revoked' AND revoked_at IS NOT NULL))
      ) STRICT;
      CREATE UNIQUE INDEX one_active_guarded_mission_authorization
        ON guarded_mission_authorizations(state) WHERE state = 'active';
      CREATE INDEX guarded_mission_authorization_history
        ON guarded_mission_authorizations(mission_id, mission_revision, authorized_at);
      CREATE TRIGGER revoke_guarded_authorization_on_mission_revision_change
      AFTER UPDATE OF current_revision ON missions
      WHEN OLD.current_revision <> NEW.current_revision
      BEGIN
        UPDATE guarded_mission_authorizations
        SET state = 'revoked', revoked_at = NEW.updated_at
        WHERE mission_id = NEW.id AND state = 'active';
      END;
    `,
  },
  {
    version: 13,
    name: "guarded-scheduler-readiness-evaluations",
    sql: `
      CREATE TABLE guarded_scheduler_evaluations (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        mission_revision INTEGER NOT NULL,
        cycle_number INTEGER NOT NULL,
        authorization_id TEXT REFERENCES guarded_mission_authorizations(id),
        outcome TEXT NOT NULL CHECK (outcome IN ('inactive', 'ready', 'denied')),
        reason_code TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        FOREIGN KEY (mission_id, mission_revision) REFERENCES mission_revisions(mission_id, revision),
        UNIQUE (mission_id, mission_revision, cycle_number)
      ) STRICT;
      CREATE INDEX guarded_scheduler_evaluation_history
        ON guarded_scheduler_evaluations(mission_id, mission_revision, cycle_number);
    `,
  },
  {
    version: 14,
    name: "one-shot-guarded-scheduler-arm",
    sql: `
      CREATE TABLE guarded_scheduler_arms (
        id TEXT PRIMARY KEY,
        authorization_id TEXT NOT NULL REFERENCES guarded_mission_authorizations(id),
        mission_id TEXT NOT NULL,
        mission_revision INTEGER NOT NULL,
        plan_digest TEXT NOT NULL CHECK (length(plan_digest) = 64 AND plan_digest NOT GLOB '*[^0-9a-f]*'),
        desk_rule_digest TEXT NOT NULL CHECK (length(desk_rule_digest) = 64 AND desk_rule_digest NOT GLOB '*[^0-9a-f]*'),
        fixture_manifest_digest TEXT NOT NULL REFERENCES devnet_fixture_reviews(manifest_digest),
        scope TEXT NOT NULL CHECK (scope = 'devnet-fixture-cycle-once'),
        state TEXT NOT NULL CHECK (state IN ('active', 'consumed', 'revoked', 'expired')),
        execution_id TEXT,
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        armed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY (mission_id, mission_revision) REFERENCES mission_revisions(mission_id, revision),
        CHECK (
          (state = 'active' AND execution_id IS NULL AND consumed_at IS NULL AND revoked_at IS NULL)
          OR (state = 'consumed' AND execution_id IS NOT NULL AND consumed_at IS NOT NULL AND revoked_at IS NULL)
          OR (state IN ('revoked', 'expired') AND revoked_at IS NOT NULL)
        )
      ) STRICT;
      CREATE UNIQUE INDEX one_open_guarded_scheduler_arm
        ON guarded_scheduler_arms((1)) WHERE state IN ('active', 'consumed');
      CREATE INDEX guarded_scheduler_arm_history
        ON guarded_scheduler_arms(mission_id, mission_revision, armed_at);
      CREATE TRIGGER revoke_scheduler_arm_on_authorization_revocation
      AFTER UPDATE OF state ON guarded_mission_authorizations
      WHEN NEW.state = 'revoked'
      BEGIN
        UPDATE guarded_scheduler_arms
        SET state = 'revoked', revoked_at = NEW.revoked_at
        WHERE authorization_id = NEW.id AND state IN ('active', 'consumed');
      END;
      CREATE TRIGGER revoke_scheduler_arm_on_mission_revision_change
      AFTER UPDATE OF current_revision ON missions
      WHEN OLD.current_revision <> NEW.current_revision
      BEGIN
        UPDATE guarded_scheduler_arms
        SET state = 'revoked', revoked_at = NEW.updated_at
        WHERE mission_id = NEW.id AND state IN ('active', 'consumed');
      END;
    `,
  },
] as const;
