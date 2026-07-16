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
- Simulations always report `signingAttempted: false`; signing and broadcast IPC do not exist yet.
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
- Jupiter, transaction construction, signing, broadcast, and AI providers remain disabled.

Read [the final decisions](docs/desktop/DECISIONS.md), [architecture](docs/desktop/ARCHITECTURE.md), and [threat model](docs/desktop/THREAT_MODEL.md) before adding privileged functionality.
