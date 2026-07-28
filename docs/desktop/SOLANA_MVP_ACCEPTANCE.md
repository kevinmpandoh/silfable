# Solana Desktop MVP acceptance runbook

## Purpose and release boundary

This runbook is the acceptance procedure for the **manual, restricted Solana desktop MVP**. It is not a blanket production-release approval and it does not authorize a Mainnet transaction. The wallet owner must approve every signing action at the time it is proposed.

The supported MVP path is deliberately narrow:

- verified Solana wallet reads and portfolio refresh;
- Jupiter quote, unsigned simulation, and a manually approved Jupiter swap;
- Pump.fun Token Launch through the restricted SOL-paired, zero-initial-buy `create_v2` path;
- Pump.fun / PumpSwap read-only analysis and the restricted, per-transaction assisted-trading pilot;
- Jupiter Trigger V2 limit-order creation and cancellation, each with a separate simulated vault transaction and final approval.

Bridge, EVM / Robinhood Chain execution, Hyperliquid execution, unattended DCA or TP/SL, autonomous token selection, and approval-bypass `Full Access` are outside this MVP. Do not enable or market those paths as live.

## Preconditions

1. Use the signed QA desktop build, an isolated OS profile, and a dedicated Mainnet wallet. Fund it only with an amount you are prepared to lose during testing.
2. Set conservative transaction settings before beginning: a low slippage ceiling, a small maximum network-fee ceiling, a fee-percentage ceiling, and the `Economy` priority preset unless a higher priority is required for the test.
3. Configure only the required Mainnet RPC, Jupiter API key, and inference provider. Confirm they appear as configured in Settings. Never place a secret key, seed phrase, provider credential, or master password in a chat prompt, screenshot, or log.
4. Confirm the global emergency stop is disengaged. Test it once with a prepared action: it must block execution immediately.
5. Confirm the desktop vault opens with the master password and that the selected wallet address, SOL balance, snapshot slot, and timestamp agree with a public explorer.

## Rules for every live test

- Use one action at a time and record its public signature, slot, time, amount, fee classification, and outcome.
- A quote, policy check, or simulation is **not** a transaction. It must say unsigned/no broadcast until the final approval step.
- Re-read the fee panel before final approval. Stop when the fee status is `High` or `Extreme`, when rent/account funding is unexpected, or when the total wallet outflow exceeds the limit you set.
- Never retry an unknown broadcast. Copy its signature, restart if necessary, then use the read-only verify/reconcile action. A second broadcast is a separate transaction and is not an acceptable recovery action.
- If any result differs from the wallet, explorer, or expected direction, stop and preserve only redacted evidence. Do not continue to another venue.

## Acceptance sequence

### A. Read-only wallet baseline

1. Start a restricted session and ask for the selected wallet balance/activity.
2. Confirm the right panel shows the same public wallet and a fresh snapshot slot/time.
3. Restart the application, unlock the vault, reopen the session, and confirm encrypted session history and the public wallet address remain available.

**Pass:** no secret is displayed; the observed balance and activity are finalized read evidence.

### B. Jupiter swap, minimum-value controlled test

1. Create a restricted mission with the already selected wallet.
2. Request a very small, explicit pair such as `SOL to USDC`; include amount, maximum slippage, and an explicit deadline. Do not ask the agent to infer an amount.
3. Confirm the mission contract binds the registered wallet, exact mint pair, raw input amount, slippage, and deadline.
4. Run simulation. Confirm it remains unsigned/no broadcast, passes program/policy/fee checks, and shows network fee, account/rent funding (if any), and expected wallet outflow.
5. At final approval, recheck the route and fees, type the exact confirmation phrase, enter the master password, and acknowledge the real Mainnet transaction.
6. After submission, wait for independent finalization. Confirm receipt status, public signature, actual network fee, actual output, actual slippage, and total wallet outflow. Verify the signature in a public explorer.
7. Restart the application and confirm the encrypted receipt and refreshed token balance survive.

**Negative cases:** insufficient balance, fee above configured ceiling, stale simulation, invalid deadline, and emergency stop must block before signing.

### C. Pump.fun Token Launch, minimum-outflow controlled test

1. Use a dedicated disposable QA creator wallet. Prepare immutable public metadata through the system-managed Pinata/IPFS path and inspect the resulting CID, URI, image, name, symbol, description, and public links before continuing.
2. Create a Token Launch draft with SOL pairing and zero initial purchase. Keep creator-outflow and priority-fee caps conservative, but high enough for required account funding. Do not enable optional modes whose on-chain specification is not pinned.
3. Run preflight. Confirm it binds the official Pump program, exact `create_v2` discriminator/accounts, creator and volatile mint signers, Token-2022, immutable metadata digest, no address lookup table, compute ceiling, fee/rent estimates, total outflow ceiling, finalized balance, and expiry.
4. Run final revalidation immediately before approval. Confirm the blockhash, balance, fee, invoked programs, transaction digest, and unsigned simulation are fresh and unchanged.
5. Enter the master password, type `LAUNCH TOKEN MAINNET`, acknowledge the irreversible public launch, and approve exactly one signing operation and one broadcast attempt.
6. Verify the encrypted receipt independently. It must bind the public signature and mint, prove the mint was newly funded and owned by Token-2022, and show actual network fee, newly funded account total, creator pre/post balance, total creator outflow, finalized slot, and verification time.
7. Compare the receipt with a public explorer. Restart the application, unlock the vault, reopen the session, and verify that the same receipt is retained.

**Negative cases:** an expired/reused preflight, changed digest, insufficient balance, fee/outflow above the configured cap, emergency stop, incorrect password/phrase, unexpected program, missing mint account, previously funded mint, and unknown broadcast must fail closed. Unknown broadcast recovery may query only the locally derived signature and must never rebroadcast.

**Pass boundary:** this validates one controlled manual launch only. It does not authorize AI auto-launch, auto-buy, unattended signing, Mayhem Mode, or a general production release.

### D. Pump.fun / PumpSwap assisted-trading pilot

1. Create an explicit Pump.fun session for one exact mint; do not use discovery as an authority to buy.
2. Inspect finalized token, curve/pool, token-program, reserve, liquidity, authority, and risk evidence. Reject a token when eligibility/risk checks do not pass.
3. Prepare the minimum permitted buy or sell. Confirm the request contains one exact mint, one direction, one bounded amount, a slippage limit, and a deadline.
4. Run the unsigned simulation and inspect the fee/rent/compute/program evidence. It must report no signing and no broadcast.
5. Perform final revalidation. It must use fresh finalized state; expiry, reuse, suspend, or restart requires a fresh simulation.
6. Only then use the final password/phrase acknowledgement to authorize one restricted transaction. Verify the persisted receipt, exact mint delta, SOL delta, network fee, and account funding after finalization.
7. Repeat a minimum-value exit only after the buy receipt is verified. Do not claim live buy/sell readiness until both controlled QA cases pass in the signed build.

### E. Jupiter Trigger V2 limit-order pilot

1. Draft one small limit order with explicit input/output assets, trigger, amount, max slippage, and expiry.
2. Simulate the exact vault deposit. Validate the authenticated Trigger vault, sole signer/program inspection, fee guard, and expected SOL effect. The simulation must be unsigned/no broadcast.
3. Final approval requires the master password, `CREATE LIMIT ORDER`, and acknowledgement that a real vault deposit and order creation will be submitted.
4. Verify the order/deposit receipt on-chain and reopen it after restart. The Main process writes the execution receipt into encrypted session history before returning it to the UI.
5. For cancellation, simulate the exact withdrawal first. Final cancellation requires the password, `CANCEL LIMIT ORDER`, and a separate acknowledgement. Verify the cancellation receipt after restart.

**Pass:** creation/cancellation receipts persist even if the renderer closes immediately after the Main process receives the result. **Fail safe:** unknown receipts are reconciled read-only and are never rebroadcast.

## Stop and incident conditions

Stop immediately if there is an unexpected recipient/program, a fee/rent mismatch, incorrect token delta, stale/failing simulation, unknown broadcast, RPC/provider disagreement, wallet mismatch, or any plaintext secret in an artifact. Engage the emergency stop for a suspected signer or policy issue. Follow [Incident response](INCIDENT_RESPONSE.md), preserve redacted public identifiers, and do not retry a mutation.

## Evidence required for MVP sign-off

- build version/commit and signed-QA environment;
- redacted screenshots of the policy, simulation, final approval, and finalized receipt;
- public transaction signature, slot, and explorer confirmation for each controlled case;
- before/after wallet snapshots with slot/time;
- fee/rent/outflow comparison and configured ceilings;
- proof that emergency stop and each negative case blocked before signing;
- proof that restart recovery retained encrypted receipts without rebroadcast.

Completion of this runbook supports a controlled Solana MVP pilot only. Broader venue activation still requires the independent evidence gates in [Per-venue controlled Mainnet acceptance](VENUE_CONTROLLED_ACCEPTANCE.md).
