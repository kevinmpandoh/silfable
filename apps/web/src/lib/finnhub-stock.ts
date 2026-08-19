import "server-only";

export interface StockQuote {
  currentPrice: number;
  change: number;
  percentChange: number;
  highOfDay: number;
  lowOfDay: number;
  openPrice: number;
  previousClose: number;
  timestamp: number;
}

export interface StockCompanyProfile {
  name: string;
  ticker: string;
  exchange: string;
  currency: string;
  industry: string;
  logo?: string;
  weburl?: string;
  marketCapMillions?: number;
}

export interface StockFinancialMetrics {
  week52High?: number;
  week52Low?: number;
  peRatio?: number;
  beta?: number;
  eps?: number;
  dividendYield?: number;
}

export interface StockRecommendationTrend {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface OnChainStockToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  issuer?: string;
  priceUsd?: number;
}

export interface StockAnalysisIntelligence {
  ticker: string;
  companyName: string;
  quote: StockQuote;
  profile: StockCompanyProfile;
  metrics: StockFinancialMetrics;
  recommendation?: StockRecommendationTrend | null;
  analystConsensus?: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "Neutral";
  onChainToken?: OnChainStockToken | null;
  fetchedAt: number;
}

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function fetchStockQuote(symbol: string, apiKey: string): Promise<StockQuote | null> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const currentPrice = Number(data.c);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  return {
    currentPrice,
    change: Number(data.d) || 0,
    percentChange: Number(data.dp) || 0,
    highOfDay: Number(data.h) || currentPrice,
    lowOfDay: Number(data.l) || currentPrice,
    openPrice: Number(data.o) || currentPrice,
    previousClose: Number(data.pc) || currentPrice,
    timestamp: Number(data.t) ? Number(data.t) * 1000 : Date.now(),
  };
}

export async function fetchStockProfile(symbol: string, apiKey: string): Promise<StockCompanyProfile | null> {
  const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const name = typeof data.name === "string" && data.name.trim() ? data.name : symbol.toUpperCase();
  return {
    name,
    ticker: typeof data.ticker === "string" ? data.ticker : symbol.toUpperCase(),
    exchange: typeof data.exchange === "string" ? data.exchange : "US Exchange",
    currency: typeof data.currency === "string" ? data.currency : "USD",
    industry: typeof data.finnhubIndustry === "string" ? data.finnhubIndustry : "Equities",
    logo: typeof data.logo === "string" && data.logo ? data.logo : undefined,
    weburl: typeof data.weburl === "string" ? data.weburl : undefined,
    marketCapMillions: typeof data.marketCapitalization === "number" ? data.marketCapitalization : undefined,
  };
}

export async function fetchStockMetrics(symbol: string, apiKey: string): Promise<StockFinancialMetrics> {
  try {
    const url = `${FINNHUB_BASE}/stock/metric?symbol=${encodeURIComponent(symbol.toUpperCase())}&metric=all&token=${apiKey}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return {};
    const data = (await res.json()) as { metric?: Record<string, unknown> };
    const metric = data.metric || {};
    return {
      week52High: typeof metric["52WeekHigh"] === "number" ? metric["52WeekHigh"] : undefined,
      week52Low: typeof metric["52WeekLow"] === "number" ? metric["52WeekLow"] : undefined,
      peRatio:
        typeof metric.peNormalizedAnnual === "number"
          ? metric.peNormalizedAnnual
          : typeof metric.peBasicExclExtraTTM === "number"
            ? metric.peBasicExclExtraTTM
            : undefined,
      beta: typeof metric.beta === "number" ? metric.beta : undefined,
      eps: typeof metric.epsTTM === "number" ? metric.epsTTM : undefined,
      dividendYield: typeof metric.dividendYieldIndicatedAnnual === "number" ? metric.dividendYieldIndicatedAnnual : undefined,
    };
  } catch {
    return {};
  }
}

export async function fetchStockRecommendation(symbol: string, apiKey: string): Promise<StockRecommendationTrend | null> {
  try {
    const url = `${FINNHUB_BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${apiKey}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const latest = data[0] as Record<string, unknown>;
    return {
      period: typeof latest.period === "string" ? latest.period : "Recent",
      strongBuy: Number(latest.strongBuy) || 0,
      buy: Number(latest.buy) || 0,
      hold: Number(latest.hold) || 0,
      sell: Number(latest.sell) || 0,
      strongSell: Number(latest.strongSell) || 0,
    };
  } catch {
    return null;
  }
}

function deriveAnalystConsensus(rec?: StockRecommendationTrend | null): StockAnalysisIntelligence["analystConsensus"] {
  if (!rec) return undefined;
  const buys = rec.strongBuy * 2 + rec.buy;
  const sells = rec.strongSell * 2 + rec.sell;
  const total = buys + sells + rec.hold;
  if (total === 0) return "Neutral";
  if (rec.strongBuy > rec.buy && rec.strongBuy > rec.hold && rec.strongBuy > sells) return "Strong Buy";
  if (buys > sells * 1.5 && buys > rec.hold) return "Buy";
  if (sells > buys * 1.5 && sells > rec.hold) return "Sell";
  if (rec.strongSell > rec.sell && rec.strongSell > buys) return "Strong Sell";
  return "Hold";
}

export async function findTokenizedStockOnSolana(ticker: string): Promise<OnChainStockToken | null> {
  try {
    const cleanTicker = ticker.trim().toUpperCase();
    const urls = [
      `https://lite-api.jup.ag/tokens/v2/search?query=x${cleanTicker}`,
      `https://lite-api.jup.ag/tokens/v2/search?query=${cleanTicker}`,
    ];

    const results = await Promise.allSettled(
      urls.map(async (u) => {
        const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
        if (!res.ok) return [];
        return (await res.json()) as Array<Record<string, unknown>>;
      }),
    );

    const candidates: Array<Record<string, unknown>> = [];
    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        candidates.push(...r.value);
      }
    }

    for (const row of candidates) {
      const symbol = typeof row.symbol === "string" ? row.symbol.toUpperCase() : "";
      const name = typeof row.name === "string" ? row.name : "";
      const mint = typeof row.id === "string" ? row.id : typeof row.address === "string" ? row.address : typeof row.mint === "string" ? row.mint : "";
      if (!mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(mint)) continue;

      // Strictly exclude pump.fun tokens
      if (mint.toLowerCase().endsWith("pump") || name.toLowerCase().includes("pump.fun")) continue;

      const isXStock = (symbol === `X${cleanTicker}` || symbol === `${cleanTicker}X`) && !name.toLowerCase().includes("pump");
      const isOndo = (symbol.startsWith(cleanTicker) && (symbol.endsWith("ON") || name.toLowerCase().includes("ondo"))) || name.toLowerCase().includes("ondo tokenized");
      const exactMatch = symbol === cleanTicker && (name.toLowerCase().includes("tokenized") || name.toLowerCase().includes("backed") || name.toLowerCase().includes("wrapped"));

      if (isXStock || isOndo || exactMatch) {
        // Verify that Jupiter actually has a live route for this mint
        try {
          const testQuoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=${mint}&amount=1000000&slippageBps=100`;
          const testRes = await fetch(testQuoteUrl, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
          if (!testRes.ok) continue;
          const testData = (await testRes.json()) as { outAmount?: string };
          if (!testData.outAmount || testData.outAmount === "0") continue;
        } catch {
          continue;
        }

        const decimals = typeof row.decimals === "number" ? row.decimals : 9;
        const issuer = isOndo ? "Ondo Finance" : isXStock ? "xStocks" : "Tokenized Stock";
        const priceUsd = typeof row.usdPrice === "number" ? row.usdPrice : typeof row.price === "number" ? row.price : undefined;
        return {
          mint,
          symbol,
          name: name || symbol,
          decimals,
          issuer,
          priceUsd,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function analyzeStock(symbol: string, customApiKey?: string): Promise<StockAnalysisIntelligence> {
  const apiKey = customApiKey || process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Finnhub API key is not configured. Set FINNHUB_API_KEY in your environment.");
  }
  const cleanSymbol = symbol.trim().toUpperCase();

  const [quote, profile, metrics, recommendation, onChainToken] = await Promise.all([
    fetchStockQuote(cleanSymbol, apiKey),
    fetchStockProfile(cleanSymbol, apiKey),
    fetchStockMetrics(cleanSymbol, apiKey),
    fetchStockRecommendation(cleanSymbol, apiKey),
    findTokenizedStockOnSolana(cleanSymbol),
  ]);

  if (!quote) {
    throw new Error(`Stock ticker '${cleanSymbol}' not found or market data is unavailable.`);
  }

  const companyProfile = profile || {
    name: cleanSymbol,
    ticker: cleanSymbol,
    exchange: "US Exchange",
    currency: "USD",
    industry: "Equities",
  };

  return {
    ticker: cleanSymbol,
    companyName: companyProfile.name,
    quote,
    profile: companyProfile,
    metrics,
    recommendation,
    analystConsensus: deriveAnalystConsensus(recommendation),
    onChainToken,
    fetchedAt: Date.now(),
  };
}

export async function fetchTopStockMarketScreening(
  tickers: string[] = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"],
  customApiKey?: string,
): Promise<StockAnalysisIntelligence[]> {
  const apiKey = customApiKey || process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return [];
  const results = await Promise.allSettled(tickers.map((t) => analyzeStock(t, apiKey)));
  return results
    .filter((r): r is PromiseFulfilledResult<StockAnalysisIntelligence> => r.status === "fulfilled")
    .map((r) => r.value);
}

