import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  InvestmentAllocation,
  InvestmentAssetClass,
  InvestmentProfile,
  InvestmentRecommendation,
  InvestmentRiskProfile,
} from "@/lib/db";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPITER_TOKENS = "https://api.jup.ag/tokens/v2";
const JUPITER_TOKENS_LITE = "https://lite-api.jup.ag/tokens/v2";
const JUPITER_PRICE = "https://api.jup.ag/price/v3";
const JUPITER_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const DEXSCREENER = "https://api.dexscreener.com";
const SNAPSHOT_TTL_MS = 15 * 60_000;

type JsonRecord = Record<string, unknown>;

type SignedRecommendation = {
  userId: string;
  snapshot: Omit<InvestmentRecommendation, "id">;
};

function recommendationSecret(): string {
  const value = process.env.INVESTMENT_RECOMMENDATION_SECRET?.trim()
    || process.env.WORKER_ENCRYPTION_KEY?.trim()
    || process.env.DATABASE_URL?.trim();
  if (!value || value.length < 24) throw new Error("The server recommendation signing secret is not configured.");
  return value;
}

function signSnapshot(value: SignedRecommendation): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signature = createHmac("sha256", recommendationSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySnapshot(userId: string, id: string): InvestmentRecommendation | null {
  const separator = id.lastIndexOf(".");
  if (separator <= 0 || id.length > 80_000) return null;
  const payload = id.slice(0, separator);
  const supplied = Buffer.from(id.slice(separator + 1));
  const expected = Buffer.from(createHmac("sha256", recommendationSecret()).update(payload).digest("base64url"));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedRecommendation;
    if (parsed.userId !== userId || !Array.isArray(parsed.snapshot?.profiles) || Date.parse(parsed.snapshot.expiresAt) <= Date.now()) return null;
    return { ...parsed.snapshot, id };
  } catch {
    return null;
  }
}

type Candidate = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  assetClass: InvestmentAssetClass;
  underlyingTicker?: string;
  issuer?: string;
  priceUsd: number | null;
  underlyingPriceUsd?: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24hPct: number | null;
  poolAgeHours: number | null;
  organicScore: number | null;
  holderCount: number | null;
  verified: boolean;
  fresh: boolean;
  auditBlocked: boolean;
  routeAvailable: boolean;
  sources: Array<"Jupiter" | "DexScreener">;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function headers(): HeadersInit {
  const key = process.env.JUPITER_API_KEY?.trim();
  return key ? { "x-api-key": key } : {};
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Market data provider returned ${response.status}.`);
  return response.json();
}

function tokenRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.map(record).filter((row): row is JsonRecord => Boolean(row));
  const root = record(payload);
  const data = root?.data;
  return Array.isArray(data) ? data.map(record).filter((row): row is JsonRecord => Boolean(row)) : [];
}

function inferStock(row: JsonRecord, fromStocksFeed: boolean): { assetClass: InvestmentAssetClass; ticker?: string; issuer?: string } {
  const symbol = text(row.symbol) ?? "";
  const name = text(row.name) ?? "";
  const tags = Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const haystack = `${symbol} ${name} ${tags.join(" ")}`.toLowerCase();
  const commodity = /\bgold\b|\bsilver\b|\boil\b|\bcommodity\b|\bcommodities\b|\bplatinum\b|\bpalladium\b/iu.test(haystack)
    || /^(?:GLD|SLV|USO|IAU|PPLT|PALL)(?:x|on)?$/iu.test(symbol);
  if (commodity) return { assetClass: "crypto" };
  const isEtf = /\betf\b|sp500|nasdaq|s&p/iu.test(haystack);
  const tokenized = /tokenized|xstock|\bstock\b|\bequity\b|remora/iu.test(haystack)
    || (fromStocksFeed && /(?:x|on)$/iu.test(symbol));
  if (!tokenized) return { assetClass: symbol.toUpperCase() === "USDC" ? "stablecoin" : "crypto" };
  const ticker = (text(row.ticker) ?? symbol).replace(/(?:on|x)$/iu, "").toUpperCase();
  const issuer = /ondo/iu.test(haystack) || /on$/iu.test(symbol) ? "Ondo" : /xstock|x$/iu.test(haystack) ? "xStocks" : undefined;
  return { assetClass: isEtf ? "tokenized_etf" : "tokenized_stock", ticker, issuer };
}

function normalizeToken(row: JsonRecord, fromStocksFeed: boolean, fresh: boolean): Candidate | null {
  const mint = text(row.id) ?? text(row.address) ?? text(row.mint);
  const symbol = text(row.symbol);
  if (!mint || !symbol || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(mint)) return null;
  const audit = record(row.audit);
  const stock = inferStock(row, fromStocksFeed);
  const mintAuthorityDisabled = audit?.mintAuthorityDisabled;
  const freezeAuthorityDisabled = audit?.freezeAuthorityDisabled;
  const issuerManaged = stock.assetClass.startsWith("tokenized");
  const auditBlocked = audit?.isSus === true
    || audit?.isSuspected === true
    || (!issuerManaged && (mintAuthorityDisabled === false || freezeAuthorityDisabled === false));
  return {
    mint,
    symbol: symbol.toUpperCase(),
    name: text(row.name) ?? symbol,
    decimals: Math.max(0, Math.min(18, number(row.decimals) ?? 9)),
    ...stock,
    priceUsd: number(row.usdPrice) ?? number(row.price),
    underlyingPriceUsd: number(row.underlyingPrice),
    liquidityUsd: number(row.liquidity),
    volume24hUsd: number(record(row.stats24h)?.buyVolume) !== null || number(record(row.stats24h)?.sellVolume) !== null
      ? (number(record(row.stats24h)?.buyVolume) ?? 0) + (number(record(row.stats24h)?.sellVolume) ?? 0)
      : number(row.volume24h),
    priceChange24hPct: number(record(row.stats24h)?.priceChange) ?? number(row.priceChange24h),
    poolAgeHours: number(row.firstPoolCreatedAt) ? (Date.now() - Number(row.firstPoolCreatedAt)) / 3_600_000 : null,
    organicScore: number(row.organicScore),
    holderCount: number(row.holderCount),
    verified: row.isVerified === true || (Array.isArray(row.tags) && row.tags.includes("verified")) || mint === SOL_MINT || mint === USDC_MINT,
    fresh,
    auditBlocked,
    routeAvailable: mint === USDC_MINT,
    sources: ["Jupiter"],
  };
}

async function discoverJupiter(): Promise<Candidate[]> {
  const feeds = [
    { path: "/toporganicscore/24h?limit=30", stock: false, fresh: false },
    { path: "/toptraded/24h?limit=30", stock: false, fresh: false },
    { path: "/toptrending/24h?limit=30", stock: false, fresh: false },
    // Jupiter's documented `stocks` tag has not been stable across deployments.
    // Search issuer families instead, then retain only rows classified below as tokenized.
    { path: "/search?query=xStock", stock: true, fresh: false },
    { path: "/search?query=Ondo%20Tokenized", stock: true, fresh: false },
    { path: "/recent", stock: false, fresh: true },
    { path: `/search?query=${SOL_MINT},${USDC_MINT}`, stock: false, fresh: false },
  ];
  const settled = await Promise.allSettled(feeds.map(async (feed) => {
    const primary = await fetchJson(`${JUPITER_TOKENS}${feed.path}`, { headers: headers() }).catch(() => null);
    const payload = tokenRows(primary).length
      ? primary
      : await fetchJson(`${JUPITER_TOKENS_LITE}${feed.path}`);
    return { feed, payload };
  }));
  const merged = new Map<string, Candidate>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const row of tokenRows(result.value.payload)) {
      const next = normalizeToken(row, result.value.feed.stock, result.value.feed.fresh);
      if (!next) continue;
      const current = merged.get(next.mint);
      if (!current) merged.set(next.mint, next);
      else merged.set(next.mint, {
        ...current,
        ...next,
        assetClass: current.assetClass.startsWith("tokenized") ? current.assetClass : next.assetClass,
        underlyingTicker: current.underlyingTicker ?? next.underlyingTicker,
        issuer: current.issuer ?? next.issuer,
        fresh: current.fresh || next.fresh,
        verified: current.verified || next.verified,
      });
    }
  }
  return [...merged.values()];
}

async function enrichDex(candidates: Candidate[]): Promise<void> {
  const selected = candidates.slice(0, 90);
  for (let offset = 0; offset < selected.length; offset += 30) {
    const batch = selected.slice(offset, offset + 30);
    try {
      const payload = await fetchJson(`${DEXSCREENER}/tokens/v1/solana/${batch.map((item) => item.mint).join(",")}`);
      if (!Array.isArray(payload)) continue;
      const byMint = new Map<string, JsonRecord[]>();
      for (const value of payload) {
        const pair = record(value);
        const base = record(pair?.baseToken);
        const quote = record(pair?.quoteToken);
        const mint = text(base?.address) ?? text(quote?.address);
        if (!pair || !mint) continue;
        byMint.set(mint, [...(byMint.get(mint) ?? []), pair]);
      }
      for (const candidate of batch) {
        const pairs = byMint.get(candidate.mint) ?? [];
        const best = pairs.sort((a, b) => (number(record(b.liquidity)?.usd) ?? 0) - (number(record(a.liquidity)?.usd) ?? 0))[0];
        if (!best) continue;
        candidate.liquidityUsd = number(record(best.liquidity)?.usd) ?? candidate.liquidityUsd;
        candidate.volume24hUsd = number(record(best.volume)?.h24) ?? candidate.volume24hUsd;
        candidate.priceChange24hPct = number(record(best.priceChange)?.h24) ?? candidate.priceChange24hPct;
        const createdAt = number(best.pairCreatedAt);
        candidate.poolAgeHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3_600_000) : candidate.poolAgeHours;
        candidate.priceUsd = number(best.priceUsd) ?? candidate.priceUsd;
        candidate.sources = ["Jupiter", "DexScreener"];
      }
    } catch {
      // Jupiter remains the source of truth when DexScreener is unavailable.
    }
  }
}

async function hasRoute(candidate: Candidate): Promise<boolean> {
  if (candidate.mint === USDC_MINT) return true;
  try {
    const url = new URL(JUPITER_QUOTE);
    url.searchParams.set("inputMint", USDC_MINT);
    url.searchParams.set("outputMint", candidate.mint);
    url.searchParams.set("amount", "1000000");
    url.searchParams.set("slippageBps", "100");
    url.searchParams.set("restrictIntermediateTokens", "true");
    const quote = record(await fetchJson(url.toString(), { headers: headers() }));
    return Boolean(quote && text(quote.outAmount) && Number(quote.outAmount) > 0);
  } catch {
    return false;
  }
}

function score(candidate: Candidate, profile: InvestmentRiskProfile): number {
  const liquidity = Math.log10(Math.max(1, candidate.liquidityUsd ?? 1)) * 8;
  const volume = Math.log10(Math.max(1, candidate.volume24hUsd ?? 1)) * 5;
  const organic = (candidate.organicScore ?? 0) * 0.35;
  const verification = candidate.verified ? 24 : 0;
  const momentum = Math.max(-20, Math.min(40, candidate.priceChange24hPct ?? 0));
  if (profile === "conservative") return liquidity + volume + organic + verification - Math.abs(momentum) * 0.5 - (candidate.fresh ? 100 : 0);
  if (profile === "moderate") return liquidity + volume + organic + verification + momentum * 0.25 - (candidate.fresh ? 40 : 0);
  return liquidity + volume + organic + verification * 0.5 + momentum * 0.75 + (candidate.fresh ? 12 : 0);
}

function isTokenizedEquity(candidate: Candidate): boolean {
  if (!candidate.assetClass.startsWith("tokenized")) return false;
  const identity = `${candidate.symbol} ${candidate.name} ${candidate.underlyingTicker ?? ""}`;
  return !/\bgold\b|\bsilver\b|\boil\b|\bcommodity\b|\bcommodities\b|\bplatinum\b|\bpalladium\b/iu.test(identity)
    && !/^(?:GLD|SLV|USO|IAU|PPLT|PALL)(?:x|on)?(?:\s|$)/iu.test(identity);
}

function eligible(candidate: Candidate, profile: InvestmentRiskProfile): boolean {
  if (candidate.auditBlocked || !candidate.routeAvailable || candidate.priceUsd === null) return false;
  if (candidate.mint === SOL_MINT || candidate.mint === USDC_MINT) return true;
  if (candidate.assetClass.startsWith("tokenized") && !candidate.verified) return false;
  if (candidate.assetClass.startsWith("tokenized")) {
    const minimumLiquidity = profile === "conservative" ? 250_000 : profile === "moderate" ? 150_000 : 75_000;
    const minimumVolume = profile === "conservative" ? 25_000 : profile === "moderate" ? 15_000 : 10_000;
    const organicFloor = profile === "aggressive" ? 30 : 40;
    return (candidate.liquidityUsd ?? 0) >= minimumLiquidity
      && (candidate.volume24hUsd ?? 0) >= minimumVolume
      && (candidate.poolAgeHours == null || candidate.poolAgeHours >= 24)
      && (candidate.organicScore ?? 0) >= organicFloor;
  }
  if (profile !== "aggressive" && (!candidate.verified || candidate.fresh)) return false;
  const minimumLiquidity = profile === "aggressive" ? 100_000 : profile === "moderate" ? 250_000 : 500_000;
  const minimumVolume = profile === "aggressive" ? 50_000 : 100_000;
  const minimumAge = candidate.fresh ? 24 : profile === "conservative" ? 168 : 72;
  return (candidate.liquidityUsd ?? 0) >= minimumLiquidity
    && (candidate.volume24hUsd ?? 0) >= minimumVolume
    && (candidate.poolAgeHours ?? 0) >= minimumAge
    && (!candidate.fresh || (candidate.holderCount ?? 0) >= 500)
    && (candidate.organicScore ?? 0) >= (candidate.fresh ? 35 : 50);
}

function allocation(candidate: Candidate, index: number, percentage: number, budgetUsd: number, profile: InvestmentRiskProfile): InvestmentAllocation {
  const underlyingTicker = (candidate.underlyingTicker ?? candidate.symbol).replace(/(?:on|x)$/iu, "").toUpperCase();
  const flags: string[] = [];
  if (candidate.assetClass.startsWith("tokenized")) flags.push("Issuer, tracking, market-hours, liquidity, and jurisdiction risk.");
  if (candidate.fresh) flags.push("Fresh token: limited market history and substantially higher volatility.");
  if ((candidate.priceChange24hPct ?? 0) > 20) flags.push("High 24-hour price momentum may reverse quickly.");
  return {
    index,
    mint: candidate.mint,
    symbol: candidate.symbol,
    name: candidate.name,
    decimals: candidate.decimals,
    assetClass: candidate.assetClass,
    underlyingTicker,
    issuer: candidate.issuer,
    percentage,
    amountUsd: Number((budgetUsd * percentage / 100).toFixed(2)),
    priceUsd: candidate.priceUsd,
    underlyingPriceUsd: candidate.underlyingPriceUsd,
    trackingDeviationPct: candidate.priceUsd && candidate.underlyingPriceUsd
      ? Number((((candidate.priceUsd - candidate.underlyingPriceUsd) / candidate.underlyingPriceUsd) * 100).toFixed(2))
      : null,
    liquidityUsd: candidate.liquidityUsd,
    volume24hUsd: candidate.volume24hUsd,
    priceChange24hPct: candidate.priceChange24hPct,
    poolAgeHours: candidate.poolAgeHours,
    organicScore: candidate.organicScore,
    verified: candidate.verified,
    rationale: [
      `Recommended for on-chain exposure to ${underlyingTicker}.`,
      candidate.liquidityUsd ? `It has approximately $${Math.round(candidate.liquidityUsd).toLocaleString("en-US")} in tracked liquidity` : "Liquidity data passed the profile filter",
      candidate.volume24hUsd ? `and $${Math.round(candidate.volume24hUsd).toLocaleString("en-US")} in 24-hour volume.` : "with an active Jupiter route.",
      candidate.organicScore != null ? `Jupiter organic score is ${candidate.organicScore.toFixed(1)}/100.` : "",
      profile === "conservative"
        ? "It ranked highly for market depth and lower short-term volatility."
        : profile === "aggressive"
          ? "It ranked highly for current market activity, with correspondingly higher price risk."
          : "It offers a balance of liquidity, activity, and price stability for the moderate profile.",
    ].filter(Boolean).join(" "),
    riskFlags: flags,
    sources: candidate.sources,
  };
}

function pick(candidates: Candidate[], profile: InvestmentRiskProfile, predicate: (item: Candidate) => boolean, excluded: Set<string>): Candidate | null {
  return candidates
    .filter((candidate) => !excluded.has(candidate.mint) && predicate(candidate) && eligible(candidate, profile))
    .sort((a, b) => score(b, profile) - score(a, profile))[0] ?? null;
}

function buildProfile(candidates: Candidate[], profile: InvestmentRiskProfile, budgetUsd: number): InvestmentProfile {
  const used = new Set<string>();
  const percentages = profile === "conservative" ? [45, 35, 20] : profile === "moderate" ? [40, 35, 25] : [40, 35, 25];
  const choices = percentages.map((percentage) => {
    const candidate = pick(candidates, profile, isTokenizedEquity, used);
    if (candidate) used.add(candidate.mint);
    return { candidate, percentage };
  });

  const selected: Array<{ candidate: Candidate; percentage: number }> = [];
  used.clear();
  for (const choice of choices) {
    if (!choice.candidate || used.has(choice.candidate.mint)) continue;
    used.add(choice.candidate.mint);
    selected.push({ candidate: choice.candidate, percentage: choice.percentage });
  }
  if (!selected.length) throw new Error(`No eligible tokenized stocks are available for the ${profile} profile.`);
  const total = selected.reduce((sum, item) => sum + item.percentage, 0);
  if (selected.length && total !== 100) selected[0].percentage += 100 - total;
  const labels = { conservative: "Conservative", moderate: "Moderate", aggressive: "Aggressive" } as const;
  const summaries = {
    conservative: "Prioritizes the deepest tokenized-stock markets and lower short-term volatility.",
    moderate: "Balances tokenized-stock liquidity, organic activity, and price momentum.",
    aggressive: "Favors more active tokenized-stock markets and accepts higher price volatility.",
  } as const;
  return {
    id: profile,
    label: labels[profile],
    summary: summaries[profile],
    allocations: selected.map((item, index) => allocation(item.candidate, index, item.percentage, budgetUsd, profile)),
  };
}

export async function createInvestmentRecommendation(input: { userId: string; walletAddress: string; budgetUsd: number }): Promise<InvestmentRecommendation> {
  const candidates = await discoverJupiter();
  if (!candidates.some((candidate) => candidate.mint === SOL_MINT) || !candidates.some((candidate) => candidate.mint === USDC_MINT)) {
    throw new Error("Jupiter core asset metadata is unavailable.");
  }
  await enrichDex(candidates);
  const ranked = candidates.sort((a, b) => score(b, "moderate") - score(a, "moderate"));
  const routeChecks = [...new Map([
    ...ranked.slice(0, 14),
    ...ranked.filter((item) => item.assetClass.startsWith("tokenized")).slice(0, 8),
    ...ranked.filter((item) => item.fresh).slice(0, 5),
    ...ranked.filter((item) => item.mint === SOL_MINT || item.mint === USDC_MINT),
  ].map((item) => [item.mint, item])).values()];
  const availability = await Promise.all(routeChecks.map(hasRoute));
  routeChecks.forEach((candidate, index) => { candidate.routeAvailable = availability[index]; });

  const profiles = (["conservative", "moderate", "aggressive"] as const).map((profile) => buildProfile(candidates, profile, input.budgetUsd));
  if (profiles.some((profile) => profile.allocations.reduce((sum, item) => sum + item.percentage, 0) !== 100)) {
    throw new Error("A complete three-profile allocation could not be produced from current market data.");
  }
  const expiresAt = new Date(Date.now() + SNAPSHOT_TTL_MS);
  const snapshot = {
    budgetUsd: input.budgetUsd,
    generatedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    profiles,
    tokenizedStockDisclosure: "Tokenized stocks are SPL tokens, not direct ownership of the underlying shares. A Jupiter route does not establish legal eligibility, redemption rights, or availability in your jurisdiction.",
    dataWarnings: ["Only verified, routeable tokenized stocks are included. Pump.fun and ordinary crypto tokens are excluded from this recommendation."],
  } satisfies Omit<InvestmentRecommendation, "id">;
  const id = signSnapshot({ userId: input.userId, snapshot });
  return { ...snapshot, id };
}

export async function loadOwnedRecommendation(userId: string, id: string): Promise<InvestmentRecommendation | null> {
  return verifySnapshot(userId, id);
}

export async function getUsdPrice(mint: string): Promise<number> {
  if (mint === USDC_MINT) return 1;
  const payload = record(await fetchJson(`${JUPITER_PRICE}?ids=${encodeURIComponent(mint)}`, { headers: headers() }));
  const row = record(payload?.[mint]);
  const price = number(row?.usdPrice) ?? number(row?.price);
  if (!price || price <= 0) throw new Error("The funding asset price is unavailable.");
  return price;
}

export async function getInvestmentQuote(input: { inputMint: string; outputMint: string; amountRaw: string; slippageBps: number }): Promise<JsonRecord> {
  const url = new URL(JUPITER_QUOTE);
  url.searchParams.set("inputMint", input.inputMint);
  url.searchParams.set("outputMint", input.outputMint);
  url.searchParams.set("amount", input.amountRaw);
  url.searchParams.set("slippageBps", String(input.slippageBps));
  url.searchParams.set("restrictIntermediateTokens", "true");
  const quote = record(await fetchJson(url.toString(), { headers: headers() }));
  if (!quote || !text(quote.outAmount)) throw new Error("Jupiter did not return a usable route.");
  return quote;
}
