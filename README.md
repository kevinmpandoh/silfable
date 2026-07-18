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
- Auto DCA simulation receipts always report `signingAttempted: false`; automatic mission signing and broadcast IPC do not exist yet.
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
- OpenAI and Anthropic can produce validated DCA drafts. API keys remain in the OS-backed keystore and provider output cannot authorize or execute a mission.
- A manual Devnet canary can build, simulate, sign, broadcast, confirm, and journal a zero-lamport self-transfer. It requires explicit per-attempt fee acknowledgement and does not enable Auto DCA signing.
- Jupiter Mainnet Shadow can request SOL/USDC quote-only orders through Swap V2, enforce local risk bounds, and retain an encrypted local audit journal. It deliberately omits `taker`; transaction construction, signing, broadcast, and automatic mission execution remain disabled.
- The desktop checks only the public GitHub latest-release metadata and opens one fixed review URL. It never downloads, installs, restarts, or resumes a mission automatically.
- Crash journaling is disabled by default. Explicit opt-in permits only an encrypted local allowlisted process/reason/exit-code record; this build has no telemetry endpoint or transmission IPC, and revoking consent purges all reports.
- Security QA enforces strict request schemas, exact top-frame IPC identity, denied permissions/navigation/windows/webviews, restrictive CSP, and a CI bundle audit that prevents privileged main-process markers from entering renderer or preload output.
- Keystore tamper/size/backend checks, serialized secret mutations, single-flight data-key creation, duplicate scheduler-wake protection, restart halt, and staged canary network-drop tests are enforced before guarded execution work begins.
- A pure guarded-Devnet policy now binds mission revision/digest/cycle to a short-lived SPL test proposal, exact amount and slippage-derived minimum output, simulation fee/program/balance deltas, and a non-skippable execution state machine. It has no IPC, live adapter, or production signing connection yet.

Read [the final decisions](docs/desktop/DECISIONS.md), [architecture](docs/desktop/ARCHITECTURE.md), [Mainnet Shadow boundary](docs/desktop/JUPITER_MAINNET_SHADOW.md), [crash privacy boundary](docs/desktop/CRASH_REPORTING.md), and [threat model](docs/desktop/THREAT_MODEL.md) before adding privileged functionality.
