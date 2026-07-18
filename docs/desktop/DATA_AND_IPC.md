# Data and IPC Contracts

## SQLite ownership

Only the Electron main process opens SQLite. The renderer receives view models through IPC and cannot run SQL.

The initial implementation uses Electron 43's built-in `node:sqlite` runtime. It enables foreign keys, WAL journaling, full synchronous writes, transactional migrations, strict tables, extension denial, and defensive mode. Database initialization failure exits the application fail-closed.

Initial tables:

- `profiles`
- `wallet_metadata`
- `missions`
- `mission_revisions`
- `desk_rule_revisions`
- `dca_cycles`
- `execution_attempts`
- `transaction_signatures`
- `receipts`
- `daily_risk_counters`
- `app_settings`
- `schema_migrations`
- `devnet_fixture_provisions`
- `guarded_devnet_executions`
- `guarded_devnet_execution_events`
- `devnet_fixture_reviews`
- `guarded_fixture_transfers`
- `guarded_fixture_transfer_approvals`
- `guarded_mission_authorizations`
- `guarded_scheduler_evaluations`
- `guarded_scheduler_arms`

Private keys, mnemonic phrases, provider API keys, master keys, and plaintext encrypted-column keys are forbidden in SQLite.

Sensitive columns use envelope encryption. The database stores ciphertext, nonce, algorithm version, and key identifier. The data key is unwrapped only through the keystore service.

## IPC rules

- Every request and response has a schema version.
- Every mutating request has a unique request ID.
- Mission commands include expected current revision/state.
- Renderer-provided paths, URLs, mints, amounts, and IDs are validated.
- IPC never accepts callbacks, code, SQL, shell strings, raw private keys, or arbitrary Solana instructions.

Initial surface:

```text
app.getRuntimeStatus
profile.list
profile.switch
wallet.create
wallet.importMnemonic
wallet.importPrivateKey
wallet.lock
wallet.unlock
wallet.lock
wallet.getDevnetBalance
devnet.requestAirdrop
devnet.executeCanary
devnet.listCanaries
devnet.provisionFixture
devnet.listFixtureProvisions
devnet.activateFixtureReview
devnet.getActiveFixture
devnet.executeFixtureTransfer
devnet.listFixtureTransfers
devnet.approveFixtureTransfer
devnet.getFixtureTransferApproval
guarded.authorizeMission
guarded.revokeMission
guarded.listAuthorizations
guarded.armScheduler
guarded.revokeSchedulerArm
guarded.listSchedulerArms
guarded.listExecutions
mission.createDraft
mission.compile
mission.authorize
mission.start
mission.halt
mission.resume
mission.getAudit
dca.getCycles
receipt.list
receipt.get
settings.get
settings.update
ai.getSettings
ai.saveProvider
ai.deleteProvider
ai.draftDca
update.getStatus
update.check
update.openReview
telemetry.getSettings
telemetry.setConsent
telemetry.listReports
telemetry.deleteReports
jupiter.getSettings
jupiter.saveKey
jupiter.deleteKey
jupiter.shadowQuote
jupiter.listShadowQuotes
```

Secret import methods are available only in the onboarding/locked state and are never echoed back in IPC responses.

AI provider API keys are encrypted by the OS-backed keystore under provider-specific labels. SQLite stores only the selected model name. `ai.getSettings` exposes `configured: boolean` and the model; it never exposes, masks, hashes, or otherwise returns a key. `ai.draftDca` accepts only a bounded prompt and provider identifier and returns a validated draft with `executionAttempted: false`.

The `devnet_canary_executions` journal stores canary state, simulation units, lifetime, and encrypted wire/signature envelopes. Renderer views never receive wire transaction bytes. A signature is decrypted only for the local audit view. A `signed` record found after restart is failed without broadcast; `broadcast` and `ambiguous` records are status-queried but never blindly resubmitted.

The fixture-provision request consists only of a request ID and four literal acknowledgments. Renderer-provided addresses, amounts, programs, endpoints, and transaction bytes are rejected. Main fixes the supply and decimals, generates the destination owner, and returns only mint address, state, simulation units, failure code, attempt flags, and timestamps. Signed wire bytes and signature remain encrypted in `devnet_fixture_provisions`.

Fixture activation accepts only a confirmed provision ID and three literal acknowledgments. Main reconstructs and verifies the final manifest from encrypted evidence plus a fresh Devnet snapshot. `devnet_fixture_reviews` stores the activation receipt encrypted and exposes only bounded public provenance metadata.

The guarded fixture-transfer request contains only a request ID and four literal acknowledgments. It cannot select a mint, account, amount, instruction, program, endpoint, or serialized transaction. Main loads the single active reviewed manifest and fixes the transfer to exactly 1,000,000 atomic units (1 token at 6 decimals). The public receipt exposes only the manifest digest, state, fixed amount, simulation units, failure code, attempt flags, and timestamps. Wire bytes, signature, and both provenance snapshots remain encrypted in `guarded_fixture_transfers`. A unique manifest constraint permits only one transfer, and restart reconciliation never rebroadcasts.

Operator approval is a separate read-only gate accepting only the confirmed transfer ID and three literal acknowledgments. Main decrypts and validates both provenance snapshots against the active manifest, requires the fixed amount, and freshly queries the encrypted signature on Devnet. Only a confirmed or finalized result creates the unique encrypted `guarded_fixture_transfer_approvals` receipt. Its public view explicitly returns `automaticTradingEnabled: false`; it cannot authorize or start a mission.

Guarded mission authorization is a second authority ledger, separate from simulation authorization. It binds one exact mission revision, plan digest, canonical Desk Rule digest, active fixture manifest, and approved transfer receipt. Migration 12 permits only one active guarded authorization globally and automatically revokes it when that mission's current revision changes. Explicit revocation is local and does not require RPC availability. Public views always return `schedulerSigningEnabled: false` and `mainnetEnabled: false` in this milestone.

Migration 13 adds one encrypted guarded-readiness evaluation per mission revision and cycle. A cycle with no guarded authority remains ordinary simulation and records `inactive`. An active authority is rechecked against its encrypted evidence, current plan and Desk Rule digests, approved transfer, confirmed fixture, keystore, and fresh network state. A mismatch records `denied` and halts the mission before any signing-capable path. A complete match records `ready`, but both its evidence and renderer view still assert `executionEnabled: false` and `signingAttempted: false`.

When readiness is `ready`, main constructs a strict fixture-cycle proposal and embeds it only inside the encrypted simulation receipt. There is no renderer IPC for proposal creation and no renderer-provided proposal field. The model carries separate authorized-DCA and fixture-test amounts while asserting no economic mapping, no market swap, and no execution capability.

The internal fixture-cycle bridge uses the existing guarded execution and append-only event journal. It accepts only the strict proposal object from trusted main-process code, repeats authority/readiness/fixture checks before simulation and signing, and encrypts proposal, validation, simulation, signed wire, signature, confirmation, failure, and receipt evidence. It is intentionally absent from preload, IPC, and scheduler construction. Post-broadcast reconciliation is signature-query-only and never rebroadcasts.

Migration 14 adds a one-shot scheduler-arm ledger. Its encrypted evidence records the three operator acknowledgements and exact parent-authority bindings. The arm expires after 15 minutes, is atomically consumed by one execution ID before signing, and is revoked when its parent authority or mission revision changes. Its renderer surface accepts only the parent authorization ID plus literal acknowledgements, exposes bounded audit metadata, and supports immediate local revocation. It cannot accept transaction bytes, accounts, amounts, programs, endpoints, or market parameters. The Devnet scheduler can invoke the bridge only through this exact arm and halts after the one-shot result; Jupiter and Mainnet remain non-executing.

`guarded.listExecutions` is read-only and returns bounded receipt metadata plus state-transition names. It intentionally excludes message hashes, signatures, wire transactions, encrypted event payloads, nonce values, key identifiers, account balances, and private transaction evidence.

The Jupiter API key is stored only under the OS-backed `jupiter-api-key` keystore label. The `jupiter_shadow_quotes` table contains an AES-256-GCM encrypted quote view, nonce, data-key identifier, allow/deny index, and observation time. It never stores the API key or a transaction. The shadow quote request accepts only a fixed SOL/USDC direction, atomic amount, bounded slippage/impact/fee limits, and an explicit quote-only acknowledgement.

The update surface accepts no renderer-provided URL. `update.check` reads only public metadata from the fixed `kevinmpandoh/silfable` latest-release API, while `update.openReview` opens only the fixed HTTPS GitHub Releases page. Every status response asserts that automatic download, installation, and restart are disabled.

Crash collection is absent until `telemetry.setConsent` records an explicit opt-in. The main process reduces Electron crash events to an allowlisted process category, reason, numeric exit code, app version, platform, and timestamp before schema validation and encryption. `crash_reports` never accepts stack traces, arbitrary messages, service names, environment variables, application state, or renderer-provided crash content. Revoking consent deletes every report. There is no upload endpoint, transmission method, or transmitted state in this build.
