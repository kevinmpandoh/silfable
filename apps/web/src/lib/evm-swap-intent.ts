export type RobinhoodSwapIntent = {
  requested: boolean;
  amount: string | null;
  sellToken: "USDG" | "ETH" | null;
  buyToken: "USDG" | "ETH" | null;
};

const SWAP_WORD = /\b(?:swap|tukar|convert|jual|beli)\b/iu;
const PAIR = /\b(usd(?:g)?|eth)\b\s*(?:ke|to|->|→)\s*\b(usd(?:g)?|eth)\b/iu;
const AMOUNT = /(?:\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:(?:dari|of)\s+)?(?:usd(?:g)?|eth)\b/iu;

function symbol(value: string): "USDG" | "ETH" | null {
  const normalized = value.toUpperCase();
  if (normalized === "USD" || normalized === "USDG") return "USDG";
  return normalized === "ETH" ? "ETH" : null;
}

/** Parses only the two pinned Robinhood assets; all chain data remains application-owned. */
export function resolveRobinhoodSwapIntent(message: string): RobinhoodSwapIntent {
  if (!SWAP_WORD.test(message)) return { requested: false, amount: null, sellToken: null, buyToken: null };
  const pair = message.match(PAIR);
  if (!pair) return { requested: true, amount: null, sellToken: null, buyToken: null };
  const sellToken = symbol(pair[1]);
  const buyToken = symbol(pair[2]);
  const amountMatch = message.match(AMOUNT);
  const amount = amountMatch?.[1]?.replace(",", ".") ?? null;
  return { requested: true, amount, sellToken, buyToken };
}
