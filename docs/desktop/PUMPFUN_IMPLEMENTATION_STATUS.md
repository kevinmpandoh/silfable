# Legacy Pump.fun / PumpSwap Trading Pilot Status

Last reviewed: 2026-07-28

## Product status and redesign note

This document covers the **legacy exact-mint Pump.fun/PumpSwap buy/sell pilot**. It is no longer the target definition of Pump.fun in Silfable. The target product treats Pump.fun as a **Token Launch** lane; Solana asset exchange is handled by Jupiter, EVM asset exchange by a verified Uniswap-compatible deployment, and cross-chain movement by Bridge. The redesign and migration rules are authoritative in [Venue product architecture](../VENUE_PRODUCT_ARCHITECTURE.md).

Do not use the legacy trading pilot in this document as proof of Token Launch readiness. The desktop now has a separate restricted Pump.fun `create_v2` Token Launch implementation, including strict inspection, unsigned simulation, fresh final revalidation, local creator-plus-mint signing, one broadcast attempt, and encrypted receipt recovery. It has not completed controlled low-value Mainnet acceptance or external security review and is therefore not production-cleared. The web metadata route publishes through the system-managed Pinata/IPFS boundary; the desktop Cloudflare R2 path is a legacy experimental metadata publisher, not the target publication flow.

## Token Launch metadata storage (current target: Pinata/IPFS)

The web Token Launch draft can publish public token metadata and an image through system-managed Pinata/IPFS. This is deliberately separate from the Pump.fun launch flow:

1. The user supplies name, symbol, description, optional public links, and an accepted image file in the web Token Launch flow.
2. The server validates the image and metadata, uploads the public image first, then uploads immutable `metadata.json` through the configured Pinata account. The Pinata credential remains server-side and is never returned to the browser.
3. The route returns the immutable `ipfs://` metadata URI, gateway URLs, CIDs, and a SHA-256 digest for user review.
4. The user can independently inspect that URI before any future launch review. Publishing metadata does not construct a transaction, connect a signer, create a mint, spend SOL/USDC, or open a broadcast path.

The current web implementation accepts a bounded image file and creates immutable public IPFS objects. It does not accept credentials from the AI model. The desktop app does not receive the browser authentication cookie or the Pinata credential; a device-link upload capability is still required before desktop can use this target publication flow.

## Token Launch restricted execution boundary

The desktop Token Launch card can run a launch-specific unsigned Mainnet preflight after a public metadata URI exists. The current conservative slice:

- uses a production-local `create_v2` codec with byte-for-byte parity tests against pinned Pump SDK `1.36.0`;
- supports SOL pairing with zero initial purchase only;
- generates a fresh, non-extractable mint signer in volatile main-process memory;
- verifies exact creator and mint signers, account count, discriminator, program, and lookup-free v0 transaction;
- simulates the unsigned transaction and checks invoked-program allowlist, finalized balance, fee, priority fee, created-account rent, creator outflow cap, compute units, and evidence slots;
- persists only the mint address, digest, costs, checks, slots, and expiry in encrypted session history;
- never exposes transaction bytes or the non-extractable mint signer to the renderer;
- discards the volatile, non-extractable mint signer on expiry, replacement, vault lock, window close/minimize, suspend, or application quit.

After preflight, a separate final review repeats the exact digest, signer, blockhash, fee, balance, program-allowlist, and simulation checks. The user must supply the current master password, type `LAUNCH TOKEN MAINNET`, acknowledge irreversibility, and click the final action. The main process consumes the cached transaction once, signs locally with the selected creator wallet and volatile mint signer, deletes the mint signer, encrypts the locally derived signature into session history, and then makes one broadcast attempt with RPC retries disabled. A timeout remains `broadcast-unknown`; recovery checks only that signature and never rebroadcasts it. A finalized receipt additionally requires the exact mint account to be newly funded and owned by Token-2022. Independent finalized settlement evidence records the actual network fee, aggregate funding of newly created accounts, creator balance before and after, total creator outflow, slot, and verification time.

The implementation is exercised with mocked RPC evidence only. No real token was launched by the automated test suite. Controlled low-value Mainnet acceptance and external security review remain mandatory before production release.

The desktop Pump.fun path is now **code-complete for a restricted manual Mainnet pilot on an active Pump bonding curve or a canonically verified migrated PumpSwap pool**.

This is not Full Access and not autonomous trading. The AI can research and draft a typed proposal, but it cannot call the signer, see private keys, approve a trade, or broadcast. A real transaction is possible only after deterministic policy checks, unsigned simulation, fresh final revalidation, master-password verification, an exact confirmation phrase, and an explicit user click.

No real-wallet Pump transaction was broadcast while validating this change. Therefore the accurate release label is **pilot-ready in code; live Mainnet acceptance and external security review still pending**.

| Capability | Status | Current boundary |
| --- | --- | --- |
| Exact-mint Pump research | Complete | Finalized read-only evidence |
| Manual watchlist | Complete | 1–10 exact mints per encrypted session |
| Bounded Market Scanner | Partial | Manual incremental scan, not a complete launch feed |
| AI trade proposal | Complete | Exact mint and restricted session required |
| Pump/PumpSwap builder and inspector | Complete | Active curve or canonical migrated pool |
| Unsigned Mainnet simulation | Complete | Fee, rent, compute, program, risk, and quote evidence |
| Final pre-sign revalidation | Complete | Fresh digest-bound one-time transaction |
| Manual Pump v2 signing | Pilot-ready | Local selected-wallet signer after password and exact approval |
| One-attempt broadcast | Pilot-ready | Signature persisted before network call; no automatic retry |
| Unknown-broadcast recovery | Complete in code | Verify the local signature; never rebroadcast |
| Finalized receipt and risk ledger | Complete in code | Exact wallet/mint settlement and idempotent encrypted receipt |
| Portfolio refresh | Complete in code | Refreshes after finalized execution |
| PumpSwap execution | Pilot-ready in code | Same manual gates as Pump; live signed acceptance pending |
| Automatic discovery-to-buy | Blocked | No AI or background signer authority |
| Live DCA / TP / SL | Not available | Strategy foundations do not authorize transactions |
| Full Access | Blocked | Separate threat model, custody design, and audit required |
| Global emergency stop | Complete | Persistent fail-closed gate; instant engage, password-gated release |

## Implemented restricted execution boundary

- `pump:execute` accepts only the typed restricted request.
- The main process re-loads the encrypted session and exact proposal.
- Only an active verified Pump bonding curve or canonical migrated PumpSwap pool is executable.
- The selected local wallet must exactly match the session wallet and transaction payer.
- Final revalidation binds the wallet, mint, side, amounts, quote floor, risk settings, fee guard, blockhash, simulation, and transaction digest.
- The prepared final transaction is in memory, short-lived, digest-bound, and consumable once.
- The master password is independently verified in the main process.
- The user must type `EXECUTE PUMP MAINNET` and acknowledge irreversible Mainnet execution.
- Transaction bytes never cross into the renderer.
- The locally derived signature is encrypted into session history before any network request.
- `sendTransaction` is attempted once with RPC retries disabled.
- Timeout, mismatched RPC response, or an ambiguous network result becomes `broadcast-unknown`.
- Unknown results are reconciled by signature only; they are never automatically rebroadcast.
- Pending signatures are checked again when encrypted sessions are restored after unlock/restart.
- A blockhash-expired signature that was never found becomes a readable failed receipt.
- A finalized signature is independently reconciled against exact wallet and token deltas.
- Finalized receipts are encrypted, idempotently added to the Pump risk ledger, and restored after restart.
- A persistent global emergency stop clears prepared Pump transactions, stops local strategy monitoring, and blocks Pump final revalidation plus Pump, Jupiter mission, and limit-order execution handlers. Releasing it requires the master password. Pending signatures remain verification/reconciliation-only and are never rebroadcast.

## Receipt evidence

The conversation receipt records and displays:

- locally derived transaction signature;
- signed transaction digest;
- last valid block height;
- status: signed, broadcast unknown, failed, or finalized;
- expected output versus actual output;
- actual slippage in basis points;
- actual raw input and output;
- network fee in lamports;
- newly funded token-account/rent amount;
- total SOL wallet outflow;
- finalized slot;
- friendly error text;
- copy signature, open explorer, and verify-on-chain actions.

After finalization, the portfolio/positions query is refreshed from finalized Mainnet evidence.

## AI and monitoring boundary

- Pump sessions remain explicit and exact-mint scoped.
- The AI may use allowlisted read-only tools and create typed proposals.
- Deterministic services—not the model—perform token checks, quote checks, fee/risk checks, instruction inspection, simulation, and receipt verification.
- The AI prompt accurately describes manual restricted active-curve and canonical PumpSwap execution.
- The sidebar switch is labelled **Monitor only**. It may observe configured strategies and produce reviewable proposals.
- The previous autonomous executor is not wired into the desktop runtime.
- Background events do not receive signer access and cannot broadcast.

## Validation completed

Verified on 2026-07-27:

- desktop TypeScript typecheck passed;
- contracts TypeScript typecheck passed;
- desktop test suite passed: **248/248**;
- production desktop build passed;
- desktop privilege and Pump production-boundary bundle audit passed;
- minimum-value buy/sell validation matrices passed against mocked deterministic Mainnet evidence;
- one-time digest/session/wallet binding tests passed;
- signer and status-transition tests passed;
- encrypted pending-signature restart persistence test passed;
- RPC `sendTransaction` no-retry test passed;
- receipt reconciliation and risk-ledger idempotency tests passed.

These tests do not replace a signed installer test or a controlled real-wallet acceptance test.

## Current assisted-trading flow

1. User creates a Pump.fun mission with an exact token mint.
2. AI requests bounded finalized intelligence and may draft a proposal.
3. Deterministic research eligibility and proposal policy run outside the model.
4. User requests unsigned simulation.
5. Main process rebinds session, wallet, mint, side, amount, fee settings, and risk usage.
6. Main process resolves finalized active-curve or canonical PumpSwap state, derives a venue-specific quote, builds and inspects the unsigned transaction, and simulates it.
7. Fee guard, global risk checks, and eligibility checks must pass.
8. User requests final revalidation.
9. Main process consumes the first prepared transaction, rebuilds and re-simulates with fresh finalized evidence, then caches the final digest-bound transaction briefly.
10. User opens final approval and reviews wallet, mint, amount, minimum output, slippage, estimated fee, and digest.
11. User enters the master password, types `EXECUTE PUMP MAINNET`, acknowledges the risk, and clicks execute.
12. Main process consumes the final transaction once, signs locally, persists the signature, and attempts one broadcast.
13. Silfable independently verifies the signature and persists either pending, failed, or finalized evidence without automatic rebroadcast.

## Still required before a production claim

1. Run controlled minimum-value Pump and PumpSwap buys with a dedicated low-value Mainnet wallet.
2. Verify finalized receipt, portfolio refresh, and encrypted restart recovery.
3. Run minimum-value Pump and PumpSwap sell/exit paths for the acquired tokens.
4. Repeat insufficient balance, changed state, expired blockhash, RPC timeout, and broadcast-unknown cases in a signed QA build. Automated coverage already proves bounded read/simulation/verification retries, one-attempt broadcast behavior, encrypted unknown-status persistence, and no automatic rebroadcast.
5. Test suspend/minimize/restart during every approval and broadcast phase.
6. Complete external review of local key custody, signer scope, program/account allowlists, log redaction, and dependency/bundle audit.
7. Package and validate a code-signed Windows installer.
8. Rotate any credentials previously exposed in terminal output, screenshots, IDE selections, or chat.

The emergency-stop boundary is implemented, but durable DCA/scheduled autonomous execution is not wired into the production runtime; therefore there are no live autonomous schedules for it to cancel yet.

## Not available

- signed/broadcast token creation or migration (the AI can only prepare an unsaved text draft; it cannot publish metadata, create a mint, sign, or broadcast);
- automatic candidate selection and buy;
- unattended signing;
- live auto-DCA;
- live take-profit, stop-loss, or trailing-stop execution;
- Full Access;
- any retry that can rebroadcast an ambiguous transaction.

Until the live acceptance and security gates pass, use this product description:

> Pump.fun and canonical PumpSwap exact-mint research, proposal, simulation, and manually approved restricted execution are implemented for a controlled desktop pilot. Autonomous trading is not available.
