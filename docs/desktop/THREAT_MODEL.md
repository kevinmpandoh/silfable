# Threat Model

## Protected assets

- Solana private keys and mnemonic phrases.
- OpenAI and Anthropic API keys.
- Authorized mission and Desk Rule snapshots.
- Strategy configuration, wallet addresses, balances, and receipts.
- Signed and unsigned Solana transactions.
- Update artifacts and application integrity.

## Principal threats and controls

| Threat | Primary controls |
| --- | --- |
| Renderer compromise | sandbox, context isolation, no Node integration, narrow IPC |
| Malicious model output | structured intent schema, token/program allowlists, deterministic execution engine |
| IPC privilege escalation | sender validation, per-channel schema validation, state and authorization checks |
| Secret theft at rest | Argon2id-derived wrapping key, authenticated encryption, file permissions, separate keystore |
| Secret leakage in logs | telemetry disabled by default, allowlist-only crash schema, encrypted local records, prohibited-field tests, revoke-and-purge |
| Stale or manipulated market data | freshness windows, Jupiter quote validation, RPC health, fail closed |
| Unbounded autonomous loss | Desk Rule caps, dedicated wallet warning, daily counters, global kill switch |
| Duplicate execution | idempotency key, durable cycle state, signature reconciliation |
| Missed DCA cycles | mark skipped; never catch up automatically |
| Supply-chain update attack | draft-release QA, checksums, fixed review URL, notify-and-review; signing remains required before production |
| Database corruption | migrations, transaction boundaries, backup, receipt append checks |
| Suspend/network interruption | halt, lock on suspend, manual reconciliation and resume |

## Explicit non-goals for version one

- Protecting secrets from a fully compromised host or root user.
- Running arbitrary third-party plugins.
- Executing arbitrary Solana programs proposed by a model.
- Mainnet execution before shadow-mode evidence and guarded-beta approval.
- Cloud synchronization of wallets, seeds, strategies, or receipts.

## Required security tests

- IPC unknown-field fuzz, acknowledgement, sender, and top-frame tests. Implemented.
- Renderer preferences, permissions, navigation, window, webview, and CSP tests. Implemented.
- Automated renderer/preload privilege-marker audit in CI and release workflows. Implemented.
- Telemetry allowlist and encrypted-at-rest prohibited-field tests. Implemented.
- Keystore tamper, insecure-backend, malformed-file, size-limit, and concurrent-mutation tests. Implemented.
- Duplicate DCA wake/restart tests. Implemented for the simulation scheduler.
- Network drop after simulation, signing, and broadcast. Implemented for the Devnet canary; guarded swap stages remain pending.
- Guarded proposal mutation, stale/expired quote, program allowlist, fee, reserve, balance-delta, and state-transition tests. Implemented as a pure policy; live adapter tests remain pending.
- Transaction confirmation ambiguity and reconciliation tests.
- Database migration rollback tests.
- Update checksum/signature verification tests.
