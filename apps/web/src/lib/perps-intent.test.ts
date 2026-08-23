import assert from "node:assert/strict";
import test from "node:test";

import { parsePerpIntent } from "./perps-intent";

test("ignores ordinary conversation that merely uses the word long", () => {
  assert.deepEqual(parsePerpIntent("that was a long explanation, thanks"), { requested: false });
  assert.deepEqual(parsePerpIntent("swap 1 SOL to USDC"), { requested: false });
});

test("resolves a long open with an explicit base size", () => {
  const intent = parsePerpIntent("long 0.5 SOL-PERP");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.action, "open");
  assert.equal(intent.direction, "long");
  assert.equal(intent.baseAssetSymbol, "SOL");
  assert.equal(intent.baseAmount, "0.5");
  assert.equal(intent.notionalUsd, null);
});

test("resolves a short open sized in USD notional with leverage", () => {
  const intent = parsePerpIntent("short BTC perp $250 at 3x leverage");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.direction, "short");
  assert.equal(intent.baseAssetSymbol, "BTC");
  assert.equal(intent.notionalUsd, "250");
  assert.equal(intent.leverage, 3);
  assert.equal(intent.baseAmount, null);
});

test("reads an Indonesian open instruction", () => {
  const intent = parsePerpIntent("buka posisi long 2 SOL perp dengan leverage 2x");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.action, "open");
  assert.equal(intent.direction, "long");
  assert.equal(intent.baseAssetSymbol, "SOL");
  assert.equal(intent.baseAmount, "2");
  assert.equal(intent.leverage, 2);
});

test("captures a limit price when one is stated", () => {
  const intent = parsePerpIntent("long ETH-PERP 0.1 limit 3200 with leverage");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.limitPrice, "3200");
});

test("refuses to guess a direction when both sides appear", () => {
  const intent = parsePerpIntent("should I long or short SOL perp?");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.direction, null);
});

test("resolves a close instruction without a size", () => {
  const intent = parsePerpIntent("close my SOL perp position");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.action, "close");
  assert.equal(intent.baseAssetSymbol, "SOL");
  assert.equal(intent.baseAmount, null);
  assert.equal(intent.direction, null);
});

test("treats a bare question about perps as an overview", () => {
  const intent = parsePerpIntent("show my perp positions and funding");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.action, "overview");
});

test("rejects a leverage outside the supported range", () => {
  const intent = parsePerpIntent("long SOL perp 1 with 500x leverage");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.leverage, null);
  assert.equal(intent.leverageError, "out_of_range");
});

test("rejects conflicting leverage values instead of guessing", () => {
  const intent = parsePerpIntent("long ETH perp 2x $1 lev 5x");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.notionalUsd, "1");
  assert.equal(intent.leverage, null);
  assert.equal(intent.leverageError, "conflicting");
});

test("parses analyze-then-propose with percentage exits", () => {
  const intent = parsePerpIntent("Analyze ETH. If the setup is bullish, open a $500 long with a 3% stop loss and 8% take profit.");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.action, "open");
  assert.equal(intent.baseAssetSymbol, "ETH");
  assert.equal(intent.direction, "long");
  assert.equal(intent.notionalUsd, "500");
  assert.equal(intent.analyzeBeforeOpen, true);
  assert.equal(intent.stopLossPct, 3);
  assert.equal(intent.takeProfitPct, 8);
});

test("parses SOL before market price and treats dollars as margin", () => {
  const intent = parsePerpIntent("Long SOL with $3 margin at 5x leverage. Execute the order at market price.");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.baseAssetSymbol, "SOL");
  assert.equal(intent.direction, "long");
  assert.equal(intent.marginUsd, "3");
  assert.equal(intent.notionalUsd, null);
  assert.equal(intent.leverage, 5);
  assert.equal(intent.limitPrice, null);
});
