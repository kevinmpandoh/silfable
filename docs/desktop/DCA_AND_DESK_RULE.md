# Auto DCA and Desk Rule

## Authorized DCA plan

```ts
type DcaPlanV1 = {
  id: string;
  profile: "devnet-simulation" | "mainnet-shadow" | "mainnet-guarded";
  inputMint: string;
  outputMint: string;
  amountPerCycleAtomic: string;
  intervalSeconds: number;
  startAt: string;
  endAt?: string;
  maxCycles?: number;
  minPrice?: string;
  maxPrice?: string;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  maxFeeLamports: string;
  dailySpendLimitAtomic: string;
  minimumWalletReserveAtomic: string;
  missedCyclePolicy: "skip";
  failurePolicy: "halt";
};
```

The authorized plan is immutable. Editing it creates a new revision that requires explicit user authorization. AI-generated plans are always drafts.

## Cycle state

```text
Scheduled -> Due -> Observing -> Quoted -> Validated -> Simulated
          -> Signed -> Broadcast -> Confirmed -> Receipted

Any pre-sign failure -> Halted
Past due after downtime -> Skipped
Ambiguous post-broadcast state -> Reconciling -> Halted or Confirmed
```

## Mandatory Desk Rule checks

- input and output mint allowlist
- exact authorized amount per cycle
- total and daily spend caps
- minimum wallet reserve
- maximum slippage and price impact
- maximum network and priority fee
- quote age and observation freshness
- market/liquidity eligibility
- mission time window and maximum cycles
- trades-per-hour cap
- transaction program and account allowlists
- simulation success and expected balance deltas
- global and mission kill switches

## DCA defaults

- minimum interval: 3,600 seconds
- missed cycle: skip
- network drop: halt
- validation or simulation failure: halt
- insufficient funds: halt
- quote expiration: discard and halt
- retry: none after signing; reconcile by signature before any next action
- resume: manual only

## Jupiter boundary

Version one uses Jupiter Swap through the ordinary local execution pipeline. Jupiter Recurring is intentionally not used, so funds stay in the dedicated Silfable wallet and every cycle passes through the locally authorized Desk Rule.

## Current implementation boundary

The current desktop build implements the lifecycle through encrypted Devnet Simulation receipts only. Draft plans and compiled Desk Rules are encrypted in SQLite, every edit creates a new unauthorized revision, and authorization binds to both the expected revision and SHA-256 plan digest. The scheduler records skips, risk counters, and simulated receipts, but no transaction builder, signer, broadcast method, Jupiter adapter, or automatic retry exists yet.

Cycle numbering is scoped to a specific mission revision. Creating revision two starts its cycle count at zero while preserving the encrypted audit history from revision one. Daily risk counters remain mission-wide so editing a plan cannot reset the current UTC day's spend cap.
