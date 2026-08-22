import { createHash } from "node:crypto";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type {
  PerpMarket,
  PerpPosition,
  PerpAccount,
  PerpProposal,
  PerpOrderPlan,
} from "@mirae/contracts";
import { PerpOrderPlanSchema } from "@mirae/contracts";
import {
  buildCreateAssociatedTokenAccountIdempotentSync,
  buildSplTokenTransfer,
  createPhoenixClient,
  deriveFlameDepositAddresses,
  getPhoenixTraderSubaccountAddress,
} from "@ellipsis-labs/rise";
import { address } from "@solana/kit";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

function deriveAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

const PHOENIX_API =
  process.env.PHOENIX_PERP_API_URL?.trim() || "https://perp-api.phoenix.trade";
const PHOENIX_PROGRAM_ID = "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih";
const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_MARK_PRICE_AGE_SLOTS = 1_500;
export const MIN_PERP_NOTIONAL_USD = 0.5;
export const MAX_PERP_NOTIONAL_USD = 5_000;
export const MAX_PERP_LEVERAGE = 10;
export const MIRAE_TRADER_PDA_INDEX = 0;
const USDC_DECIMALS = 6;
const ORDER_VALIDITY_MS = 45_000;
const SETUP_VALIDITY_MS = 10 * 60_000;
const MARKET_LIST_TTL_MS = 60_000;
const MARKET_LIST_STALE_MS = 10 * 60_000;
const CANDLE_TTL_MS = 20_000;
const CANDLE_STALE_MS = 10 * 60_000;
const MARK_PRICE_TTL_MS = 8_000;
const FUNDING_TTL_MS = 300_000;
const ACCOUNT_TTL_MS = 30_000;
const ACCOUNT_STALE_FALLBACK_MS = 300_000;
const PHOENIX_REQUEST_SPACING_MS = 150;
const RATE_LIMIT_RETRY_DELAYS_MS = [750, 1_500, 3_000] as const;

export const MIRAE_PERP_SYMBOLS = [
  "SOL",
  "BTC",
  "ETH",
  "JUP",
  "ONDO",
  "DOGE",
] as const;

const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const EMBER_PROGRAM = "EMBERpYNE6ehWmXymZZS2skiFmCa9V5dp14e1iduM5qy";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

type ApiAccountMeta = {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
};
type ApiInstruction = {
  programId: string;
  keys: ApiAccountMeta[];
  data: number[];
};
type ApiBuildRegister = {
  instructions: ApiInstruction[];
  traderPda: string;
  traderOnboarder: string;
  txFeePayer: string;
  maxPositions: number;
  includeRegisterTrader: boolean;
};
type ApiSendRegister = ApiBuildRegister & { signature: string };

type ApiMarket = {
  marketPubkey: string;
  symbol: string;
  baseAssetSymbol?: string;
  quoteAssetSymbol?: string;
  marketStatus: string;
  baseLotsDecimals: number;
  takerFee: number;
  leverageTiers: Array<{
    maxLeverage: number;
    maxSizeBaseLots: number | string;
  }>;
  statsSnapshot?: { openInterestBaseLots?: number | string } | null;
};

type ApiMarkPrice = {
  symbol: string;
  slot: number;
  markPrice?: { price: number | string; slot: number } | null;
};

type ApiFunding = {
  symbol: string;
  rates?: Array<{ timestamp: string | number; fundingRatePercentage: string }>;
};

type ApiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ApiPosition = {
  symbol: string;
  basePositionLots: string;
  entryPriceUsd: string;
};

type ApiAccount = {
  authority: string;
  snapshot: {
    capabilities?: {
      capabilities?: {
        placeMarketOrder?: { immediate?: boolean };
        depositCollateral?: { immediate?: boolean };
      };
    };
    subaccounts: Array<{
      collateral: string;
      positions?: ApiPosition[];
    }>;
  };
};

type ApiWalletAccess = { whitelisted: boolean };

let cachedMarkets: { data: ApiMarket[]; expiresAt: number } | null = null;
let cachedMarketViews: {
  data: PerpMarket[];
  expiresAt: number;
  staleUntil: number;
} | null = null;
const candleCache = new Map<
  string,
  { data: ApiCandle[]; expiresAt: number; staleUntil: number }
>();
const candleRequests = new Map<string, Promise<ApiCandle[]>>();
const markPriceCache = new Map<
  string,
  { data: ApiMarkPrice; expiresAt: number }
>();
const fundingCache = new Map<string, { data: ApiFunding; expiresAt: number }>();
const accountCache = new Map<
  string,
  { data: PerpAccount; expiresAt: number; staleUntil: number }
>();
const submittedCollateral = new Map<
  string,
  { amountUsd: number; submittedAt: number }
>();
let nextPhoenixRequestAt = 0;

const COLLATERAL_CREDIT_WAIT_MS = 24 * 60 * 60_000;

export function rememberSubmittedCollateral(
  walletAddress: string,
  amountUsd: number,
  submittedAt = Date.now()
): void {
  const authority = new PublicKey(walletAddress).toBase58();
  if (
    !Number.isFinite(amountUsd) ||
    amountUsd <= 0 ||
    !Number.isFinite(submittedAt)
  )
    return;
  submittedCollateral.set(authority, { amountUsd, submittedAt });
  accountCache.delete(authority);
}

async function waitForPhoenixRequestSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextPhoenixRequestAt - now);
  nextPhoenixRequestAt =
    Math.max(now, nextPhoenixRequestAt) + PHOENIX_REQUEST_SPACING_MS;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function phoenixRequest<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    await waitForPhoenixRequestSlot();
    const response = await fetch(`${PHOENIX_API}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const raw = await response.text();
    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(
        `The perpetuals service returned an unreadable response for ${path} (HTTP ${response.status}).`
      );
    }
    if (response.ok) return payload as T;

    if (
      response.status === 429 &&
      attempt < RATE_LIMIT_RETRY_DELAYS_MS.length
    ) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryAfterMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(retryAfterSeconds * 1_000, 5_000)
          : RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      continue;
    }

    if (response.status === 429) {
      throw new Error(
        "The live perpetuals service is busy. Wait a few seconds, refresh market data, and prepare the order again."
      );
    }
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (() => {
            const record = payload as Record<string, unknown>;
            const summary = String(record.error);
            const details = record.message ?? record.detail ?? record.details;
            return details === undefined
              ? summary
              : `${summary}: ${
                  typeof details === "string"
                    ? details
                    : JSON.stringify(details)
                }`;
          })()
        : `The perpetuals request failed with status ${response.status}.`;
    throw new Error(message);
  }
}

export function normalizeSymbol(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/-PERP$/u, "")
    .replace(/\/USD$/u, "")
    .replace(/\/USDC$/u, "");
}

export function isAllowedSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{1,16}$/u.test(normalizeSymbol(symbol));
}

export async function getPhoenixPerpCandles(
  symbol: string,
  timeframe = "1h",
  limit = 120
) {
  const normalized = normalizeSymbol(symbol);
  if (!isAllowedSymbol(normalized))
    throw new Error("Invalid perpetual market symbol.");
  if (!/^(?:1m|5m|15m|1h|4h|1d)$/u.test(timeframe))
    throw new Error("Unsupported candle timeframe.");
  const safeLimit = Math.max(20, Math.min(240, Math.trunc(limit)));
  const key = `${normalized}:${timeframe}:${safeLimit}`;
  const now = Date.now();
  const cached = candleCache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;
  const pending = candleRequests.get(key);
  if (pending) return pending;
  const request = phoenixRequest<ApiCandle[]>(
    `/v1/candles/${encodeURIComponent(
      normalized
    )}?timeframe=${timeframe}&limit=${safeLimit}&enableExternalSource=true`
  )
    .then((candles) => {
      const valid = candles.filter((candle) =>
        [
          candle.time,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
        ].every(Number.isFinite)
      );
      if (valid.length >= 2) {
        const storedAt = Date.now();
        candleCache.set(key, {
          data: valid,
          expiresAt: storedAt + CANDLE_TTL_MS,
          staleUntil: storedAt + CANDLE_STALE_MS,
        });
      }
      return valid;
    })
    .catch((error) => {
      if (cached && cached.staleUntil > Date.now()) return cached.data;
      throw error;
    })
    .finally(() => candleRequests.delete(key));
  candleRequests.set(key, request);
  return request;
}

async function fetchMarkets(): Promise<ApiMarket[]> {
  const now = Date.now();
  if (cachedMarkets && cachedMarkets.expiresAt > now) return cachedMarkets.data;
  const list = await phoenixRequest<ApiMarket[]>("/v1/view/exchange/markets");
  if (!Array.isArray(list) || list.length === 0)
    throw new Error("No live perpetual markets are available.");
  cachedMarkets = { data: list, expiresAt: now + MARKET_LIST_TTL_MS };
  return list;
}

async function fetchMarkPrice(symbol: string): Promise<ApiMarkPrice | null> {
  const norm = normalizeSymbol(symbol);
  const now = Date.now();
  const hit = markPriceCache.get(norm);
  if (hit && hit.expiresAt > now) return hit.data;
  try {
    const payload = await phoenixRequest<ApiMarkPrice>(
      `/v1/market/${encodeURIComponent(norm)}/mark-price`
    );
    if (payload?.markPrice && Number(payload.markPrice.price) > 0) {
      markPriceCache.set(norm, {
        data: payload,
        expiresAt: now + MARK_PRICE_TTL_MS,
      });
      return payload;
    }
  } catch {
    // Fallback if endpoint is unavailable
  }
  return hit?.data ?? null;
}

async function fetchFunding(symbol: string): Promise<ApiFunding | null> {
  const norm = normalizeSymbol(symbol);
  const now = Date.now();
  const hit = fundingCache.get(norm);
  if (hit && hit.expiresAt > now) return hit.data;
  try {
    const payload = await phoenixRequest<ApiFunding>(
      `/v1/funding/${encodeURIComponent(norm)}/rates?limit=1`
    );
    if (payload) {
      fundingCache.set(norm, {
        data: payload,
        expiresAt: now + FUNDING_TTL_MS,
      });
      return payload;
    }
  } catch {
    // Fallback
  }
  return hit?.data ?? null;
}

export async function listPhoenixPerpMarkets(
  rpcUrl: string
): Promise<PerpMarket[]> {
  const cached = cachedMarketViews;
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const connection = new Connection(rpcUrl, "confirmed");
  try {
    const [chainSlot, rawMarkets] = await Promise.all([
      connection.getSlot("confirmed"),
      fetchMarkets(),
    ]);
    if (chainSlot <= 0 || !Array.isArray(rawMarkets))
      throw new Error("Live perpetual markets are unavailable.");
    const ranked = rawMarkets
      .filter(
        (market) =>
          isAllowedSymbol(market.symbol) && market.marketStatus === "active"
      )
      .sort((left, right) => {
        const leftOi =
          Number(left.statsSnapshot?.openInterestBaseLots ?? 0) *
          10 ** -left.baseLotsDecimals;
        const rightOi =
          Number(right.statsSnapshot?.openInterestBaseLots ?? 0) *
          10 ** -right.baseLotsDecimals;
        return rightOi - leftOi;
      });
    const priority = ranked.filter((market) =>
      (MIRAE_PERP_SYMBOLS as readonly string[]).includes(
        normalizeSymbol(market.symbol)
      )
    );
    const allowed = [
      ...priority,
      ...ranked.filter((market) => !priority.includes(market)),
    ].slice(0, 12);
    const results = (
      await Promise.all(
        allowed.map(async (meta): Promise<PerpMarket | null> => {
          const sym = normalizeSymbol(meta.symbol);
          const mark = await fetchMarkPrice(sym);
          if (!mark?.markPrice) return null;
          const oraclePriceUsd = Number(mark.markPrice.price);
          const oracleSlot = Number(mark.markPrice.slot || mark.slot);
          const oracleAgeSlots = Math.max(0, chainSlot - oracleSlot);
          const stepSizeBase = 10 ** -Math.max(0, meta.baseLotsDecimals);
          const cachedFunding = fundingCache.get(sym)?.data.rates?.at(-1);
          const hourlyFunding = Number(
            cachedFunding?.fundingRatePercentage ?? 0
          );
          const maxVenueLeverage = Math.max(
            1,
            ...meta.leverageTiers
              .map((tier) => Number(tier.maxLeverage))
              .filter(Number.isFinite)
          );
          return {
            symbol: `${sym}-PERP`,
            baseAssetSymbol: sym,
            marketPubkey: new PublicKey(meta.marketPubkey).toBase58(),
            oraclePriceUsd,
            fundingRateHourlyPctLong: Number.isFinite(hourlyFunding)
              ? hourlyFunding
              : 0,
            fundingRateHourlyPctShort: Number.isFinite(hourlyFunding)
              ? -hourlyFunding
              : 0,
            openInterestBase:
              Number(meta.statsSnapshot?.openInterestBaseLots ?? 0) *
              stepSizeBase,
            maxLeverage: Math.min(MAX_PERP_LEVERAGE, maxVenueLeverage),
            minOrderBase: stepSizeBase,
            stepSizeBase,
            takerFeeBps: Number(meta.takerFee) * 10_000,
            oracleSlot,
            oracleAgeSlots,
            stale: oracleAgeSlots > MAX_MARK_PRICE_AGE_SLOTS,
          };
        })
      )
    ).filter((market): market is PerpMarket => market !== null);
    if (results.length === 0)
      throw new Error(
        "Live perpetual market prices are unavailable. No synthetic fallback data was used."
      );
    const storedAt = Date.now();
    cachedMarketViews = {
      data: results,
      expiresAt: storedAt + MARKET_LIST_TTL_MS,
      staleUntil: storedAt + MARKET_LIST_STALE_MS,
    };
    return results;
  } catch (error) {
    if (cached && cached.staleUntil > Date.now()) return cached.data;
    throw error;
  }
}

export async function getPhoenixPerpAccount(
  walletAddress: string,
  rpcUrl: string
): Promise<PerpAccount> {
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = new PublicKey(walletAddress).toBase58();
  const cachedAccount = accountCache.get(authority);
  if (cachedAccount && cachedAccount.expiresAt > Date.now())
    return cachedAccount.data;
  const traderAccountAddress = await getPhoenixTraderSubaccountAddress({
    authority: address(authority) as never,
    traderPdaIndex: MIRAE_TRADER_PDA_INDEX,
    subaccountIndex: 0,
  });
  const traderAccountInfo = await connection.getAccountInfo(
    new PublicKey(traderAccountAddress),
    "confirmed"
  );
  const traderAccountExists =
    traderAccountInfo !== null &&
    traderAccountInfo.owner.toBase58() === PHOENIX_PROGRAM_ID &&
    traderAccountInfo.data.length > 0;
  let walletUsdcBalance = 0;
  let pendingCollateralUsd = 0;
  let proxyBalanceUsd = 0;
  let tradingAccessReady: boolean | null = null;
  try {
    const access = await phoenixRequest<ApiWalletAccess>(
      `/v1/invite/check/${encodeURIComponent(authority)}`
    );
    tradingAccessReady = access.whitelisted === true;
  } catch {
    tradingAccessReady = null;
  }
  try {
    const ata = deriveAssociatedTokenAddress(
      USDC_MINT,
      new PublicKey(authority)
    );
    const tokenBalance = await connection.getTokenAccountBalance(ata);
    walletUsdcBalance = tokenBalance.value.uiAmount ?? 0;
  } catch {
    walletUsdcBalance = 0;
  }
  try {
    const flame = await deriveFlameDepositAddresses({
      userAuthority: address(authority) as never,
      traderPdaIndex: MIRAE_TRADER_PDA_INDEX,
      mintAddress: address(USDC_MINT.toBase58()) as never,
      phoenixProgramAddress: address(PHOENIX_PROGRAM_ID) as never,
    });
    const pendingBalance = await connection.getTokenAccountBalance(
      new PublicKey(flame.proxyAta),
      "confirmed"
    );
    proxyBalanceUsd = pendingBalance.value.uiAmount ?? 0;
    pendingCollateralUsd = proxyBalanceUsd;
    if (pendingCollateralUsd <= 0) {
      const proxyAta = new PublicKey(flame.proxyAta);
      const recentSignatures = await connection.getSignaturesForAddress(
        proxyAta,
        { limit: 5 },
        "confirmed"
      );
      const recent = recentSignatures.find(
        (entry) =>
          entry.err === null &&
          Date.now() - (entry.blockTime ?? 0) * 1_000 <=
            COLLATERAL_CREDIT_WAIT_MS
      );
      if (recent) {
        const parsed = await connection.getParsedTransaction(recent.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        for (const instruction of parsed?.transaction.message.instructions ??
          []) {
          if (!("parsed" in instruction) || instruction.program !== "spl-token")
            continue;
          const info = instruction.parsed?.info as
            | {
                authority?: string;
                destination?: string;
                amount?: string;
                tokenAmount?: { uiAmount?: number | null };
              }
            | undefined;
          if (
            info?.authority !== authority ||
            info.destination !== flame.proxyAta
          )
            continue;
          const amount =
            info.tokenAmount?.uiAmount ??
            Number(info.amount ?? 0) / 10 ** USDC_DECIMALS;
          if (Number.isFinite(amount) && amount > 0)
            pendingCollateralUsd = Math.max(pendingCollateralUsd, amount);
        }
      }
    }
  } catch {
    pendingCollateralUsd = 0;
  }

  try {
    const [payload, markets] = await Promise.all([
      phoenixRequest<ApiAccount>(
        `/v1/trader/state/${encodeURIComponent(
          authority
        )}?traderPdaIndex=${MIRAE_TRADER_PDA_INDEX}`
      ),
      listPhoenixPerpMarkets(rpcUrl),
    ]);
    const positions: PerpPosition[] = [];
    const venueCapabilities = payload.snapshot.capabilities?.capabilities;
    if (
      venueCapabilities?.placeMarketOrder?.immediate === true &&
      venueCapabilities.depositCollateral?.immediate === true
    ) {
      // The trader-state capability snapshot is authoritative for execution.
      // Invite/waitlist membership is not equivalent to an existing trader's
      // on-chain permissions (cold accounts can still have immediate access).
      tradingAccessReady = true;
    }
    for (const raw of payload.snapshot.subaccounts.flatMap(
      (subaccount) => subaccount.positions ?? []
    )) {
      const sym = normalizeSymbol(raw.symbol);
      const market = markets.find(
        (entry) => normalizeSymbol(entry.symbol) === sym
      );
      if (!market) continue;
      const signedBase = Number(raw.basePositionLots) * market.stepSizeBase;
      if (!Number.isFinite(signedBase) || signedBase === 0) continue;
      const entry = Number(raw.entryPriceUsd);
      const mark = market.oraclePriceUsd;
      const base = Math.abs(signedBase);
      positions.push({
        symbol: `${sym}-PERP`,
        direction: signedBase > 0 ? "long" : "short",
        baseAmount: base,
        entryPriceUsd: entry,
        markPriceUsd: mark,
        notionalUsd: base * mark,
        unrealizedPnlUsd: signedBase * (mark - entry),
      });
    }
    // Trader-state collateral is returned in canonical USDC base units.
    const collateralUsd = payload.snapshot.subaccounts.reduce(
      (sum, subaccount) =>
        sum + Number(subaccount.collateral || 0) / 10 ** USDC_DECIMALS,
      0
    );
    if (collateralUsd > 0 && proxyBalanceUsd <= 0) pendingCollateralUsd = 0;
    const submitted = submittedCollateral.get(authority);
    if (collateralUsd > 0 && submitted) submittedCollateral.delete(authority);
    else if (
      submitted &&
      Date.now() - submitted.submittedAt <= COLLATERAL_CREDIT_WAIT_MS
    ) {
      pendingCollateralUsd = Math.max(
        pendingCollateralUsd,
        submitted.amountUsd
      );
    } else if (submitted) submittedCollateral.delete(authority);
    const unrealizedPnlUsd = positions.reduce(
      (sum, position) => sum + position.unrealizedPnlUsd,
      0
    );
    const totalNotionalUsd = positions.reduce(
      (sum, position) => sum + position.notionalUsd,
      0
    );
    const leverage = collateralUsd > 0 ? totalNotionalUsd / collateralUsd : 0;

    const account: PerpAccount = {
      walletAddress: authority,
      accountExists: true,
      walletUsdcBalance,
      collateralUsd,
      // The public snapshot does not publish a risk-adjusted free-collateral
      // field. Keep this conservative and let the order builder enforce the
      // authoritative margin check instead of overstating spendable balance.
      freeCollateralUsd: positions.length === 0 ? collateralUsd : 0,
      unrealizedPnlUsd,
      leverage,
      healthPct: positions.length === 0 ? 100 : 0,
      positions,
      pendingCollateralUsd,
      tradingAccessReady,
    };
    accountCache.set(authority, {
      data: account,
      expiresAt: Date.now() + ACCOUNT_TTL_MS,
      staleUntil: Date.now() + ACCOUNT_STALE_FALLBACK_MS,
    });
    return account;
  } catch (error) {
    // A wallet without a trader state can still use wallet USDC for cold
    // activation. Provider/network errors are surfaced by market loading and
    // order preparation; they never produce a signable fallback transaction.
    if (cachedAccount && cachedAccount.staleUntil > Date.now())
      return cachedAccount.data;
    if (traderAccountExists) throw error;
    const account: PerpAccount = {
      walletAddress: authority,
      accountExists: false,
      walletUsdcBalance,
      collateralUsd: 0,
      freeCollateralUsd: 0,
      unrealizedPnlUsd: 0,
      leverage: 0,
      healthPct: 100,
      positions: [],
      pendingCollateralUsd,
      tradingAccessReady,
    };
    accountCache.set(authority, {
      data: account,
      expiresAt: Date.now() + ACCOUNT_TTL_MS,
      staleUntil: Date.now() + ACCOUNT_STALE_FALLBACK_MS,
    });
    return account;
  }
}

export async function buildPhoenixOrderProposal(params: {
  symbol: string;
  direction: "long" | "short";
  notionalUsd: number;
  leverage: number;
  collateralUsdc?: string;
  reduceOnly?: boolean;
  baseAmount?: number;
  walletAddress: string;
  rpcUrl: string;
}): Promise<PerpProposal> {
  const walletAddress = new PublicKey(params.walletAddress).toBase58();
  const normSym = normalizeSymbol(params.symbol);
  const reduceOnly = params.reduceOnly === true;
  if (!isAllowedSymbol(normSym))
    throw new Error(
      `${normSym || "Unknown"}-PERP is not allowlisted by Mirae.`
    );
  if (
    !Number.isFinite(params.notionalUsd) ||
    params.notionalUsd <= 0 ||
    (!reduceOnly && params.notionalUsd < MIN_PERP_NOTIONAL_USD) ||
    params.notionalUsd > MAX_PERP_NOTIONAL_USD
  ) {
    throw new Error(
      `Perpetual notional must be between $${MIN_PERP_NOTIONAL_USD.toFixed(
        2
      )} and $${MAX_PERP_NOTIONAL_USD}.`
    );
  }
  if (
    !Number.isInteger(params.leverage) ||
    params.leverage < 1 ||
    params.leverage > MAX_PERP_LEVERAGE
  ) {
    throw new Error(
      `Leverage must be an integer from 1x to ${MAX_PERP_LEVERAGE}x.`
    );
  }
  const markets = await listPhoenixPerpMarkets(params.rpcUrl);
  const market = markets.find(
    (entry) => normalizeSymbol(entry.symbol) === normSym
  );
  if (!market)
    throw new Error(
      `${normSym}-PERP has no verified live market and cannot be prepared.`
    );
  const account = await getPhoenixPerpAccount(walletAddress, params.rpcUrl);

  const marginRequired = reduceOnly
    ? 0
    : Number((params.notionalUsd / Math.max(1, params.leverage)).toFixed(2));
  const collateral = reduceOnly
    ? 0
    : params.collateralUsdc
    ? Number(params.collateralUsdc)
    : marginRequired;
  if (
    !reduceOnly &&
    (!Number.isFinite(collateral) ||
      collateral <= 0 ||
      Math.abs(collateral - marginRequired) > 0.01)
  ) {
    throw new Error(
      "Collateral must match the guarded isolated-margin requirement."
    );
  }

  const rawQuantity = reduceOnly
    ? Number(params.baseAmount)
    : params.notionalUsd / market.oraclePriceUsd;
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0)
    throw new Error(
      "Reduce-only orders require an exact positive position size."
    );
  const quantityLots = Math.floor(
    (rawQuantity + Number.EPSILON) / market.stepSizeBase
  );
  const quantity = Number(
    (quantityLots * market.stepSizeBase).toFixed(
      Math.max(0, Math.ceil(-Math.log10(market.stepSizeBase)))
    )
  );
  const venueMinimumNotionalUsd =
    Math.ceil(market.minOrderBase * market.oraclePriceUsd * 100) / 100;
  const hasTradingCollateral =
    reduceOnly || account.freeCollateralUsd >= collateral;
  const collateralDepositPending =
    !reduceOnly && (account.pendingCollateralUsd ?? 0) > 0;
  const tradingAccessReady = account.tradingAccessReady === true;
  const canFundTradingCollateral =
    !reduceOnly &&
    !collateralDepositPending &&
    account.walletUsdcBalance >= collateral;

  const checks: Array<{
    code: string;
    status: "pass" | "block";
    message: string;
  }> = [
    {
      code: "market_allowlisted",
      status: "pass",
      message: `Market is pinned to the allowlisted perpetual market ${market.symbol}.`,
    },
    {
      code: "oracle_freshness",
      status: market.stale ? "block" : "pass",
      message: market.stale
        ? `Mark price is stale (${market.oracleAgeSlots} slots old).`
        : `Mark price published inside ${MAX_MARK_PRICE_AGE_SLOTS}-slot freshness window ($${market.oraclePriceUsd.toLocaleString()}).`,
    },
    {
      code: "notional_ceiling",
      status: "pass",
      message: reduceOnly
        ? `Reduce-only close notional is $${params.notionalUsd.toFixed(2)}.`
        : `Notional $${params.notionalUsd.toFixed(
            2
          )} is within the guarded $${MIN_PERP_NOTIONAL_USD.toFixed(
            2
          )}–$${MAX_PERP_NOTIONAL_USD} range.`,
    },
    {
      code: "leverage_ceiling",
      status: params.leverage <= market.maxLeverage ? "pass" : "block",
      message:
        params.leverage <= market.maxLeverage
          ? `${params.leverage}x leverage is within the verified ${market.maxLeverage}x market ceiling.`
          : `${params.leverage}x leverage exceeds the verified ${market.maxLeverage}x market ceiling.`,
    },
    {
      code: "min_order_size",
      status: quantity >= market.minOrderBase ? "pass" : "block",
      message:
        quantity >= market.minOrderBase
          ? `Order quantity ${quantity} ${market.baseAssetSymbol} satisfies contract minimum (${market.minOrderBase}).`
          : `Requested $${params.notionalUsd.toFixed(2)} cannot form one ${
              market.minOrderBase
            } ${
              market.baseAssetSymbol
            } lot. The current live minimum is approximately $${venueMinimumNotionalUsd.toFixed(
              2
            )}.`,
    },
    {
      code: "trading_access",
      status: tradingAccessReady ? "pass" : "block",
      message: tradingAccessReady
        ? "Perpetual trading access is verified for this wallet."
        : account.tradingAccessReady === false
        ? "This wallet has not completed the venue's required access onboarding. Deposits and orders are disabled."
        : "Perpetual trading access could not be verified. Deposits and orders are disabled until verification succeeds.",
    },
    {
      code: "collateral_check",
      status:
        tradingAccessReady && (hasTradingCollateral || canFundTradingCollateral)
          ? "pass"
          : "block",
      message: reduceOnly
        ? "Reduce-only close does not add collateral or increase exposure."
        : hasTradingCollateral
        ? `Trading collateral has $${account.freeCollateralUsd.toFixed(
            2
          )} available; this order requires $${collateral.toFixed(2)}.`
        : collateralDepositPending
        ? `$${(account.pendingCollateralUsd ?? 0).toFixed(
            2
          )} reached the deposit proxy but is not trading collateral yet. Do not deposit again; venue onboarding or support is required if it remains uncredited.`
        : canFundTradingCollateral
        ? `Wallet holds ${account.walletUsdcBalance.toFixed(
            2
          )} USDC. A separate $${collateral.toFixed(
            2
          )} trading-collateral deposit must be approved before the order.`
        : `Insufficient wallet USDC: funding requires $${collateral.toFixed(
            2
          )}, but the wallet holds ${account.walletUsdcBalance.toFixed(
            2
          )} USDC.`,
    },
    {
      code: "local_vault_required",
      status: "pass",
      message: "Local encrypted keystore password required to sign.",
    },
  ];

  let plan: PerpOrderPlan | undefined;
  let preparationError: string | null = null;
  const onboardingRequired = account.tradingAccessReady === false;
  const nonAccessChecksPass = checks.every(
    (check) =>
      check.code === "trading_access" ||
      check.code === "collateral_check" ||
      check.status === "pass"
  );
  if (
    checks.every((check) => check.status === "pass") ||
    (onboardingRequired && nonAccessChecksPass)
  ) {
    try {
      if (onboardingRequired) {
        plan = await buildFundingPlan({
          walletAddress,
          amountUsdc: collateral,
          registrationRequired: true,
          symbol: market.symbol,
          direction: params.direction,
          quantity,
          notionalUsd: params.notionalUsd,
          oraclePriceUsd: market.oraclePriceUsd,
          rpcUrl: params.rpcUrl,
          checks: checks.map((check) => check.message),
        });
        const accessCheck = checks.find(
          (check) => check.code === "trading_access"
        );
        if (accessCheck) {
          accessCheck.status = "pass";
          accessCheck.message =
            "Official builder onboarding is ready for wallet signature and venue co-signing.";
        }
        const collateralCheck = checks.find(
          (check) => check.code === "collateral_check"
        );
        if (collateralCheck) {
          collateralCheck.status = "pass";
          collateralCheck.message = collateralDepositPending
            ? `$${(account.pendingCollateralUsd ?? 0).toFixed(
                2
              )} is already in the deposit proxy. No additional deposit will be made during onboarding.`
            : "Collateral funding remains disabled until official onboarding confirms.";
        }
      } else if (!hasTradingCollateral && canFundTradingCollateral) {
        plan = await buildFundingPlan({
          walletAddress,
          amountUsdc: collateral,
          registrationRequired: false,
          symbol: market.symbol,
          direction: params.direction,
          quantity,
          notionalUsd: params.notionalUsd,
          oraclePriceUsd: market.oraclePriceUsd,
          rpcUrl: params.rpcUrl,
          checks: checks.map((check) => check.message),
        });
      } else {
        const instructions = await phoenixRequest<ApiInstruction[]>(
          "/v1/ix/place-isolated-market-order",
          {
            method: "POST",
            body: JSON.stringify({
              authority: walletAddress,
              symbol: normSym,
              side: params.direction === "long" ? "bid" : "ask",
              quantity,
              isReduceOnly: reduceOnly,
              // Isolated market orders require their collateral to be moved from
              // the trader's cross balance into the new isolated subaccount even
              // when the cross account already has sufficient free collateral.
              transferAmount: usdcToBaseUnits(String(collateral)),
              pdaIndex: MIRAE_TRADER_PDA_INDEX,
            }),
          }
        );

        if (Array.isArray(instructions) && instructions.length > 0) {
          const connection = new Connection(params.rpcUrl, "confirmed");
          const blockhash = await connection.getLatestBlockhash("finalized");
          const transaction = new VersionedTransaction(
            new TransactionMessage({
              payerKey: new PublicKey(walletAddress),
              recentBlockhash: blockhash.blockhash,
              instructions: [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
                ...instructions.map(toTransactionInstruction),
              ],
            }).compileToV0Message()
          );

          const simulation = await connection.simulateTransaction(transaction, {
            commitment: "confirmed",
            sigVerify: false,
            replaceRecentBlockhash: false,
          });
          if (simulation.value.err)
            throw new Error(
              `Unsigned Mainnet simulation failed: ${JSON.stringify(
                simulation.value.err
              )}`
            );
          const programs = invokedPrograms(simulation.value.logs);
          assertAllowedPerpPrograms(programs);
          const fee = await connection.getFeeForMessage(
            transaction.message,
            "confirmed"
          );

          plan = {
            action: "place_order",
            transactionBase64: Buffer.from(transaction.serialize()).toString(
              "base64"
            ),
            transactionDigest: messageDigest(transaction),
            walletAddress,
            symbol: market.symbol,
            direction: params.direction,
            orderKind: "market",
            reduceOnly,
            baseAmount: String(quantity),
            notionalUsd: params.notionalUsd.toFixed(2),
            oraclePriceUsd: market.oraclePriceUsd.toFixed(4),
            limitPriceUsd: null,
            networkFeeLamports: String(fee.value ?? 0),
            simulationSlot: simulation.context.slot,
            computeUnitsConsumed: simulation.value.unitsConsumed ?? null,
            invokedPrograms: programs,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
            expiresAt: Date.now() + ORDER_VALIDITY_MS,
            checks: checks.map((c) => c.message),
          };
        } else {
          throw new Error(
            "The perpetuals service returned no instructions for this order."
          );
        }
      }
    } catch (error) {
      preparationError =
        error instanceof Error
          ? error.message
          : "The perpetual order could not be prepared.";
    }
  }

  if (!plan)
    checks.push({
      code: "unsigned_preflight",
      status: "block",
      message:
        preparationError ??
        "No signable transaction was created because a policy check did not pass.",
    });

  return {
    id: `perp_${Date.now()}`,
    type: "perp_order",
    action: plan?.action ?? "place_order",
    symbol: market.symbol,
    direction: params.direction,
    orderKind: "market",
    reduceOnly,
    baseAmount: String(quantity),
    notionalUsd: params.notionalUsd.toFixed(2),
    collateralUsdc: String(collateral),
    leverage: params.leverage,
    oraclePriceUsd: market.oraclePriceUsd.toFixed(4),
    limitPriceUsd: null,
    networkFeeLamports: plan?.networkFeeLamports ?? "0",
    status: plan ? "ready_for_user_signature" : "blocked",
    mode: "local_vault",
    venue: "Solana Perpetuals",
    explanation:
      plan?.action === "register_account"
        ? "Prepared the one-time trading-account registration. Prepare the order again after registration confirms."
        : plan?.action === "fund_collateral"
        ? `Prepared a $${collateral.toFixed(
            2
          )} trading-collateral deposit. Prepare the order again after this funding transaction confirms.`
        : reduceOnly
        ? `Prepared a reduce-only close for ${quantity} ${market.baseAssetSymbol}.`
        : `Prepared ${params.direction.toUpperCase()} perpetual order on ${
            market.symbol
          } for $${params.notionalUsd.toFixed(2)} USD notional at ${
            params.leverage
          }x leverage.`,
    checks,
    account,
    plan,
  };
}

async function buildFundingPlan(params: {
  walletAddress: string;
  amountUsdc: number;
  registrationRequired: boolean;
  symbol: string;
  direction: "long" | "short";
  quantity: number;
  notionalUsd: number;
  oraclePriceUsd: number;
  rpcUrl: string;
  checks: string[];
}): Promise<PerpOrderPlan> {
  const client = createPhoenixClient({
    apiUrl: PHOENIX_API,
    rpcUrl: params.rpcUrl,
    ws: false,
    exchangeMetadata: { stream: false },
  });
  try {
    await client.exchange.ready();
    const sdkInstructions: any[] = [];
    const action: "register_account" | "fund_collateral" =
      params.registrationRequired ? "register_account" : "fund_collateral";
    let onboarderAddress: string | undefined;
    let maxPositions: number | undefined;
    if (params.registrationRequired) {
      const registration = await phoenixRequest<ApiBuildRegister>(
        "/v1/exchange/build-register-ixs",
        {
          method: "POST",
          body: JSON.stringify({
            traderAuthority: params.walletAddress,
            txFeePayer: params.walletAddress,
            maxPositions: 32,
          }),
        }
      );
      if (
        !Array.isArray(registration.instructions) ||
        registration.instructions.length === 0
      ) {
        throw new Error(
          "The venue returned no official onboarding instructions."
        );
      }
      if (registration.txFeePayer !== params.walletAddress)
        throw new Error(
          "The onboarding fee payer does not match the active wallet."
        );
      onboarderAddress = new PublicKey(registration.traderOnboarder).toBase58();
      maxPositions = registration.maxPositions;
      sdkInstructions.push(
        ...registration.instructions.map((instruction) => ({
          programAddress: address(instruction.programId),
          accounts: instruction.keys.map((key) => ({
            address: address(key.pubkey),
            role: key.isSigner
              ? key.isWritable
                ? 3
                : 2
              : key.isWritable
              ? 1
              : 0,
          })),
          data: Uint8Array.from(instruction.data),
        }))
      );
    } else {
      const authority = address(params.walletAddress);
      const usdcMint = address(USDC_MINT.toBase58());
      const flame = await deriveFlameDepositAddresses({
        userAuthority: authority as never,
        traderPdaIndex: MIRAE_TRADER_PDA_INDEX,
        mintAddress: usdcMint as never,
        phoenixProgramAddress: address(PHOENIX_PROGRAM_ID) as never,
      });
      const sourceUsdcAta = deriveAssociatedTokenAddress(
        USDC_MINT,
        new PublicKey(params.walletAddress)
      );
      sdkInstructions.push(
        buildCreateAssociatedTokenAccountIdempotentSync({
          payer: authority as never,
          ataAddress: flame.proxyAta,
          owner: flame.proxyAuthority,
          mint: usdcMint as never,
        }),
        buildSplTokenTransfer({
          owner: authority as never,
          sourceTokenAccount: address(sourceUsdcAta.toBase58()) as never,
          destinationTokenAccount: flame.proxyAta,
          amount: BigInt(usdcToBaseUnits(params.amountUsdc.toFixed(6))),
        })
      );
    }

    const connection = new Connection(params.rpcUrl, "confirmed");
    const blockhash = await connection.getLatestBlockhash("finalized");
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: new PublicKey(params.walletAddress),
        recentBlockhash: blockhash.blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
          ...sdkInstructions.map(toWeb3Instruction),
        ],
      }).compileToV0Message()
    );
    const programs = transactionProgramIds(transaction);
    assertAllowedPerpPrograms(programs);
    const simulation =
      action === "register_account"
        ? null
        : await connection.simulateTransaction(transaction, {
            commitment: "confirmed",
            sigVerify: false,
          });
    if (simulation?.value.err) {
      const failingIndex = Array.isArray(simulation.value.err)
        ? null
        : (simulation.value.err as { InstructionError?: [number, unknown] })
            .InstructionError?.[0];
      const programAtFailure =
        typeof failingIndex === "number"
          ? transactionProgramIdsInOrder(transaction)[failingIndex] ??
            "unknown program"
          : "unknown program";
      throw new Error(
        `Trading-collateral funding simulation failed at ${programAtFailure}: ${JSON.stringify(
          simulation.value.err
        )}`
      );
    }
    const fee = await connection.getFeeForMessage(
      transaction.message,
      "confirmed"
    );
    return {
      action,
      transactionBase64: Buffer.from(transaction.serialize()).toString(
        "base64"
      ),
      transactionDigest: messageDigest(transaction),
      walletAddress: params.walletAddress,
      symbol: params.symbol,
      direction: params.direction,
      orderKind: "market",
      reduceOnly: false,
      baseAmount: String(params.quantity),
      notionalUsd: params.notionalUsd.toFixed(2),
      oraclePriceUsd: params.oraclePriceUsd.toFixed(4),
      limitPriceUsd: null,
      networkFeeLamports: String(fee.value ?? 0),
      // Builder onboarding is co-signed, simulated, and broadcast by the
      // official send-register endpoint after the user's partial signature.
      simulationSlot:
        simulation?.context.slot ?? (await connection.getSlot("confirmed")),
      computeUnitsConsumed: simulation?.value.unitsConsumed ?? null,
      invokedPrograms: programs,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
      expiresAt: Date.now() + SETUP_VALIDITY_MS,
      checks: [
        ...params.checks,
        action === "register_account"
          ? "Complete official builder onboarding before funding collateral."
          : `Deposit $${params.amountUsdc.toFixed(
              2
            )} into trading collateral before order preparation.`,
      ],
      onboarderAddress,
      maxPositions,
    };
  } finally {
    client.dispose();
  }
}

function toWeb3Instruction(instruction: any): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(String(instruction.programAddress)),
    keys: instruction.accounts.map((account: any) => ({
      pubkey: new PublicKey(String(account.address)),
      isSigner: account.role === 2 || account.role === 3,
      isWritable: account.role === 1 || account.role === 3,
    })),
    data: Buffer.from(instruction.data),
  });
}

export async function executePhoenixOrder(params: {
  plan: PerpOrderPlan;
  keypair: Keypair;
  rpcUrl: string;
}): Promise<{ signature: string }> {
  const plan = PerpOrderPlanSchema.parse(params.plan);
  const connection = new Connection(params.rpcUrl, "confirmed");
  const blockHeight = await connection.getBlockHeight("confirmed");
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(plan.transactionBase64, "base64")
  );
  validatePerpOrderPlanForSigning(
    plan,
    transaction,
    params.keypair.publicKey.toBase58(),
    Date.now(),
    blockHeight
  );
  const freshBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.message.recentBlockhash = freshBlockhash.blockhash;
  if (plan.action === "register_account") {
    transaction.sign([params.keypair]);
    const submitted = await phoenixRequest<ApiSendRegister>(
      "/v1/exchange/send-register-ixs",
      {
        method: "POST",
        body: JSON.stringify({
          transaction: Buffer.from(transaction.serialize()).toString("base64"),
          traderAuthority: plan.walletAddress,
          txFeePayer: plan.walletAddress,
          maxPositions: plan.maxPositions ?? 32,
          traderPdaIndex: MIRAE_TRADER_PDA_INDEX,
          traderSubaccountIndex: 0,
        }),
      }
    );
    if (!submitted.signature)
      throw new Error(
        "The venue did not return an onboarding transaction signature."
      );
    accountCache.delete(plan.walletAddress);
    return { signature: submitted.signature };
  }
  const simulation = await connection.simulateTransaction(transaction, {
    commitment: "confirmed",
    sigVerify: false,
    replaceRecentBlockhash: false,
  });
  if (simulation.value.err)
    throw new Error(
      `Final perpetual simulation failed: ${JSON.stringify(
        simulation.value.err
      )}`
    );
  assertAllowedPerpPrograms(invokedPrograms(simulation.value.logs));
  transaction.sign([params.keypair]);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    }
  );

  try {
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: freshBlockhash.blockhash,
        lastValidBlockHeight: freshBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (confirmation.value.err)
      throw new Error(
        `Perpetual transaction failed on-chain: ${JSON.stringify(
          confirmation.value.err
        )}`
      );
  } catch (error) {
    const status = (
      await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      })
    ).value[0];
    if (status?.err)
      throw new Error(
        `Perpetual transaction failed on-chain: ${JSON.stringify(status.err)}`
      );
    if (
      status?.confirmationStatus !== "confirmed" &&
      status?.confirmationStatus !== "finalized"
    ) {
      const reason =
        error instanceof Error ? error.message : "confirmation timed out";
      throw new Error(
        `Transaction was broadcast but is not confirmed yet (${signature}). Refresh activity before retrying. ${reason}`
      );
    }
  }
  accountCache.delete(plan.walletAddress);

  return { signature };
}

function toTransactionInstruction(
  instruction: ApiInstruction
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.keys.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data),
  });
}

function messageDigest(transaction: VersionedTransaction): string {
  return createHash("sha256")
    .update(transaction.message.serialize())
    .digest("hex");
}

export function validatePerpOrderPlanForSigning(
  plan: PerpOrderPlan,
  transaction: VersionedTransaction,
  signerAddress: string,
  nowMs: number,
  blockHeight: number
): void {
  if (nowMs >= plan.expiresAt)
    throw new Error(
      "The perpetual order preflight expired. Prepare a fresh order."
    );
  if (!Number.isSafeInteger(blockHeight) || blockHeight < 0)
    throw new Error("The current Solana block height could not be verified.");
  if (signerAddress !== plan.walletAddress)
    throw new Error(
      "The active wallet does not match the prepared perpetual order."
    );
  if (messageDigest(transaction) !== plan.transactionDigest)
    throw new Error("The perpetual order transaction changed after preflight.");
  const programs = transactionProgramIds(transaction);
  assertAllowedPerpPrograms(programs);
  if (plan.action === "fund_collateral") {
    if (!programs.includes(TOKEN_PROGRAM))
      throw new Error(
        "The verified USDC transfer program is missing from the collateral transaction."
      );
  } else if (!programs.includes(PHOENIX_PROGRAM_ID)) {
    throw new Error(
      "The verified perpetual exchange program is missing from the transaction."
    );
  }
  if (
    !transaction.signatures.every((signatureBytes) =>
      signatureBytes.every((byte) => byte === 0)
    )
  ) {
    throw new Error(
      "The prepared perpetual transaction already contains a signature."
    );
  }
  const expectedSignatures = plan.action === "register_account" ? 2 : 1;
  if (transaction.message.header.numRequiredSignatures !== expectedSignatures)
    throw new Error(
      "The perpetual transaction requested an unexpected signer set."
    );
  if (
    transaction.message.staticAccountKeys[0]?.toBase58() !== plan.walletAddress
  )
    throw new Error(
      "The perpetual transaction fee payer does not match the bound wallet."
    );
  if (
    plan.action === "register_account" &&
    transaction.message.staticAccountKeys[1]?.toBase58() !==
      plan.onboarderAddress
  ) {
    throw new Error(
      "The official onboarding signer does not match the prepared venue response."
    );
  }
}

function transactionProgramIds(transaction: VersionedTransaction): string[] {
  if (transaction.message.addressTableLookups.length > 0) {
    throw new Error(
      "Perpetual transactions using unverified address lookup tables are not supported."
    );
  }
  const keys = transaction.message.staticAccountKeys;
  return [
    ...new Set(
      transaction.message.compiledInstructions.map((instruction) => {
        const program = keys[instruction.programIdIndex];
        if (!program)
          throw new Error(
            "The perpetual transaction contains an invalid program index."
          );
        return program.toBase58();
      })
    ),
  ];
}

function transactionProgramIdsInOrder(
  transaction: VersionedTransaction
): string[] {
  const keys = transaction.message.staticAccountKeys;
  return transaction.message.compiledInstructions.map(
    (instruction) =>
      keys[instruction.programIdIndex]?.toBase58() ?? "unknown program"
  );
}

function assertAllowedPerpPrograms(programs: string[]): void {
  const allowed = new Set([
    PHOENIX_PROGRAM_ID,
    COMPUTE_BUDGET_PROGRAM,
    TOKEN_PROGRAM,
    ASSOCIATED_TOKEN_PROGRAM,
    EMBER_PROGRAM,
    SYSTEM_PROGRAM,
  ]);
  const unexpected = programs.filter((program) => !allowed.has(program));
  if (unexpected.length > 0)
    throw new Error(
      `Perpetual transaction invoked an unapproved program: ${unexpected.join(
        ", "
      )}.`
    );
}

function invokedPrograms(logs: string[] | null | undefined): string[] {
  if (!logs) return [];
  return [
    ...new Set(
      logs
        .map(
          (line) =>
            /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[\d+\]$/u.exec(
              line
            )?.[1]
        )
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

function usdcToBaseUnits(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,6})?$/u.test(normalized))
    return Math.floor(Number(normalized) * 10 ** USDC_DECIMALS);
  const [whole, fraction = ""] = normalized.split(".");
  return (
    Number(whole) * 10 ** USDC_DECIMALS +
    Number(fraction.padEnd(USDC_DECIMALS, "0") || "0")
  );
}
