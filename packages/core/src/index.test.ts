import assert from "node:assert/strict";
import test from "node:test";

import { DcaSimulationRequestSchema, type DcaSimulationRequest } from "@silfable/contracts";

import { simulateDcaCycle } from "./index";

const now = "2026-07-16T00:00:00.000Z";

function request(overrides?: Partial<DcaSimulationRequest>): DcaSimulationRequest {
  const value = {
    schemaVersion: 1,
    requestId: "d71560f7-9f4f-46fe-83b4-f58459ae351f",
    completedCycles: 0,
    lastSchedulerTickAt: "2026-07-15T23:59:59.000Z",
    now,
    plan: {
      schemaVersion: 1,
      id: "507a3841-48e7-43be-95c6-4b287081dcd7",
      profile: "devnet-simulation",
      inputMint: "11111111111111111111111111111111",
      outputMint: "22222222222222222222222222222222",
      amountPerCycleAtomic: "100",
      intervalSeconds: 3_600,
      startAt: now,
      maxCycles: 3,
      minPrice: "0.5",
      maxPrice: "2",
      maxSlippageBps: 100,
      maxPriceImpactBps: 50,
      maxFeeLamports: "5000",
      dailySpendLimitAtomic: "1000",
      minimumWalletReserveAtomic: "500",
      missedCyclePolicy: "skip",
      failurePolicy: "halt",
    },
    snapshot: {
      observedAt: now,
      quoteExpiresAt: "2026-07-16T00:01:00.000Z",
      networkHealth: "healthy",
      keystoreUnlocked: true,
      globalKillSwitch: false,
      missionKillSwitch: false,
      walletBalanceAtomic: "1000",
      spentTodayAtomic: "0",
      price: "1",
      priceImpactBps: 20,
      feeLamports: "1000",
      inputMintAllowed: true,
      outputMintAllowed: true,
      marketEligible: true,
      simulationSucceeded: true,
    },
    ...overrides,
  };

  return DcaSimulationRequestSchema.parse(value);
}

test("healthy Devnet cycle would execute but never signs", () => {
  const result = simulateDcaCycle(request());
  assert.equal(result.outcome, "would-execute");
  assert.equal(result.signingAttempted, false);
  assert.deepEqual(result.denialCodes, []);
});

test("network loss and locked keystore halt fail-closed", () => {
  const base = request();
  const result = simulateDcaCycle(
    request({
      snapshot: { ...base.snapshot, networkHealth: "offline", keystoreUnlocked: false },
    }),
  );
  assert.equal(result.outcome, "halted");
  assert.ok(result.denialCodes.includes("network-unhealthy"));
  assert.ok(result.denialCodes.includes("keystore-locked"));
});

test("daily cap and wallet reserve are enforced with atomic integers", () => {
  const base = request();
  const result = simulateDcaCycle(
    request({
      snapshot: { ...base.snapshot, spentTodayAtomic: "950", walletBalanceAtomic: "550" },
    }),
  );
  assert.equal(result.outcome, "halted");
  assert.ok(result.denialCodes.includes("daily-spend-exceeded"));
  assert.ok(result.denialCodes.includes("wallet-reserve-breached"));
});

test("a cycle missed beyond its interval is skipped, not accumulated", () => {
  const result = simulateDcaCycle(
    request({
      now: "2026-07-16T02:00:01.000Z",
      lastSchedulerTickAt: "2026-07-15T23:59:59.000Z",
    }),
  );
  assert.equal(result.outcome, "skipped");
  assert.equal(result.schedulerAction, "skip");
});
