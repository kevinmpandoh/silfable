# Silfable

Silfable is a local-first desktop workspace for operating a restricted AI agent. Wallet material and API credentials stay encrypted locally. Its product architecture is organized into Token Launch (Pump.fun), Solana Swap (Jupiter), EVM Swap, and Bridge lanes. The guarded desktop Jupiter path and conservative Pump.fun Token Launch path have restricted manual execution implementations. A restricted Robinhood Chain/0x EVM pipeline is also wired through exact approval, local signing, and encrypted receipt recovery, but remains release-locked pending independent Mainnet acceptance and security evidence. Bridge remains quote-only.

## Workspace

```text
apps/web             Next.js website
apps/desktop         Electron main process, preload bridge, and React UI
packages/contracts   Strict IPC request and response schemas
docs/desktop         Current desktop architecture and safety boundary
```

## Desktop flow

The first run guides the user through:

1. System and Mainnet boundary check.
2. Master-password setup and local vault unlock.
3. Solana Mainnet wallet creation or import, with multi-wallet support.
4. Optional Jupiter and Tavily API credentials.
5. Agent and subagent tuning.
6. OpenRouter key and model selection.
7. Review, followed by the session workspace.

Later launches do not repeat onboarding. Silfable runs the system check, asks for the configured master password, and then opens the existing workspace. Minimizing or closing the window to the tray locks the vault and requires this entry flow again.

Settings reopens the review screen so each section can be edited and then returned to the active sessions. The workspace contains sessions, memory and mission navigation, chat/session controls, verified read-only Mainnet balances, wallet context, and runtime/cost panels. USD portfolio values appear only when Jupiter returns a price for the corresponding mint.

## Security boundary

- The renderer is sandboxed and receives only a narrow, schema-validated preload API.
- Runtime profile is fixed to `mainnet-guarded`; there is no Devnet option or fallback.
- Wallet private keys, integration keys, and the OpenRouter key are encrypted with the local OS-backed keystore.
- The master password is verified in the Electron main process using a salted `scrypt` verifier. The password itself is never persisted, and secret-bearing IPC fails while the vault is locked.
- AI chat is restricted to analysis and planning. It can invoke only locally allowlisted read-only tools for a selected wallet portfolio, Jupiter prices, and Tavily research. It receives no signer, transaction, or execution tool.
- The removed Devnet faucet, test SOL request, fixture, canary, DCA, and shadow-trade services are not part of the active runtime.
- Passed Mainnet simulations are cached briefly in the main process. Only that exact one-time transaction can be signed locally and submitted through Jupiter after the user re-enters the master password, types the confirmation phrase, and acknowledges irreversible execution. The resulting signature is then checked independently through Solana RPC; encrypted receipts can be reverified without rebroadcasting and opened through a fixed Solana Explorer route.
- A fresh Mainnet-only SQLite database stores settings and non-secret wallet metadata. The previous Devnet database is not loaded.

## Windows release gates

- `npm run dist:desktop:win:qa` creates and audits an unsigned Windows x64 unpacked application for internal QA. It intentionally does not create an unsigned NSIS installer.
- `npm run dist:desktop:win` is the production path. It requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, enables electron-builder `forceCodeSigning`, audits the package, and generates checksums.
- Windows QA launches the packaged executable with an isolated profile and verifies that the React renderer and restricted preload bridge start successfully.
- The signed-release workflow additionally requires a valid Authenticode result. Certificates and passwords are supplied through CI secrets and never committed.

See [the Phase 0 baseline](docs/PHASE_0_BASELINE.md), [Phase 1 production hardening](docs/PHASE_1_PRODUCTION_HARDENING.md), [Phase 2 validation matrix](docs/PHASE_2_VALIDATION_MATRIX.md), [the venue product architecture](docs/VENUE_PRODUCT_ARCHITECTURE.md), and [the current desktop architecture](docs/desktop/MAINNET_DESKTOP_ARCHITECTURE.md) before adding privileged capabilities.

Future work is tracked in the [prioritized Mainnet product roadmap](docs/desktop/MAINNET_PRODUCT_ROADMAP.md). It places fee and state correctness, security review, recovery, and signed-release gates ahead of scheduled or autonomous trading features.

The legacy Pump/PumpSwap pilot is documented separately in [Pump.fun implementation status](docs/desktop/PUMPFUN_IMPLEMENTATION_STATUS.md). It is not the new Token Launch lane.

## Requirements

- Node.js 24.15 or newer
- npm workspaces

## Setup and commands

```bash
npm install
npm run setup:electron

npm run dev:web
npm run dev:desktop
npm run typecheck
npm test
npm run build:desktop
npm run dist:desktop:win:qa
```
