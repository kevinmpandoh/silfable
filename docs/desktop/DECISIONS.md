# Silfable Desktop — Final Decisions

Status: approved for implementation.

## Product and platform

- Desktop runtime: Electron.
- Repository: npm workspaces monorepo.
- Initial operating system: Linux.
- Packages: AppImage and Debian (`.deb`).
- Architectures: x64 and ARM64.
- Display stacks: Wayland and X11.
- QA baseline: Ubuntu 22.04 LTS and Ubuntu 24.04 LTS.
- Window close may minimize to system tray; explicit Quit stops the runtime.

## Network and execution

- Blockchain: Solana.
- Development profile: Devnet Simulation.
- Pre-production profile: Mainnet Shadow (real quotes, no signing).
- Production proving profile: Mainnet Guarded Beta with small dedicated funds.
- Trading venue: Jupiter Aggregator only.
- Jupiter is treated as Mainnet-only; Devnet uses a deterministic adapter and SPL test transactions.
- Automatic signing is permitted only after every Desk Rule check passes.
- Every execution must quote, validate, simulate, revalidate freshness, sign, broadcast, confirm, and write a receipt.
- A network drop, stale observation, simulation failure, ambiguous state, or unavailable receipt store halts the mission.
- Missions never resume automatically after crash, reboot, suspend, update, or network loss.

## Wallet and secrets

- Wallet flows: create new, import mnemonic, and import private key.
- Silfable is a hot wallet; the UI must recommend a dedicated mission wallet.
- Private keys and AI provider keys live in a separate encrypted local keystore, never in SQLite.
- Secrets remain unlocked in memory while an authorized mission is active.
- Suspend, logout, explicit lock, and application quit halt missions and lock the keystore.
- Screen lock alone does not stop an active mission.
- Sensitive SQLite fields are encrypted with an application data key derived from the keystore.

## AI runtime

- Hybrid external AI using user-provided OpenAI and/or Anthropic credentials.
- Provider access is behind a common adapter.
- Models produce validated structured intents, never raw Solana instructions, filesystem paths, shell commands, or IPC commands.
- The deterministic mission engine, not the model, builds and authorizes transactions.

## Auto DCA

- Version one uses a local deterministic DCA scheduler.
- Jupiter Recurring API is deferred as a separate future mode.
- AI may draft or explain a DCA plan but cannot mutate an authorized plan.
- Missed cycles are skipped, never accumulated.
- Default minimum interval is one hour.
- Any execution uncertainty halts the DCA mission and requires manual resume.

## Operations

- Updates are notify-and-review; no forced restart or automatic mission restart.
- Crash reporting is strict opt-in and redacts secrets, wallet addresses, balances, transaction payloads, and strategy data.
- CI and releases use GitHub Actions and GitHub Releases.
- Builds cover x64/ARM64 and AppImage/DEB.
