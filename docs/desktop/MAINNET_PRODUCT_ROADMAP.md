# Mainnet Desktop Product Roadmap

## Purpose

This roadmap records work that is not yet complete for the Mainnet-only desktop application. It is ordered by risk and dependency: protection of user funds comes before operational polish, production release work comes before unattended agents, and new chains or venues come last.

The current production boundary remains `mainnet-guarded`: AI may research and propose, while deterministic local services enforce policy, simulate, request explicit approval, sign locally, broadcast once, and verify the resulting signature independently.

## Status legend

- **Planned**: not implemented.
- **Partial**: a foundation exists, but the end-to-end product behavior is incomplete.
- **Blocked**: must not begin until its listed safety dependencies are complete.
- **Complete**: retained here only when needed to explain why a planned item is narrower than the original request.

## P0 — Mainnet capital safety and state correctness

These items are required before another round of routine Mainnet execution testing.

### P0.1 Fee guard — Partial

- [x] Show network fee in lamports, SOL, USD, and as a percentage of trade value when pricing evidence is available.
- [x] Reconcile and show actual account/rent funding separately from the actual network fee after confirmation.
- [x] Show actual total wallet outflow from confirmed pre/post wallet balances.
- [ ] Estimate account/rent funding and total wallet outflow before signing.
- [x] Classify the result as `Reasonable`, `High`, or `Extreme`; thresholds are explicit and configurable.
- [x] Add persisted user settings for maximum network fee and maximum fee percentage.
- [x] Fail closed before signing when either configured limit is exceeded.
- [x] Require and enforce a fresh estimate during the final pre-sign simulation.
- [x] Never describe refundable token-account rent as a permanently spent trading fee.

### P0.2 Automatic position refresh — Complete

- [x] Reload the selected wallet portfolio after a receipt becomes confirmed or finalized.
- [x] Poll finalized state until the receipt slot is visible, including newly created SPL token accounts.
- [x] Display the snapshot slot and verification time.
- [x] Prevent an older portfolio response from replacing a newer snapshot.
- [x] Provide an explicit retry action when RPC or price data cannot be refreshed.

### P0.3 Complete execution receipts — Partial

Already present: encrypted receipt persistence, signature, router status, independent Solana status, slot, Explorer action, and success/failure state.

Still required:

- [x] Compare quoted/expected output with settled output.
- [ ] Show actual slippage in both raw amount and basis points (basis points are implemented).
- [x] Show estimated fee, actual network fee, account/rent funding, and total wallet outflow separately.
- Convert known router/program failures into human-readable explanations; retain bounded raw evidence only behind a details view.
- Ensure every successful, failed, and unknown receipt can be reopened from session history.
- [x] Hold portfolio refresh until its finalized snapshot slot reaches the confirmed receipt slot.

### P0.4 Transaction settings — Partial

- [x] Persist and enforce a maximum network fee in lamports; add SOL/USD entry modes later.
- [x] Persist and enforce maximum fee as a percentage of trade value when pricing evidence is available.
- [x] Persist a default slippage limit; apply it automatically to AI-created mission drafts later.
- [x] Persist a default mission deadline; apply it automatically to AI-created mission drafts later.
- [ ] Apply priority presets `Economy`, `Standard`, and `Fast` during Jupiter transaction construction and show their estimated cost (the preference is persisted but not yet sent to Jupiter).
- Per-session overrides that can only become stricter than the configured safety ceiling.
- Restricted execution and explicit final approval remain mandatory.

## P1 — Production hardening and release readiness

These gates must be complete before describing the desktop application as production-ready.

### P1.1 Wallet and vault security audit — Partial

Already present: encrypted local wallet material, master-password verification, narrow IPC, local signing, and tests preventing secret access while locked.

Still required:

- Independent review of private-key lifecycle, zeroization limits, backup behavior, and signer isolation.
- End-to-end recovery drill using a clean machine/profile and a documented expected result.
- Negative tests for corrupted backups, wrong seed phrases, partial restores, and interrupted vault migration.

### P1.2 Execution-policy audit — Partial

Already present: sole-signer checks, program allowlisting, deterministic mission policy, one-time cached approvals, and a final pre-sign simulation.

Still required:

- Review every allowlisted program and pin its intended capability and owner.
- Define a controlled process for adding, updating, or removing program IDs.
- Add fee/rent ceilings and token-risk policy to the same deterministic boundary.
- Review stale quote, blockhash, RPC disagreement, and duplicate-submission scenarios.

### P1.3 Network and logging resilience — Partial

- Add bounded rate limiting and provider-specific backoff.
- Classify retry-safe reads separately from broadcasts, which must never be retried blindly.
- Add explicit handling for RPC timeout, partial provider outage, and contradictory provider/RPC status.
- Audit logs, crash reports, and packaged artifacts to ensure keys, seed phrases, passwords, signed transactions, and provider request secrets never appear.

### P1.4 Windows release gate — Partial

Already present: QA packaging, artifact auditing, checksum generation, and signed-release workflow scaffolding.

Still required:

- Provision production Authenticode credentials through CI secrets.
- Verify the signed installer on a clean Windows machine.
- Test install, upgrade, uninstall, vault retention, and rollback behavior.
- Publish a recovery and incident-response procedure before general availability.

## P2 — Remaining validation matrix

Automated tests already cover insufficient balance, changed evidence before execution, unknown broadcast status, encrypted session persistence, and the final pre-sign re-simulation boundary. Do not duplicate those as wholly missing features.

Remaining validation work:

- **USDC to SOL**: quote and simulate first; broadcast only when the fee guard is complete and the user explicitly approves.
- **Portfolio reconciliation**: verify SOL, SPL balances, rent-bearing account creation, and receipt slot after restart.
- **RPC timeout**: exercise read, simulation, broadcast-response, and verification timeouts independently.
- **Unknown broadcast recovery**: restart the app, reopen the encrypted receipt, verify by signature, and prove there is no rebroadcast path.
- **Fee ceiling**: prove excessive network fee and excessive fee percentage both block before signer access.
- **Account-creation estimate**: prove first-time SPL receipt shows rent separately and a later swap does not incorrectly charge it again.
- **Packaged application**: repeat the above critical paths in the signed Windows build, not only the development runtime.

## P3 — Guarded AI trading missions

These features may begin only after P0 is complete and the relevant P1 security gates have passed.

### P3.1 Durable market observation loop — Blocked

- Monitor an explicitly allowlisted set of assets at a bounded interval.
- Persist checkpoints so a restart does not duplicate decisions or lose mission state.
- Record provider timestamps and reject stale market evidence.
- Observation alone never grants signing or broadcast authority.

### P3.2 Scheduled missions — Blocked

- Durable scheduling with wake, pause, resume, expiry, and user-owned stop controls.
- Strict per-mission wallet, asset, venue, capital, frequency, and loss limits.
- A visible audit trail for every wake and skipped decision.

### P3.3 Take-profit and stop-loss proposals — Blocked

- Evaluate configured conditions from verified price evidence.
- Produce a new typed proposal when a condition triggers.
- Re-run policy, quote, fee guard, and simulation for every proposed action.
- Initially require explicit approval for every execution.

### P3.4 Autonomous token selection — Blocked

- Start with a user-defined allowlist, not unrestricted discovery.
- Require liquidity, verification, token-program, concentration, and route-risk checks.
- Apply per-token and total-capital ceilings.
- Keep AI ranking separate from deterministic eligibility policy.

### P3.5 Real limit-order lifecycle — Partial and blocked

Preview and policy foundations exist, but production order creation and the full authenticated lifecycle are not enabled as a supported capability.

Required work:

- Complete deposit simulation and fee/rent review.
- Explicit approval for create, cancel, and withdraw operations.
- Durable order reconciliation after restart.
- Independent on-chain verification for every lifecycle transition.
- Recovery handling for expired, partially processed, or provider-missing orders.

### P3.6 Full Access and unattended execution — Blocked indefinitely

`Full Access` must not be treated as a UI toggle. It requires a separate threat model, limited signing capability, revocable on-chain/local policy, capital isolation, loss limits, emergency stop, incident recovery, and external security review. Until those controls exist, every mutating Mainnet action remains restricted and explicitly approved.

## Priority track — Pump.fun and PumpSwap guarded trading

Priority has been raised at product direction. This track now proceeds alongside P0/P1 hardening, but it does not bypass those Mainnet release and signing gates.

Current status: **In progress**

For a concise implementation audit, current user flow, and explicit completed/partial/blocked matrix, see [Pump.fun implementation status](PUMPFUN_IMPLEMENTATION_STATUS.md).

- [x] Pin the official Pump program address used by the read-only verifier.
- [x] Derive the canonical bonding-curve PDA from an exact mint.
- [x] Verify finalized RPC evidence, official program ownership, Anchor account discriminator, curve completion state, and bounded reserve fields.
- [x] Expose `pump_token_analysis` to the AI for exact-mint research and proposal support without requiring a Jupiter key.
- [x] Explicitly prevent the AI from representing Pump/PumpSwap buy, sell, creation, migration, or autonomous execution as available.
- [x] Verify canonical migrated PumpSwap pools independently through the official program, canonical index, pool authority, mint, and WSOL bindings; a missing or completed Pump curve is never treated as proof of migration.
- [x] Add finalized mint/freeze authority, token-program, supply, and top-ten account concentration evidence.
- [x] Read PumpSwap base/quote vault liquidity and calculate effective quote reserves including the pool's signed virtual reserve field.
- [x] Add persisted finalized spot-price, estimated market-cap, curve-progress, quote-reserve, and fee-base evidence.
- [x] Add a bounded per-session SOL reference size and persist a size-specific reserve-only buy plus sell-back path for active Pump curves and verified PumpSwap pools.
- [x] Replace the simulation builder's reserve-only minimum with fresh exact buy/sell output evidence derived from the same finalized state and fee tier used by the local codec. Apply the approved slippage and always choose the stricter of the fresh minimum and the user-approved minimum; then require the unsigned transaction simulation to pass. The earlier reserve-only analytics remain clearly labeled and are not execution evidence.
- [x] Pin official public-docs IDL commit `9c82f61cb711b044a17f770ab8ce9f9bdf78f333` and audit the selected Pump v2 `buy_exact_quote_in_v2`/`sell_v2` plus PumpSwap `buy_exact_quote_in`/`sell` instruction manifests.
- [x] Pin `@pump-fun/pump-sdk@1.36.0` and reproduce deterministic offline Pump v2 buy/sell instruction construction against the pinned inspector. This produces an instruction only; it does not construct a transaction, request a signature, or broadcast.
- [x] Explicitly mitigate the pinned SDK dependency advisories by keeping `pump-sdk`, PumpSwap/Anchor transitives, legacy Solana Web3/SPL, `bn.js`, and vulnerable `bigint-buffer` in the development-only Pump harness. Every desktop production build now fails if these dependencies are restored to runtime dependencies or their markers leak into main/preload/renderer bundles.
- [x] Implement a production-safe Pump v2 buy/sell instruction codec with `@solana/kit` only. Its discriminator, little-endian `u64` data, PDA/ATA derivation, account order, signer flags, and writable flags are tested byte-for-byte and account-for-account against the pinned official SDK.
- [x] Fail every production build if the local Pump codec imports quarantined Pump SDK, legacy Solana Web3/SPL, `bn.js`, or `bigint-buffer` dependencies.
- [x] Compile the local Pump instruction into an unsigned v0 transaction with `@solana/kit`; decode it again and require the selected wallet as sole payer/signer, an empty signature, no address lookup tables, exactly one instruction, fresh blockhash evidence, and the full pinned Pump instruction inspection.
- [x] Resolve and locally decode Pump Global, bonding-curve, mint, and optional fee-program accounts from one finalized snapshot with `@solana/kit` and bounded Borsh readers. Reject wrong ownership/discriminators, truncated state, completed curves, unsupported token programs, uninitialized mints, and any live mint or freeze authority before instruction construction.
- [x] Connect finalized state evidence, the deterministic trading-fee ceiling, local instruction codec, finalized blockhash freshness check, and inspected unsigned v0 transaction in one production-only pipeline with no signing or broadcast capability.
- [x] Route finalized Pump state through the local codec and unsigned Mainnet RPC simulator without importing the development-only SDK harness into production. The bounded HTTPS adapter validates RPC envelopes/account bytes, blockhash freshness, fee evidence, simulation slots, invoked programs, compute, created-account funding, and absolute/percentage fee ceilings. This backend path has no signing or broadcast authority and is not renderer-accessible yet.
- [x] Add a persisted proposal-only Pump buy/sell contract with exact mint, raw amount, SOL exposure, minimum output, guarded slippage, deadline, stop conditions, venue/risk evidence, balance, and transaction-free route evidence.
- [x] Extend the persisted Pump proposal UI with a simulation-only IPC path that rebinds the encrypted restricted session, exact proposal, wallet, and mint before building. Persist and render finalized fee-program evidence, simulated network fee, account-creation funding, compute, invoked programs, and bounded logs; no signing or broadcast fields exist in the request contract.
- [x] Add separate pre-builder Pump and PumpSwap instruction-plan inspectors with exact discriminators, ordered account roles, signer/writable flags, fixed programs, token-program allowlists, exact mint/wallet binding, and no unaudited remaining accounts.
- [x] Build Pump v2 buy/sell instruction artifacts through the pinned official SDK, bind their derived PDA/ATA accounts to the normalized plan, and prove that the plan passes the pinned inspector while transaction/signing/broadcast flags remain false.
- [x] Resolve the active bonding-curve creator, Global fee-recipient allowlist, buyback-recipient allowlist, and mint token program from one fresh finalized RPC snapshot before calling the offline builder; reject completed curves and unsupported token programs.
- [x] Resolve the Pump fee-program schedule when present and deterministically calculate tiered protocol/creator fees from finalized curve market-cap state. Show buyback as an allocation setting rather than inventing an additional fee, classify the trading fee, and block the builder above the configured maximum.
- [x] Add simulated network fee and created-account funding to the Pump fee guard after unsigned transaction construction, with absolute and percentage ceilings plus `reasonable`/`high`/`extreme` classification.
- [x] Construct a v0 unsigned transaction only after finalized state and fee policy pass, using a finalized blockhash whose context slot is not older than the state evidence. Pump v2 owns its audited `init_if_needed` ATA path through the included associated-token and system-program accounts; no separate unaudited top-level instruction is added.
- [x] Serialize and decode the final unsigned transaction; verify the sole payer/signer, zero placeholder signature, exact blockhash, no address lookup tables, exactly one top-level instruction, full instruction bytes, and all PDA/ATA/account-meta bindings through the pinned inspector.
- [x] Simulate the decoded unsigned transaction with signature verification disabled and no broadcast; require fresh slots, complete non-truncated logs and inner instructions, allowlisted invoked programs, compute units, network fee, and created-account funding before the artifact can pass.
- [x] Persist typed Pump simulation artifacts inside encrypted session records and restore them after restart without leaking bounded simulation logs into plaintext SQLite.
- [x] Render persisted Pump simulation evidence as a read-only conversation card with fee guard, invoked programs, bounded logs, and explicit unsigned/no-broadcast state.
- [x] Expose a simulation-only Pump mutation IPC after isolating the SDK/native-binding harness from production. The renderer can request and persist an unsigned simulation for an active bonding curve, but receives no transaction bytes and has no signing or broadcast method.
- [ ] Require simulation, fee guard, token-risk policy, final pre-sign simulation, master-password confirmation, and explicit final approval.
  - [x] Persist a deterministic pre-approval readiness artifact that binds the encrypted restricted session wallet, exact mint, proposal, passed simulation, fee guard, 14-check eligibility evidence, eight-check risk policy, two-minute freshness, and zero signing/broadcast authority. It explicitly records that master password plus `EXECUTE PUMP MAINNET` are still required; it does not authorize execution.
  - [x] Add a one-time 90-second in-memory prepared-transaction boundary and a separate final revalidation action. The action consumes the cache, rebuilds from fresh finalized state and blockhash evidence, re-runs quote, fee, risk, eligibility, program inspection, and unsigned simulation checks, persists a 12-check digest-bound artifact, and still grants no signing or broadcast authority. Restart, suspend, mismatch, reuse, or expiry requires a new simulation.
- [ ] Persist and independently reconcile actual SOL/token settlement and a complete receipt after restart.
  - [x] Add the finalized-only reconciliation foundation for a future Pump execution receipt. It independently verifies the signature state and slot, fetches finalized exact-wallet/exact-mint settlement, separates network fee and newly funded token-account rent, derives actual buy/sell input and output from raw balance deltas, and rejects pending, mismatched, or directionally impossible evidence. No broadcast path or receipt writer is connected yet.
- [ ] Prove buy and sell exit paths with minimum-value Mainnet tests before marking restricted execution available.

### Pump.fun product model and session UX — Partial

Pump.fun must be an explicit session workspace, not an invisible behavior inside a general chat. `New Session` will offer `General Agent` and `Pump.fun Agent`. A general agent may perform read-only exact-mint analysis, but only a Pump.fun mission may hold a durable discovery, monitoring, or trading policy.

Pump.fun sessions will expose three progressively enabled modes:

1. **Monitor only** — discover or watch candidates, verify on-chain evidence, rank opportunities, and emit alerts. It never requests signer access.
2. **Assisted trading** — prepare a typed buy/sell proposal, then require fresh state, inspection, simulation, fee guard, master-password confirmation, and explicit approval for every transaction.
3. **Restricted automation** — execute only inside a user-authored, expiring strategy contract with fixed capital and loss ceilings. This remains blocked until durable monitoring, execution inspection, recovery, and security-review gates are complete.

- [x] Add `Pump.fun Agent` to the new-session type selector while retaining `General Agent` for ordinary chat and Mainnet wallet work.
- [x] Add discovery scopes: `Specific token`, bounded manual `Watchlist`, and a manual incremental `Market Scanner`. A complete real-time `Discover new tokens` index remains unavailable.
- [ ] Complete all objectives. `Monitor` and assisted proposal-only buy/sell exist; opportunity scoring, position management, DCA, take-profit, and stop-loss remain incomplete.
- [x] Keep exact mint identity mandatory for every Pump session and proposal; symbols, names, social metadata, and AI rankings are never execution identity.
- [x] Display unavailable modes honestly as `Proposal only`, `Requires approval`, or `Coming later`; never imply that Pump execution is enabled before its gates pass.

### Pump.fun global settings and hard risk ceilings — Partial

Global Pump.fun settings are a deterministic local boundary shared by all Pump sessions. Session rules may only be stricter than these ceilings, and neither chat nor the inference provider may relax them.

- [ ] Persist bounded data refresh intervals, maximum concurrently monitored tokens, trusted RPC configuration, and stale-evidence thresholds.
- [x] Persist maximum trading fee, maximum slippage, total Pump exposure, exposure per token, spend per trade/day, open positions, transactions per hour, and minimum SOL reserve through a strict Main-process settings boundary and editable local UI.
- [x] Enforce the global fee/slippage/per-trade ceilings and finalized SOL reserve floor before unsigned simulation. Daily spend, exposure, open-position, and hourly-rate checks now read an encrypted append-only ledger that accepts only finalized receipt records; no Pump execution path writes receipts yet, so its legitimate initial usage remains zero.
- [x] Persist and render typed risk evidence with the exact settings snapshot, finalized wallet balance, projected post-proposal balance, reserve floor, usage source, and all eight deterministic checks. The UI explicitly labels the current zero-execution baseline and does not imply historical reconciliation.
- [x] Add an encrypted, restart-safe Pump risk ledger with signature idempotency, conflicting-receipt rejection, rolling 24-hour/hourly aggregation, and nonnegative per-token exposure reconciliation. Connecting a future execution receipt writer remains blocked on the complete Pump signing/broadcast safety boundary.
- [x] Persist maximum slippage, bounded reference price impact, network fee, total known fee, fee percentage, finalized protocol/creator fee evidence, and simulated account-creation funding in typed encrypted session artifacts.
- [x] Persist verified reserve/liquidity evidence and top-ten token-account concentration with the evidence slot and timestamp used by eligibility checks.
- [ ] Complete every venue hard block. Active Pump v2 simulation already blocks invalid ownership/state, unsupported token programs, live mint/freeze authority, stale state, missing quote/exit path, excessive fees, and failed/non-allowlisted simulation; the PumpSwap execution path is not implemented.
- [ ] Add a global emergency stop that cancels schedules, prevents new signing requests, and leaves already-broadcast signatures in reconciliation-only state.
- [ ] Add creator and mint allowlists/blocklists without allowing AI to modify them implicitly.

### Pump.fun discovery and candidate ranking — Partial

AI-assisted discovery may find candidates, but deterministic eligibility must remain separate from probabilistic ranking. The initial discovery release produces watchlist suggestions only; it cannot buy a token merely because the model calls it promising.

- [x] Add encrypted session-scoped exact-mint watchlists (1-10 unique mints), read-only per-mint analysis actions, persisted finalized evidence, and a contextual right rail. The AI tool enforces the same allowlist and watchlist sessions do not expose the Pump trade-proposal tool. This is a manually curated watchlist, not autonomous discovery.
- [x] Add a typed pre-ranking research-eligibility gate with ten deterministic checks for canonical venue, token program, revoked authorities, top-ten concentration, positive quote reserves, non-zero reserve-only buy/sell-back paths, bounded reference price impact, two-minute freshness, and zero execution authority. Persist thresholds and failed-check explanations with each intelligence snapshot; AI ranking is explicitly blocked unless every check passes.
- [x] Add a manual low-volume discovery scanner over at most 10 recent finalized signatures touching the official Pump program. It extracts bounded exact-mint candidates, independently runs canonical intelligence/eligibility for at most 5, persists typed evidence, and exposes no proposal, signing, or broadcast tool. This is not a real-time index and does not prove a token is newly created.
- [x] Decode pinned Pump SDK IDL instruction discriminators for create, curve buy/sell, and migration observations; combine them with independently verified active/complete/migrated account state, and persist a finalized signature cursor so repeated manual scans request only newer activity. This remains incremental polling, not a complete event index.
- [x] Observe bounded official Pump program events and finalized account state for newly created tokens, active curves, curve completion, and canonical PumpSwap migration. The manual scanner decodes pinned `CreateEvent`, `TradeEvent`, `CompleteEvent`, and `CompletePumpAmmMigrationEvent` discriminators only while the official Pump program owns the log execution frame, then re-verifies canonical account state. This is bounded incremental polling, not a complete real-time index.
- [x] Add a post-simulation deterministic Pump v2 trade-eligibility gate covering exact mint binding, finalized canonical state resolver evidence, token program, revoked authorities, active curve/reserves, finalized fee tier, quote binding, two-minute freshness, non-zero quote/exit path, global risk policy, successful unsigned simulation, invoked-program allowlist, and absence of execution authority. Holder concentration and scanner-scale price-impact eligibility remain part of the discovery gate below.
- [ ] Complete bounded market evidence. Estimated market cap, supply/source, curve progress, reserves, venue, and snapshot slot/time exist; token age, volume windows, buyer/seller activity, liquidity-change history, and creator history remain missing.
- [x] Mark market cap as an estimate and persist the supply, price source, venue, slot, and timestamp used to derive it.
- [ ] Add AI ranking only after eligibility results are available; show an explanation and risk factors for each score.
- [ ] Complete candidate actions. `Analyze` exists; the unified `Add to watchlist`, `Prepare buy`, `Ignore`, and `Block creator` actions remain incomplete.
- [ ] Start discovery-to-trade with explicit user selection. Autonomous token discovery-to-buy remains blocked until restricted automation receives separate security approval.

### Pump.fun strategy contract and position management — Blocked

Dependencies: durable observation, restricted Pump execution, finalized position reconciliation, P0 fee/receipt work, and P1 security review.

- [ ] Add fixed-SOL and percentage-based position sizing with a mandatory maximum SOL exposure and reserved gas balance.
- [ ] Add Auto-DCA amount, interval, maximum entries, price/market-cap range, expiry, and cooldown controls.
- [ ] Add staged take-profit, fixed stop-loss, trailing stop, maximum holding time, liquidity/creator emergency exits, and user-owned manual exit.
- [ ] Require every trigger to refresh finalized state and sellability, rebuild the quote, inspect, simulate, run fee guard/policy, and produce a new typed decision record.
- [ ] Launch take-profit/stop-loss as proposal-only, then approval-required; do not enable unattended signing in the initial release.
- [ ] Track entry cost, current estimated value, realized/unrealized P/L, immediately sellable value, exit price impact, venue, curve progress, and latest finalized snapshot.
- [ ] Persist checkpoints across restart without duplicating buys, sells, alerts, or approvals.

### Pump.fun persistent runtime — Blocked

Auto-DCA and stop-loss are not reliable if they live only in an Electron renderer or stop when the window closes.

- [ ] Move monitoring and scheduling into a bounded local background service with authenticated IPC and encrypted durable state.
- [ ] Clearly distinguish `Monitoring active`, `Paused`, `Runtime offline`, `Awaiting approval`, `Executing`, `Strategy expired`, and `Emergency stopped`.
- [ ] Warn immediately when a strategy requiring monitoring has no active runtime.
- [ ] Add wake deduplication, clock-skew handling, stale evidence rejection, backoff, rate limiting, and restart recovery.
- [ ] Provide explicit pause, resume, expire, close-position, and emergency-stop controls owned by the user.

### Pump.fun right-sidebar specification — Partial

The right sidebar is contextual; it must not show a generic empty portfolio panel for every Pump.fun screen.

1. **Discovery/watchlist context — `Market Scanner`**
   - Runtime health and last finalized scan slot/time.
   - Number of tokens scanned, eligible, blocked, and watched.
   - Active discovery filters and remaining daily capital ceiling.
   - Top candidates with estimated market cap, venue/curve progress, liquidity, risk status, and `Analyze` action.
2. **Candidate context — `Token Intelligence`**
   - Exact mint with copy action, symbol/name as untrusted metadata, token age, venue, and migration status.
   - Estimated price and market cap with source, formula basis, slot, and timestamp.
   - Curve progress or PumpSwap reserves, buy/sell price impact, protocol/creator/network fees, and account-creation funding.
   - Authority, holder concentration, creator activity, fresh sell-path status, risk score, warnings, and hard policy blocks.
3. **Proposal context — `Trade Preview`**
   - Side, wallet, raw and human-readable input, expected/minimum output, quote expiry, slippage, total SOL exposure, and stop conditions.
   - Simulation status, fee-guard classification, policy pass count, approval status, and a disabled execution control until every gate passes.
4. **Active-position context — `Position`**
   - Wallet and copy action, token amount, average entry, cost basis, current and immediately sellable value, realized/unrealized P/L, and actual exit price impact.
   - Take-profit, stop-loss, trailing-stop, DCA schedule, next wake, strategy expiry, venue/curve progress, and latest finalized snapshot.
   - `Pause`, `Resume`, `Prepare sell`, and `Emergency stop`; direct broadcast is never hidden behind an ambiguous action.
5. **Receipt context — `Execution & Receipt`**
   - Signature, on-chain state, expected versus settled amounts, actual slippage, network/protocol/creator fees, rent/account funding, total wallet outflow, slot/time, and Explorer action.
   - Reconciliation status and human-readable failure/recovery guidance.

At narrow widths, the contextual sidebar becomes a persistent `Details` drawer. Critical approval, stop-loss, runtime-offline, and emergency-stop state must remain visible in the main session area and cannot exist only inside the collapsed drawer.

Implemented slices: persisted Pump workspace identity; exact-mint copy/analysis actions; specific-token, watchlist, and bounded manual Market Scanner scopes; lifecycle/objective; verified wallet exposure; latest persisted Pump proposal; unsigned simulation; final revalidation; and visibly disabled future position controls. Typed finalized token intelligence persists spot-price and market-cap estimates, curve progress, quote reserves, reference buy/sell-back impact, finalized fee configuration, authority/concentration risks, warnings, and evidence slot/time. A finalized-only receipt reconciliation foundation exists, but live receipt creation, complete position accounting, responsive drawer behavior, complete market-history evidence, and Pump execution remain incomplete.

## P4 — Additional venues and chains

These are independent projects and must not reuse Solana assumptions without new policy and security reviews.

### P4.1 Pump.fun and PumpSwap trading — In progress (priority track)

Goal: allow the AI agent to research and propose trades for Pump.fun-origin tokens, then support restricted buy/sell execution only after the venue-specific safety boundary is complete.

Phased scope:

1. **Read-only discovery**
   - Resolve a token by exact mint and distinguish an active Pump bonding curve from a migrated PumpSwap pool.
   - Read bounded curve/pool state, liquidity, price, market cap, holder concentration, mint authority, freeze authority, token program, and migration status.
   - Treat social metadata and AI analysis as untrusted evidence, never proof of token safety.
2. **Proposal-only AI trading**
   - AI may rank only tokens inside an explicit user allowlist or bounded discovery policy.
   - Every proposal must include exact mint, side, raw amount, maximum SOL exposure, minimum output, price impact, protocol/creator fees, rent, deadline, take-profit/stop-loss intent, and stop conditions.
   - No symbol-only execution and no automatic substitution of a similarly named token.
3. **Restricted execution**
   - Pin and audit the official Pump and PumpSwap program IDs, IDLs, SDK versions, account derivations, and fee recipients.
   - Support both bonding-curve buy/sell and migrated PumpSwap buy/sell with separate transaction inspectors.
   - Require fee guard, token-risk policy, fresh quote/state, simulation, final pre-sign simulation, master password, exact confirmation, and explicit final approval.
   - Verify settled token/SOL amounts and receipt status independently through Solana RPC.
4. **Guarded mission automation**
   - Price monitoring, take-profit, and stop-loss may create proposals only at first.
   - Capital limits apply per token, per trade, per day, and across all active Pump.fun missions.
   - Emergency pause, stale-data rejection, failed-sell recovery, and guaranteed manual exit controls are mandatory before any scheduled execution is considered.

Initial exclusions:

- No token creation or launch automation.
- No sniping, front-running, sandwiching, bundled priority execution, or attempts to bypass platform protections.
- No unrestricted autonomous discovery-to-buy loop.
- No `Full Access`; each Mainnet buy or sell remains explicitly approved until P3.6 receives a separate security approval.

Dependencies: all P0 items, P1.1–P1.3, the relevant P2 failure tests, P3.1, and P3.3–P3.4.

### P4.2 Bridge support — Planned

- Route and destination-chain verification.
- Source and destination fee disclosure.
- Finality, timeout, refund, and stuck-transfer recovery.
- Explicit destination address and chain binding.

### P4.3 EVM support — Planned

- Separate wallet derivation/import and chain allowlist.
- Chain ID, nonce, gas, allowance, approval, contract, and simulation policy.
- Protection against unlimited approvals and chain-switch confusion.

### P4.4 Hyperliquid — Planned

- Separate spot/perpetuals workspace and credential boundary.
- Leverage, liquidation, margin, funding, and position-size controls.
- No shared `Full Access` authority with spot swaps.

## Recommended delivery order

1. Fee guard and total-outflow disclosure.
2. Automatic position refresh and receipt reconciliation.
3. Complete receipt UX and transaction settings.
4. Add the Pump.fun session workspace, contextual right sidebar, global risk settings, and exact-mint watchlist UX.
5. Continue Pump.fun/PumpSwap read-only discovery, migrated-pool verification, deterministic eligibility, and proposal-only AI ranking.
6. Finish the Mainnet validation matrix.
7. Complete security, resilience, recovery, and signed-release gates.
8. Add read-only durable Pump market observation and the `Market Scanner` candidate workflow.
9. Add scheduled proposal-only missions.
10. Add take-profit/stop-loss proposals, position management, and allowlisted token selection.
11. Add restricted Pump.fun/PumpSwap buy and sell only after its program, fee, token-risk, simulation, receipt, and exit-path gates pass.
12. Add approval-required Auto-DCA only after persistent-runtime and restart-recovery tests pass.
13. Complete the real limit-order lifecycle.
14. Consider narrowly scoped unattended execution only after a separate security approval.
15. Treat bridges, EVM, and Hyperliquid as later independent milestones.

## Definition of production-ready for the current scope

The current restricted Jupiter swap scope is production-ready only when P0 is complete, all P1 release gates are satisfied, the P2 critical matrix passes in a signed Windows build, recovery has been proven on a clean profile, and no unresolved security finding can expose wallet material or authorize an unreviewed Mainnet transaction.
