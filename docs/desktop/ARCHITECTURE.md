# Desktop Architecture

## Trust boundaries

```text
Electron renderer (untrusted UI boundary)
        |
        | narrow, versioned, validated IPC
        v
Preload contextBridge
        |
        v
Electron main process
  |-- Mission supervisor
  |-- Desk Rule engine
  |-- DCA scheduler
  |-- AI provider adapters
  |-- Solana/Jupiter adapters
  |-- Transaction simulator and broadcaster
  |-- Encrypted keystore service
  |-- SQLite repository
  `-- Receipt writer
```

The renderer has no Node.js integration, filesystem access, SQLite handle, RPC client, or secret access. Context isolation and renderer sandboxing remain enabled. IPC handlers validate sender, channel, payload, mission state, and authorization before work begins.

## Runtime modules

### Mission supervisor

Owns the lifecycle `Draft -> Compiled -> Authorized -> Running -> Halted -> Completed`. Only the supervisor can transition a mission into an executable state. Restart always returns non-terminal missions to `Halted`.

### Desk Rule engine

Pure and deterministic. Inputs include the authorized rule snapshot, proposed intent, fresh quote, simulation result, wallet exposure, daily counters, and network health. It returns an allow/deny result plus machine-readable evidence.

### DCA scheduler

Stores the next due time, never relies on renderer timers, and runs inside the main process. On wake or restart it marks past cycles `Skipped`; it does not catch up. A cycle becomes an ordinary swap intent and follows the same execution pipeline as every other mission.

### AI adapters

OpenAI and Anthropic adapters currently receive only the user's DCA brief plus a fixed system instruction. Wallet addresses, balances, key material, database content, and market observations are not included. Provider structured-output modes constrain the response, then the main process independently validates it with the versioned `AiDcaIntentV1` schema.

The adapter cannot call tools and has no reference to the mission service, signer, Solana RPC, SQLite handle, filesystem, shell, or renderer IPC. Its result is only a draft. The user must apply it to the local form, save an immutable mission revision, review its digest, and authorize it through Desk Rules. Invalid or incomplete provider output fails closed without changing a mission.

### Solana profiles

- `devnet-simulation`: deterministic quote adapter plus Devnet SPL test transactions.
- `mainnet-shadow`: real Jupiter Swap V2 SOL/USDC quote-only observation with local validation and an encrypted journal. The request omits `taker`, and no transaction builder, signer, or broadcaster is reachable from this profile.
- `mainnet-guarded`: real Jupiter execution with explicit low-value caps.

Profiles use separate database namespaces, wallet records, receipts, and configuration. Switching profile halts all missions and locks the keystore.

## Security defaults

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- restrictive Content Security Policy
- no remote code execution
- navigation and new-window creation denied by default
- external URLs opened only after allowlist validation
- versioned, one-purpose IPC methods
- strict request objects that reject unknown fields
- exact main-window WebContents and top-frame identity for every IPC invocation
- secrets copied into memory only for the shortest required operation
- structured logs with denylisted and pattern-based redaction

## Failure semantics

Silfable fails closed. Network loss, RPC disagreement, stale quotes, expired blockhashes, simulation errors, receipt write failures, keystore errors, database migration failures, or unknown transaction status immediately stop new signing. An in-flight signature is reconciled before the mission can be manually resumed.
