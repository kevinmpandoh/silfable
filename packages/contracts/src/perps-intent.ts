const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

export const MIRAE_CHAT_PERP_SYMBOLS = ["SOL", "BTC", "ETH", "JUP", "ONDO", "DOGE"] as const;

export type MiraePerpPromptIntent =
  | { requested: false }
  | {
      requested: true;
      symbol: string | null;
      direction: "long" | "short" | null;
      notionalUsd: number | null;
      marginUsd: number | null;
      leverage: number;
      error: "conflicting_leverage" | "invalid_leverage" | null;
    };

export function parseMiraePerpPrompt(text: string): MiraePerpPromptIntent {
  const value = typeof text === "string" ? text.slice(0, 4_000) : "";
  const direction = resolveDirection(value);
  const requested = Boolean(direction) && /\b(?:perp(?:s|etual|etuals)?|futures|leverage|lev|margin|collateral)\b/iu.test(value);
  if (!requested) return { requested: false };

  const leverageResult = resolveLeverage(value);
  const marginUsd = resolveUsdBefore(value, String.raw`(?:margin|collateral)`);
  const explicitNotional = resolveNotional(value, marginUsd !== null);
  const leverage = leverageResult.value ?? 2;

  return {
    requested: true,
    symbol: resolveSymbol(value),
    direction,
    marginUsd,
    notionalUsd: marginUsd !== null ? roundMoney(marginUsd * leverage) : explicitNotional,
    leverage,
    error: leverageResult.error,
  };
}

function resolveDirection(value: string): "long" | "short" | null {
  const long = /\b(?:long|buy|beli)\b/iu.test(value);
  const short = /\b(?:short|sell|jual)\b/iu.test(value);
  return long === short ? null : long ? "long" : "short";
}

function resolveSymbol(value: string): string | null {
  const explicit = /\b([A-Za-z0-9]{2,12})[-\s]?perp\b/iu.exec(value)?.[1];
  const directed = /\b(?:long|short|buy|sell|beli|jual)\s+([A-Za-z0-9]{2,12})\b/iu.exec(value)?.[1];
  const candidate = (explicit ?? directed)?.toUpperCase() ?? null;
  return candidate && (MIRAE_CHAT_PERP_SYMBOLS as readonly string[]).includes(candidate) ? candidate : null;
}

function resolveUsdBefore(value: string, suffix: string): number | null {
  const match = new RegExp(String.raw`(?:\$\s*(${NUMBER})|(${NUMBER})\s*(?:usd|usdc)?)\s*${suffix}\b`, "iu").exec(value);
  return parseNumber(match?.[1] ?? match?.[2]);
}

function resolveNotional(value: string, hasMargin: boolean): number | null {
  if (hasMargin) return null;
  const match = new RegExp(String.raw`\$\s*(${NUMBER})|(${NUMBER})\s*(?:usd|usdc|dollars?)\b`, "iu").exec(value);
  return parseNumber(match?.[1] ?? match?.[2]);
}

function resolveLeverage(value: string): { value: number | null; error: "conflicting_leverage" | "invalid_leverage" | null } {
  const matches = [...value.matchAll(new RegExp(String.raw`(${NUMBER})\s*x\b`, "giu"))];
  const values = matches.map((match) => parseNumber(match[1])).filter((item): item is number => item !== null);
  if (values.length === 0) return { value: null, error: null };
  if (values.some((item) => item < 1 || item > 10 || !Number.isInteger(item))) return { value: null, error: "invalid_leverage" };
  const distinct = [...new Set(values)];
  return distinct.length > 1
    ? { value: null, error: "conflicting_leverage" }
    : { value: distinct[0]!, error: null };
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
