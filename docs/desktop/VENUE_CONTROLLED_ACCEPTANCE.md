# Per-venue controlled Mainnet acceptance

This procedure creates the evidence required to open an execution venue. It does not authorize an operation itself and must never be replaced by a renderer setting, AI instruction, or a manually toggled `Full Access` flag.

## Universal rules

- Use a dedicated QA wallet with only the minimum required funds.
- One venue, one route/market, one small amount, one explicit approval at a time.
- Never retry an unknown broadcast. Persist the locally derived signature, restart the application, then reconcile read-only.
- Store only public signature/hash, build hash, timestamp, evidence digest, redacted screenshot, and outcome. Never store secret keys, seed phrases, passwords, API keys, full provider responses, or transaction payloads in the evidence record.
- Any mismatch, stale simulation, unknown signer, fee-limit breach, provider disagreement, or recovery failure invalidates the venue readiness record.

## Evidence that must exist for every venue

1. **Signer custody:** isolated signer scope; no renderer or AI access to raw key material.
2. **Policy:** wallet, asset, venue, capital, frequency, fee, and expiry limits are deterministic.
3. **Fresh simulation:** bound to the exact signer, route, amount, and current network state.
4. **Receipt reconciliation:** a finalized receipt updates balances/position without trusting provider-only status.
5. **Recovery drill:** restart during pending/unknown state and recover by public identifier without rebroadcast.
6. **Security audit:** reviewer records the code/build revision and reviewed attack surface.
7. **Controlled Mainnet acceptance:** a minimum-value live case succeeds and a negative case blocks before signing.
8. **Final approval:** exact amount, fee, and route need a user-owned approval at action time.
9. **Revocation and kill switch:** prove immediate block while a prepared action exists, then prove safe recovery.
10. **Spend limits:** prove per-operation and rolling-period ceilings block deterministically.

## Bridge

- Start with one provider and one route only, for example a verified Solana-to-EVM USDC route.
- Validate source/destination chain IDs, token addresses, recipient address, bridge protocol, source fee, destination fee, expected output, refund/timeout terms, and route expiry.
- Simulate/read-only validate before signing; after broadcast reconcile both source and destination transaction identifiers.
- Required negative cases: wrong destination chain, output token mismatch, route expiry, provider outage, source confirmed but destination pending, timeout/refund.

## EVM / Robinhood Chain

- Pin the verified router or aggregator deployment, bytecode hash, chain ID `4663`, allowed token addresses, and selector allowlist.
- Demonstrate nonce retrieval, EIP-1559 gas cap, fee ceiling, allowance policy with no unlimited approvals, `eth_call`/estimate simulation, one local signature, one broadcast, and finalized receipt.
- Required negative cases: RPC chain mismatch, router bytecode mismatch, approval above policy, nonce conflict, gas/fee above cap, unknown broadcast, and restart reconciliation.

## Hyperliquid

- Start with a single market and minimal size; choose spot or perpetuals, not both.
- Verify canonical asset ID, venue signing domain, API-wallet approval, nonce, expiry, reduce-only behavior, leverage/margin cap, and cancel path.
- Reconcile venue order state, fills, collateral, and position after restart; provider metadata alone is not execution evidence.
- Required negative cases: stale nonce, expired action, wrong asset ID, leverage above cap, insufficient margin, partial fill, cancel race, and venue/API outage.

## DCA and TP/SL

- Begin as monitor/proposal-only. Each trigger must create a new bound proposal from fresh price, route, simulation, and policy evidence.
- Before any unattended mode, prove scheduler persistence, deduplication after restart, clock-skew behavior, expiry, pause/resume, spend limits, max entries, loss limits, and emergency stop.
- The first execution mode remains approval-required. A future delegated mode may only use an expiring scoped signer with independent daily/per-trade limits; `Full Access` never removes these limits.

## Recording readiness

When the independent review is complete, a Main-process release workflow may record a `VenueReadinessAttestation` containing all ten evidence flags, an immutable SHA-256 digest of the redacted evidence package, reviewer identity, and timestamp. The application must invalidate it when any provider, router, signer, policy, build, or security finding changes.

No current UI/API is permitted to create this attestation. Adding one requires a separate authenticated release-administration boundary and security review.
