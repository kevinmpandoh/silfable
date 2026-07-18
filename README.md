# Silfable

Silfable is a local-first AI trading runtime with enforceable execution limits. This repository contains the public website, the secure Electron desktop foundation, shared mission contracts, and architecture documents.

## Workspace

```text
apps/web             Next.js App Router website
apps/desktop         Electron main, preload, and React renderer
packages/contracts   Versioned IPC and mission schemas
packages/core        Deterministic mission and DCA primitives
docs/desktop         Architecture, threat model, and release design
```

## Requirements

- Node.js 24.15 or newer (matches Electron 43's Node runtime and built-in SQLite API)
- npm workspaces
- Linux is required for final AppImage/DEB verification

## Setup

```bash
npm install
npm run setup:electron
```

The Electron runtime download can be blocked by corporate Windows Application Control policies. Source builds and typechecks still work; use a Linux development machine or GitHub Actions when native extraction is prohibited.

## Commands

```bash
npm run dev:web
npm run build:web
npm run lint:web

npm run dev:desktop
npm run build:desktop

npm run typecheck
npm test
npm run build
```

## Security posture

The desktop renderer is sandboxed and has no Node.js integration. Privileged behavior is exposed through narrow, validated IPC contracts.

- The renderer can read runtime status and request a deterministic DCA safety simulation.
- Auto DCA simulation receipts always report `signingAttempted: false`; the DCA scheduler remains disconnected from signing and broadcast. The separately acknowledged agent fixture proof below cannot execute a market DCA trade.
- Desk Rules fail closed for network, keystore, kill switch, freshness, market, price, fee, spend, reserve, and simulation failures.
- Electron `safeStorage` protects a separate secret file and Linux's insecure `basic_text` backend is rejected.
- The main process owns a strict SQLite v1 database using Node's built-in `node:sqlite`, WAL journaling, full synchronous writes, foreign keys, transactional migrations, and defensive mode.
- Devnet wallet onboarding supports create, BIP39/BIP44 mnemonic import, and 32/64-byte private-key import through `@solana/kit`.
- The generated recovery phrase is returned once; imported mnemonics are never stored. Only encrypted private-key material is kept in the separate keystore.
- Solana Devnet RPC health monitoring, confirmed balance reads, and a manual one-SOL test faucet are enabled in the main process.
- Auto DCA missions support encrypted drafts, immutable revisions, SHA-256 review digests, explicit authorization, manual start/halt, skipped-cycle recording, daily risk counters, and encrypted simulation receipts.
- The desktop exposes a decrypted-on-demand audit viewer for cycle state, revision, denial reason, receipt ID, digest, and the invariant `signingAttempted: false`.
- Explicit lock halts running missions before locking the keystore. Best-effort OS notifications contain only a shortened mission ID and generic state.
- Running missions halt on restart, suspend, locked keystore, stale/unhealthy RPC, or Desk Rule denial and never resume automatically.
- OpenAI and Anthropic can produce validated DCA drafts and evaluate one sanitized, main-owned Jupiter shadow quote as an exact `execute-quoted-swap` or `hold` proposal. API keys remain in the OS-backed keystore; every shadow proposal is deterministically rebound to the quote and stored as an encrypted no-execution receipt. Eligible intents can be approved, rejected, revoked, or automatically expired, but approval is digest-bound and explicitly cannot enable signing or execution.
- Fresh allowed Jupiter quotes can be converted into encrypted, digest-bound SOL/USDC market observations. The snapshot normalizes price with integer arithmetic, derives an explicitly labeled liquidity proxy and historical range, records nullable slot/block provenance, and reports Mainnet wallet exposure as unavailable until a real Mainnet wallet context exists. Observation capture performs zero model calls and cannot sign or execute.
- An explicitly activated market watch can poll a fixed-size SOL/USDC quote every 60–3,600 seconds and wake on a price threshold only when its impact gate passes. Watch configuration and every check receipt are encrypted; only one watch can be active, overlapping ticks collapse, five consecutive failures pause it, and lock/suspend cancels in-flight work. Sleeping makes zero AI calls and a wake cannot authorize or execute a trade.
- Restricted agent sessions add an objective, provider, five-minute-to-seven-day deadline, per-action USDC cap, price-impact stop, and volatility stop for Jupiter-only SOL actions. AI may return `buy-sol`, `sell-sol`, `hold`, or `halt`; every field is rebound to a main-owned observation and quote after the provider returns. Buy/sell can only become an expiring, revocable operator-approved intent with `executionEnabled: false`; hold is non-actionable, while AI halt or policy denial safely halts the session.
- An exact approved buy/sell intent can be mapped to an unsigned, fixed low-value SPL fixture message and simulated on Devnet. The proof is digest-bound, rechecks fixture provenance and approval after RPC latency, and stores detailed evidence encrypted; its public receipt always reports `economicValueMapping: none`, `marketSwapPerformed: false`, and signing, broadcast, and execution as false. This proves the message pipeline only—it does not trade or grant the agent a signer.
- A successful exact-message proof can receive one encrypted Devnet signing arm lasting at most 60 seconds after three explicit operator acknowledgements. Only proofs at most 30 seconds old are eligible. The arm is bound to the simulation, proposal, message, session, and fixture digests; it expires no later than the intent/session and is revoked on lock, suspend, quit, rejection, or session halt. The arm surface itself exposes no signer or transaction material and can only be consumed by the exact pre-sign pipeline described below.
- An active agent arm can now be consumed atomically into an encrypted `ready-for-signing` pre-sign journal only after the original private wire message passes block-height, on-chain fixture provenance, exact RPC simulation, fee, network, session, approval, and digest revalidation. Failures are receipted without consuming the arm. The public receipt exposes no wire or signature and hard-codes signing, broadcast, execution, market swap, Mainnet, and the execution bridge to false.
- A `ready-for-signing` agent receipt can now load the local Devnet wallet signer only after one more complete binding and provenance check, sign the exact previously simulated fixture message once, and encrypt the signed wire plus signature before exposing only a signature hash. Restart fails an unfinished signing journal without retrying. This path has no send/broadcast method, performs no market swap, carries no economic mapping to the AI intent, and cannot use Mainnet.
- A separately acknowledged broadcast journal can submit that exact signed fixture transaction to Devnet once. The runtime atomically commits its attempt marker before RPC submission, confirms by signature, treats an unknown post-send result as ambiguous, and on restart only queries status without rebroadcasting. A confirmed result is explicitly a fixed fixture transfer with `economicValueMapping: none`, never a Jupiter market swap or Mainnet trade.
- An approved `buy-sol` or `sell-sol` intent can now request a real Raydium Devnet SOL/devUSDC quote with a fixed low-value canary amount. The runtime owns the mints, direction mapping, slippage, endpoint, and amount; it revalidates approval after network latency, rejects excessive impact or malformed routes, and stores the quote encrypted. Devnet price is not trusted market discovery, and this increment cannot build, sign, or broadcast the quoted swap.
- A manual Devnet canary can build, simulate, sign, broadcast, confirm, and journal a zero-lamport self-transfer. It requires explicit per-attempt fee acknowledgement and does not enable Auto DCA signing.
- Jupiter Mainnet Shadow can request SOL/USDC quote-only orders through Swap V2, enforce local risk bounds, and retain an encrypted local audit journal. It deliberately omits `taker`; transaction construction, signing, broadcast, and automatic mission execution remain disabled.
- The desktop checks only the public GitHub latest-release metadata and opens one fixed review URL. It never downloads, installs, restarts, or resumes a mission automatically.
- Crash journaling is disabled by default. Explicit opt-in permits only an encrypted local allowlisted process/reason/exit-code record; this build has no telemetry endpoint or transmission IPC, and revoking consent purges all reports.
- Security QA enforces strict request schemas, exact top-frame IPC identity, denied permissions/navigation/windows/webviews, restrictive CSP, and a CI bundle audit that prevents privileged main-process markers from entering renderer or preload output.
- Keystore tamper/size/backend checks, serialized secret mutations, single-flight data-key creation, duplicate scheduler-wake protection, restart halt, and staged canary network-drop tests are enforced before guarded execution work begins.
- A pure guarded-Devnet policy now binds mission revision/digest/cycle to a short-lived SPL test proposal, exact amount and slippage-derived minimum output, simulation fee/program/balance deltas, and a non-skippable execution state machine. It has no IPC, live adapter, or production signing connection yet.

Read [the final decisions](docs/desktop/DECISIONS.md), [architecture](docs/desktop/ARCHITECTURE.md), [Mainnet Shadow boundary](docs/desktop/JUPITER_MAINNET_SHADOW.md), [crash privacy boundary](docs/desktop/CRASH_REPORTING.md), and [threat model](docs/desktop/THREAT_MODEL.md) before adding privileged functionality.
