const DECIMAL = String.raw`\d+(?:[.,]\d+)?`;

export type BullishPerpSetupCheck = {
  code: string;
  passed: boolean;
  message: string;
};

export type BullishPerpSetupAssessment = {
  verdict: "bullish" | "bearish" | "neutral";
  direction: "long" | "short";
  score: number;
  requiredScore: number;
  priceUsd: number;
  ema20: number;
  ema50: number;
  rsi14: number;
  checks: BullishPerpSetupCheck[];
};

export type ConditionalX402PerpIntent =
  | { requested: false }
  | {
      requested: true;
      symbol: string | null;
      direction: "long" | "short";
      notionalUsd: number | null;
      leverage: number;
      stopLossPct: number | null;
      takeProfitPct: number | null;
    };

const SUPPORTED_SYMBOLS = ["SOL", "BTC", "ETH", "JUP", "ONDO", "DOGE"] as const;

export function parseConditionalX402PerpIntent(text: string): ConditionalX402PerpIntent {
  const value = typeof text === "string" ? text.slice(0, 4_000) : "";
  const condition = /\b(?:if|jika)\b[^.!?\n]{0,120}\b(bullish|bearish|berish)\b/iu.exec(value)?.[1]?.toLowerCase();
  const longRequested = /(?:\b(?:open|buka|place|prepare)\b[^.!?\n]{0,100}\b(?:long|buy)\b)|(?:\b(?:long|buy)\b[^.!?\n]{0,80}\b(?:position|order|posisi)\b)/iu.test(value);
  const shortRequested = /(?:\b(?:open|buka|place|prepare)\b[^.!?\n]{0,100}\b(?:short|sell)\b)|(?:\b(?:short|sell)\b[^.!?\n]{0,80}\b(?:position|order|posisi)\b)/iu.test(value);
  const direction = condition === "bullish" && longRequested && !shortRequested
    ? "long"
    : (condition === "bearish" || condition === "berish") && shortRequested && !longRequested
      ? "short"
      : null;
  if (!/\bx402\b/iu.test(value) || direction === null) return { requested: false };

  const explicit = /\b([A-Za-z0-9]{2,12})[-\s]?perp\b/iu.exec(value)?.[1];
  const analyzed = /\b(?:analy[sz]e|analisa|analisis)\s+([A-Za-z0-9]{2,12})\b/iu.exec(value)?.[1];
  const directed = /\b(?:long|buy|beli|short|sell|jual)\s+([A-Za-z0-9]{2,12})\b/iu.exec(value)?.[1];
  const candidate = (explicit ?? analyzed ?? directed)?.toUpperCase() ?? null;
  const symbol = candidate && (SUPPORTED_SYMBOLS as readonly string[]).includes(candidate) ? candidate : null;

  const leverage = parsePositiveNumber(new RegExp(String.raw`(${DECIMAL})\s*x\b`, "iu").exec(value)?.[1]) ?? 2;
  const marginMatch = new RegExp(String.raw`(?:\$\s*(${DECIMAL})|(${DECIMAL})\s*(?:usd|usdc|dollars?)?)\s*(?:of\s+)?(?:margin|collateral)\b`, "iu").exec(value);
  const marginUsd = parsePositiveNumber(marginMatch?.[1] ?? marginMatch?.[2]);
  const notionalMatch = new RegExp(String.raw`(?:\$\s*(${DECIMAL})|(${DECIMAL})\s*(?:usd|usdc|dollars?)?)\s*(?:of\s+)?(?:notional|position\s+size)\b|(?:open|buka|place|prepare)\b[^.!?\n]{0,50}\$\s*(${DECIMAL})`, "iu").exec(value);
  const explicitNotional = parsePositiveNumber(notionalMatch?.[1] ?? notionalMatch?.[2] ?? notionalMatch?.[3]);
  const validLeverage = Number.isInteger(leverage) && leverage >= 1 && leverage <= 10 ? leverage : 2;
  const notionalUsd = marginUsd === null ? explicitNotional : marginUsd * validLeverage;

  return {
    requested: true,
    symbol,
    direction,
    notionalUsd,
    leverage: validLeverage,
    stopLossPct: parseRiskPercent(value, "stop(?:[\s-]*loss)?|sl"),
    takeProfitPct: parseRiskPercent(value, "take(?:[\s-]*profit)?|tp"),
  };
}

export function assessBullishPerpSetup(
  market: { fundingRateHourlyPctLong: number; stale: boolean },
  candles: Array<{ close: number }>,
): BullishPerpSetupAssessment {
  return assessPerpSetup("long", market, candles);
}

export function assessPerpSetup(
  direction: "long" | "short",
  market: { fundingRateHourlyPctLong: number; stale: boolean },
  candles: Array<{ close: number }>,
): BullishPerpSetupAssessment {
  if (candles.length < 55) throw new Error("At least 55 verified candles are required for setup analysis.");
  const closes = candles.map((candle) => candle.close);
  if (closes.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Verified candle data contains an invalid closing price.");
  const priceUsd = closes.at(-1)!;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const momentum = priceUsd / closes.at(-4)! - 1;
  const checks = direction === "long" ? [
    { code: "price_above_ema20", passed: priceUsd > ema20, message: `Price $${priceUsd.toFixed(4)} ${priceUsd > ema20 ? "is" : "is not"} above EMA20 $${ema20.toFixed(4)}.` },
    { code: "ema_trend", passed: ema20 > ema50, message: `EMA20 $${ema20.toFixed(4)} ${ema20 > ema50 ? "is" : "is not"} above EMA50 $${ema50.toFixed(4)}.` },
    { code: "rsi_momentum", passed: rsi14 >= 52 && rsi14 <= 70, message: `RSI14 is ${rsi14.toFixed(1)}; bullish policy range is 52–70.` },
    { code: "three_candle_momentum", passed: momentum > 0, message: `Three-candle momentum is ${(momentum * 100).toFixed(2)}%.` },
    { code: "funding_guard", passed: market.fundingRateHourlyPctLong <= 0.1, message: `Long funding is ${market.fundingRateHourlyPctLong.toFixed(4)}%/h; maximum is 0.1000%/h.` },
  ] : [
    { code: "price_below_ema20", passed: priceUsd < ema20, message: `Price $${priceUsd.toFixed(4)} ${priceUsd < ema20 ? "is" : "is not"} below EMA20 $${ema20.toFixed(4)}.` },
    { code: "ema_trend", passed: ema20 < ema50, message: `EMA20 $${ema20.toFixed(4)} ${ema20 < ema50 ? "is" : "is not"} below EMA50 $${ema50.toFixed(4)}.` },
    { code: "rsi_momentum", passed: rsi14 >= 30 && rsi14 <= 48, message: `RSI14 is ${rsi14.toFixed(1)}; bearish policy range is 30–48.` },
    { code: "three_candle_momentum", passed: momentum < 0, message: `Three-candle momentum is ${(momentum * 100).toFixed(2)}%.` },
    { code: "funding_guard", passed: market.fundingRateHourlyPctLong >= -0.1, message: `Short funding cost is ${(-market.fundingRateHourlyPctLong).toFixed(4)}%/h; maximum is 0.1000%/h.` },
  ];
  const score = checks.filter((check) => check.passed).length;
  const requiredScore = 4;
  return { verdict: score >= requiredScore && !market.stale ? (direction === "long" ? "bullish" : "bearish") : "neutral", direction, score, requiredScore, priceUsd, ema20, ema50, rsi14, checks };
}

function parseRiskPercent(value: string, label: string): number | null {
  const after = new RegExp(String.raw`\b(?:${label})\b\s*(?:(?:of|at|sebesar)\s*)?(?:[:=-]\s*)?(${DECIMAL})\s*%`, "iu").exec(value)?.[1];
  const before = new RegExp(String.raw`(${DECIMAL})\s*%\s*(?:${label})\b`, "iu").exec(value)?.[1];
  return parsePositiveNumber(before ?? after);
}

function parsePositiveNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function ema(values: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) current = value * multiplier + current * (1 - multiplier);
  return current;
}

function rsi(values: number[], period: number): number {
  const recent = values.slice(-period - 1);
  const changes = recent.slice(1).map((value, index) => value - recent[index]!);
  const gains = changes.reduce((sum, change) => sum + Math.max(0, change), 0) / period;
  const losses = changes.reduce((sum, change) => sum + Math.max(0, -change), 0) / period;
  if (losses === 0) return gains === 0 ? 50 : 100;
  return 100 - 100 / (1 + gains / losses);
}
