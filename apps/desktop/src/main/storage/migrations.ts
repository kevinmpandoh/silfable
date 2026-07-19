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
  {
    version: 15,
    name: "ai-shadow-trade-evaluation-journal",
    sql: `
      CREATE TABLE ai_shadow_trade_evaluations (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL REFERENCES jupiter_shadow_quotes(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        outcome TEXT NOT NULL CHECK (outcome IN ('hold', 'would-execute', 'blocked')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0),
        evaluated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX ai_shadow_trade_evaluations_history
        ON ai_shadow_trade_evaluations(evaluated_at DESC);
    `,
  },
  {
    version: 16,
    name: "restricted-ai-shadow-intent-approval",
    sql: `
      ALTER TABLE ai_shadow_trade_evaluations ADD COLUMN approval_state TEXT NOT NULL DEFAULT 'not-actionable'
        CHECK (approval_state IN ('not-actionable', 'pending', 'approved', 'rejected', 'expired'));
      ALTER TABLE ai_shadow_trade_evaluations ADD COLUMN approval_expires_at TEXT;
      ALTER TABLE ai_shadow_trade_evaluations ADD COLUMN decided_at TEXT;
      CREATE INDEX ai_shadow_trade_open_approvals
        ON ai_shadow_trade_evaluations(approval_state, approval_expires_at);
    `,
  },
  {
    version: 17,
    name: "encrypted-mainnet-market-observations",
    sql: `
      CREATE TABLE market_observations (
        id TEXT PRIMARY KEY,
        source_quote_id TEXT NOT NULL REFERENCES jupiter_shadow_quotes(id),
        observation_digest TEXT NOT NULL CHECK (length(observation_digest) = 64 AND observation_digest NOT GLOB '*[^0-9a-f]*'),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        model_calls_attempted INTEGER NOT NULL DEFAULT 0 CHECK (model_calls_attempted = 0),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0)
      ) STRICT;
      CREATE INDEX market_observation_history ON market_observations(captured_at DESC);
    `,
  },
  {
    version: 18,
    name: "scheduled-market-wake-journal",
    sql: `
      CREATE TABLE market_watches (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK (state IN ('active', 'triggered', 'paused')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        next_check_at TEXT NOT NULL,
        last_checked_at TEXT,
        triggered_at TEXT,
        paused_at TEXT,
        last_observation_id TEXT REFERENCES market_observations(id),
        consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures BETWEEN 0 AND 5),
        model_calls_attempted INTEGER NOT NULL DEFAULT 0 CHECK (model_calls_attempted = 0),
        execution_enabled INTEGER NOT NULL DEFAULT 0 CHECK (execution_enabled = 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX one_active_market_watch ON market_watches((1)) WHERE state = 'active';
      CREATE INDEX market_watch_history ON market_watches(updated_at DESC);

      CREATE TABLE market_wake_receipts (
        id TEXT PRIMARY KEY,
        watch_id TEXT NOT NULL REFERENCES market_watches(id),
        observation_id TEXT REFERENCES market_observations(id),
        outcome TEXT NOT NULL CHECK (outcome IN ('waiting', 'triggered', 'failed')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        model_calls_attempted INTEGER NOT NULL DEFAULT 0 CHECK (model_calls_attempted = 0),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0)
      ) STRICT;
      CREATE INDEX market_wake_receipt_history ON market_wake_receipts(evaluated_at DESC);
    `,
  },
  {
    version: 19,
    name: "restricted-agent-session-journal",
    sql: `
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK (state IN ('active', 'halted', 'expired')),
        provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        halted_at TEXT,
        halt_reason TEXT CHECK (halt_reason IS NULL OR halt_reason IN ('operator', 'ai-halt', 'deadline', 'policy-denial')),
        execution_enabled INTEGER NOT NULL DEFAULT 0 CHECK (execution_enabled = 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX one_active_agent_session ON agent_sessions((1)) WHERE state = 'active';
      CREATE INDEX agent_session_history ON agent_sessions(updated_at DESC);

      CREATE TABLE agent_intent_evaluations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        observation_id TEXT NOT NULL REFERENCES market_observations(id),
        quote_id TEXT NOT NULL REFERENCES jupiter_shadow_quotes(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        outcome TEXT NOT NULL CHECK (outcome IN ('pending-approval', 'hold', 'halted', 'blocked')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        approval_state TEXT NOT NULL CHECK (approval_state IN ('not-actionable', 'pending', 'approved', 'rejected', 'expired')),
        approval_expires_at TEXT,
        decided_at TEXT,
        model_calls_attempted INTEGER NOT NULL DEFAULT 1 CHECK (model_calls_attempted = 1),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0),
        evaluated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX agent_intent_history ON agent_intent_evaluations(evaluated_at DESC);
      CREATE INDEX agent_open_intents ON agent_intent_evaluations(approval_state, approval_expires_at);
      CREATE TRIGGER expire_agent_intents_on_session_end
      AFTER UPDATE OF state ON agent_sessions
      WHEN NEW.state IN ('halted', 'expired')
      BEGIN
        UPDATE agent_intent_evaluations
        SET approval_state = 'expired', decided_at = NEW.updated_at
        WHERE session_id = NEW.id AND approval_state IN ('pending', 'approved');
      END;
    `,
  },
  {
    version: 20,
    name: "agent-devnet-simulation-proof-journal",
    sql: `
      CREATE TABLE agent_devnet_simulations (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL UNIQUE REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        outcome TEXT NOT NULL CHECK (outcome IN ('simulated', 'failed')),
        fixture_manifest_digest TEXT NOT NULL CHECK (length(fixture_manifest_digest) = 64 AND fixture_manifest_digest NOT GLOB '*[^0-9a-f]*'),
        message_hash TEXT CHECK (message_hash IS NULL OR (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0),
        simulated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX agent_devnet_simulation_history ON agent_devnet_simulations(simulated_at DESC);
    `,
  },
  {
    version: 21,
    name: "revocable-agent-devnet-signing-arm",
    sql: `
      CREATE TABLE agent_devnet_signing_arms (
        id TEXT PRIMARY KEY,
        simulation_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_simulations(id),
        evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        fixture_manifest_digest TEXT NOT NULL CHECK (length(fixture_manifest_digest) = 64 AND fixture_manifest_digest NOT GLOB '*[^0-9a-f]*'),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        scope TEXT NOT NULL CHECK (scope = 'agent-devnet-fixture-sign-once'),
        state TEXT NOT NULL CHECK (state IN ('active', 'revoked', 'expired')),
        encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL,
        key_id TEXT NOT NULL,
        execution_bridge_connected INTEGER NOT NULL DEFAULT 0 CHECK (execution_bridge_connected = 0),
        mainnet_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mainnet_enabled = 0),
        armed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        CHECK (
          (state = 'active' AND revoked_at IS NULL)
          OR (state IN ('revoked', 'expired') AND revoked_at IS NOT NULL)
        )
      ) STRICT;
      CREATE UNIQUE INDEX one_active_agent_devnet_signing_arm
        ON agent_devnet_signing_arms((1)) WHERE state = 'active';
      CREATE INDEX agent_devnet_signing_arm_history
        ON agent_devnet_signing_arms(armed_at DESC);
      CREATE TRIGGER revoke_agent_signing_arm_on_intent_change
      AFTER UPDATE OF approval_state ON agent_intent_evaluations
      WHEN NEW.approval_state <> 'approved'
      BEGIN
        UPDATE agent_devnet_signing_arms
        SET state = 'revoked', revoked_at = COALESCE(NEW.decided_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE evaluation_id = NEW.id AND state = 'active';
      END;
      CREATE TRIGGER revoke_agent_signing_arm_on_session_end
      AFTER UPDATE OF state ON agent_sessions
      WHEN NEW.state IN ('halted', 'expired')
      BEGIN
        UPDATE agent_devnet_signing_arms
        SET state = 'revoked', revoked_at = NEW.updated_at
        WHERE session_id = NEW.id AND state = 'active';
      END;
    `,
  },
  {
    version: 22,
    name: "agent-devnet-pre-sign-execution-journal",
    sql: `
      DROP TRIGGER revoke_agent_signing_arm_on_intent_change;
      DROP TRIGGER revoke_agent_signing_arm_on_session_end;
      DROP INDEX one_active_agent_devnet_signing_arm;
      DROP INDEX agent_devnet_signing_arm_history;
      CREATE TABLE agent_devnet_signing_arms_v22 (
        id TEXT PRIMARY KEY, simulation_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_simulations(id),
        evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id), session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        fixture_manifest_digest TEXT NOT NULL CHECK (length(fixture_manifest_digest) = 64 AND fixture_manifest_digest NOT GLOB '*[^0-9a-f]*'),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        scope TEXT NOT NULL CHECK (scope = 'agent-devnet-fixture-sign-once'),
        state TEXT NOT NULL CHECK (state IN ('active', 'consumed', 'revoked', 'expired')),
        execution_id TEXT, encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        execution_bridge_connected INTEGER NOT NULL DEFAULT 0 CHECK (execution_bridge_connected = 0),
        mainnet_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mainnet_enabled = 0),
        armed_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, revoked_at TEXT,
        CHECK ((state = 'active' AND execution_id IS NULL AND consumed_at IS NULL AND revoked_at IS NULL)
          OR (state = 'consumed' AND execution_id IS NOT NULL AND consumed_at IS NOT NULL AND revoked_at IS NULL)
          OR (state IN ('revoked', 'expired') AND execution_id IS NULL AND consumed_at IS NULL AND revoked_at IS NOT NULL))
      ) STRICT;
      INSERT INTO agent_devnet_signing_arms_v22
        (id, simulation_id, evaluation_id, session_id, proposal_digest, fixture_manifest_digest, message_hash,
         scope, state, execution_id, encrypted_payload, payload_nonce, key_id, execution_bridge_connected,
         mainnet_enabled, armed_at, expires_at, consumed_at, revoked_at)
      SELECT id, simulation_id, evaluation_id, session_id, proposal_digest, fixture_manifest_digest, message_hash,
         scope, state, NULL, encrypted_payload, payload_nonce, key_id, execution_bridge_connected,
         mainnet_enabled, armed_at, expires_at, NULL, revoked_at FROM agent_devnet_signing_arms;
      DROP TABLE agent_devnet_signing_arms;
      ALTER TABLE agent_devnet_signing_arms_v22 RENAME TO agent_devnet_signing_arms;
      CREATE UNIQUE INDEX one_active_agent_devnet_signing_arm ON agent_devnet_signing_arms((1)) WHERE state = 'active';
      CREATE INDEX agent_devnet_signing_arm_history ON agent_devnet_signing_arms(armed_at DESC);

      CREATE TABLE agent_devnet_pre_sign_executions (
        id TEXT PRIMARY KEY, signing_arm_id TEXT NOT NULL REFERENCES agent_devnet_signing_arms(id),
        simulation_id TEXT NOT NULL REFERENCES agent_devnet_simulations(id), evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        fixture_manifest_digest TEXT NOT NULL CHECK (length(fixture_manifest_digest) = 64 AND fixture_manifest_digest NOT GLOB '*[^0-9a-f]*'),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        state TEXT NOT NULL CHECK (state IN ('ready-for-signing', 'failed')),
        failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('arm-invalid', 'binding-changed', 'network-unhealthy', 'provenance-denied', 'blockhash-expired', 'simulation-failed', 'fee-exceeded')),
        encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0), prepared_at TEXT NOT NULL,
        CHECK ((state = 'ready-for-signing' AND failure_code IS NULL) OR (state = 'failed' AND failure_code IS NOT NULL))
      ) STRICT;
      CREATE UNIQUE INDEX one_ready_agent_execution_per_arm ON agent_devnet_pre_sign_executions(signing_arm_id) WHERE state = 'ready-for-signing';
      CREATE INDEX agent_devnet_pre_sign_history ON agent_devnet_pre_sign_executions(prepared_at DESC);

      CREATE TRIGGER revoke_agent_signing_arm_on_intent_change AFTER UPDATE OF approval_state ON agent_intent_evaluations
      WHEN NEW.approval_state <> 'approved' BEGIN
        UPDATE agent_devnet_signing_arms SET state = 'revoked', revoked_at = COALESCE(NEW.decided_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE evaluation_id = NEW.id AND state = 'active'; END;
      CREATE TRIGGER revoke_agent_signing_arm_on_session_end AFTER UPDATE OF state ON agent_sessions
      WHEN NEW.state IN ('halted', 'expired') BEGIN
        UPDATE agent_devnet_signing_arms SET state = 'revoked', revoked_at = NEW.updated_at
        WHERE session_id = NEW.id AND state = 'active'; END;
    `,
  },
  {
    version: 23,
    name: "agent-devnet-exact-signing-journal",
    sql: `
      CREATE TABLE agent_devnet_signed_executions (
        id TEXT PRIMARY KEY, pre_sign_execution_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_pre_sign_executions(id),
        signing_arm_id TEXT NOT NULL REFERENCES agent_devnet_signing_arms(id), simulation_id TEXT NOT NULL REFERENCES agent_devnet_simulations(id),
        evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id), session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        state TEXT NOT NULL CHECK (state IN ('proposed', 'signing', 'signed-awaiting-broadcast', 'failed')),
        signature_hash TEXT CHECK (signature_hash IS NULL OR (length(signature_hash) = 64 AND signature_hash NOT GLOB '*[^0-9a-f]*')),
        failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('binding-changed', 'network-unhealthy', 'provenance-denied', 'blockhash-expired', 'signing-failed', 'journal-conflict', 'restart-before-sign-complete')),
        encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted IN (0, 1)),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted = 0),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK (state <> 'signed-awaiting-broadcast' OR (signing_attempted = 1 AND signature_hash IS NOT NULL AND failure_code IS NULL)),
        CHECK (state <> 'failed' OR failure_code IS NOT NULL)
      ) STRICT;
      CREATE INDEX agent_devnet_signed_execution_history ON agent_devnet_signed_executions(updated_at DESC);
    `,
  },
  {
    version: 24,
    name: "agent-devnet-broadcast-journal",
    sql: `
      CREATE TABLE agent_devnet_broadcast_executions (
        id TEXT PRIMARY KEY, signed_execution_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_signed_executions(id),
        pre_sign_execution_id TEXT NOT NULL REFERENCES agent_devnet_pre_sign_executions(id),
        simulation_id TEXT NOT NULL REFERENCES agent_devnet_simulations(id), evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        signature_hash TEXT NOT NULL CHECK (length(signature_hash) = 64 AND signature_hash NOT GLOB '*[^0-9a-f]*'),
        last_valid_block_height TEXT NOT NULL CHECK (length(last_valid_block_height) BETWEEN 1 AND 32 AND last_valid_block_height NOT GLOB '*[^0-9]*'),
        state TEXT NOT NULL CHECK (state IN ('proposed', 'broadcast', 'confirmed', 'failed', 'ambiguous')),
        failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('binding-changed', 'network-unhealthy', 'provenance-denied', 'blockhash-expired', 'broadcast-status-unknown', 'network-lost-after-broadcast', 'transaction-error', 'blockhash-expired-unconfirmed', 'confirmation-timeout', 'restart-before-broadcast', 'reconciliation-pending', 'reconciliation-unavailable', 'journal-integrity-error')),
        encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted IN (0, 1)),
        execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempted IN (0, 1)),
        fixture_transfer_performed INTEGER NOT NULL DEFAULT 0 CHECK (fixture_transfer_performed IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK (state NOT IN ('broadcast', 'ambiguous', 'confirmed') OR (broadcast_attempted = 1 AND execution_attempted = 1)),
        CHECK (state <> 'confirmed' OR (failure_code IS NULL AND fixture_transfer_performed = 1)),
        CHECK (state NOT IN ('failed', 'ambiguous') OR failure_code IS NOT NULL)
      ) STRICT;
      CREATE INDEX agent_devnet_broadcast_history ON agent_devnet_broadcast_executions(updated_at DESC);
    `,
  },
  {
    version: 25,
    name: "agent-raydium-devnet-economic-quotes",
    sql: `
      CREATE TABLE agent_devnet_swap_quotes (
        id TEXT PRIMARY KEY, evaluation_id TEXT NOT NULL UNIQUE REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id), action TEXT NOT NULL CHECK (action IN ('buy-sol', 'sell-sol')),
        allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)), encrypted_payload TEXT NOT NULL,
        payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL, quoted_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        transaction_built INTEGER NOT NULL DEFAULT 0 CHECK (transaction_built = 0),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0)
      ) STRICT;
      CREATE INDEX agent_devnet_swap_quote_history ON agent_devnet_swap_quotes(quoted_at DESC);
    `,
  },
  {
    version: 26,
    name: "agent-raydium-devnet-swap-builds",
    sql: `
      CREATE TABLE agent_devnet_swap_builds (
        id TEXT PRIMARY KEY, quote_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_swap_quotes(id),
        evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id), session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        state TEXT NOT NULL CHECK (state IN ('simulated', 'denied')), message_hash TEXT,
        encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        transaction_built INTEGER NOT NULL CHECK (transaction_built IN (0, 1)), simulation_attempted INTEGER NOT NULL CHECK (simulation_attempted IN (0, 1)),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0), broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0),
        built_at TEXT NOT NULL, expires_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX agent_devnet_swap_build_history ON agent_devnet_swap_builds(built_at DESC);
    `,
  },
  {
    version: 27,
    name: "agent-raydium-devnet-signing-arms",
    sql: `
      CREATE TABLE agent_devnet_swap_signing_arms (
        id TEXT PRIMARY KEY, build_id TEXT NOT NULL UNIQUE REFERENCES agent_devnet_swap_builds(id),
        quote_id TEXT NOT NULL REFERENCES agent_devnet_swap_quotes(id), evaluation_id TEXT NOT NULL REFERENCES agent_intent_evaluations(id),
        session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
        message_hash TEXT NOT NULL CHECK (length(message_hash) = 64 AND message_hash NOT GLOB '*[^0-9a-f]*'),
        output_token_account TEXT NOT NULL CHECK (length(output_token_account) BETWEEN 32 AND 44),
        output_amount_delta TEXT NOT NULL CHECK (length(output_amount_delta) > 0 AND output_amount_delta NOT GLOB '*[^0-9]*' AND output_amount_delta <> '0'),
        wallet_lamports_delta TEXT NOT NULL CHECK (length(wallet_lamports_delta) > 0 AND wallet_lamports_delta NOT GLOB '*[^0-9]*' AND wallet_lamports_delta <> '0'),
        scope TEXT NOT NULL CHECK (scope = 'agent-raydium-devnet-sell-sign-once'),
        state TEXT NOT NULL CHECK (state IN ('active', 'consumed', 'revoked', 'expired')), consumer_id TEXT,
        encrypted_payload TEXT NOT NULL, payload_nonce TEXT NOT NULL, key_id TEXT NOT NULL,
        signing_bridge_connected INTEGER NOT NULL DEFAULT 0 CHECK (signing_bridge_connected = 0),
        signing_attempted INTEGER NOT NULL DEFAULT 0 CHECK (signing_attempted = 0),
        broadcast_attempted INTEGER NOT NULL DEFAULT 0 CHECK (broadcast_attempted = 0),
        mainnet_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mainnet_enabled = 0),
        armed_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, revoked_at TEXT,
        CHECK ((state = 'consumed') = (consumer_id IS NOT NULL AND consumed_at IS NOT NULL)),
        CHECK (state <> 'active' OR (consumer_id IS NULL AND consumed_at IS NULL AND revoked_at IS NULL))
      ) STRICT;
      CREATE UNIQUE INDEX one_active_agent_devnet_swap_signing_arm
        ON agent_devnet_swap_signing_arms((1)) WHERE state = 'active';
      CREATE INDEX agent_devnet_swap_signing_arm_history ON agent_devnet_swap_signing_arms(armed_at DESC);
      CREATE TRIGGER revoke_swap_signing_arm_on_intent_change AFTER UPDATE OF approval_state ON agent_intent_evaluations
      WHEN NEW.approval_state <> 'approved' BEGIN
        UPDATE agent_devnet_swap_signing_arms SET state = 'revoked', revoked_at = COALESCE(NEW.decided_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE evaluation_id = NEW.id AND state = 'active'; END;
      CREATE TRIGGER revoke_swap_signing_arm_on_session_end AFTER UPDATE OF state ON agent_sessions
      WHEN NEW.state IN ('halted', 'expired') BEGIN
        UPDATE agent_devnet_swap_signing_arms SET state = 'revoked', revoked_at = NEW.updated_at
        WHERE session_id = NEW.id AND state = 'active'; END;
    `,
  },
] as const;
