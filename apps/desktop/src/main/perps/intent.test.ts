import assert from "node:assert/strict";
import test from "node:test";

import { parseMiraePerpPrompt } from "@mirae/contracts";

test("parses a margin-based desktop Perps prompt deterministically", () => {
  const intent = parseMiraePerpPrompt("Long SOL with $3 margin at 5x Leverage. Execute the order at market place");
  assert.deepEqual(intent, {
    requested: true,
    symbol: "SOL",
    direction: "long",
    notionalUsd: 15,
    marginUsd: 3,
    leverage: 5,
    error: null,
  });
});

test("uses conservative default leverage and rejects conflicts", () => {
  const defaulted = parseMiraePerpPrompt("short BTC perp $10");
  assert.equal(defaulted.requested && defaulted.leverage, 2);
  const conflict = parseMiraePerpPrompt("long ETH perp $10 at 2x then 5x");
  assert.equal(conflict.requested && conflict.error, "conflicting_leverage");
});

test("does not claim ordinary chat messages", () => {
  assert.deepEqual(parseMiraePerpPrompt("that was a long explanation"), { requested: false });
});
