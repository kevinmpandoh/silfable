# Pump.fun Implementation Status

Last reviewed: 2026-07-23

## Product status

Pump.fun support is **in progress**. The desktop application can research exact mints, maintain bounded watchlists, scan a small finalized activity window, create restricted proposal-only Pump v2 buy/sell contracts, build and inspect an unsigned transaction, simulate it against Solana Mainnet, enforce fee and risk limits, and perform a separate final revalidation.

It **cannot sign or broadcast a Pump.fun/PumpSwap transaction yet**. A passing simulation or final revalidation never grants execution authority.

| Capability | Status | Current boundary |
| --- | --- | --- |
| Exact-mint Pump research | Complete | Finalized read-only evidence |
| Manual watchlist | Complete | 1–10 exact mints per encrypted session |
| Bounded Market Scanner | Partial | Manual incremental scan; not a complete real-time launch feed |
| AI trade proposal | Complete | Proposal only; exact mint and restricted session required |
| Pump v2 unsigned builder | Complete | Active bonding curve only; no signer access |
| Unsigned Mainnet simulation | Complete | Fee/rent/program evidence persisted in encrypted session |
| Final pre-sign revalidation | Complete | Still no password, signing, or broadcast authority |
| PumpSwap transaction execution | Not implemented | Migrated pools are read-only verified only |
| Pump.fun signing and broadcast | Blocked | The `pump:execute` IPC rejects live execution; signer, broadcast, and Mainnet exit tests are incomplete |
| Automatic discovery-to-buy | Blocked | AI cannot select and buy a token autonomously |
| DCA, take-profit, and stop-loss | Not implemented | Planned as proposal-only first |
| Persistent background monitoring | Not implemented | No durable scheduler/runtime yet |
| Full Access/autonomous trading | Blocked | Requires a separate security approval and threat model |

## Completed

### Session and AI boundary

- Pump.fun is an explicit session workspace, separate from the general agent.
- Session scopes support `Specific token`, a bounded manual `Watchlist`, and a manual `Market Scanner`.
- Exact mint identity is mandatory for any proposal. Symbol, name, social metadata, or AI confidence can never substitute for the mint.
- Watchlist and discovery sessions expose read-only tools only. The proposal tool is available only inside an exact-mint Pump session.
- The AI is explicitly told that Pump signing, broadcast, automatic buying, and autonomous execution are unavailable.
- Session records, analysis, scanner cursor, proposals, simulations, and revalidation evidence are encrypted and restored after restart.

### Finalized market and token evidence

- Canonical active Pump bonding-curve PDA and verified migrated PumpSwap pool resolution.
- Official program ownership, Anchor discriminator, curve completion/migration state, token program, supply, mint authority, and freeze authority checks.
- Top-ten token-account concentration evidence.
- PumpSwap vault liquidity and effective quote reserves for read-only analysis.
- Estimated spot price and market cap with supply/source/venue/slot/timestamp evidence.
- Curve progress, quote reserves, configured fee basis, and bounded reference buy plus sell-back estimates.
- Ten-check deterministic research eligibility before a candidate may be presented as eligible for ranking.
- Manual scanner over at most 10 newer finalized Pump program signatures and at most 5 independently verified candidates.
- Pinned instruction and event discriminators for create, buy, sell, completion, and migration observations, decoded only while the official Pump program owns the execution frame.

### Proposal, policy, and risk controls

- Typed proposal-only Pump buy/sell contract with exact wallet, mint, side, raw input, SOL exposure, minimum output, slippage, deadline, stop conditions, and risk evidence.
- Persisted global ceilings for trading fees, slippage, spend per trade/day, per-token and total exposure, open positions, hourly transactions, and minimum SOL reserve.
- Encrypted append-only finalized-receipt risk ledger with signature idempotency and conflicting-receipt rejection. It currently remains at the legitimate zero-execution baseline because no Pump broadcast path exists.
- Eight-check global risk evidence and 14-check post-simulation trade eligibility.
- Hard rejection of unsupported token programs, live mint/freeze authority, noncanonical state, completed curves in the active-curve builder, stale evidence, excessive fees, failed simulation, and non-allowlisted invoked programs.

### Transaction construction and simulation

- Official Pump IDL revision and `@pump-fun/pump-sdk@1.36.0` are pinned in a development-only compatibility harness.
- Production uses a local `@solana/kit` Pump v2 codec. Production builds fail if quarantined SDK/legacy dependencies leak into runtime bundles.
- Buy and sell instructions are byte-for-byte and account-for-account checked against the pinned SDK.
- The local builder creates an unsigned v0 transaction with exactly one inspected top-level instruction, one expected payer/signer, an empty signature, no lookup tables, and a finalized blockhash that does not predate state evidence.
- RPC simulation verifies complete logs and inner instructions, allowlisted programs, compute units, network fee, created-account funding, state slots, and absolute/percentage fee ceilings.
- The renderer receives typed evidence only; serialized transaction bytes never cross the preload boundary.

### Final revalidation and receipt foundation

- A deterministic pre-approval readiness artifact binds the restricted session, wallet, mint, proposal, simulation, fees, risk, eligibility, and two-minute freshness.
- Prepared unsigned transactions are held only in a one-time in-memory cache for 90 seconds. Restart, suspend, expiry, reuse, or binding mismatch requires a new simulation.
- `Final revalidation` consumes that cache, rebuilds from fresh finalized state and blockhash evidence, repeats quote/fee/risk/eligibility/inspection/simulation checks, and persists a 12-check digest-bound artifact.
- Final revalidation still records `executionAllowed: false`; master password and `EXECUTE PUMP MAINNET` have not been requested.
- Encrypted receipt storage and a finalized-only receipt reconciler can independently verify a future signature and slot, read exact-wallet/exact-mint deltas, separate network fee and newly funded token-account rent, and reject pending, mismatched, or directionally impossible settlements.
- The current `pump:execute` IPC is intentionally disabled and returns a clear unavailable-capability error. It does not sign, broadcast, persist a fabricated receipt, or update the risk ledger.

## Partially completed

### Market Scanner

The scanner is manual, incremental, and intentionally bounded. It is useful for candidate observation but is not a complete real-time Pump.fun launch index. Token age, complete volume windows, buyer/seller counts, liquidity-change history, and durable creator history are not yet available.

### Candidate experience and ranking

Deterministic research eligibility exists, but probabilistic AI scoring/ranking with a stable explanation contract is not finished. `Analyze` exists; `Add to watchlist`, `Prepare buy`, `Ignore`, and creator-block actions are not complete as a unified candidate workflow.

### PumpSwap

Canonical migrated pools, vaults, reserves, and analysis paths are verified read-only. The production transaction builder, inspector-to-simulation path, signing boundary, and settlement tests for PumpSwap are not implemented.

### Receipt and position reconciliation

The finalized receipt parser/reconciler and encrypted receipt store exist, but no Pump execution can create a live receipt yet. Restart recovery, position cost basis, sell-side exposure reduction, portfolio refresh, and right-sidebar receipt/position presentation remain incomplete.

## Not implemented or blocked

The following work must remain visibly unavailable:

1. Pump.fun/PumpSwap signer access and transaction broadcast.
2. Master-password execution confirmation and exact final approval flow for Pump trades.
3. Receipt restart recovery, unknown-broadcast recovery, and idempotent risk-ledger connection for real Pump signatures.
4. Minimum-value Mainnet buy and sell exit-path tests.
5. Complete PumpSwap buy/sell transaction construction and simulation.
6. Automatic portfolio/position refresh after a Pump transaction.
7. Durable token age, volume, buyer/seller, liquidity-change, and creator-behavior history.
8. Probabilistic AI candidate scoring after deterministic eligibility.
9. Creator/mint allowlists and blocklists plus a user-owned emergency stop.
10. Persistent background monitoring with pause/resume, retry, rate limits, stale-data rejection, and restart recovery.
11. Auto-DCA, staged take-profit, fixed/trailing stop-loss, maximum holding time, and emergency-exit strategies.
12. Autonomous discovery-to-buy, unattended signing, and `Full Access`.

## Current assisted-trading flow

1. The user creates a Pump.fun mission and selects `Specific token` with an exact mint.
2. The AI requests finalized token/venue intelligence through the allowlisted read-only tool.
3. Deterministic research and proposal policy runs independently from the AI response.
4. The AI may create a typed proposal-only buy or sell contract.
5. The user requests an unsigned simulation.
6. Main process rebinds session, wallet, mint, side, amount, limits, and current risk-ledger usage.
7. Main process resolves finalized state, derives a fresh quote, constructs and inspects the unsigned transaction, and simulates it.
8. Fee guard, eight risk checks, and 14 eligibility checks must pass.
9. The user may request `Final revalidation` within 90 seconds.
10. Main process consumes the one-time cache, rebuilds and re-simulates from fresh evidence, then persists the digest-bound result.
11. The flow stops. No Pump password prompt, signature, or broadcast API exists.

## Required order before restricted Pump execution

1. Complete encrypted receipt persistence and recovery, including unknown-broadcast reconciliation without rebroadcast.
2. Connect finalized receipts to the risk ledger and durable position accounting.
3. Complete the exact Pump buy and sell Mainnet validation matrix using minimum-value tests.
4. Add the master-password and exact-confirmation approval UI without exposing transaction bytes to the renderer.
5. Add a narrowly scoped local signer path that signs only the exact revalidated digest.
6. Broadcast once, persist the signature before awaiting confirmation, and reconcile independently through RPC.
7. Complete external security review before describing restricted Pump execution as production-ready.

Until all of these gates pass, the accurate product description is: **Pump.fun research, bounded discovery, proposal, unsigned simulation, and final revalidation are available; Pump.fun live trading is not available.**
