import assert from "node:assert/strict";
import test from "node:test";

import { assessBullishPerpSetup, assessPerpSetup, parseConditionalX402PerpIntent } from "@mirae/contracts";

test("parses an x402 conditional ETH long with risk references", () => {
  const intent = parseConditionalX402PerpIntent("Analyze ETH. Find the data you need through x402. If the setup is bullish, open a $500 long with a 3% stop loss and 8% take profit.");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.symbol, "ETH");
  assert.equal(intent.notionalUsd, 500);
  assert.equal(intent.leverage, 2);
  assert.equal(intent.stopLossPct, 3);
  assert.equal(intent.takeProfitPct, 8);
});

test("parses margin separately from notional for a conditional x402 long", () => {
  const intent = parseConditionalX402PerpIntent("Analyze ETH using x402. If the setup is bullish, open a market LONG using $0.50 margin at 2x leverage.");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.direction, "long");
  assert.equal(intent.notionalUsd, 1);
  assert.equal(intent.leverage, 2);
});

test("parses a bearish x402 short and tolerates the common berish spelling", () => {
  const intent = parseConditionalX402PerpIntent("Analyze ETH using x402. If the setup qualifies as berish, open a market SHORT on ETH-PERP using $0.50 margin at 2x leverage.");
  assert.equal(intent.requested, true);
  if (!intent.requested) return;
  assert.equal(intent.symbol, "ETH");
  assert.equal(intent.direction, "short");
  assert.equal(intent.notionalUsd, 1);
});

test("does not turn an ordinary x402 research request into a trade", () => {
  assert.deepEqual(parseConditionalX402PerpIntent("Find external SOL market data through x402 and let me choose."), { requested: false });
});

test("bullish assessment requires four of five verified checks", () => {
  const candles = Array.from({ length: 60 }, (_, index) => ({ close: 100 + index * 0.8 }));
  const assessment = assessBullishPerpSetup({ fundingRateHourlyPctLong: 0.01, stale: false }, candles);
  assert.equal(assessment.checks.length, 5);
  assert.equal(assessment.requiredScore, 4);
  assert.equal(assessment.verdict, "bullish");
});

test("stale market data cannot qualify even with passing price checks", () => {
  const candles = Array.from({ length: 60 }, (_, index) => ({ close: 100 + index * 0.8 }));
  const assessment = assessBullishPerpSetup({ fundingRateHourlyPctLong: 0.01, stale: true }, candles);
  assert.equal(assessment.verdict, "neutral");
});

test("bearish assessment requires four of five direction-specific checks", () => {
  const candles = Array.from({ length: 60 }, (_, index) => ({ close: 160 - index * 0.8 }));
  const assessment = assessPerpSetup("short", { fundingRateHourlyPctLong: 0.01, stale: false }, candles);
  assert.equal(assessment.direction, "short");
  assert.equal(assessment.verdict, "bearish");
  assert.equal(assessment.score >= assessment.requiredScore, true);
});
