# Mainnet Desktop Architecture

## Product boundary

The desktop application has one runtime profile: `mainnet-guarded`. It provides secure local configuration, wallet identity, verified Mainnet balances, optional integrations, OpenRouter-backed AI chat, typed mission contracts, explicitly approved simulations, and restricted Jupiter swap execution. Pump.fun support currently includes bounded research/discovery, proposal-only buy/sell contracts, unsigned Pump v2 construction/simulation, and final revalidation; Pump.fun signing and broadcast are not connected. It does not provide autonomous execution, Full Access, faucet access, or Devnet simulation.

The detailed Pump.fun capability matrix and remaining safety gates are maintained in [Pump.fun implementation status](PUMPFUN_IMPLEMENTATION_STATUS.md).

This distinction is intentional. Selecting or importing a wallet gives a session an identity and future authorization target; it does not grant the AI access to its secret or authorize a transaction.

## First-run flow

1. **System check** verifies the desktop runtime and its fixed Mainnet safety boundary.
2. **Security** creates or unlocks the encrypted local vault.
3. **Wallets** creates or imports one or more Solana Mainnet wallets. Mnemonic and private-key import are supported; secrets are encrypted before persistence.
4. **Integrations** stores optional Jupiter and Tavily API keys in the vault.
5. **Agent core** configures context, output, temperature, and advanced subagent limits.
6. **Provider** validates an OpenRouter key, loads available models, and persists the selected model.
7. **Review** summarizes configuration and becomes the settings hub after onboarding.

After setup, the session workspace exposes session creation, chat, memory, missions, settings, wallet context, and runtime/cost panels. Settings returns to the review hub. Editing a section returns to review, and review returns to sessions.

On every later renderer launch, the application shows the system check and then requires the previously configured master password. A successful main-process `scrypt` verification unlocks the OS-backed keystore. Closing or minimizing to the tray locks the vault; reopening reloads the renderer and repeats the check and unlock flow. All secret-bearing IPC handlers fail closed while locked.

## Main-process services

The active Electron main process owns only:

- the hardened browser window and lifecycle;
- OS-backed encrypted secret storage;
- the Mainnet settings and wallet-metadata database;
- wallet creation/import/list operations;
- Jupiter Price API V3, Tokens API V2, quote-only Swap V2 orders, guarded unsigned Swap V2 order construction, and Tavily read-only evidence adapters;
- Solana Mainnet finalized SOL and SPL-token balance reads;
- OpenRouter model discovery, provider settings, restricted chat with encrypted session context, and an allowlisted read-only tool loop;
- deterministic mission policy checks for wallet registration, pair and amount validity, guarded slippage, deadline, finalized balance, and transaction-free quotes;
- a simulation boundary that refreshes policy evidence, inspects the unsigned transaction's sole signer and allowlisted programs, and calls Solana `simulateTransaction` without signature verification or broadcast;
- a one-time execution boundary that accepts only the exact transaction cached by a passed simulation, rechecks policy and the master password, signs locally, submits through Jupiter `/execute`, independently queries Solana signature status, and persists the receipt.
- a Pump.fun read-only intelligence boundary, bounded finalized scanner, exact-mint proposal policy, local Pump v2 codec/inspector, unsigned RPC simulator, one-time final-revalidation cache, and finalized-only future-receipt reconciler. None of these Pump services can currently request a signature or broadcast.

There is no Devnet RPC client, faucet request, fixture provisioner, canary executor, scheduler, DCA service, market shadow service, autonomous signing loop, or generic broadcast service in the active codebase.

## IPC surface

The preload bridge exposes only these operations:

- runtime status;
- vault unlock;
- create/import/list wallets;
- read/save Jupiter settings;
- read/save Tavily settings;
- fetch a verified portfolio for a wallet registered on this device;
- read/preview/save OpenRouter settings;
- restricted AI chat.
- mission simulation for a mission artifact already stored in encrypted session history.
- Pump.fun unsigned simulation and final revalidation by encrypted session and proposal identifiers. These requests contain explicit no-execution acknowledgements and cannot carry a password, transaction bytes, signer flag, or broadcast flag.
- one-time mission execution requiring the matching simulation ID, master password, exact `EXECUTE MAINNET` phrase, and irreversible-action acknowledgement.
- receipt verification by encrypted session, mission, and receipt identifiers; signature copy; and a fixed Solana Explorer transaction opener.

Every request and response is parsed by strict shared schemas. The renderer never receives decrypted keys, transaction bytes, Jupiter request IDs, or a generic IPC escape hatch. Simulation and execution requests identify encrypted artifacts instead of supplying arbitrary transaction parameters from the renderer.

## Data model

The current database stores only application settings and non-secret wallet metadata. Secret values live in the encrypted keystore. The runtime opens `silfable-mainnet.sqlite3`; historical Devnet databases are not opened or migrated into this profile.

## AI role

The AI is an analyst and planning assistant. It can explain portfolio or trading concepts, use bounded encrypted session history, search Jupiter token metadata, inspect wallet balances and recent finalized activity, request price or quote evidence, and propose a typed mission contract preview. Tool output is treated as untrusted evidence, the tool round is bounded, and no credential is placed in the prompt. Mission previews are independently checked by the main-process policy service, saved with encrypted session history, and explicitly set `executionAllowed: false`.

Only after a separate user acknowledgement may the deterministic main-process simulation service—not the AI—request an unsigned order, verify its signer and program scope, and simulate it. A passed simulation is cached for at most 90 seconds and does not itself authorize execution.

Restricted execution requires another policy refresh, the current master password, an exact confirmation phrase, and an irreversible-action checkbox. The cached transaction is consumed before signing so it cannot be submitted twice through the application. The selected wallet signs locally; neither key material nor transaction bytes cross the preload boundary. Jupiter's result is not treated as final by itself: the application queries Solana `getSignatureStatuses` with transaction-history search and records confirmation state, slot, error, and verification time. The confirmed, failed, or unknown receipt is saved in encrypted session history and can be rechecked without signing or broadcasting again. Unknown results must be checked on-chain before any new attempt.

The renderer can copy a validated signature or ask the main process to open its constructed `https://explorer.solana.com/tx/<signature>` URL. It cannot submit an arbitrary external URL, and receipt verification contains no rebroadcast field or authority.

For Pump.fun, the AI may analyze exact mints and create typed proposal-only contracts only inside the permitted session scope. Deterministic research eligibility, risk checks, transaction inspection, simulation, and final revalidation run outside the model. The AI cannot see private keys or raw transactions, call the signer, bypass confirmation, or claim that an action succeeded without a structured execution receipt. Pump.fun live execution and all autonomous execution remain unavailable.

## Windows distribution gate

Windows releases use an x64 NSIS installer with the application ID `ai.silfable.desktop`. Internal QA packages may be unsigned, but the production command fails unless signing credentials are injected through environment or CI secrets and electron-builder successfully signs the application and installer. CI then verifies Authenticode, audits packaged ASAR contents for secrets and development artifacts, launches the unpacked application with an isolated profile, checks the renderer and preload bridge, and publishes a SHA-256 checksum alongside the artifact.
