import assert from "node:assert/strict";
import test from "node:test";

import type { DcaPlanV1, GuardedDevnetProposal, GuardedDevnetSimulation } from "@silfable/contracts";

import { transitionGuardedExecution, validateGuardedDevnet } from "./guarded-policy";

const now = new Date("2026-07-17T00:00:10.000Z");
const missionId = "00000000-0000-4000-8000-000000000001";
const proposalId = "00000000-0000-4000-8000-000000000002";
const digest = "a".repeat(64);
const fixtureManifestDigest = "c".repeat(64);
const plan: DcaPlanV1 = {
  schemaVersion: 1,
  id: missionId,
  profile: "devnet-simulation",
  inputMint: "11111111111111111111111111111111",
  outputMint: "22222222222222222222222222222222",
  amountPerCycleAtomic: "100000000",
  intervalSeconds: 3600,
  startAt: "2026-07-17T00:00:00.000Z",
  maxCycles: 2,
  maxSlippageBps: 100,
  maxPriceImpactBps: 50,
  maxFeeLamports: "5000",
  dailySpendLimitAtomic: "500000000",
  minimumWalletReserveAtomic: "1000000000",
  missedCyclePolicy: "skip",
  failurePolicy: "halt",
};
const proposal: GuardedDevnetProposal = {
  schemaVersion: 1,
  id: proposalId,
  missionId,
  missionRevision: 1,
  planDigest: digest,
  fixtureManifestDigest,
  cycle: 1,
  transactionKind: "spl-test-swap-v1",
  inputMint: plan.inputMint,
  outputMint: plan.outputMint,
  inputAmountAtomic: plan.amountPerCycleAtomic,
  quotedOutputAtomic: "200000000",
  minimumOutputAtomic: "198000000",
  slippageBps: 100,
  priceImpactBps: 20,
  observedAt: "2026-07-17T00:00:00.000Z",
  expiresAt: "2026-07-17T00:00:30.000Z",
};
const simulation: GuardedDevnetSimulation = {
  schemaVersion: 1,
  proposalId,
  fixtureManifestDigest,
  succeeded: true,
  feeLamports: "5000",
  unitsConsumed: "100000",
  lastValidBlockHeight: "1000",
  transactionMessageHash: "b".repeat(64),
  programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
  inputDebitAtomic: plan.amountPerCycleAtomic,
  outputCreditAtomic: proposal.minimumOutputAtomic,
};

function context() {
  return {
    missionId,
    missionRevision: 1,
    planDigest: digest,
    fixtureManifestDigest,
    cycle: 1,
    plan,
    proposal,
    simulation,
    now,
    networkHealthy: true,
    keystoreUnlocked: true,
    globalKillSwitch: false,
    missionKillSwitch: false,
    fixtureProvenanceAllowed: true,
    walletBalanceAtomic: "5000000000",
    spentTodayAtomic: "0",
  };
}

test("signing is allowed only after a matching successful simulation", () => {
  const { simulation: _simulation, ...beforeContext } = context();
  const before = validateGuardedDevnet("pre-simulation", beforeContext);
  assert.equal(before.allowed, true);
  assert.equal(before.signingAllowed, false);
  const after = validateGuardedDevnet("pre-sign", context());
  assert.equal(after.allowed, true);
  assert.equal(after.signingAllowed, true);
});

test("proposal manipulation, stale quotes, foreign programs, and wrong deltas fail closed", () => {
  const result = validateGuardedDevnet("pre-sign", {
    ...context(),
    proposal: { ...proposal, inputAmountAtomic: "1", observedAt: "2026-07-16T23:00:00.000Z" },
    simulation: {
      ...simulation,
      programIds: ["BadProgram111111111111111111111111111111111"],
      inputDebitAtomic: "1",
      outputCreditAtomic: "1",
    },
  });
  assert.equal(result.signingAllowed, false);
  assert.ok(result.denialCodes.includes("amount-mismatch"));
  assert.ok(result.denialCodes.includes("quote-stale"));
  assert.ok(result.denialCodes.includes("program-denied"));
  assert.ok(result.denialCodes.includes("balance-delta-invalid"));
});

test("revalidation denies provenance, network, keystore, fee, reserve, and kill-switch failures", () => {
  const result = validateGuardedDevnet("pre-sign", {
    ...context(),
    networkHealthy: false,
    keystoreUnlocked: false,
    globalKillSwitch: true,
    fixtureProvenanceAllowed: false,
    walletBalanceAtomic: "100000000",
    simulation: { ...simulation, feeLamports: "5001" },
  });
  assert.equal(result.signingAllowed, false);
  for (const denial of ["fixture-provenance-invalid", "network-unhealthy", "keystore-locked", "kill-switch-active", "wallet-reserve-breached", "fee-exceeded"] as const) {
    assert.ok(result.denialCodes.includes(denial));
  }
});

test("state machine cannot skip simulation or report post-broadcast failure as definite", () => {
  assert.throws(() => transitionGuardedExecution("validated", "signed"), /Invalid guarded/u);
  assert.equal(transitionGuardedExecution("signed", "pre-broadcast-failure"), "failed");
  assert.equal(transitionGuardedExecution("broadcast", "post-broadcast-failure"), "ambiguous");
  assert.equal(transitionGuardedExecution("ambiguous", "confirmed"), "confirmed");
  assert.throws(() => transitionGuardedExecution("receipted", "broadcast-attempted"), /Invalid guarded/u);
});
