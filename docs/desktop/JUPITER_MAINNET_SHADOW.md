# Jupiter Mainnet Shadow

## Purpose

Mainnet Shadow is an observation-only bridge between the Devnet safety foundation and future guarded execution. It obtains real SOL/USDC market routes from Jupiter while preserving the invariant that this profile cannot construct, sign, or broadcast a transaction.

This is not paper trading and is not an execution preview. It is a short-lived market quote plus a local Desk Rule-style validation receipt.

## Provider boundary

- Endpoint: `GET https://api.jup.ag/swap/v2/order`.
- Pair: native SOL mint and mainnet USDC mint only.
- Mode: `ExactIn` only.
- Authentication: user-owned Jupiter API key in the `x-api-key` request header.
- The request intentionally omits `taker`. Jupiter therefore returns quote data with `transaction: null`.
- Timeout: eight seconds, one attempt, no automatic retry.
- The API key is stored in the OS-backed keystore and is never returned through IPC or written to SQLite.

## Fail-closed validation

The main process validates the untrusted provider response before it reaches the renderer. A quote is denied when any of these conditions occurs:

- input/output mint or exact input amount differs from the request;
- mode is not `ExactIn`;
- a transaction is unexpectedly returned;
- route is empty or its allocation does not total 100%;
- provider slippage, price impact, or fees exceed the user's local cap;
- output or minimum-output threshold is invalid.

Every view explicitly reports `signingAttempted: false` and `broadcastAttempted: false`. Quotes expire locally after ten seconds.

## Storage and IPC

The renderer can configure/delete a key, request a bounded quote, and list the latest 20 observations through versioned, schema-validated IPC. It has no generic HTTP proxy and cannot choose an endpoint, mint, taker, router, or arbitrary query parameter.

Validated quote views are encrypted with the local database data key before insertion into `jupiter_shadow_quotes`. The table retains only ciphertext metadata plus non-sensitive allow/deny and timestamp indexes.

## Explicitly out of scope

- transaction creation or serialized transaction persistence;
- wallet address (`taker`) disclosure to Jupiter;
- signatures, broadcasts, swaps, approvals, or automatic DCA execution;
- arbitrary tokens, routes, providers, or mainnet RPC access;
- retries, background polling, or quote-triggered actions.

Adding any item above requires a new reviewed milestone, threat-model update, dedicated IPC contracts, transaction simulation, hard value caps, and separate guarded-execution tests.
