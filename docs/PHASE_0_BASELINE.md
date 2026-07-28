# Phase 0 baseline

Date: 2026-07-28
Status: complete

## Purpose

Phase 0 freezes a coherent, testable starting point for the remaining delivery
phases. It does not activate a new Mainnet venue or relax an existing release
gate.

## Product lanes

The product and shared contracts now distinguish these lanes:

1. **Pump.fun Token Launch** — create a new Solana token through a restricted,
   manually approved launch flow.
2. **Jupiter Solana Swap** — swap existing Solana assets through the guarded
   desktop execution flow.
3. **EVM Swap** — swap exact EVM assets through a chain-specific, verified
   router. The Robinhood Chain/0x implementation remains release-locked.
4. **Bridge** — move an exact asset between two chains. It remains quote-only.

Research has no transaction authority. Existing Pump.fun/PumpSwap buy/sell
sessions are retained as the separate `legacy-pump-pilot` compatibility lane
and are never reinterpreted as Token Launch.

## Frozen safety boundaries

- Runtime remains Mainnet-only and guarded; Devnet services are not restored.
- AI may draft typed proposals but cannot bypass deterministic policy,
  simulation, final revalidation, signer boundaries, or explicit approval.
- Every mutable lane uses its own typed contract and execution gate.
- A renderer state, AI response, API credential, or successful quote cannot
  activate a release-locked venue.
- Bridge has no signing or broadcast path.
- Web token metadata publication has no wallet signer or Pump transaction
  authority.
- Local QA installers and packaging output are excluded from source control.

## Validation evidence

The baseline was validated from the repository root:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed for desktop main/preload, desktop renderer, web, and contracts |
| `npm test` | 328 tests passed: 11 cloud worker, 308 desktop, 9 web |
| `npm run lint` | Passed |
| `npm run build` | Passed for cloud worker, desktop, and web |
| Desktop bundle privilege audit | Passed |
| Next.js production build | Passed; 28 routes generated |

The local Electron packaging directories `apps/desktop/release-qa/` and
`apps/desktop/release-qa-*/` are build/QA evidence, not source artifacts, and
are ignored by Git.

## Explicit non-claims

This baseline is not full production approval. The following still require
their later phase gates and controlled acceptance evidence:

- signed installer and code-signing acceptance;
- controlled Mainnet Token Launch acceptance;
- complete Jupiter recovery/security acceptance;
- EVM venue activation;
- executable bridge;
- unattended automation or approval-bypass Full Access.

The authoritative lane definitions and delivery order are in
[Venue Product Architecture](VENUE_PRODUCT_ARCHITECTURE.md). Solana controlled
acceptance is defined in
[Solana Desktop MVP acceptance](desktop/SOLANA_MVP_ACCEPTANCE.md).
