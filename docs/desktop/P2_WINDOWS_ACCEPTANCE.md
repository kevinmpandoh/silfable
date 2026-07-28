# Windows P2 Mainnet acceptance

This checklist validates the packaged desktop application. Automated tests remain the primary safety proof; this pass verifies packaging, UI wiring, persistence, and controlled Mainnet behavior.

## Safety boundary

- Use a dedicated QA wallet containing only the minimum funds required.
- Never record a seed phrase, private key, master password, RPC credential, or API key in screenshots, terminal logs, or the evidence directory.
- Start with simulation-only cases. A live transaction requires a separate action-time decision by the wallet owner after reviewing the exact amount, output floor, fee, deadline, and signature scope.
- Never retry a timeout or unknown broadcast. Copy the locally derived signature and use **Verify on-chain** first.
- Stop immediately if the displayed wallet, mint, amount, fee ceiling, or program evidence differs from the intended test.

## Prepare the packaged build

1. Build the unsigned internal QA application folder:

   ```powershell
   npm.cmd run dist:desktop:win:qa
   ```

   This produces and audits `apps/desktop/release/win-unpacked`. It intentionally does not create an unsigned NSIS installer because Windows Application Control may block the unsigned NSIS bootstrap executable. It does not satisfy the production signing gate.

   The versioned NSIS installer is produced only by `npm.cmd run dist:desktop:win`, which requires signing credentials and enforces `forceCodeSigning=true`.

2. Optionally repeat the unpacked artifact audit:

   ```powershell
   node scripts/audit-windows-artifacts.mjs apps/desktop/release --unpacked-only
   ```

3. Launch with a new isolated profile and evidence manifest:

   ```powershell
   npm.cmd run qa:desktop:p2:win
   ```

The launcher only starts the application. It does not configure credentials, approve, sign, or broadcast a transaction.
It creates a host-path-free `manifest.json` bound to the executable SHA-256 and
a `cases.json` template containing P2-01 through P2-09. Record only the bounded
case status, UTC timestamp, public transaction signatures, relative screenshot
names, and a short redacted note.

Validate the evidence structure at any time:

```powershell
npm.cmd run qa:desktop:p2:validate -- artifacts/p2-windows/<timestamp>
```

After all cases pass, enforce the completion gate:

```powershell
npm.cmd run qa:desktop:p2:validate -- artifacts/p2-windows/<timestamp> --complete
```

The validator rejects build mismatches, host paths, unsafe artifact paths, and
credential-shaped notes. Screenshots must still be inspected manually because
image content is intentionally not parsed by the evidence tool.

### Application Control on unsigned QA builds

Some managed Windows hosts block every newly generated unsigned executable. Do not disable that policy. On such a host, the exact packaged ASAR can still receive a local renderer/preload smoke test through the trusted development Electron runtime:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-electron-windows.ps1 `
  -Executable apps/desktop/release/win-unpacked/silfable.exe `
  -AllowTrustedElectronFallback
```

This fallback validates the packaged application archive, renderer, and preload boundary; it is not evidence that the generated executable or installer can launch. The production gate still requires the signed executable and signed NSIS installer to pass smoke testing on a clean Windows machine without fallback.

## Acceptance cases

Record only status, timestamp, build hash, public address/signature, and redacted screenshots.

### P2-01 — Packaged startup and vault recovery

- Complete first-run setup in the isolated profile.
- Close and reopen the packaged application.
- Confirm System Check appears, followed by vault unlock rather than setup.
- Confirm wallets and settings appear only after unlock.
- Expected: no `Vault is locked` IPC noise, no missing session list, and no secret in logs.

### P2-02 — USDC to SOL reverse swap

- Use a wallet with a small verified USDC balance and enough SOL for network/account costs.
- Draft a restricted USDC→SOL mission with a small amount, explicit slippage, and deadline.
- Run simulation first.
- Confirm input/output mints, raw amount, expected SOL output, allowed programs, fee, and no signature/broadcast.
- Optional live execution is a separate wallet-owner decision; it is not part of the automated launcher.

### P2-03 — Insufficient balance

- Propose an amount larger than the finalized input-token balance.
- Expected: policy blocks before transaction construction, signing, or broadcast.
- Confirm the receipt/evidence says balance insufficient without raw JSON.

### P2-04 — Changed quote or route

- Simulate a small swap, then wait for the quote to change or use the controlled QA provider fixture.
- Attempt to continue only through the normal approval UI.
- Expected: fresh policy and final simulation block an output below the approved floor. The signer is not opened and no broadcast occurs.

### P2-05 — RPC timeout before signing

- In a controlled QA network, make the configured RPC unavailable before simulation.
- Expected: bounded retries end in a friendly blocked state. No signing or broadcast occurs.
- Restore RPC and use the explicit retry action.

### P2-06 — Broadcast result unknown

- Run only with a controlled proxy that can return a timeout after accepting one request.
- Expected: exactly one broadcast attempt; receipt status becomes `unknown`; the locally derived signature is available.
- Restart the app before checking.
- Use **Verify on-chain**. Never press an execution button again for the same transaction.

### P2-07 — Receipt restart recovery

- Reopen sessions containing successful, failed, and unknown receipts.
- Expected: signature, Explorer link, chain status, slot, verification time, fee evidence, and readable error return from encrypted history.
- For unknown swap, Pump, limit-order deposit, and cancellation receipts, verify by signature only.

### P2-08 — Portfolio reconciliation

- After a confirmed/finalized controlled transaction, wait for the right rail to refresh.
- Expected: portfolio snapshot slot is not older than the receipt slot.
- Confirm SOL, USDC/SPL amount, snapshot time, and recent activity reflect finalized evidence.

### P2-09 — Fee and account-funding evidence

- Confirm simulation separates network fee from token-account creation/rent funding.
- Confirm estimated total SOL wallet outflow includes the SOL input, network fee, and account funding without treating token input as an additional SOL fee.
- Repeat the exact final pre-sign simulation with a controlled higher account-funding or wallet-outflow fixture.
- Expected: any increase above the reviewed values blocks before the vault signer opens.
- Confirm fee is shown in lamports and SOL; USD and percentage appear when price evidence is available.
- Confirm configured fee ceilings block execution before signing.

## Pass criteria

P2 is accepted only when all non-live cases pass in a packaged build and every intentionally executed minimum-value transaction has:

- explicit restricted approval;
- exact locally bound signer and transaction digest;
- one broadcast attempt;
- independently verified signature and finalized slot;
- encrypted receipt recovery after restart;
- reconciled portfolio at or beyond the receipt slot.

An unsigned internal QA build may validate functionality, but production release still requires valid Authenticode signing, clean-machine recovery testing, artifact audit, and external security review.
