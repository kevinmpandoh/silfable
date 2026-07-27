# Silfable AI Agent Handoff Brief

Last updated: 2026-07-27
Audience: external AI coding agent, e.g. Gemini  
Repository: `D:\Web3\silfable-web`

## 1. Read this first

Silfable is a local-first AI trading runtime. The key product rule is:

> AI may research, explain, draft, and propose. Deterministic local services must enforce policy, simulate, require explicit approval, sign locally, broadcast once, and verify independently.

Do not turn any "proposal", "simulation", "final revalidation", "read-only scanner", or "AI confidence" into live Mainnet authority unless the specific execution gate is already implemented and tested.

Current safe description:

- Desktop has a guarded Mainnet Jupiter swap execution path with local encrypted wallet, master-password approval, simulation, signing, broadcast, receipt, and verification.
- Desktop has extensive Pump.fun/PumpSwap research, proposal, unsigned simulation, final revalidation, and restricted manual execution foundations.
- Pump.fun active-bonding-curve and canonically verified PumpSwap manual signing/one-attempt broadcast are implemented for a controlled desktop pilot; autonomous execution remains unavailable.
- A guarded Full Access session profile is implemented for broader typed planning. It does not bypass policy, simulation, password, final approval, signer scope, or receipt verification.
- Bridge quotes are provider-backed only: unavailable or malformed responses fail closed rather than becoming synthetic routes. Bridge signing and broadcast remain disabled.
- Repeated bridge-quote and Hyperliquid-metadata failures open a bounded local circuit breaker; it recovers after cooldown and never produces a fallback quote or market response.
- Desktop reconciliation logging accepts only structured, bounded audit fields. Never reintroduce free-form provider errors, decrypted state, signed payloads, wallet addresses, passwords, seed phrases, or credentials into diagnostics.
- `VenueExecutionGate` is the shared fail-closed production boundary for Bridge, EVM, Hyperliquid, DCA, TP/SL, and Full Access. It requires isolated custody, deterministic policy, fresh simulation, receipt reconciliation, recovery, audit, controlled Mainnet acceptance, final approval, kill switch/revocation, and spend limits. EVM raw broadcast already requires this gate; future venue execution must do the same with persisted trusted evidence, never an AI or renderer Boolean.
- `VenueReadinessService` persists normalized Main-process-only venue attestation with a SHA-256 evidence digest, reviewer, and timestamp. It has no renderer IPC; tampered or incomplete state fails closed and invalidation immediately closes the venue. Future work must feed it independently generated evidence, not manual UI flags.
- Robinhood Chain RPC reads are chain-ID-gated to `4663`. Trading remains fail-closed until a deployment-specific router or aggregator address and its policy/allowlist evidence are independently verified; the code no longer assumes an Ethereum Uniswap router address exists on Robinhood Chain.
- Hyperliquid metadata is venue-validated, while generic order execution fails closed until canonical asset IDs, venue signing, nonce/expiry, API-wallet approval, margin policy, and receipt reconciliation are implemented.
- Desktop now has a persistent global emergency stop. Engage is immediate; release requires the master password. While engaged it clears prepared Pump transactions, stops the local observation loop, blocks Pump final revalidation and supported execution handlers, and still permits signature verification/reconciliation without rebroadcast.
- Web `/trade` is **Restricted Mainnet only**. Opening the workspace requires a one-time, expiring Solana wallet challenge signature. The resulting opaque session is stored in an HttpOnly, SameSite=Strict cookie, while only hashes are persisted server-side. The connected browser wallet retains transaction signing authority and every transaction requires explicit wallet approval.
- Web settings now include a second, exact-policy wallet signature for a 24-hour `monitor-propose` grant. The signed payload binds capabilities, mint scope, proposal/allocation limits, network-fee ceiling, slippage, start/expiry, and immutable `signingAllowed=false`, `broadcastAllowed=false`, `executionAllowed=false` fields. The authenticated wallet can revoke all active grants or engage a one-way emergency stop.
- Cloud signing, autonomous broadcast, DCA execution, TP/SL execution, and discovery-to-buy are frozen; the cloud process is monitor/proposal infrastructure only. Legacy scheduler endpoints and worker entry points fail closed and perform no database mutation, queue dispatch, signing, or broadcast.
- The legacy queue drain now reads the latest monitor-only grant and wallet kill switch only to explain why a queued execution is blocked. It still has no signer, builder, or broadcast path.
- Scheduled unattended execution, Auto-DCA, take-profit live execution, Bridge, EVM live trading, and Hyperliquid live trading remain blocked.

If a future task asks to "make it production", do not claim production-ready until the P1 release/security gates and P2 signed-build validation matrix are complete.

## 2. Repository shape

Important workspaces:

- `apps/desktop` - Electron desktop app, current main product surface.
- `apps/web` - Next.js web app, landing/docs/whitepaper/trade workspace.
- `packages/contracts` - shared Zod contracts and typed IPC/API payloads.
- `docs/desktop` - desktop roadmap and Pump.fun status docs.
- `scripts` - bundle audits, Windows signing checks, artifact audits, release checksums.

Important docs:

- `docs/desktop/MAINNET_PRODUCT_ROADMAP.md`
- `docs/desktop/PUMPFUN_IMPLEMENTATION_STATUS.md`
- this file: `docs/AI_AGENT_PROJECT_HANDOFF.md`

Important developer rule:

- `AGENTS.md` says this repo uses a newer Next.js with breaking changes. Before editing Next.js code, read the relevant docs under `node_modules/next/dist/docs/`.

## 3. Build/test commands

On this Windows/PowerShell workspace, prefer `npm.cmd`, not `npm`, because `npm.ps1` may be blocked.

Common commands:

```powershell
npm.cmd run typecheck --workspace @silfable/contracts
npm.cmd run typecheck --workspace @silfable/desktop
npm.cmd run test --workspace @silfable/desktop
npm.cmd run typecheck --workspace @silfable/web
npm.cmd run test --workspace @silfable/web
npm.cmd run lint --workspace @silfable/web
npm.cmd run build --workspace @silfable/web
npm.cmd run build --workspace @silfable/desktop
```

Focused desktop tests:

```powershell
npm.cmd exec --workspace @silfable/desktop -- tsx --test src/main/mission/simulation.test.ts
npm.cmd exec --workspace @silfable/desktop -- tsx --test src/main/mission/limit-order.test.ts
npm.cmd exec --workspace @silfable/desktop -- tsx --test src/main/integrations/read-only.test.ts
```

Latest verified by Codex before the wallet-auth change:

- `npm.cmd run typecheck --workspace @silfable/contracts` - passed.
- `npm.cmd run typecheck --workspace @silfable/desktop` - passed.
- `npm.cmd run test --workspace @silfable/desktop` - 248/248 passed on 2026-07-27.
- `npm.cmd run test --workspace @silfable/cloud-worker` - 11/11 passed, including delegated-authority fail-closed guards.
- `npm.cmd run test --workspace @silfable/web` - 7/7 passed, covering wallet authentication and signed delegated-policy rules.
- The latest focused desktop MVP validation added PumpSwap, guarded Full Access contracts, Robinhood chain-ID enforcement, and verified-router fail-closed coverage. A fresh monorepo total was not rerun in this batch.

The full desktop test output includes warnings like `bigint: Failed to load bindings, pure JS will be used`; those warnings were present while tests passed and are not by themselves a failure.

## 4. Current product architecture

### 4.1 Desktop security model

Desktop is the trusted local runtime:

- Master password protects a local encrypted vault.
- Wallet private key material is encrypted locally.
- Renderer cannot access private keys directly.
- IPC contracts reject privilege-shaped input.
- The main process owns signing, policy, simulation, and storage boundaries.
- BrowserWindow/preload/CSP tests harden the renderer surface.
- Mutating Mainnet actions are restricted and require explicit approval.

Relevant areas:

- `apps/desktop/src/main/storage/*`
- `apps/desktop/src/main/wallet/*`
- `apps/desktop/src/main/security*.test.ts`
- `apps/desktop/src/main/ipc*.test.ts`
- `apps/desktop/src/main/index.ts`
- `packages/contracts/src/index.ts`

### 4.2 AI role

The AI agent is not the authority. Its role is:

- Explain capabilities and current wallet/market context.
- Use allowlisted read-only tools.
- Draft typed mission contracts.
- Draft exact-mint Pump.fun/PumpSwap trade proposals; an active Pump curve or canonical PumpSwap pool may later enter the separate manual restricted approval flow.
- Ask for missing fields when deterministic services require exact values.
- Never invent wallet, mint, amount, token identity, trigger price, or Pump execution state.
- For swap and limit-order drafts only, it may omit slippage/deadline/expiry so local Transaction Settings defaults are applied.

AI must not:

- Claim Pump/PumpSwap is production-validated or autonomous before signed live acceptance.
- Claim autonomous execution is available.
- Symbol-match a token for execution.
- Treat AI ranking as deterministic safety evidence.
- Generate or accept hidden execution authority.

Relevant areas:

- `apps/desktop/src/main/ai/service.ts`
- `apps/desktop/src/main/ai/providers.ts`
- `apps/desktop/src/main/ai/service.test.ts`
- `apps/desktop/src/main/ai/providers.test.ts`

Recent completed AI behavior:

- OpenRouter model/key configuration works through desktop settings.
- AI tool schemas for swap and limit-order previews now allow local defaults for slippage/deadline/expiry.
- System prompt explicitly says only slippage/deadline/expiry may be defaulted; do not invent other fields.
- Test added: AI-created swap mission preview uses Transaction Settings defaults when slippage/deadline are omitted.

## 5. Desktop Mainnet Jupiter swap status

Status: guarded restricted execution exists and has been Mainnet-tested by the user with a small SOL->USDC transaction.

Implemented flow:

1. User creates a restricted Mainnet session.
2. User selects/uses encrypted local Solana wallet.
3. AI can draft a mission preview.
4. Deterministic policy validates:
   - wallet is registered,
   - token pair is valid,
   - amount is valid,
   - slippage is within limit,
   - deadline is valid,
   - balance is sufficient,
   - quote-only evidence is returned without transaction payload.
5. Main process builds unsigned Jupiter swap order.
6. Main process inspects transaction:
   - selected wallet is sole fee payer/signer,
   - signature is empty before signing,
   - allowed programs only,
   - supported message format only.
7. Main process simulates unsigned transaction with `sigVerify: false`, `replaceRecentBlockhash: true`, no broadcast.
8. Fee guard checks configured absolute fee and fee percent.
9. Final pre-sign simulation repeats before signer access.
10. User gives master password + exact approval phrase.
11. Main process signs locally.
12. Main process broadcasts once through Jupiter execute endpoint.
13. Receipt stores signature, status, slot, fee, expected vs actual output, slippage, wallet outflow, and verification state.
14. Portfolio refresh waits for finalized/confirmed receipt slot before replacing balances.

Recent improvements completed:

- `RawSimulationResult` now includes `accountCreationFundingLamports`.
- Solana simulation can request account snapshots and estimate newly funded accounts/rent.
- `MissionSimulationPreview` now includes:
  - `accountFundingLamports`
  - `estimatedWalletOutflowLamports`
  - fee SOL/USD/percent/risk/guard message
- Receipt now includes:
  - expected output
  - output amount
  - actual slippage in basis points
  - actual slippage raw amount
  - estimated network fee
  - actual network fee
  - wallet pre/post lamports
  - total wallet outflow
  - account/rent funding
- Known router/program simulation failures are converted to human-readable messages.
- Bounded logs/details remain available as evidence; raw JSON should not be the primary user-facing message.

Key files:

- `apps/desktop/src/main/integrations/read-only.ts`
- `apps/desktop/src/main/mission/policy.ts`
- `apps/desktop/src/main/mission/simulation.ts`
- `apps/desktop/src/main/mission/transaction-settings.ts`
- `apps/desktop/src/renderer/src/WorkspaceApp.tsx`
- `packages/contracts/src/index.ts`

Tests:

- `apps/desktop/src/main/integrations/read-only.test.ts`
- `apps/desktop/src/main/mission/policy.test.ts`
- `apps/desktop/src/main/mission/simulation.test.ts`
- `apps/desktop/src/main/mission/transaction-settings.test.ts`

Completed receipt recovery:

- Successful, failed, and unknown swap, Pump, limit-order deposit, and limit-order cancellation receipts reopen from encrypted session history.
- Unknown limit-order receipts can be checked again by their existing signature. The renderer calls read-only verification IPC; the verifier never calls Jupiter write methods and never rebroadcasts.
- Priority presets are applied to Jupiter construction and the simulated fee is shown before approval.
- A timed-out Jupiter broadcast retains the signature derived from the exact locally signed transaction. The unknown receipt survives encrypted restart and can be checked by signature without another broadcast attempt.
- Automated P2 tests cover USDC→SOL unsigned simulation and insufficient USDC before construction/signing.
- Windows packaged acceptance uses `scripts/start-windows-p2-qa.ps1` and `docs/desktop/P2_WINDOWS_ACCEPTANCE.md`; the launcher creates an isolated profile/evidence manifest but grants no transaction authority.
- `npm.cmd run dist:desktop:win:qa` produces an unsigned, audited `win-unpacked` application for internal acceptance. It deliberately does not build an unsigned NSIS bootstrapper because host Application Control can block that intermediate executable. The production NSIS path remains `npm.cmd run dist:desktop:win` and still requires valid signing credentials.
- When host Application Control also blocks the unpacked unsigned executable, `scripts/smoke-electron-windows.ps1 -AllowTrustedElectronFallback` tests the exact packaged ASAR through the trusted Electron development binary. This is only archive/renderer/preload evidence and never replaces signed executable and installer smoke tests.

Still incomplete for Jupiter swap:

- Add SOL/USD entry modes for max network fee.
- Complete P2 validation in a signed Windows build:
  - optional minimum-value USDC->SOL live acceptance (unsigned simulation is covered),
  - insufficient balance,
  - changed quote after simulation,
  - RPC timeout,
  - unknown broadcast recovery,
  - receipt and portfolio survival after restart.

## 6. Limit order status

Status: manually approved Jupiter Trigger V2 lifecycle is implemented in code, but controlled live acceptance and provider/recovery validation remain required before a production claim.

Implemented:

- Limit-order policy creates typed preview artifact.
- Minimum order value and slippage checks exist.
- AI can draft limit-order preview using default slippage/expiry when omitted.
- Jupiter Trigger V2 integration signs official auth challenge locally and keeps credentials in headers.
- Vault deposit transaction is crafted and inspected.
- Unsigned vault-deposit simulation runs with sole-signer/program inspection.
- Fee guard runs during simulation and again immediately before signing.
- Account/rent funding estimate and known SOL-balance outflow are displayed.
- Limit-order execution receipt includes fee/risk evidence for order creation.
- Limit-order deposit and cancellation receipts persist across restart and expose signature, Explorer, chain status, slot, verification time, friendly error, and manual read-only re-verification for unknown status.

Important caveat:

- Do not describe the lifecycle as autonomous or production complete.
- Create/cancel/withdraw use explicit approval, durable receipts, and independent verification. Remaining release work is controlled live acceptance plus expired/partial/provider-missing order recovery.

Key files:

- `apps/desktop/src/main/mission/limit-order.ts`
- `apps/desktop/src/main/mission/limit-order.test.ts`
- `apps/desktop/src/main/integrations/trigger-v2.ts`
- `apps/desktop/src/main/integrations/trigger-v2.test.ts`

## 7. Pump.fun and PumpSwap status

Short version:

> Pump.fun research, bounded discovery, proposal, unsigned simulation, and manually approved restricted active-curve execution are implemented for a controlled desktop pilot. Live Mainnet acceptance is still pending.

Status: in progress, priority track.

Completed capabilities:

- Explicit Pump.fun session workspace.
- Session scopes:
  - specific exact mint,
  - bounded manual watchlist,
  - manual incremental Market Scanner.
- Exact mint is mandatory for analysis/proposal.
- Read-only finalized Pump token intelligence:
  - canonical active bonding-curve PDA,
  - migrated PumpSwap pool verification,
  - official program ownership,
  - Anchor discriminator,
  - curve completion/migration state,
  - token program,
  - supply,
  - mint/freeze authority,
  - top-ten concentration,
  - PumpSwap reserves,
  - estimated price and market cap,
  - curve progress,
  - quote reserves,
  - fee evidence,
  - bounded reference buy and sell-back estimates.
- Manual scanner:
  - reads at most 10 newer finalized Pump program signatures,
  - verifies at most 5 candidates,
  - persists bounded evidence,
  - no execution tool.
- Proposal-only Pump buy/sell contracts:
  - exact wallet,
  - exact mint,
  - side,
  - raw input,
  - SOL exposure,
  - minimum output,
  - slippage,
  - deadline,
  - stop conditions,
  - risk evidence.
- Global Pump risk settings:
  - trading fee ceiling,
  - slippage ceiling,
  - spend per trade/day,
  - per-token and total exposure,
  - open positions,
  - transactions per hour,
  - minimum SOL reserve.
- Encrypted append-only risk ledger exists.
- Local production-safe Pump v2 codec using `@solana/kit` only.
- Development-only compatibility harness pins `@pump-fun/pump-sdk@1.36.0`.
- Production build fails if quarantined SDK/legacy dependencies leak into runtime bundles.
- Pump v2 buy/sell instruction codec is byte-for-byte/account-for-account checked against pinned SDK.
- Unsigned v0 transaction builder:
  - exactly one top-level instruction,
  - selected wallet as sole payer/signer,
  - empty placeholder signature,
  - no lookup tables,
  - finalized blockhash not older than state evidence.
- Unsigned simulation:
  - no signing,
  - no broadcast,
  - validates logs/inner instructions/programs/compute/network fee/account funding.
- Persisted Pump simulation artifacts restored from encrypted session records.
- Final revalidation:
  - one-time 90-second in-memory cache,
  - rebuilds fresh finalized state/blockhash,
  - repeats quote/fee/risk/eligibility/inspection/simulation,
  - persists digest-bound result,
  - grants no authority by itself; only the separate manual approval handler may consume it once.
- Finalized-only receipt reconciler foundation:
  - verifies future signature and slot,
  - reads exact-wallet/exact-mint deltas,
  - separates network fee and newly funded token-account rent,
  - rejects pending/mismatched/directionally impossible settlements.
- Manual restricted Pump active-curve and canonical PumpSwap execution:
  - verifies master password and exact `EXECUTE PUMP MAINNET` confirmation,
  - signs only the one-time freshly revalidated digest with the selected encrypted wallet,
  - persists the locally derived signature before the network call,
  - attempts broadcast once with RPC send retries disabled,
  - reconciles unknown results by signature without rebroadcast,
  - restores and verifies pending execution records after restart,
  - writes finalized encrypted receipts and the idempotent Pump risk ledger,
  - refreshes portfolio/position data after finalization.

Not implemented / blocked for Pump:

- Controlled real-wallet minimum-value Pump and PumpSwap buy/sell acceptance in a signed QA build.
- Complete market history:
  - token age,
  - volume windows,
  - buyer/seller activity,
  - liquidity-change history,
  - creator history.
- Probabilistic AI candidate scoring after deterministic eligibility.
- Unified candidate actions:
  - add to watchlist,
  - prepare buy,
  - ignore,
  - block creator.
- Persistent background monitoring runtime.
- Auto-DCA live execution.
- Take-profit/stop-loss live execution.
- Autonomous discovery-to-buy.
- Unattended Full Access authority. The guarded planning profile remains approval-bound.

Current Pump assisted flow:

1. User creates Pump.fun mission.
2. User selects specific exact mint or bounded scope.
3. AI requests read-only token/venue intelligence.
4. Deterministic research eligibility runs separately.
5. AI may create a proposal-only buy/sell contract.
6. User requests unsigned simulation.
7. Main process rebinds exact session, wallet, mint, side, amount, limits, and risk ledger.
8. Main process resolves finalized state, quote, local instruction, unsigned transaction, inspection, simulation.
9. Fee guard, risk checks, and eligibility must pass.
10. User requests final revalidation while the one-time prepared artifact is fresh.
11. Main process rebuilds and re-simulates from fresh evidence and binds the exact final digest.
12. User reviews the final approval, enters the master password, types `EXECUTE PUMP MAINNET`, acknowledges real-funds risk, and clicks execute.
13. Main process signs locally, persists the signature, and attempts one broadcast.
14. RPC reconciliation persists pending, failed, or finalized evidence; it never automatically rebroadcasts an unknown transaction.

Key files and areas:

- `apps/desktop/src/main/pump/*`
- `apps/desktop/src/main/ai/service.ts`
- `apps/desktop/src/main/ai/providers.ts`
- `apps/desktop/src/renderer/src/WorkspaceApp.tsx`
- `packages/contracts/src/index.ts`
- `docs/desktop/PUMPFUN_IMPLEMENTATION_STATUS.md`
- `docs/desktop/MAINNET_PRODUCT_ROADMAP.md`

Representative tests:

- `apps/desktop/src/main/pump/*test.ts`
- `apps/desktop/src/main/ai/service.test.ts`
- `apps/desktop/src/main/schemas.test.ts`

## 8. Desktop setup/onboarding UX status

The desktop app was redesigned toward a Vex-inspired flow, but not pixel-identical. The intended flow:

1. System check on launch.
2. Existing vault:
   - system check,
   - unlock with existing master password.
3. First run / reset vault:
   - configure security/master password,
   - set up Mainnet Solana wallet,
   - configure API keys/integrations,
   - configure agent core tuning,
   - configure inference provider,
   - review setup,
   - enter sessions dashboard.
4. Settings from dashboard:
   - open review-style infrastructure/settings page,
   - edit individual sections,
   - return to review,
   - back to sessions.

Implemented/changed across earlier work:

- No Devnet option in the new flow; Mainnet only.
- Password policy relaxed to accept practical 9-character mixed passwords.
- Password errors should be user-friendly, not raw JSON/Zod output.
- Forgot-password reset path exists and requires irreversible acknowledgement.
- Wallet onboarding supports generate/import/restore and multiple wallets on desktop.
- Sessions persist across app restart.
- Sidebar has session list, filters, Memory, Missions, Settings.
- Right rail switches from initial Portfolio to session Positions when a session is active.
- Portfolio copy action should work.
- Scrollbars styled dark/blue in desktop.
- Settings opens the review/edit pattern with Back to Sessions.

If modifying this area, preserve:

- Master password for desktop.
- Locked vault means `wallet:list` and `session:list` should fail closed but UI should handle it gracefully.
- No raw JSON validation errors in user-facing UI.
- No Devnet labels, request SOL, canary, or old testnet/devnet flows.

## 9. Web app status

The web app is being aligned visually and logically with desktop, but the security boundary differs:

- Web uses browser wallet confirmation for transactions.
- Web should not use the desktop master-password vault model.
- Current product direction says only the connected wallet should be used in web; to use another wallet, disconnect/reconnect.
- Web `New Session` should not require wallet selection if only one connected browser wallet is allowed.
- Web settings should mirror desktop structure where possible:
  - first-run setup modal,
  - later edit modal,
  - API key design like desktop,
  - review page,
  - non-clickable step tabs,
  - Back to Session/Back to Sessions.
- Web `/trade` should resemble desktop dashboard:
  - left workspace/session rail,
  - central chat/session area,
  - right portfolio/positions/runtime rail,
  - Memory/Missions/Settings pages.
- Landing page should retain the intended dramatic hero and navbar:
  - logo in navbar,
  - Home,
  - Docs,
  - Releases,
  - GitHub,
  - Get Started,
  - Download,
  - Whitepaper page exists/should exist.

Important caution:

- Do not put user private keys or secret keys into a normal web server route or shared DB casually.
- If a web feature asks for secret key import for Pump.fun, design it as an explicit high-risk burner/local-browser feature or avoid it. Browser wallet signing is safer. Never silently store secret keys server-side.
- Before editing Next.js code, read the relevant local Next docs under `node_modules/next/dist/docs/`.

Current web files with known recent work/dirty state:

- `apps/web/src/app/trade/page.tsx`
- `apps/web/src/components/trade/WebSetupWizard.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/whitepaper/page.tsx`
- `apps/web/src/lib/db.ts`

Web status should be treated as in-progress until:

- `npm.cmd run typecheck --workspace @silfable/web` passes.
- `npm.cmd run lint --workspace @silfable/web` passes.
- `npm.cmd run build --workspace @silfable/web` passes.
- Wallet balance issue is fixed: connected Phantom/Mainnet wallet with SOL should show actual balance, not `0.000000 SOL`.
- `/trade` modal/session/settings behavior matches desktop flow.
- Landing page spacing/navbar/CTA are visually restored.

## 10. Features already present elsewhere but not production-complete

Tests indicate foundations exist for:

- DurableBackgroundObservationService polling prices and triggering auto-execution events.
- DcaSchedulerManager schedule mechanics.
- PositionStrategyManager triggering stop-loss/take-profit/trailing-stop internally.
- EvmVenueProvider validating EVM addresses and building unsigned EIP-1559 payloads.
- CrossChainExecutionDispatcher routing multi-chain providers.

These should be treated as foundations, not user-facing production capabilities, unless an end-to-end UI + policy + signer/broadcast + receipt/recovery flow is explicitly complete.

Do not advertise these as finished:

- Bridge between chains.
- EVM wallet/trading.
- Hyperliquid trading.
- Limit order production lifecycle.
- Autonomous trading / auto-buy.
- Full Access without approval. The guarded Full Access MVP is planning scope only.
- Scheduled mission that runs itself.
- Take-profit/stop-loss that really executes live.
- Auto DCA live.
- Token discovery then automatic buy.

## 11. Production readiness status

Not production-ready as a whole.

Current Mainnet status:

- Restricted Jupiter swap path has live-transaction capability and strong local safety tests.
- P0 is close/mostly complete for swap safety and state correctness.
- P1 security/release gates are still partial.
- P2 signed-build validation matrix is not complete.
- Pump.fun/PumpSwap manual restricted execution is pilot-ready in code, but controlled real-wallet buy/sell acceptance is not complete.
- Web trading parity is not complete.
- Delegated monitor/proposal policy foundation is implemented, but it is not transaction authority. Guarded Full Access exists only as a broader approval-bound planning profile.

Additional release blockers found on 2026-07-26:

- The wallet-authentication Prisma models have been generated into the client, but the live MongoDB schema/indexes were not pushed automatically. Back up and verify the target database, then run the explicit Prisma deployment step before releasing the web authentication flow.
- `npm audit --omit=dev --audit-level=high` is not clean. It currently reports transitive advisories in the Solana wallet/tooling and Next.js dependency trees, including high-severity findings. The suggested automatic fixes are breaking or inappropriate for this stack; do not run `npm audit fix --force`. Upgrade and validate the affected dependency families deliberately.
- Rotate every credential that has appeared in terminal output, screenshots, chat, or IDE selections before deployment.
- Keep the cloud worker monitor-only until delegated authority, revocation, idempotency, and production signing custody are designed and audited.
- A signed kill-switch recovery/disengagement challenge is not implemented. Once engaged, recovery deliberately requires a future audited flow rather than a normal settings toggle.

Do not call it "go live production" until:

1. P0 items are complete and verified.
2. P1 security audits and release gates are complete.
3. P2 matrix passes in a signed Windows installer, not only dev runtime.
4. Recovery on a clean profile/machine is tested.
5. No unresolved security finding can expose wallet material or authorize an unreviewed Mainnet transaction.

## 12. Current priority order

Recommended next work, in order:

1. Complete P2 validation matrix:
   - USDC->SOL quote/simulation/optional tiny execution,
   - insufficient balance,
   - quote changes after simulation,
   - RPC timeout,
   - unknown broadcast recovery,
   - restart with persisted receipts and balances.
2. Harden logs and network resilience:
   - bounded retries,
   - provider backoff,
   - no blind rebroadcast,
   - no secrets in logs/crashes.
3. Continue Pump.fun execution path only after:
   - packaged restart/receipt recovery acceptance,
   - risk ledger connection to real receipts,
   - minimum-value buy/sell Mainnet tests,
   - approval UI,
   - signer digest binding,
   - single-broadcast persistence.
4. Finish Web `/trade` parity after reading Next docs:
   - wallet balance,
   - connected-wallet-only session flow,
   - setup/review/settings modals,
   - Memory/Missions/Settings pages,
   - landing/navbar/whitepaper copy.
7. Only then consider:
   - bridge,
   - EVM,
   - Hyperliquid,
   - autonomous execution,
   - unattended Full Access authority.

## 13. Coding rules for the next AI agent

Follow these rules to avoid breaking the project direction:

1. Use `rg` for search.
2. Use `apply_patch` for code/file edits.
3. Do not delete or reset unrelated dirty work.
4. Do not use `git reset --hard` or destructive checkout.
5. Preserve existing user changes unless the task explicitly says to replace them.
6. For Next.js changes, read local Next docs first.
7. For desktop signing/broadcast, fail closed.
8. Never add a mutating renderer IPC that accepts arbitrary transaction bytes, arbitrary URLs, or privilege flags.
9. Never expose private keys, seed phrases, API keys, passwords, signed transactions, or provider secrets in logs/UI.
10. Keep typed contracts in `packages/contracts` synchronized with main and renderer.
11. After changing contracts, run contracts + desktop typecheck.
12. After changing Mainnet execution behavior, run focused tests and full desktop tests.
13. If touching web, run web typecheck/lint/build.
14. Keep user-facing errors human-readable; raw JSON belongs only in bounded details/logs.
15. Do not mark a roadmap item complete unless code and tests prove it.

## 14. Recent concrete changes from the latest Codex batch

### P1 network, logging, and autonomous-authority hardening

- `apps/desktop/src/main/execution/autonomous-executor.ts`
  - The earlier experimental autonomous signer/broadcaster has been removed.
  - The service now always fails closed and may only direct callers back to the restricted manual approval flow.
  - It must not be changed into a signing service until custody, scheduling, revocation, restart recovery, and explicit product approval gates are complete.

- `apps/desktop/src/main/integrations/trigger-v2.ts`
  - Only explicitly idempotent reads (`/vault` and `/orders/history`) receive bounded retry/backoff.
  - Vault registration, deposit crafting, order creation, and cancellation mutations receive zero automatic retries.
  - A timeout or ambiguous mutation response must be reconciled; it must not be submitted again blindly.

- `apps/desktop/src/main/execution/reconciliation.ts`
  - Raw provider/decrypted errors are no longer printed to the process console.
  - The user-facing reconciliation boundary remains generic and fail closed.

- `scripts/audit-desktop-bundles.mjs`
  - Production build auditing now requires the autonomous executor to remain explicitly disabled.
  - The audit fails if signer access, Pump transaction construction, transaction signing, or RPC broadcast authority is reintroduced into that service.

Validation for this hardening batch:

```powershell
npm.cmd run typecheck --workspace @silfable/desktop
npx.cmd tsx --test apps/desktop/src/main/execution/autonomous-executor.test.ts apps/desktop/src/main/execution/reconciliation.test.ts apps/desktop/src/main/integrations/trigger-v2.test.ts
npm.cmd run build --workspace @silfable/desktop
npm.cmd test --workspace @silfable/desktop -- --run
```

Result:

- Desktop node and renderer typechecks passed.
- 8 focused network/logging/authority tests passed.
- 243 full desktop tests passed, 0 failed.
- Desktop production build and privilege/Pump boundary audit passed.

Files changed in the latest desktop safety batch:

- `packages/contracts/src/index.ts`
  - Added simulation fields:
    - `accountFundingLamports`
    - `estimatedWalletOutflowLamports`
  - Added receipt field:
    - `actualSlippageRawAmount`
  - Added limit-order simulation/receipt fee fields.

- `apps/desktop/src/main/integrations/read-only.ts`
  - `simulateUnsignedTransaction` now extracts static transaction accounts.
  - It fetches pre-simulation account lamports through `getMultipleAccounts`.
  - It asks Solana simulation to return account evidence.
  - It estimates newly created account funding/rent.

- `apps/desktop/src/main/mission/simulation.ts`
  - Swap simulation now propagates account funding and known SOL outflow.
  - Final pre-sign simulation remains mandatory.
  - Receipt computes raw output delta and basis-point slippage.
  - Friendly error mapping added for known program/router failures.

- `apps/desktop/src/main/mission/limit-order.ts`
  - Limit-order vault deposits use configured fee guard.
  - Limit-order deposits re-simulate and re-check fee guard before signing.
  - Limit-order preview shows account funding and estimated wallet outflow.
  - Limit-order receipt includes fee/risk evidence.

- `apps/desktop/src/renderer/src/WorkspaceApp.tsx`
  - Simulation cards show network fee, account funding, estimated wallet outflow, fee risk, and friendly fee message.
  - Swap receipts show output delta raw.
  - Limit-order cards show deposit amount, fee, fee percent, fee risk, and outflow wording.

- `apps/desktop/src/main/ai/service.ts`
  - AI tool schemas allow omitted slippage/deadline/expiry where local settings defaults apply.

- `apps/desktop/src/main/ai/providers.ts`
  - Prompt clarifies what the AI may omit and what it must not invent.

- `apps/desktop/src/main/index.ts`
  - Transaction settings service is wired into AI and limit-order services.

- `docs/desktop/MAINNET_PRODUCT_ROADMAP.md`
  - Updated P0/P3 limit-order/Pump notes to reflect completed fee/outflow/receipt improvements.

Latest verified tests:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Result at the time of that earlier fee/receipt batch:

- 237 tests passed, 0 failed. The newer P1 hardening run above supersedes this desktop count with 243 passing tests.
- Monorepo lint and typecheck passed.
- Cloud worker, desktop, contracts, and web production builds passed.
- Desktop privilege and Pump production-boundary bundle audit passed.

## 15. What Gemini should do next if asked to continue

If the next instruction is simply "continue", choose this order:

1. Run the P2 acceptance matrix in the signed Windows QA build, including USDC-to-SOL, insufficient balance, stale quote, RPC timeout, unknown broadcast, restart recovery, and receipt/portfolio reconciliation.

2. Repeat RPC timeout and unknown-broadcast recovery in the signed QA build.

3. Complete remaining P1 security audits and release evidence without weakening restricted approvals.
   - Automated tests already prove bounded retries for reads, simulation, and signature verification.
   - A timed-out Pump broadcast is attempted exactly once and is never blindly retried.
   - Manual verification now preserves a friendly `broadcast-unknown` record instead of surfacing a raw provider timeout.
   - Encrypted restart persistence and signature-only recovery already exist; the remaining task is packaged acceptance evidence.

4. Continue Pump.fun execution only after the above is stable.
   - Do not add live Pump broadcast first.
   - Build approval UI, signer digest binding, receipt persistence, and recovery tests before exposing any live button.

5. For web, fix parity only after reading Next docs.
   - Fix connected wallet balance.
   - Remove wallet selection from New Session if single connected wallet is the product rule.
   - Restore landing hero/navbar spacing and CTAs.
   - Complete settings/review modal parity.

This document is intentionally conservative. If in doubt, keep Mainnet execution unavailable and add typed evidence/tests first.
