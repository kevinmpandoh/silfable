# Guarded AI Trader Roadmap

## Product direction

Silfable is evolving from AI-assisted DCA configuration into a guarded local AI trading runtime. The target loop is:

```text
main-owned market observation
  -> AI proposes a typed intent
  -> deterministic policy evaluates it
  -> restricted approval or bounded autonomy
  -> runtime constructs, simulates, signs, and submits
  -> encrypted local receipt
```

The model never receives a signer, private key, RPC client, database handle, filesystem, shell, or arbitrary tool access. It can propose only versioned intents. The Electron main process remains the sole authority for observation provenance, policy, transaction construction, simulation, signing, broadcast, reconciliation, and journaling.

## Delivery phases

### Phase 1 — Shadow proposal loop

- Feed one sanitized, main-owned Jupiter shadow quote to the selected AI provider.
- Permit only `execute-quoted-swap` or `hold` proposals.
- Bind every proposal to the exact quote ID, direction, and input amount.
- Evaluate freshness, quote validity, transaction absence, and proposal binding deterministically.
- Store an encrypted local evaluation receipt.
- Never construct, sign, or broadcast a transaction.

This phase proves the model-to-runtime handoff without creating a new execution path.

### Phase 2 — Restricted intent approval (implemented)

- Convert an eligible `execute-quoted-swap` evaluation into a short-lived pending intent.
- Require explicit operator acknowledgement before approval.
- Bind approval and rejection to the evaluation ID and proposal digest.
- Allow an approved intent to be revoked and automatically expire open intents.
- Keep approval informational: it cannot construct, sign, or execute a transaction.

### Phase 3 — Market observation service

- Add first-party price, liquidity, volatility, wallet-exposure, and position observations. Price, a labeled liquidity proxy, and historical range are implemented; Mainnet wallet exposure/positions remain explicitly unavailable until a real Mainnet wallet profile exists.
- Record source, slot/block, timestamp, freshness budget, and content digest. Implemented; slot/block remain nullable because the current Jupiter quote response does not provide them.
- Build scheduled wake conditions that make zero model calls while sleeping. Implemented with fixed-size Jupiter probes, explicit opt-in, encrypted receipts, one active watch, overlap suppression, and fail-closed automatic pause.
- Keep observations separate from signing and mission authority.

### Phase 4 — Restricted agent sessions (implemented)

- Add mission objectives, deadlines, capital caps, allowed venues, and explicit stop conditions.
- Let AI propose typed `buy`, `sell`, `hold`, or `halt` intents from validated observations.
- Require one-tap operator approval for every state-changing proposal.
- Expire unanswered proposals and continue or halt according to mission policy.

The current implementation supports one active encrypted session, manual selection of a fresh main-owned observation, `buy-sol`, `sell-sol`, `hold`, and `halt` proposals, post-provider freshness revalidation, deterministic capital/risk gates, immediate safe halt, and digest-bound approve/reject/revoke controls. It deliberately has no transaction construction or signing path.

### Phase 5 — Guarded Devnet autonomy (increments 1–6 implemented)

- Construct transactions only after deterministic approval.
- Simulate exact messages and bind authorization to their digest.
- Use revocable, short-lived, narrowly scoped signing arms.
- Revalidate observation, quote, balances, fees, programs, and mission state immediately before signing.
- Reconcile ambiguous broadcasts before any further execution.

Increment 1 implements the boundary before signing: an exact approved buy/sell intent can trigger one replay-protected, unsigned Devnet simulation against the active reviewed SPL fixture. The runtime hashes the compiled message, stores the unsigned wire and RPC evidence encrypted, revalidates the fixture and approval after the network call, and exposes a receipt that hard-codes no economic mapping, no market swap, no signing, no broadcast, and no execution. Revocable signing arms, market-value mapping, broadcast, and reconciliation remain unimplemented.

Increment 2 adds a dedicated one-shot signing-arm lifecycle without connecting it to a signer. An operator can arm only an exact successful proof no older than 30 seconds; the encrypted authorization is bound to the simulation, message, proposal, session, and fixture, lasts at most 60 seconds, and is revoked by state changes, lock, suspend, quit, restart, or explicit action. The renderer cannot submit transaction material and the public contract hard-codes `executionBridgeConnected: false`, `marketSwapPerformed: false`, and `mainnetEnabled: false`. Arm consumption, signing, broadcast, and reconciliation remain unimplemented.

Increment 3 implements atomic arm consumption and an encrypted pre-sign journal. The main process privately reloads and re-simulates the original exact wire, checks block height, fee, network, on-chain fixture provenance, approval, session, and every digest before and after RPC latency, then writes `ready-for-signing` and `consumed` in one database transaction. Failures receive durable no-sign receipts without consuming the arm. The consumer has no wallet signer or broadcast port; actual signing, submission, confirmation, and reconciliation remain unimplemented.

Increment 4 connects only a `ready-for-signing` receipt to the local Devnet wallet signer. A durable marker is committed before key use, all current bindings and on-chain fixture provenance are checked again, and the exact previously simulated message hash is verified before and after signing. The signed wire and signature remain encrypted while the renderer receives only a signature hash and fixed no-broadcast/no-execution flags. A receipt can be attempted only once, and restart fails unfinished journals without retrying. This still is not an AI-directed market swap: broadcast, confirmation, reconciliation, economic intent mapping, value-bearing execution, and every Mainnet signing path remain unimplemented.

Increment 5 adds separately acknowledged one-shot Devnet submission and signature reconciliation for the exact signed fixture. Authorization and provenance are checked again, the attempt marker is committed before `sendTransaction`, confirmation is status-driven, and uncertainty after submission is never reported as a safe retry. Restart converts an unsubmitted proposal to failure and only queries the encrypted signature for broadcast or ambiguous records; it never rebroadcasts. A confirmed receipt proves the reviewed fixture transfer only. It has no economic mapping to the AI intent, is not a Jupiter swap, and cannot use Mainnet.

Increment 6 begins the real economic bridge without adding execution privilege. Approved `buy-sol` and `sell-sol` directions map to fixed low-value Raydium Devnet SOL/devUSDC canary quotes. Main owns the pair, direction, amount, slippage, and endpoint, validates route continuity and impact against the session cap, repeats approval checks after network latency, and encrypts the result. The mapping is direction-only rather than full notional equivalence, and Devnet prices are never treated as market discovery. Transaction construction, simulation, signing, and broadcast for this economic quote remain unimplemented.

### Phase 6 — Mainnet restricted execution

- Start with low-value, allowlisted SOL/USDC swaps and mandatory per-trade approval.
- Add audited adapters one venue at a time.
- Require signed release artifacts, successful recovery tests, and an explicit operator risk acknowledgement.
- Keep full autonomy disabled until restricted execution has production evidence.

### Phase 7 — Bounded full autonomy

- Allow a mission to run without per-trade prompts only inside immutable capital, loss, slippage, venue, asset, duration, and action limits.
- Never allow permission widening during a running session.
- End missions on goal, deadline, loss cap, capital exhaustion, no viable opportunity, policy denial, or emergency stop.
- Preserve complete local receipts for proposed, blocked, approved, executed, failed, and ambiguous outcomes.

## Non-negotiable invariants

1. AI output is untrusted data, never authorization.
2. Renderer input is untrusted and cannot provide market provenance or transaction material.
3. Only the main process can resolve an observation or quote by ID.
4. Proposal fields that affect execution must exactly match a validated observation or be independently bounded by policy.
5. Policy checks run again after simulation and immediately before signing.
6. Unknown, stale, unavailable, or ambiguous state fails closed.
7. Mainnet autonomy cannot be enabled by a model response, renderer flag, or a single generic consent.
8. Every state-changing attempt produces a durable encrypted receipt.

## Current milestone

Phase 5 increments 1–6 are complete. The fixture pipeline reaches safe Devnet confirmation, while the separate economic path now binds approved AI direction to a real capped Raydium Devnet SOL/devUSDC quote. Silfable still does not execute that quote: no Raydium transaction is built, simulated, signed, or broadcast, and the mapping does not reproduce the full AI notional. The next increment is strict server-built transaction decoding, program/account allowlisting, exact simulation, and balance-delta policy before any new signing arm is considered. Every Mainnet signing/broadcast path remains disabled.
