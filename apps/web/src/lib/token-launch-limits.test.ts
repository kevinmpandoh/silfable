import assert from "node:assert/strict";
import test from "node:test";

import { automaticLaunchLimits } from "./token-launch-limits";

test("creates a guarded launch-only allowance", () => {
  assert.deepEqual(automaticLaunchLimits("0"), {
    maxCreatorOutflowLamports: "50000000",
    maxPriorityFeeLamports: "0",
  });
});

test("adds one percent creator-buy protection and the launch cost reserve", () => {
  assert.deepEqual(automaticLaunchLimits("1000000000"), {
    maxCreatorOutflowLamports: "1060000000",
    maxPriorityFeeLamports: "0",
  });
});

test("rejects creator buys that exceed the guarded automatic ceiling", () => {
  assert.throws(() => automaticLaunchLimits("9900000000"), /guarded 10 SOL launch limit/u);
});
