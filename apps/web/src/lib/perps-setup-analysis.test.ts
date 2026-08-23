import assert from "node:assert/strict";
import test from "node:test";

import { assessBullishPerpSetup } from "./perps-setup-analysis";

test("qualifies a trending setup using deterministic checks", () => {
  const closes = Array.from({ length: 60 }, (_, index) => 100 + index * 0.35 + Math.sin(index) * 0.15);
  const assessment = assessBullishPerpSetup({
    symbol: "ETH-PERP", baseAssetSymbol: "ETH", marketPubkey: "market", oraclePriceUsd: closes.at(-1)!,
    fundingRateHourlyPctLong: 0.01, fundingRateHourlyPctShort: -0.01, openInterestBase: 1,
    maxLeverage: 20, minOrderBase: 0.001, stepSizeBase: 0.001, takerFeeBps: 5,
    oracleSlot: 1, oracleAgeSlots: 1, stale: false,
  }, closes.map((close, index) => ({ time: index, open: close - 0.1, high: close + 0.2, low: close - 0.2, close, volume: 100 })));
  assert.equal(assessment.verdict, "bullish");
  assert.ok(assessment.score >= assessment.requiredScore);
});
