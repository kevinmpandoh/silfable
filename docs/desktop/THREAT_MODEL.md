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
| Secret leakage in logs | centralized redaction, telemetry opt-in, prohibited-field tests |
| Stale or manipulated market data | freshness windows, Jupiter quote validation, RPC health, fail closed |
| Unbounded autonomous loss | Desk Rule caps, dedicated wallet warning, daily counters, global kill switch |
| Duplicate execution | idempotency key, durable cycle state, signature reconciliation |
| Missed DCA cycles | mark skipped; never catch up automatically |
| Supply-chain update attack | signed GitHub release artifacts, checksums, notify-and-review |
| Database corruption | migrations, transaction boundaries, backup, receipt append checks |
| Suspend/network interruption | halt, lock on suspend, manual reconciliation and resume |

## Explicit non-goals for version one

- Protecting secrets from a fully compromised host or root user.
- Running arbitrary third-party plugins.
- Executing arbitrary Solana programs proposed by a model.
- Mainnet execution before shadow-mode evidence and guarded-beta approval.
- Cloud synchronization of wallets, seeds, strategies, or receipts.

## Required security tests

- IPC fuzz and authorization tests.
- Renderer navigation and CSP tests.
- Secret redaction snapshot tests.
- Keystore tamper and wrong-password tests.
- Duplicate DCA wake/restart tests.
- Network drop at every execution stage.
- Transaction confirmation ambiguity and reconciliation tests.
- Database migration rollback tests.
- Update checksum/signature verification tests.
