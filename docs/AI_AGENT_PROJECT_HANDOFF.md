# Silfable AI Agent Handoff Brief

Last updated: 2026-07-24  
Audience: external AI coding agent, e.g. Gemini  
Repository: `D:\Web3\silfable-web`

## 1. Read this first

Silfable is a local-first AI trading runtime. The key product rule is:

> AI may research, explain, draft, and propose. Deterministic local services must enforce policy, simulate, require explicit approval, sign locally, broadcast once, and verify independently.

Do not turn any "proposal", "simulation", "final revalidation", "read-only scanner", or "AI confidence" into live Mainnet authority unless the specific execution gate is already implemented and tested.

Current safe description:

- Desktop has a guarded Mainnet Jupiter swap execution path with local encrypted wallet, master-password approval, simulation, signing, broadcast, receipt, and verification.
- Desktop has extensive Pump.fun/PumpSwap research, proposal, unsigned simulation, and final revalidation foundations.
- Pump.fun/PumpSwap live signing and broadcast are still unavailable.
- Web `/trade` has **Full Access 24/7 Autonomous Trading** via Node.js Cloud Worker, BullMQ/Redis, MongoDB, and AES-256-GCM Ephemeral Vaults. Web supports full autonomous execution for Jupiter Swaps.
- Scheduled unattended execution, Auto-DCA, and take-profit live execution are now structurally possible on Web via the Cloud Worker, but still require UX scaffolding. Bridge, EVM live trading, and Hyperliquid live trading remain blocked.

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

Latest verified by Codex:

- `npm.cmd run typecheck --workspace @silfable/contracts` - passed.
- `npm.cmd run typecheck --workspace @silfable/desktop` - passed.
- `npm.cmd run test --workspace @silfable/desktop` - 182/182 passed.

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
- Draft proposal-only Pump.fun/PumpSwap trade contracts.
- Ask for missing fields when deterministic services require exact values.
- Never invent wallet, mint, amount, token identity, trigger price, or Pump execution state.
- For swap and limit-order drafts only, it may omit slippage/deadline/expiry so local Transaction Settings defaults are applied.

AI must not:

- Claim Pump.fun live trading is available.
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

Still incomplete for Jupiter swap:

- Ensure every successful, failed, and unknown receipt can be reopened cleanly from session history.
- Apply priority presets to Jupiter construction, not only persist the preference.
- Add SOL/USD entry modes for max network fee.
- Complete P2 validation in a signed Windows build:
  - USDC->SOL test,
  - insufficient balance,
  - changed quote after simulation,
  - RPC timeout,
  - unknown broadcast recovery,
  - receipt and portfolio survival after restart.

## 6. Limit order status

Status: preview/policy and significant vault-deposit safety foundation exist, but treat production lifecycle as partial/blocked.

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

Important caveat:

- Do not describe "real limit-order lifecycle" as production complete.
- Create/cancel/withdraw lifecycle needs explicit approval flow, durable reconciliation, independent verification for every transition, and recovery for expired/partial/provider-missing orders.

Key files:

- `apps/desktop/src/main/mission/limit-order.ts`
- `apps/desktop/src/main/mission/limit-order.test.ts`
- `apps/desktop/src/main/integrations/trigger-v2.ts`
- `apps/desktop/src/main/integrations/trigger-v2.test.ts`

## 7. Pump.fun and PumpSwap status

Short version:

> Pump.fun research, bounded discovery, proposal, unsigned simulation, and final revalidation are available. Pump.fun live trading is not available.

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
  - still no signing/broadcast authority.
- Finalized-only receipt reconciler foundation:
  - verifies future signature and slot,
  - reads exact-wallet/exact-mint deltas,
  - separates network fee and newly funded token-account rent,
  - rejects pending/mismatched/directionally impossible settlements.

Not implemented / blocked for Pump:

- Live Pump.fun signer access.
- Live Pump.fun broadcast.
- PumpSwap execution path.
- Master-password execution confirmation for Pump.
- Exact final approval UI for Pump live trades.
- Receipt restart recovery for real Pump signatures.
- Unknown-broadcast recovery for Pump.
- Risk-ledger writes from real Pump receipts.
- Minimum-value Mainnet buy and sell exit-path tests.
- Automatic portfolio/position refresh after Pump transaction.
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
- Full Access.

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
10. User may request final revalidation within 90 seconds.
11. Main process rebuilds and re-simulates from fresh evidence.
12. Flow stops. No Pump password prompt, signature, or broadcast API exists.

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
- Full Access without approval.
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
- Pump.fun live execution is not available.
- Web trading parity is not complete.

Do not call it "go live production" until:

1. P0 items are complete and verified.
2. P1 security audits and release gates are complete.
3. P2 matrix passes in a signed Windows installer, not only dev runtime.
4. Recovery on a clean profile/machine is tested.
5. No unresolved security finding can expose wallet material or authorize an unreviewed Mainnet transaction.

## 12. Current priority order

Recommended next work, in order:

1. Finish receipt reopen from session history for success/failure/unknown receipts.
2. Complete transaction settings priority presets:
   - Economy,
   - Standard,
   - Fast,
   - send preference to Jupiter where supported,
   - show estimated cost.
3. Complete P2 validation matrix:
   - USDC->SOL quote/simulation/optional tiny execution,
   - insufficient balance,
   - quote changes after simulation,
   - RPC timeout,
   - unknown broadcast recovery,
   - restart with persisted receipts and balances.
4. Harden logs and network resilience:
   - bounded retries,
   - provider backoff,
   - no blind rebroadcast,
   - no secrets in logs/crashes.
5. Continue Pump.fun execution path only after:
   - receipt recovery,
   - risk ledger connection to real receipts,
   - minimum-value buy/sell Mainnet tests,
   - approval UI,
   - signer digest binding,
   - single-broadcast persistence.
6. Finish Web `/trade` parity after reading Next docs:
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
   - Full Access.

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
npm.cmd run typecheck --workspace @silfable/contracts
npm.cmd run typecheck --workspace @silfable/desktop
npm.cmd run test --workspace @silfable/desktop
```

Result:

- Desktop test suite: 182 tests passed, 0 failed.

## 15. What Gemini should do next if asked to continue

If the next instruction is simply "continue", choose this order:

1. Implement receipt reopen from session history.
   - Reopen success/failed/unknown receipt cards.
   - Verify by signature without rebroadcast.
   - Ensure encrypted session persistence still hides plaintext message contents in SQLite.
   - Add tests.

2. Implement priority presets in Jupiter transaction construction.
   - Persisted setting already exists.
   - Wire `economy|standard|fast` into the order/build call only if the provider API supports it.
   - Show estimated cost in preview.
   - Add tests.

3. Add RPC timeout and unknown broadcast recovery UX/tests.
   - Reads may retry safely with bounds.
   - Broadcast must never blindly retry.
   - Unknown status should persist signature/request evidence and guide user to verify.

4. Continue Pump.fun execution only after the above is stable.
   - Do not add live Pump broadcast first.
   - Build approval UI, signer digest binding, receipt persistence, and recovery tests before exposing any live button.

5. For web, fix parity only after reading Next docs.
   - Fix connected wallet balance.
   - Remove wallet selection from New Session if single connected wallet is the product rule.
   - Restore landing hero/navbar spacing and CTAs.
   - Complete settings/review modal parity.

This document is intentionally conservative. If in doubt, keep Mainnet execution unavailable and add typed evidence/tests first.
