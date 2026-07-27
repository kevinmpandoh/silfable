import assert from "node:assert/strict";
import test from "node:test";

import { AutonomousExecutorService, type AutonomousExecutorDependencies } from "./autonomous-executor.js";

test("autonomous executor is a fail-closed proposal-only boundary", async () => {
  const dependencies = new Proxy({}, {
    get() {
      throw new Error("Disabled autonomous execution must not access runtime authority");
    },
  }) as AutonomousExecutorDependencies;
  const service = new AutonomousExecutorService(dependencies);
  let emitted: unknown = null;
  service.once("execution_error", (event) => { emitted = event; });

  await assert.rejects(
    () => service.executeTrigger({
      positionId: "position-1",
      mintAddress: "So11111111111111111111111111111111111111112",
      reason: "STOP_LOSS",
      triggerPrice: 1,
      targetPrice: 2,
      amount: "1000000",
      triggeredAt: new Date().toISOString(),
    }),
    /Autonomous execution is disabled/u,
  );
  assert.deepEqual(emitted, {
    positionId: "position-1",
    error: "Autonomous execution is disabled. A trigger may create a reviewable proposal only; it cannot close a position, sign, or broadcast.",
  });
});

test("autonomous executor remains disabled even while the vault is unlocked", async () => {
  let closeCalls = 0;
  const service = new AutonomousExecutorService({
    keystore: { isLocked: () => false },
    strategyManager: { closePosition: () => { closeCalls += 1; } },
  } as unknown as AutonomousExecutorDependencies);

  await assert.rejects(() => service.executeTrigger({
    positionId: "pos-100",
    mintAddress: "7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump",
    reason: "TAKE_PROFIT",
    triggerPrice: 2.5,
    targetPrice: 2.0,
    amount: "5000",
    triggeredAt: new Date().toISOString(),
  }), /cannot close a position, sign, or broadcast/u);
  assert.equal(closeCalls, 0);
});
