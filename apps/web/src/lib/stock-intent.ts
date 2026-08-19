export type StockAnalysisIntent = {
  requested: boolean;
  ticker: string | null;
};

const STOCK_KEYWORD = /\b(?:saham|stock|stocks|emiten|equities|equity)\b|\$([A-Z]{1,5})\b/iu;

const STOPWORDS = new Set([
  "A", "I", "AN", "THE", "FOR", "AND", "OR", "TO", "IN", "ON", "AT", "IS", "OF", "ME", "YOU", "CAN", "US", "USA",
  "SOL", "USDC", "USDG", "ETH", "WETH", "BTC", "WBTC", "USDT", "PUMP",
  "EACH", "ALL", "THIS", "THAT", "MORE", "SOME", "BEST", "TOP", "GOOD", "ANY", "EVERY", "NEXT", "LAST", "WITH",
  "FROM", "ABOUT", "OVER", "INTO", "LIKE", "HOW", "WHAT", "WHY", "WHEN", "WHERE", "WHICH", "WHO", "FIND", "CHECK",
  "VIEW", "GET", "SEE", "TELL", "SHOW", "GIVE", "ANALYSIS", "ANALYZE", "SCREEN", "SCREENING", "MARKET", "TRADING",
  "TRADE", "STOCK", "STOCKS", "SAHAM", "PRICE", "PRICES", "SETUP", "SETUPS", "MIRAE", "ASSET", "ASSETS", "TOKEN",
  "TOKENS", "HIGH", "LOW", "ZONE", "RISK", "STOP", "LOSS", "TAKE", "PROFIT", "RSI", "MACD", "DATE", "TIME", "DATA",
  "TERM", "LONG", "SHORT", "WEEK", "WEEKS", "DAYS", "DAY", "MONTH", "YEAR", "WILL", "WOULD", "COULD", "SHOULD",
  "BE", "BEEN", "HAVE", "HAS", "HAD", "DO", "DOES", "DID", "NOT", "NO", "YES", "IF", "SO", "BUT", "BY", "OUT",
]);

export function resolveStockAnalysisIntent(text: string): StockAnalysisIntent {
  if (!text || typeof text !== "string") {
    return { requested: false, ticker: null };
  }

  const trimmed = text.trim();

  // Check if message explicitly mentions stock / saham / equity or $TICKER
  const hasKeyword = STOCK_KEYWORD.test(trimmed);
  if (!hasKeyword) {
    return { requested: false, ticker: null };
  }

  // 1. Check for $TICKER pattern: e.g. "$NVDA" or "$AAPL"
  const cashtagMatch = /\$([A-Za-z]{1,5})\b/u.exec(trimmed);
  if (cashtagMatch && cashtagMatch[1]) {
    const symbol = cashtagMatch[1].toUpperCase();
    if (!STOPWORDS.has(symbol)) {
      return { requested: true, ticker: symbol };
    }
  }

  // 2. Check for direct phrases:
  // "saham <TICKER>", "stock <TICKER>", "<TICKER> stock", "analisa <TICKER>", "analyze <TICKER>"
  const directPatterns = [
    /\b(?:saham|stock|emiten|ticker|shares?)\s+([A-Za-z]{1,5})\b/iu,
    /\b(?:analisa|analisis|analyze|analysis|check|cek)\s+(?:saham\s+|stock\s+)?([A-Za-z]{1,5})\b/iu,
    /\b([A-Za-z]{1,5})\s+(?:stock|saham|shares?)\b/iu,
  ];

  for (const pattern of directPatterns) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      const candidate = match[1].toUpperCase();
      if (!STOPWORDS.has(candidate) && candidate.length >= 2) {
        return { requested: true, ticker: candidate };
      }
    }
  }

  // 3. Check for standalone all-uppercase words in the original string (e.g. "NVDA", "AAPL", "TSLA")
  const rawWords = trimmed.split(/[\s,.;:!?()\[\]"'/]+/u);
  for (const rawWord of rawWords) {
    if (/^[A-Z]{2,5}$/u.test(rawWord)) {
      const candidate = rawWord.toUpperCase();
      if (!STOPWORDS.has(candidate)) {
        return { requested: true, ticker: candidate };
      }
    }
  }

  // If stock keyword is present but no specific single ticker was extracted (e.g. broad screening prompt), return ticker: null
  return { requested: true, ticker: null };
}
