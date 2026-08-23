import type { PerpCandle, PerpMarketSnapshot } from "./phoenix-perps-core";

export type PerpSetupAssessment = {
  verdict: "bullish" | "neutral";
  score: number;
  requiredScore: number;
  priceUsd: number;
  ema20: number;
  ema50: number;
  rsi14: number;
  checks: Array<{ code: string; passed: boolean; message: string }>;
};

export function assessBullishPerpSetup(
  market: PerpMarketSnapshot,
  candles: PerpCandle[],
): PerpSetupAssessment {
  if (candles.length < 55) throw new Error("At least 55 verified candles are required for setup analysis.");
  const closes = candles.map((candle) => candle.close);
  const priceUsd = closes.at(-1)!;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const momentum = priceUsd / closes.at(-4)! - 1;
  const checks = [
    { code: "price_above_ema20", passed: priceUsd > ema20, message: `Price $${priceUsd.toFixed(4)} ${priceUsd > ema20 ? "is" : "is not"} above EMA20 $${ema20.toFixed(4)}.` },
    { code: "ema_trend", passed: ema20 > ema50, message: `EMA20 $${ema20.toFixed(4)} ${ema20 > ema50 ? "is" : "is not"} above EMA50 $${ema50.toFixed(4)}.` },
    { code: "rsi_momentum", passed: rsi14 >= 52 && rsi14 <= 70, message: `RSI14 is ${rsi14.toFixed(1)}; bullish policy range is 52–70.` },
    { code: "three_hour_momentum", passed: momentum > 0, message: `Three-candle momentum is ${(momentum * 100).toFixed(2)}%.` },
    { code: "funding_guard", passed: market.fundingRateHourlyPctLong <= 0.1, message: `Long funding is ${market.fundingRateHourlyPctLong.toFixed(4)}%/h; maximum is 0.1000%/h.` },
  ];
  const score = checks.filter((check) => check.passed).length;
  const requiredScore = 4;
  return { verdict: score >= requiredScore && !market.stale ? "bullish" : "neutral", score, requiredScore, priceUsd, ema20, ema50, rsi14, checks };
}

function ema(values: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) current = value * multiplier + current * (1 - multiplier);
  return current;
}

function rsi(values: number[], period: number): number {
  const changes = values.slice(-period - 1).slice(1).map((value, index) => value - values.slice(-period - 1)[index]!);
  const gains = changes.reduce((sum, change) => sum + Math.max(0, change), 0) / period;
  const losses = changes.reduce((sum, change) => sum + Math.max(0, -change), 0) / period;
  if (losses === 0) return gains === 0 ? 50 : 100;
  return 100 - 100 / (1 + gains / losses);
}
