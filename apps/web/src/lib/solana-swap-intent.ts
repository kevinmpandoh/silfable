export interface SolanaSwapIntent {
  requested: boolean;
  amount: number | null;
  inputSymbol: string;
  outputSymbol: string | null;
  outputMint?: string;
}

const SWAP_KEYWORDS = /\b(?:swap|tukar|convert|beli|buy|trade)\b/iu;

export function resolveSolanaSwapIntent(text: string): SolanaSwapIntent {
  if (!text || typeof text !== "string") {
    return { requested: false, amount: null, inputSymbol: "USDC", outputSymbol: null };
  }

  const trimmed = text.trim();
  if (!SWAP_KEYWORDS.test(trimmed)) {
    return { requested: false, amount: null, inputSymbol: "USDC", outputSymbol: null };
  }
  if (/\b(?:do not|don't|never|jangan|tidak)\b[^.!?\n]{0,80}\b(?:swap|trade|buy|beli|tukar|convert)\b/iu.test(trimmed)) {
    return { requested: false, amount: null, inputSymbol: "USDC", outputSymbol: null };
  }

  // Check if it's a bridge request (which has "bridge" or cross-chain keywords)
  if (/\bbridge\b/iu.test(trimmed)) {
    return { requested: false, amount: null, inputSymbol: "USDC", outputSymbol: null };
  }

  // 1. Extract numerical amount
  let amount: number | null = null;
  const amountMatch = /(?:(\d+(?:\.\d+)?)\s*(?:usdc|sol|usdg|usd|\$))|(?:(?:usdc|sol|usdg|usd|\$)\s*(\d+(?:\.\d+)?))|(?:\b(?:amount|sebesar|sejumlah|pakai|dari|with)\s*(?:usdc|sol)?\s*(\d+(?:\.\d+)?))/iu.exec(trimmed);
  if (amountMatch) {
    const raw = amountMatch[1] || amountMatch[2] || amountMatch[3];
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // Fallback number search if not captured above
  if (amount === null) {
    const genericNum = /\b(\d+(?:\.\d+)?)\b/u.exec(trimmed);
    if (genericNum) {
      const parsed = Number(genericNum[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // 2. Determine input symbol (defaults to USDC if "usdc" mentioned or if buying a stock, else SOL if "sol" mentioned)
  let inputSymbol = "USDC";
  if (/\bsol\b/iu.test(trimmed) && !/\b(?:to|ke|jadi|menjadi|for|into)\s+sol\b/iu.test(trimmed)) {
    inputSymbol = "SOL";
  } else if (/\busdc\b/iu.test(trimmed)) {
    inputSymbol = "USDC";
  }

  // 3. Determine output symbol / ticker
  // Matches:
  // "swap untuk NVDA dari usdc 0.5" -> output: NVDA
  // "swap 0.5 usdc ke NVDA" / "swap 0.5 usdc to NVDA" -> output: NVDA
  // "beli NVDA pakai 0.5 usdc" -> output: NVDA
  // "tukar SOL jadi USDC" -> output: USDC
  let outputSymbol: string | null = null;

  const patterns = [
    /\b(?:untuk|for)\s+([A-Za-z0-9]{2,10})\s+(?:dari|pakai|with|using|from)\b/iu,
    /\b(?:to|ke|jadi|menjadi|into)\s+([A-Za-z0-9]{2,10})\b/iu,
    /\b(?:beli|buy|swap)\s+([A-Za-z0-9]{2,10})\s+(?:dari|pakai|with|using|from|for|dengan)\b/iu,
    /\b(?:beli|buy)\s+([A-Za-z0-9]{2,10})\b/iu,
    /\b(?:swap)\s+(?:untuk\s+)?([A-Za-z0-9]{2,10})\b/iu,
  ];

  for (const p of patterns) {
    const m = p.exec(trimmed);
    if (m && m[1]) {
      const candidate = m[1].toUpperCase();
      if (candidate !== "USDC" && candidate !== "SOL" && candidate !== "SWAP" && candidate !== "UNTUK" && candidate !== "DARI") {
        outputSymbol = candidate;
        break;
      } else if ((candidate === "USDC" || candidate === "SOL") && candidate !== inputSymbol) {
        outputSymbol = candidate;
        break;
      }
    }
  }

  // Clean output symbol if it starts with $
  if (outputSymbol && outputSymbol.startsWith("$")) {
    outputSymbol = outputSymbol.slice(1);
  }

  return {
    requested: Boolean(outputSymbol || amount !== null),
    amount,
    inputSymbol,
    outputSymbol,
  };
}
