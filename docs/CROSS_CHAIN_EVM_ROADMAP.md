# Silfable EVM Swap & Bridge Roadmap

Last updated: 2026-07-28
Status: restricted Robinhood Chain/0x desktop execution pipeline implemented but release-locked; Bridge execution remains disabled.

This roadmap implements the [Venue Product Architecture](VENUE_PRODUCT_ARCHITECTURE.md). The product lanes are deliberately separate:

- Pump.fun — Token Launch;
- Jupiter — Solana Swap;
- verified Uniswap-compatible deployment — EVM Swap;
- route-specific provider — Bridge.

Robinhood Chain is the first implemented EVM pilot target. The desktop uses 0x Swap API firm quotes for chain `4663`; it does not assume that an Ethereum Uniswap address exists on Robinhood Chain and it never hardcodes the 0x settlement target.

## 1. Target EVM boundary

The first EVM MVP supports exactly **Robinhood Chain (`4663`) through a verified 0x firm-quote boundary**. It does not add a generic EVM execute endpoint, Cloud Worker signing, automatic trading, or an unlimited ERC-20 approval.

The desktop main process must own EVM construction, policy, simulation, signing, broadcast, and receipt recovery. Web uses a connected browser wallet and each transaction requires wallet approval. Cloud Worker stays monitor/proposal-only.

The desktop product flow now starts inside an EVM wallet-scoped **Mission** session:

1. the user supplies the exact sell-token contract, buy-token contract, and raw sell amount in chat;
2. the AI may call only the typed `robinhood_swap_quote` tool and stores a quote-only proposal in encrypted session history;
3. the proposal card asks the main process to prepare a fresh firm 0x review and one-time preflight;
4. if allowance is insufficient, the user reviews and confirms a separate exact ERC-20 approval;
5. after approval, the original preflight is consumed and the user must prepare a fresh quote/preflight;
6. the swap receives its own password, exact confirmation phrase, and irreversible acknowledgement;
7. typed approval/swap receipts are persisted with the session while the encrypted receipt service remains the recovery source of truth.

Settings are configuration-only: EVM wallets, Robinhood RPC, 0x API key, and global Transaction Settings. Settings do not initiate or authorize a trade.

## 2. Required contract and data model

Introduce a lane-specific `evm-swap` contract rather than adding ad-hoc fields to an existing Solana session:

- selected chain ID and verified RPC identity;
- EVM wallet address;
- exact input/output ERC-20 contracts and decimals;
- pinned router, factory, quoter, wrapped-native asset, and code-hash evidence;
- raw input amount, minimum output, slippage, expiry, native gas reserve;
- maximum gas units, maximum fee per gas, maximum total native fee, and maximum fee percentage;
- exact allowance policy and transaction/receipt lifecycle.

All amounts are string base units with decimal metadata. Never globally rename existing `lamports` fields without an explicit migration. EVM key material is held only in the desktop local vault; it is never stored in a database, chat history, renderer state, Cloud Worker, or browser server. The current desktop vault supports up to 20 EVM wallets generated from a mnemonic or imported by private key, with the first wallet retained as primary. A session may select any registered EVM wallet; quote, preflight, and local signer resolution are rebound to that exact address in the main process.

The restricted execution pipeline is now wired end to end in code:

1. verify Robinhood RPC chain ID `4663`;
2. resolve only allowlisted official Robinhood asset contracts;
3. request a 0x firm quote and require confirmed liquidity, a valid transaction target, and a single non-conflicting allowance spender;
4. bind wallet, sell token, quote, expiry, allowance state, and gas ceiling in a one-time preflight;
5. submit a separate exact ERC-20 approval when needed, then require a fresh quote/preflight;
6. recheck allowance, nonce, chain, gas, emergency stop, master password, and release gate before local signing;
7. broadcast once and persist an encrypted `unknown` receipt before waiting for confirmation;
8. reconcile an unknown receipt by transaction hash without rebroadcast.

Renderer input never supplies the spender, transaction target, calldata, or approval amount. Those values remain main-process-only and are derived from the validated one-time quote.

## 3. EVM implementation phases

### Phase A — Chain and deployment attestation

1. Select a single target chain.
2. Verify RPC chain ID, genesis/block context, and explorer URL.
3. Independently verify and pin router/factory/quoter/wrapped-native addresses plus bytecode hashes and supported pool version.
4. Store reviewer, timestamp, evidence digest, and revocation state in Main-process-only readiness state.
5. Fail closed if any pin, code hash, chain ID, or RPC evidence changes.

### Phase B — Read-only assets and quotes

1. Read native and ERC-20 balances with exact decimals.
2. Resolve only user-provided exact token addresses; symbol lookup is display-only.
3. Obtain route/quote evidence from the verified quoter.
4. Show route, expected/minimum output, price impact, token tax/unsupported-token warnings, and separated gas estimate.
5. No transaction builder or signer at this phase.

### Phase C — Restricted swap

1. Construct the exact calldata only for the attested router/version.
2. Run `eth_call`, `estimateGas`, and all deterministic allowance, balance, nonce, deadline, gas, fee, and allowlist checks.
3. If an allowance is needed, construct a **separate exact allowance** transaction. Never use `uint256.max` approval.
4. Present approval and swap as separate irreversible actions, each with an explicit user confirmation.
5. Revalidate quote, nonce, gas, code hashes, allowance, and all policy evidence immediately before signing.
6. Broadcast once, persist hash before awaiting RPC, and reconcile confirmed/reverted/replaced/unknown receipts without blind retry.

### Phase D — Recovery and production acceptance

1. Reconcile nonce replacement, dropped transaction, reorg, and partial allowance outcomes.
2. Provide allowance revoke/cleanup guidance and receipt detail.
3. Complete controlled minimal-value real-wallet acceptance in a signed desktop build.
4. Complete external review of signer scope, contract pins, calldata inspector, key storage, logs, dependency chain, and recovery behavior.

## 4. Bridge boundary

Bridge is not an EVM swap. A bridge contract must bind:

- source and destination chain IDs;
- source asset/amount and destination asset/minimum amount;
- destination recipient address;
- provider route and evidence digest;
- source gas, provider fee, relayer fee, destination fee, total fee cap, and expiry;
- timeout, refund, and destination-delivery lifecycle.

Implementation order:

1. Choose one provider and one chain pair.
2. Verify provider route schema and provenance; keep malformed/unavailable route responses fail-closed.
3. Display quote-only route, complete fee split, route expiry, destination address, and refund terms.
4. Add source transaction inspection/simulation and explicit signing only after the provider's source contract is pinned.
5. Persist a two-stage receipt: source finality and destination delivery/refund. Do not mark success from source broadcast alone.
6. Add stuck-transfer escalation, timeout polling, and no-rebroadcast recovery before production acceptance.

## 5. Shared controls

Every EVM Swap and Bridge action requires:

- emergency stop and revocation checks;
- per-venue readiness attestation;
- immutable typed policy and spend limits;
- fresh simulation and fee guard;
- explicit final user approval;
- one signing/broadcast attempt;
- structured human-readable receipt and independent recovery.

`Full Access`, autonomous trading, scheduled work, DCA, and TP/SL do not bypass any of these controls and are excluded from the EVM/Bridge MVP.

## 6. Definition of done

EVM Swap is not production-ready yet. The code path is complete through quote, exact approval, local signing, one-time broadcast, and encrypted receipt reconciliation, but `VenueReadinessService` deliberately keeps broadcast disabled until independent evidence is recorded. Remaining release work is signed-build minimal-value approval/swap acceptance, negative cases, dropped/replaced/reorg recovery, external security review, evidence attestation, and code-signed installer acceptance.

Bridge is not production-ready until one chain pair has passed source and destination lifecycle validation, timeout/refund recovery, fee disclosure, independent receipt reconciliation, external review, and controlled signed-build acceptance.
