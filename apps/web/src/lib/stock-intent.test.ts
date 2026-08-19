import assert from "node:assert/strict";
import test from "node:test";

import { resolveStockAnalysisIntent } from "./stock-intent";

test("resolves stock intent with Indonesian prompt", () => {
  const result = resolveStockAnalysisIntent("tolong buatkan analisa saham NVDA untuk hari ini");
  assert.deepEqual(result, { requested: true, ticker: "NVDA" });
});

test("resolves stock intent with English prompt", () => {
  const result = resolveStockAnalysisIntent("Can you give me a stock analysis for AAPL?");
  assert.deepEqual(result, { requested: true, ticker: "AAPL" });
});

test("resolves stock intent with cashtag $TSLA", () => {
  const result = resolveStockAnalysisIntent("What do you think about $TSLA right now?");
  assert.deepEqual(result, { requested: true, ticker: "TSLA" });
});

test("ignores standard crypto swap queries", () => {
  const result = resolveStockAnalysisIntent("swap 1 SOL to USDC on mainnet");
  assert.deepEqual(result, { requested: false, ticker: null });
});

test("requests ticker if only stock keyword is mentioned without symbol", () => {
  const result = resolveStockAnalysisIntent("tolong analisa saham us");
  assert.equal(result.requested, true);
});

test("does not falsely extract words like EACH or BEST from broad screening prompt", () => {
  const result = resolveStockAnalysisIntent(
    "Find the best U.S. stocks available through Mirae Asset for short-term trading over the next 1–4 weeks. For each stock, provide the ticker, current price, ideal entry zone, stop-loss level, take-profit target.",
  );
  assert.deepEqual(result, { requested: true, ticker: null });
});
