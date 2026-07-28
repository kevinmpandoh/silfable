# Solana program allowlist change control

Status: release-controlled
Applies to: Jupiter Solana Swap and Pump.fun Token Launch

## Source of truth

The executable source of truth is
`apps/desktop/src/main/security/solana-program-policy.ts`. Each entry binds:

- an exact Mainnet program address;
- one narrow capability;
- one or more product lanes;
- a bounded rationale for why the program may appear.

Lane-specific transaction inspectors derive their sets from that manifest.
Pump launch authority is not present in the Jupiter lane, and Jupiter routing
authority is not present in the Token Launch lane.

## Current capabilities

| Capability | Lane | Purpose |
| --- | --- | --- |
| System Program | Jupiter, Token Launch | Required account funding/creation |
| Compute Budget | Jupiter, Token Launch | Bounded compute and priority price |
| Associated Token Program | Jupiter, Token Launch | Canonical associated-token accounts |
| SPL Token | Jupiter | Legacy SPL-token movement |
| Token-2022 | Jupiter, Token Launch | Supported Token-2022 assets and launch mint |
| Jupiter route | Jupiter | Canonical Jupiter routing |
| OKX Aggregator V6 | Jupiter | Explicit Jupiter Ultra route |
| Memo | Jupiter | Bounded non-authoritative metadata |
| Pump program | Token Launch | Inspected conservative `create_v2` instruction |
| Pump Mayhem support | Token Launch | Account-support program in the pinned layout |

An allowlisted address is not execution authority. The exact unsigned
transaction still requires sole-signer inspection, deterministic policy,
simulation, fee/outflow limits, fresh final revalidation, explicit approval,
local signing, one broadcast attempt, and independent reconciliation.

## Change procedure

Adding, removing, or changing an entry requires all of the following:

1. Name the affected lane and the minimum required capability.
2. Verify the official deployment and owner from two independent sources.
3. Pin any relevant SDK/IDL revision and record the reviewed instruction or
   account layout.
4. Add a negative test proving the other lane cannot invoke the program.
5. Add transaction-inspection and simulation fixtures for the exact route.
6. Repeat fee, stale-state, wrong-signer, injected-instruction, provider
   disagreement, unknown-broadcast, and restart-recovery tests.
7. Run controlled minimum-value Mainnet acceptance in a signed QA build.
8. Obtain independent security review and record the reviewed commit/build.

Until every item is complete, the new address must remain absent from the
manifest. Provider responses and address lookup tables cannot extend this
allowlist at runtime.
