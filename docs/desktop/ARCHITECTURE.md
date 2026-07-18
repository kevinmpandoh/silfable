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

OpenAI and Anthropic adapters support DCA drafting and Mainnet Shadow trade proposals. DCA drafting receives only the user's brief. Shadow proposals receive one sanitized, main-owned Jupiter quote selected by opaque ID plus the user's objective; mint addresses, wallet data, transaction material, and unrelated history are excluded. Provider structured-output modes constrain responses, then the main process independently validates versioned `AiDcaIntentV1` or `AiShadowTradeProposalV1` objects.

The adapter cannot call tools and has no reference to the mission service, signer, Solana RPC, SQLite handle, filesystem, shell, or renderer IPC. A shadow proposal can only hold or propose the exact quoted swap. The deterministic gate binds quote ID, direction, amount, expiry, allow/deny state, and transaction absence before recording an encrypted no-execution receipt. An eligible receipt may enter a one-hour, digest-bound operator approval window; it can be rejected, revoked, or expired, and always reports `executionEnabled: false`. Invalid, stale, mutated, or incomplete provider output fails closed.

### Solana profiles

- `devnet-simulation`: deterministic quote adapter plus Devnet SPL test transactions.
- `mainnet-shadow`: real Jupiter Swap V2 SOL/USDC quote-only observation with local validation and an encrypted journal. The request omits `taker`, and no transaction builder, signer, or broadcaster is reachable from this profile.

The market observation service can derive a short-lived snapshot only from a fresh, allowed quote resolved by opaque ID in the main process. It normalizes SOL/USDC price using atomic integer arithmetic, aggregates an hour of comparable local quotes into a bounded range, labels price-impact-based liquidity as a proxy, and records provider, source IDs, timestamps, expiry, nullable slot/block fields, and a SHA-256 content digest. The encrypted journal hard-codes model, signing, and execution attempts to false. Mainnet wallet exposure remains explicitly unavailable while the only configured wallet profile is Devnet.

The scheduled market wake service is separately opt-in and permits one active watch. Its encrypted configuration contains only direction, normalized SOL/USDC threshold, price-impact cap, and a 60–3,600 second interval. Each due tick requests a fixed-size quote, creates a main-owned observation, applies an integer threshold gate, and records an encrypted `waiting`, `triggered`, or `failed` receipt. It has no AI service reference, signer, transaction builder, mission authority, or execution bridge. Overlapping ticks collapse, lock/suspend invalidates in-flight work, and five consecutive failures pause the watch.

A restricted agent session stores an encrypted objective, selected provider, deadline, per-action USDC cap, price-impact stop, and volatility stop. The provider receives only that bounded policy plus a sanitized observation; wallet context, mint addresses, keys, transaction material, and unrelated history are omitted. The main process resolves the observation and primary quote by ID before the model call and re-resolves session state, observation freshness, and quote validity afterward. The deterministic evaluator binds IDs, direction, notional, cap, impact, volatility, deadline, transaction absence, and quote expiry. Buy/sell produces only a digest-bound approval intent; hold is non-actionable; halt and policy denial move the session to a safe terminal state. No session object references an execution service.

The Phase 5 proof bridge accepts only an exact, currently approved buy/sell evaluation. A dedicated adapter receives a public authority address and the active reviewed Devnet fixture, constructs a fixed `TransferChecked` message without a signer, compiles the exact unsigned wire message, and calls RPC simulation with signature verification disabled. It has no sign or broadcast method. Fixture provenance is checked before construction and again after RPC latency; the service also re-resolves the active fixture digest, session, approval state, and proposal digest before accepting success. The unsigned wire and RPC context are encrypted in the local journal, while the renderer receives only a message hash, program IDs, fee/units, and hard-coded no-sign/no-broadcast/no-execution flags. The fixture has no economic mapping to the AI proposal and is not a market swap.

After a successful proof, a separate agent signing-arm service may record one one-message Devnet authorization lasting at most 60 seconds, and only when the proof is at most 30 seconds old. Creation rebinds the simulation ID, message hash, proposal digest, active session/approval, and current fixture digest, and caps expiry to both the approval and session deadline. SQLite permits only one active arm and database triggers revoke it when the intent or session leaves its approved state. Lock, suspend, quit, explicit revocation, and restart also revoke open arms. The renderer cannot provide transaction material. The arm view reports `executionBridgeConnected: false` because it has no direct signer or broadcaster; only the exact pre-sign consumer can atomically consume it into the later isolated signing and broadcast journals.

The pre-sign preparation service is the only consumer of an agent arm. It loads the original unsigned wire from encrypted main-process evidence, rejects an expired block height, performs a fresh on-chain fixture provenance check, simulates the exact wire again, enforces the fee cap, and then repeats health, fixture, session, approval, digest, and arm checks after RPC latency. A successful receipt and the `active -> consumed` arm transition occur inside one immediate SQLite transaction. Any failure creates an encrypted failure receipt without consuming the arm.

The agent Devnet signing service accepts only that exact `ready-for-signing` receipt and its message hash. It creates a durable journal before private-key use, repeats network, fixture, block-height, session, approval, and proposal binding checks, records a signing-attempt marker, then loads the local wallet signer only for the exact decoded message. It verifies the message hash before and after signing, encrypts the signed wire and signature, and exposes only a signature hash. Each pre-sign receipt has one journal, so it cannot be replayed; an unfinished journal found at restart becomes a definite failure without another signing attempt. The adapter deliberately has no send or broadcast method, and every public receipt retains false broadcast, execution, market-swap, and Mainnet flags.

Broadcast is a separate one-shot service and journal. The renderer supplies only the signed receipt ID, expected hashes, and three literal acknowledgements; it cannot supply wire bytes, signatures, endpoints, accounts, programs, or amounts. Main repeats network, block-height, immutable fixture provenance, active session, unexpired approval, proposal, message, and signature checks, then atomically writes `broadcastAttempted` and `executionAttempted` before calling the fixed Devnet RPC adapter. Confirmation is queried by the encrypted signature. Any uncertain result after the marker becomes `ambiguous`; restart reconciliation only queries that signature and never sends again. `confirmed` means the fixed reviewed fixture transfer landed on Devnet and still reports no economic mapping, no market swap, and no Mainnet access.

The first economic Devnet bridge is quote-only. An approved agent direction maps `sell-sol` to SOL→devUSDC and `buy-sol` to devUSDC→SOL at fixed canary amounts through Raydium's fixed Devnet Transaction API quote endpoint. Renderer input cannot select mints, amount, pool, route, slippage, or endpoint. Main checks the exact response chain, output threshold, route pool IDs, session impact cap, and approval again after latency, then encrypts the journal. Its mapping is explicitly direction-only and capped; Devnet pool price is test evidence rather than market price discovery. No transaction builder, signer, or broadcaster consumes this quote yet.
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
