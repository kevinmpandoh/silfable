import assert from "node:assert/strict";
import test from "node:test";
import { resolveRobinhoodSwapIntent } from "./evm-swap-intent";

test("resolves a USDG to ETH Robinhood swap expressed in Indonesian", () => {
  assert.deepEqual(resolveRobinhoodSwapIntent("Saya ingin swap $0.5 dari usdg ke eth"), {
    requested: true,
    amount: "0.5",
    sellToken: "USDG",
    buyToken: "ETH",
  });
});

test("does not create a Robinhood quote from an unrelated chat message", () => {
  assert.equal(resolveRobinhoodSwapIntent("Tolong jelaskan saldo saya").requested, false);
});
