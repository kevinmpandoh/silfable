import { z } from "zod";

function number(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const TOKEN_REFERENCE = String.raw`(?:0x[0-9a-f]{40}|[a-z][a-z0-9_-]{1,31})`;

export function parseEvmAutomationText(text: string) {
  let amount = "1";
  let inputReference = "USDG";
  let outputReference = "AAPL";

  const dollarMatch = /dca\s+\$([0-9]+(?:[.,][0-9]+)?)/iu.exec(text);
  const targetMatch = /(?:into|in|ke|to)\s+(?:tokenized\s+stock\s+)?([a-zA-Z0-9_-]{2,42})(?:\s+tokenized\s+stock|\s+stock)?/iu.exec(text);
  const pair = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s+(${TOKEN_REFERENCE})\\s*(?:ke|to|→|->)\\s*(${TOKEN_REFERENCE})(?:\\s+(?:address|contract)?\\s*(0x[0-9a-f]{40}))?`, "iu").exec(text);

  if (pair) {
    amount = pair[1]!.replace(",", ".");
    inputReference = pair[2]!;
    outputReference = (pair[4] || pair[3])!;
  } else if (dollarMatch && targetMatch) {
    amount = dollarMatch[1]!.replace(",", ".");
    inputReference = "USDG";
    outputReference = targetMatch[1]!;
  } else {
    return null;
  }

  const interval = /(?:every|setiap)\s+(\d+(?:[.,]\d+)?)\s*(second|seconds|sec|detik|minute|minutes|min|menit|hour|hours|jam|day|days|hari)/iu.exec(text);
  const units = interval?.[2]?.toLowerCase() ?? "";
  const multiplier = /hour|jam/u.test(units) ? 3600 : /day|hari/u.test(units) ? 86_400 : /second|sec|detik/u.test(units) ? 1 : 60;
  const intervalSeconds = Math.round((number(interval?.[1]?.replace(",", ".")) ?? 0) * multiplier);

  let maximumExecutions: number | undefined;
  const cycleMatch = /(?:for|selama|sebanyak|maximum|max)\s+(\d+)\s*(?:cycles?|times?|kali)?|\b(\d+)\s*(?:cycles?|times?|kali)\b/iu.exec(text);
  const durationMatch = /(?:selama|for\s+(?:up\s+to\s+|up\s+)?)\s*(\d+)\s*(detik|seconds?|sec|s|menit|minutes?|min|m|jam|hours?|hrs?|h)\b/iu.exec(text);

  if (cycleMatch) {
    maximumExecutions = number(cycleMatch[1] ?? cycleMatch[2]);
  } else if (durationMatch && intervalSeconds > 0) {
    const durVal = number(durationMatch[1]);
    const durUnit = durationMatch[2]!.toLowerCase();
    const durMult = /hours?|hrs?|jam/u.test(durUnit) ? 3600 : /minutes?|mins?|menit/u.test(durUnit) ? 60 : 1;
    if (durVal) maximumExecutions = Math.max(1, Math.floor((durVal * durMult) / intervalSeconds));
  }

  return {
    amount,
    inputReference,
    outputReference,
    intervalSeconds,
    maximumExecutions,
  };
}

export const ROBINHOOD_NATIVE_ETH = "0x0000000000000000000000000000000000000000";
export const ROBINHOOD_USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

const TokenSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  address: z.string().regex(/^0x[0-9a-f]{40}$/iu),
  decimals: z.number().int().min(0).max(36),
});

const CommonSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{24}$/iu),
  walletAddress: z.string().regex(/^0x[0-9a-f]{40}$/iu),
  input: TokenSchema,
  output: TokenSchema,
  amount: z.string().regex(/^\d+(?:\.\d+)?$/u),
  expiresInDays: z.number().int().min(1).max(365).default(30),
}).superRefine((value, context) => {
  if (value.input.symbol === value.output.symbol) context.addIssue({ code: "custom", path: ["output"], message: "Input and output assets must differ" });
  if (Number(value.amount) <= 0) context.addIssue({ code: "custom", path: ["amount"], message: "Amount must be positive" });
});

export const CreateEvmAutomationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DCA"), common: CommonSchema, intervalSeconds: z.number().int().min(60).max(31_536_000), maximumExecutions: z.number().int().min(1).max(365) }),
  z.object({ kind: z.literal("EXIT"), common: CommonSchema, entryPriceUsd: z.number().positive(), takeProfitPriceUsd: z.number().positive().optional(), stopLossPriceUsd: z.number().positive().optional() }).superRefine((value, context) => {
    if (value.takeProfitPriceUsd == null && value.stopLossPriceUsd == null) context.addIssue({ code: "custom", path: ["takeProfitPriceUsd"], message: "Set a take-profit or stop-loss price" });
    if (value.takeProfitPriceUsd != null && value.takeProfitPriceUsd <= value.entryPriceUsd) context.addIssue({ code: "custom", path: ["takeProfitPriceUsd"], message: "Take-profit must be above entry" });
    if (value.stopLossPriceUsd != null && value.stopLossPriceUsd >= value.entryPriceUsd) context.addIssue({ code: "custom", path: ["stopLossPriceUsd"], message: "Stop-loss must be below entry" });
  }),
]);

export function evmToken(symbol: "ETH" | "USDG") {
  return symbol === "ETH"
    ? { symbol, decimals: 18, address: ROBINHOOD_NATIVE_ETH, native: true }
    : { symbol, decimals: 6, address: ROBINHOOD_USDG, native: false };
}

export function encodeStoredEvmToken(token: { symbol: string; address: string }): string {
  return `${token.symbol}@${token.address.toLowerCase()}`;
}

export function decodeStoredEvmToken(value: string, decimals: number) {
  const separator = value.lastIndexOf("@");
  if (separator > 0) {
    const symbol = value.slice(0, separator);
    const address = value.slice(separator + 1).toLowerCase();
    if (symbol && /^0x[0-9a-f]{40}$/u.test(address)) {
      return { symbol, address, decimals, native: address === ROBINHOOD_NATIVE_ETH };
    }
  }
  if (value === "ETH" || value === "USDG") return evmToken(value);
  throw new Error(`Automation token ${value} is missing its validated contract address.`);
}
