/**
 * Deterministic perpetuals intent parsing.
 *
 * Perp intents are resolved by application code before the model is consulted,
 * matching how swap, bridge, and launch intents are handled. The model never
 * invents a market, a size, or a direction on its own.
 */

export type PerpAction = "open" | "close" | "overview";

export type PerpIntent =
  | { requested: false }
  | {
      requested: true;
      action: PerpAction;
      /** Base asset symbol, e.g. "SOL" for SOL-PERP. Null when the message never named one. */
      baseAssetSymbol: string | null;
      direction: "long" | "short" | null;
      /** Position size in base units, as a decimal string. */
      baseAmount: string | null;
      /** Position size in USD notional, as a decimal string. */
      notionalUsd: string | null;
      /** Limit price in USD. Null means a market order. */
      limitPrice: string | null;
      leverage: number | null;
    };

/**
 * A bare "long"/"short" is far too common in ordinary conversation to treat as a
 * trading instruction, so an explicit perpetuals marker is always required.
 */
const PERP_MARKER = /\bperp(?:s|etual|etuals)?\b|\bfutures\b|\bleverage\b|\bkontrak berjangka\b/iu;
const OPEN_MARKER = /\b(?:long|short|buka|open|entry|masuk)\b/iu;
const CLOSE_MARKER = /\b(?:close|closing|exit|tutup|keluar|flat)\b/iu;
const OVERVIEW_MARKER = /\b(?:position|positions|posisi|portfolio|funding|market|markets|pasar|status|show|lihat|list)\b/iu;

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

export function parsePerpIntent(text: string): PerpIntent {
  const value = typeof text === "string" ? text.slice(0, 4_000) : "";
  if (!PERP_MARKER.test(value)) return { requested: false };

  const closing = CLOSE_MARKER.test(value);
  const direction = resolveDirection(value);
  const action: PerpAction = closing
    ? "close"
    : direction || OPEN_MARKER.test(value)
      ? "open"
      : OVERVIEW_MARKER.test(value)
        ? "overview"
        : "overview";

  return {
    requested: true,
    action,
    baseAssetSymbol: resolveBaseAsset(value),
    direction: action === "open" ? direction : null,
    baseAmount: action === "open" ? resolveBaseAmount(value) : null,
    notionalUsd: action === "open" ? resolveNotionalUsd(value) : null,
    limitPrice: action === "open" ? resolveLimitPrice(value) : null,
    leverage: action === "open" ? resolveLeverage(value) : null,
  };
}

function resolveDirection(value: string): "long" | "short" | null {
  const long = /\b(?:long|buy|beli|naik|bullish)\b/iu.test(value);
  const short = /\b(?:short|sell|jual|turun|bearish)\b/iu.test(value);
  // An ambiguous message names both sides; refuse to guess which one was meant.
  if (long === short) return null;
  return long ? "long" : "short";
}

function resolveBaseAsset(value: string): string | null {
  const explicit = new RegExp(String.raw`\b([A-Za-z0-9]{2,12})[-\s]?perp\b`, "iu").exec(value);
  if (explicit) return normalizeSymbol(explicit[1]);
  const named = new RegExp(String.raw`\b(?:on|di|pada|market|pasar)\s+([A-Za-z0-9]{2,12})\b`, "iu").exec(value);
  if (named && !isNoiseWord(named[1])) return normalizeSymbol(named[1]);
  const sized = new RegExp(String.raw`${NUMBER}\s*([A-Za-z][A-Za-z0-9]{1,11})\b`, "iu").exec(value);
  if (sized && !isNoiseWord(sized[1])) return normalizeSymbol(sized[1]);
  return null;
}

/** Words that can follow a size or preposition without naming a market. */
function isNoiseWord(candidate: string): boolean {
  return /^(?:perp|perps|perpetual|perpetuals|futures|leverage|usd|usdc|dollars?|x|market|markets|position|positions|posisi|long|short|at|with|dengan|the|my|saya)$/iu.test(candidate);
}

function normalizeSymbol(candidate: string): string {
  return candidate.trim().toUpperCase();
}

function resolveBaseAmount(value: string): string | null {
  // A USD-denominated size is notional, not a base amount.
  const base = new RegExp(String.raw`(?<![$\w])(${NUMBER})\s*(?:x\s*)?([A-Za-z][A-Za-z0-9]{1,11})?[-\s]?perp\b`, "iu").exec(value)
    ?? new RegExp(String.raw`(?<![$\w])(${NUMBER})\s+(?!usd|usdc|dollar|x\b)([A-Za-z][A-Za-z0-9]{1,11})\b`, "iu").exec(value);
  if (!base) return null;
  if (base[2] && isNoiseWord(base[2])) return null;
  return normalizeDecimal(base[1]);
}

function resolveNotionalUsd(value: string): string | null {
  const match = new RegExp(String.raw`\$\s*(${NUMBER})|(${NUMBER})\s*(?:usd|usdc|dollars?)\b`, "iu").exec(value);
  const raw = match?.[1] ?? match?.[2];
  return raw ? normalizeDecimal(raw) : null;
}

function resolveLimitPrice(value: string): string | null {
  const match = new RegExp(String.raw`\b(?:limit|at|@|harga|price)\s*\$?\s*(${NUMBER})`, "iu").exec(value);
  return match ? normalizeDecimal(match[1]) : null;
}

function resolveLeverage(value: string): number | null {
  const match = new RegExp(String.raw`(${NUMBER})\s*x\b|\bleverage\s*(?:of|:)?\s*(${NUMBER})`, "iu").exec(value);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const leverage = Number(normalizeDecimal(raw));
  return Number.isFinite(leverage) && leverage > 0 && leverage <= 20 ? leverage : null;
}

function normalizeDecimal(raw: string): string {
  return raw.replace(",", ".");
}
