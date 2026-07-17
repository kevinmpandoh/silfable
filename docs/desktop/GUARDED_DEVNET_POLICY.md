# Guarded Devnet Policy

## Scope

This policy defines the validation contract and non-skippable state machine for the bounded SPL test-token execution adapter. Its only execution surface is an explicit manual Devnet activation proof; it has no scheduler integration or Jupiter Mainnet execution path.

The separation allows proposal and transaction invariants to be reviewed before any automatic signing surface exists.

## Proposal binding

Every proposal is strict and binds to:

- mission identifier, immutable revision, plan digest, and cycle number;
- fixed `spl-test-swap-v1` transaction kind;
- exact authorized input/output mints and input amount;
- quoted and minimum output amounts;
- slippage and price-impact evidence;
- observation and expiration timestamps.

Minimum output must exactly equal the quote adjusted by the declared basis-point slippage using integer arithmetic. A proposal cannot advertise a safe slippage value while silently lowering the output threshold.

## Pre-simulation validation

Before simulation, the policy checks profile, mission context, mints, amount, quote freshness/expiry, slippage, impact, network, keystore, kill switches, daily spend, and wallet reserve. Passing this stage never permits signing.

## Pre-sign revalidation

Signing becomes eligible only after a simulation bound to the exact proposal. The policy additionally requires:

- successful simulation;
- fee at or below the authorized maximum;
- only SPL Token and Compute Budget programs;
- exact authorized input debit;
- output credit at or above the proposal minimum;
- fresh network, keystore, kill-switch, reserve, and spend state.

The journal now binds signing to the exact SHA-256 hash of the compiled message bytes that were simulated. A changed instruction, amount, account, blockhash, or fee payer produces a different message and is rejected before the signed state is recorded.

The deterministic fixture uses the official `@solana-program/token` implementation to build and decode an SPL Token `TransferChecked` instruction. Its program, account roles, instruction data, amount, and decimals contribute to a stable fixture fingerprint. The live adapter remains disabled until the test mint and token accounts have reviewed on-chain provenance.

## Fixture provenance

The fixture manifest is strict, Devnet-only, and binds the reviewed mint, decimals, source and destination token accounts, wallet authority, destination owner, transfer amount, and instruction fingerprint. Unknown manifest fields are rejected. A canonical SHA-256 manifest digest is included in the proposal, simulation, validation evidence, and durable execution record.

Mint and token accounts are fetched together through `getMultipleAccounts` at one confirmed context slot, then decoded locally with the official SPL codecs. Validation requires:

- all three accounts to exist, be non-executable, and be owned by the legacy SPL Token program;
- an initialized mint with exact decimals and revoked mint/freeze authorities;
- initialized, non-native source and destination accounts for the reviewed mint;
- exact token-account owners, no active delegate, and sufficient source balance;
- a fresh observation and an instruction matching every manifest-bound address and value.

Any manifest digest change between proposal, simulation, and pre-sign validation fails closed.

## Atomic fixture provisioning

The provisioning planner constructs one bounded Devnet transaction containing, in order:

1. creation of the rent-exempt SPL mint account;
2. mint initialization with the provisioning wallet as temporary mint and freeze authority;
3. idempotent creation of distinct source and destination associated token accounts;
4. the fixed test-supply mint;
5. permanent revocation of mint authority;
6. permanent revocation of freeze authority.

Keeping these instructions in one transaction means provisioning either completes with both authorities revoked or rolls back completely. It cannot crash between minting and authority revocation. The planner rejects invalid decimals, non-positive rent/supply, transfer amounts above supply, and a destination owned by the provisioning wallet. A signed serialization test enforces Solana's 1,232-byte transaction limit.

The planner only produces instructions and a candidate reviewed manifest. It is not exposed through IPC and does not submit a transaction by itself.

## Manual provisioning executor

The main-process executor now supports the internal provisioning sequence without renderer or scheduler exposure:

```text
Proposed -> Simulated -> Signed -> Broadcast -> Confirmed
    |           |          |
    +-----------+----------+--> Failed (before broadcast)
                              Broadcast uncertainty -> Ambiguous
```

It simulates the unsigned message with signature verification disabled, checks the bounded fee, rechecks fresh network and unlocked-keystore state, then signs the exact simulated message. Signed wire bytes, signature, derived accounts, amounts, and instruction fingerprint are encrypted in SQLite. The broadcast marker is committed before `sendTransaction`.

Restart reconciliation never broadcasts. `proposed`, `simulated`, and `signed` records become definite pre-broadcast failures because the ephemeral mint signer is no longer available. `broadcast` and `ambiguous` records are checked only by their encrypted signature; confirmed records advance, while missing, malformed, errored, or unconfirmed evidence remains ambiguous.

## Manual activation UI

Provisioning is exposed only as a manual Devnet action inside the configured-wallet panel. Four independent acknowledgments are required for mint creation, rent/network fees, permanent authority revocation, and the fact that provisioning does not enable automatic trading. The strict IPC request accepts no address, amount, program, transaction, instruction, or endpoint from the renderer; all provisioning parameters are fixed in the trusted main process.

The destination owner is generated in the main process and its key is discarded, so the renderer cannot redirect the fixture transfer destination. The response exposes only bounded public journal metadata and never returns encrypted wire data or signatures. A database-backed one-time lock prevents a second provision while any confirmed or ambiguous fixture exists, including after restart.

The UI can submit a real Devnet transaction only after the user unlocks the dedicated wallet, the health monitor is fresh, and every acknowledgment is checked. It is never called automatically and remains separate from Auto DCA.

## Post-confirmation activation

A confirmed provisioning transaction is not automatically trusted. The user must explicitly start a second, read-only review with acknowledgments that the check is fresh, Devnet-only, and does not enable automatic trading.

The main process decrypts the original provisioning evidence, reconstructs the exact signer-role instruction fingerprint without loading a signing key, and fetches the mint plus both token accounts in one confirmed RPC snapshot. Only a complete provenance pass can create the single active fixture record. The encrypted activation receipt contains the final manifest, observation, and validation evidence; the renderer receives only public addresses, manifest digest, confirmed slot, and activation time.

Migration 9 enforces one active reviewed fixture at the database layer. A confirmed provision with an active mint/freeze authority, wrong owner, delegate, frozen/native account, insufficient source supply, altered fingerprint, malformed encrypted evidence, or stale RPC observation cannot become active.

## Guarded fixture transfer executor

The executor can submit exactly one fixed, low-value `TransferChecked` transaction for an active reviewed fixture. A strict renderer arm flow can authorize the next eligible Devnet scheduler cycle to consume this single proof. Jupiter swaps and Mainnet remain disconnected.

Before message construction, it loads the encrypted active manifest, verifies its digest and stored public addresses, fetches the three fixture accounts in one confirmed snapshot, and reruns the complete provenance policy. It simulates the unsigned compiled message, enforces the fixed fee ceiling, checks network and keystore state again, then performs a second fresh provenance snapshot immediately before signing. Both validations must return the exact active manifest digest.

The signed transaction must match the simulated message byte-for-byte. Migration 10 stores its state and encrypted evidence, with a unique manifest digest preventing a second transfer for the same reviewed fixture. The broadcast marker is committed before submission. Restart reconciliation only queries the encrypted signature: it never signs or broadcasts again, and uncertainty remains `ambiguous` rather than being treated as a safe retry.

## Operator receipt approval

A confirmed transfer still grants no scheduler authority. The operator must pass a separate manual receipt gate. The main process decrypts the transfer evidence, checks both provenance decisions and the fixed amount against the active manifest, then queries the encrypted signature on Devnet again. Only a fresh confirmed or finalized status creates the unique encrypted approval added by migration 11.

The renderer cannot submit a signature, wire transaction, amount, address, endpoint, or instruction to this gate. Its public approval receipt explicitly states that automatic trading remains disabled.

## Revocable mission authority

Migration 12 adds a distinct guarded authority ledger. Creating an entry requires the approved fixture proof, a mission already authorized for deterministic simulation, and an exact match on mission ID, revision, and plan digest. The encrypted record contains a canonical snapshot and digest of every Desk Rule limit, schedule boundary, spend cap, wallet reserve, and failure policy.

Only one guarded authority may be active at a time. Editing the mission revision revokes it inside SQLite through a database trigger, and the operator can revoke it manually without network access. A revoked record remains as immutable audit history. This authority is still non-executable: its renderer view and encrypted evidence both state `schedulerSigningEnabled: false` and `mainnetEnabled: false`.

## One-shot scheduler arm kernel

Migration 14 adds a separate encrypted scheduler-arm ledger. An arm is valid for at most 15 minutes, binds one exact guarded authorization plus its mission revision, plan digest, canonical Desk Rule digest, and fixture manifest, and permits only one `devnet-fixture-cycle-once` execution. Creating it requires explicit acknowledgements for automatic signing, hot-wallet risk, and the Devnet-fixture-only scope. It never enables mainnet.

The fixture-cycle proposal carries the arm ID. The bridge requires the arm to remain active through simulation, consumes it atomically immediately before signing, and requires the consumed record to bind the same execution ID before broadcast. Revoking either the arm or its parent authorization fails closed, and a consumed arm cannot be replayed. The renderer confirmation flow accepts only the parent authorization ID and three literal acknowledgements, shows the 15-minute expiry and one-shot scope, and supports immediate local revocation. It cannot supply transaction material or market parameters. The production scheduler invokes the bridge only for this Devnet fixture scope.

Explicit wallet lock and application restart revoke every active or consumed arm before later mission activity. Unlocking or reopening Silfable can therefore never resurrect a previous signing permission.

No new arm can be created while any guarded execution remains pending or ambiguous. A restart may revoke the old arm, but it cannot bypass reconciliation or authorize a second transaction while the first signature has an uncertain outcome.

## Scheduler readiness gate

The simulation scheduler now consumes guarded authority at each due cycle through a non-executing readiness adapter. Migration 13 records the encrypted result exactly once per mission revision and cycle. With no authority, the cycle remains ordinary simulation and reports `inactive`. With active authority, the gate revalidates the mission/revision, plan and Desk Rule digests, encrypted authorization envelope, approved transfer, confirmed fixture binding, keystore, and fresh network state.

Any mismatch reports `denied` and halts the mission before a signing-capable path. A complete pass reports `ready`, but explicitly retains `executionEnabled: false` and `signingAttempted: false`. The renderer surfaces this outcome alongside the cycle receipt.

## Fixture-cycle proposal

A `ready` evaluation now produces a short-lived, encrypted `spl-transfer-checked-cycle-v1` proposal in the simulation receipt. It binds the evaluation and authorization IDs, mission revision, plan and Desk Rule digests, active fixture manifest, every SPL account, fixed fixture amount, and decimals.

The proposal explicitly declares `purpose: devnet-execution-path-proof`, `economicValueMapping: none`, `marketSwapPerformed: false`, and `executionEnabled: false`. The authorized DCA amount and fixture transfer amount are stored as distinct fields and are never treated as economically equivalent. Proposal construction failure halts the mission as `guarded-proposal-invalid`.

## Fixture-cycle execution bridge

The main-process bridge drives the complete durable state machine without accepting renderer input. It is instantiated by the application runtime but has no direct renderer IPC registration. Only the scheduler can call it after producing the exact armed proposal.

The bridge reloads the current mission, authority, encrypted authorization evidence, exact readiness evaluation, approved fixture proof, and active manifest before creating a journal. It then performs fresh on-chain provenance validation, simulates the exact unsigned message, checks every binding again, repeats provenance validation immediately before signing, and verifies the signed message is identical to the simulated message. Authority revocation after simulation prevents signing.

The signed evidence remains encrypted. A broadcast marker is committed before submission, and confirmation produces a receipt explicitly stating that no market swap occurred. An error after broadcast becomes `ambiguous`. Restart reconciliation reads the encrypted signature and queries status only; it never signs or broadcasts again.

## State machine

```text
Proposed -> Validated -> Simulated -> Signed -> Broadcast -> Confirmed -> Receipted
    |           |            |          |
    +-----------+------------+----------+--> Failed (pre-broadcast only)
                                           Broadcast/Confirmed error -> Ambiguous
```

Skipping simulation or signing from an unvalidated state throws. Any error after a broadcast attempt is ambiguous, never a definite failure. Ambiguous state may reconcile to confirmed but cannot transition back to signed or broadcast.

## Durable journal

Migration 6 adds one execution row per mission revision and cycle, plus append-only encrypted evidence events. The unique mission/revision/cycle key prevents scheduler overlap or restart races from creating a second execution.

Every transition is atomic and optimistic: the stored current state must match the caller's expected state. The simulated message hash is immutable once written. Signed wire bytes and signature are derived directly from the exact transaction object that passes the message-hash check; callers cannot substitute separate evidence strings. Proposal, validation, simulation, signed transaction, confirmation, failure, and receipt evidence are encrypted with the local data key before SQLite storage.

The broadcast-attempt flag is committed before network submission. Therefore, a network drop or process failure after submission can only become `ambiguous`; it cannot be retried blindly or reported as a definite failure.

## Next implementation gate

The next gate is packaged Linux QA evidence for network loss, tray operation, restart reconciliation, and Wayland/X11 behavior. Economic Jupiter execution and Mainnet remain outside this Devnet fixture proof.
