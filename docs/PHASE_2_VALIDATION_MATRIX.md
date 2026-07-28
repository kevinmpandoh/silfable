# Phase 2 validation matrix

Date: 2026-07-28
Status: automated evidence implemented; signed Windows and controlled Mainnet acceptance pending

## Scope

Phase 2 validates the restricted Solana desktop path rather than enabling a new
venue or autonomous authority. It covers:

- Jupiter SOL-to-token and token-to-SOL directions;
- balance, quote, route, fee, signer, and broadcast failure boundaries;
- account/rent funding and total SOL wallet-impact evidence;
- encrypted receipt restart recovery;
- portfolio reconciliation at or beyond the receipt slot;
- a build-bound Windows QA evidence package.

EVM, Bridge, Hyperliquid, scheduled missions, autonomous trading, and
approval-bypass Full Access remain outside this phase.

## Code-complete evidence

### Reverse direction and deterministic blocking

- USDC-to-SOL quote policy and unsigned simulation are covered.
- Insufficient finalized SOL or SPL balance blocks before transaction
  construction.
- A changed route/output floor blocks during final revalidation.
- Read RPC retries are bounded; mutation/broadcast remains single-attempt.
- An unknown broadcast preserves the locally derived signature and can only
  enter read-only verification.

### Fee and account-funding evidence

- The selected wallet's confirmed pre-simulation balance is bound to the
  unsigned Jupiter transaction.
- Solana returns the same wallet's simulated post-balance.
- Network fee, SOL trade input, residual account/rent funding, and estimated
  total wallet outflow are separated before signing.
- Missing post-simulation wallet evidence blocks safely.
- Excessive absolute fee or fee percentage blocks before the vault signer can
  be opened.
- Final pre-sign simulation must not increase account funding or total wallet
  outflow above the reviewed simulation.
- Confirmed receipts retain actual network fee, account funding, total wallet
  outflow, expected-versus-actual output, actual slippage, signature, and slot.

### Windows evidence boundary

`npm.cmd run qa:desktop:p2:win` creates:

- a host-path-free `manifest.json` bound to the executable SHA-256;
- a nine-case `cases.json` template;
- an isolated runtime profile;
- a local README containing the validation command.

The evidence schema accepts only bounded status, timestamps, public
transaction signatures, relative artifact names, and short notes. It rejects
host paths, build mismatches, credential-shaped notes, and incomplete
acceptance when `--complete` is requested.

Validated on 2026-07-28:

- typecheck passed for every workspace;
- 346 automated tests passed: 11 cloud-worker, 323 desktop, 9 web, and 3
  build-bound P2 evidence tests;
- lint passed;
- production builds passed for cloud-worker, desktop, and web;
- the desktop privilege and Pump.fun production-boundary audit passed;
- the Next.js production build generated all 28 web routes successfully.

Validate a working evidence directory with:

```powershell
npm.cmd run qa:desktop:p2:validate -- artifacts/p2-windows/<timestamp>
```

Require all nine cases to pass with:

```powershell
npm.cmd run qa:desktop:p2:validate -- artifacts/p2-windows/<timestamp> --complete
```

## Evidence still required

The following require a packaged/signed application, a controlled environment,
or an explicit wallet-owner decision:

1. launch and restart of the audited unpacked QA build on Windows;
2. clean-profile vault recovery and settings/session restoration;
3. controlled RPC timeout and accepted-request/unknown-response proxy cases;
4. portfolio refresh at or beyond a real confirmed receipt slot;
5. first-time token-account funding followed by a repeat path without a false
   second rent charge;
6. optional minimum-value USDC-to-SOL Mainnet execution;
7. a signed Authenticode executable and NSIS installer on a clean machine;
8. independent review of the redacted evidence package.

No live transaction is implied by Phase 2 code completion. Until the required
signed-build and recovery evidence passes, the desktop remains a
**production candidate**, not general production-ready.
