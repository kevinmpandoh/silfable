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
update.openReleasePage
```

Secret import methods are available only in the onboarding/locked state and are never echoed back in IPC responses.

AI provider API keys are encrypted by the OS-backed keystore under provider-specific labels. SQLite stores only the selected model name. `ai.getSettings` exposes `configured: boolean` and the model; it never exposes, masks, hashes, or otherwise returns a key. `ai.draftDca` accepts only a bounded prompt and provider identifier and returns a validated draft with `executionAttempted: false`.
