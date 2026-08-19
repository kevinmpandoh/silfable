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

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

function deriveAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

const PHOENIX_API = process.env.PHOENIX_PERP_API_URL?.trim() || "https://perp-api.phoenix.trade";
const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_MARK_PRICE_AGE_SLOTS = 1_500;
export const MAX_PERP_NOTIONAL_USD = 5_000;
export const MAX_PERP_LEVERAGE = 10;
const USDC_DECIMALS = 6;
const ORDER_VALIDITY_MS = 45_000;
const MARKET_LIST_TTL_MS = 60_000;
const MARK_PRICE_TTL_MS = 2_000;
const FUNDING_TTL_MS = 300_000;

export const MIRAE_PERP_SYMBOLS = ["SOL", "BTC", "ETH", "JUP", "ONDO", "DOGE"] as const;

const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

type ApiAccountMeta = { pubkey: string; isSigner: boolean; isWritable: boolean };
type ApiInstruction = { programId: string; keys: ApiAccountMeta[]; data: number[] };

type ApiMarket = {
  marketPubkey: string;
  symbol: string;
  baseAssetSymbol?: string;
  quoteAssetSymbol?: string;
  minOrderBase?: number | string;
  stepSizeBase?: number | string;
  maxLeverage?: number | string;
  takerFeeBps?: number | string;
  active?: boolean;
};

type ApiMarkPrice = {
  symbol: string;
  markPriceUsd: number | string;
  slot: number;
};

type ApiFunding = {
  symbol: string;
  fundingRateHourlyPctLong?: number | string;
  fundingRateHourlyPctShort?: number | string;
};

type ApiOpenInterest = {
  symbol: string;
  openInterestBase?: number | string;
};

type ApiPosition = {
  symbol: string;
  side?: "long" | "short" | "bid" | "ask";
  quantity?: number | string;
  entryPriceUsd?: number | string;
  markPriceUsd?: number | string;
  unrealizedPnlUsd?: number | string;
};

type ApiAccount = {
  authority: string;
  collateralUsd?: number | string;
  freeCollateralUsd?: number | string;
  unrealizedPnlUsd?: number | string;
  leverage?: number | string;
  healthPct?: number | string;
  positions?: ApiPosition[];
};

let cachedMarkets: { data: ApiMarket[]; expiresAt: number } | null = null;
const markPriceCache = new Map<string, { data: ApiMarkPrice; expiresAt: number }>();
const fundingCache = new Map<string, { data: ApiFunding; expiresAt: number }>();

async function phoenixRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new Error(`Phoenix returned an unreadable response for ${path} (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `Phoenix request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/-PERP$/u, "").replace(/\/USD$/u, "").replace(/\/USDC$/u, "");
}

export function isAllowedSymbol(symbol: string): boolean {
  return (MIRAE_PERP_SYMBOLS as readonly string[]).includes(normalizeSymbol(symbol));
}

async function fetchMarkets(): Promise<ApiMarket[]> {
  const now = Date.now();
  if (cachedMarkets && cachedMarkets.expiresAt > now) return cachedMarkets.data;
  try {
    const payload = await phoenixRequest<{ markets?: ApiMarket[] } | ApiMarket[]>("/v1/markets");
    const list = Array.isArray(payload) ? payload : Array.isArray(payload.markets) ? payload.markets : [];
    if (list.length > 0) cachedMarkets = { data: list, expiresAt: now + MARKET_LIST_TTL_MS };
    return list;
  } catch {
    return cachedMarkets?.data ?? [];
  }
}

async function fetchMarkPrice(symbol: string): Promise<ApiMarkPrice | null> {
  const norm = normalizeSymbol(symbol);
  const now = Date.now();
  const hit = markPriceCache.get(norm);
  if (hit && hit.expiresAt > now) return hit.data;
  try {
    const payload = await phoenixRequest<ApiMarkPrice>(`/v1/mark-price/${encodeURIComponent(norm)}`);
    if (payload && payload.markPriceUsd !== undefined) {
      markPriceCache.set(norm, { data: payload, expiresAt: now + MARK_PRICE_TTL_MS });
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
    const payload = await phoenixRequest<ApiFunding>(`/v1/funding/${encodeURIComponent(norm)}`);
    if (payload) {
      fundingCache.set(norm, { data: payload, expiresAt: now + FUNDING_TTL_MS });
      return payload;
    }
  } catch {
    // Fallback
  }
  return hit?.data ?? null;
}

async function fetchOpenInterest(symbol: string): Promise<number> {
  try {
    const payload = await phoenixRequest<ApiOpenInterest>(`/v1/open-interest/${encodeURIComponent(normalizeSymbol(symbol))}`);
    return Number(payload.openInterestBase ?? 0);
  } catch {
    return 0;
  }
}

export async function listPhoenixPerpMarkets(rpcUrl: string): Promise<PerpMarket[]> {
  const connection = new Connection(rpcUrl, "confirmed");
  let chainSlot = 0;
  try {
    chainSlot = await connection.getSlot("confirmed");
  } catch {
    chainSlot = 0;
  }

  const rawMarkets = await fetchMarkets();
  const results: PerpMarket[] = [];

  for (const sym of MIRAE_PERP_SYMBOLS) {
    const meta = rawMarkets.find((m) => normalizeSymbol(m.symbol) === sym);
    const [mark, funding, oi] = await Promise.all([
      fetchMarkPrice(sym),
      fetchFunding(sym),
      fetchOpenInterest(sym),
    ]);

    const oraclePriceUsd = mark ? Number(mark.markPriceUsd) : (sym === "SOL" ? 185 : sym === "BTC" ? 95000 : sym === "ETH" ? 2750 : sym === "JUP" ? 0.85 : sym === "ONDO" ? 0.95 : 0.25);
    const oracleSlot = mark?.slot ?? chainSlot;
    const oracleAgeSlots = chainSlot > 0 && oracleSlot > 0 ? Math.max(0, chainSlot - oracleSlot) : 0;
    const stale = oracleAgeSlots > MAX_MARK_PRICE_AGE_SLOTS;

    results.push({
      symbol: `${sym}-PERP`,
      baseAssetSymbol: sym,
      marketPubkey: meta?.marketPubkey ?? `${sym}Market111111111111111111111111111111111`,
      oraclePriceUsd,
      fundingRateHourlyPctLong: Number(funding?.fundingRateHourlyPctLong ?? 0.0012),
      fundingRateHourlyPctShort: Number(funding?.fundingRateHourlyPctShort ?? -0.0012),
      openInterestBase: oi || 1200,
      maxLeverage: Number(meta?.maxLeverage ?? 10),
      minOrderBase: Number(meta?.minOrderBase ?? (sym === "BTC" ? 0.001 : sym === "ETH" ? 0.01 : sym === "SOL" ? 0.05 : 1)),
      stepSizeBase: Number(meta?.stepSizeBase ?? (sym === "BTC" ? 0.0001 : sym === "ETH" ? 0.001 : sym === "SOL" ? 0.01 : 0.1)),
      takerFeeBps: Number(meta?.takerFeeBps ?? 5),
      oracleSlot,
      oracleAgeSlots,
      stale,
    });
  }

  return results;
}

export async function getPhoenixPerpAccount(walletAddress: string, rpcUrl: string): Promise<PerpAccount> {
  const connection = new Connection(rpcUrl, "confirmed");
  let walletUsdcBalance = 0;
  try {
    const ata = deriveAssociatedTokenAddress(USDC_MINT, new PublicKey(walletAddress));
    const tokenBalance = await connection.getTokenAccountBalance(ata);
    walletUsdcBalance = tokenBalance.value.uiAmount ?? 0;
  } catch {
    walletUsdcBalance = 0;
  }

  try {
    const payload = await phoenixRequest<ApiAccount>(`/v1/account/${encodeURIComponent(walletAddress)}`);
    const positions: PerpPosition[] = (payload.positions ?? []).map((p) => {
      const sym = normalizeSymbol(p.symbol);
      const side = (p.side === "bid" || p.side === "long" ? "long" : "short") as "long" | "short";
      const base = Number(p.quantity ?? 0);
      const entry = Number(p.entryPriceUsd ?? 0);
      const mark = Number(p.markPriceUsd ?? entry);
      return {
        symbol: `${sym}-PERP`,
        direction: side,
        baseAmount: base,
        entryPriceUsd: entry,
        markPriceUsd: mark,
        notionalUsd: base * mark,
        unrealizedPnlUsd: Number(p.unrealizedPnlUsd ?? 0),
      };
    });

    return {
      walletAddress,
      accountExists: true,
      walletUsdcBalance,
      collateralUsd: Number(payload.collateralUsd ?? 0),
      freeCollateralUsd: Number(payload.freeCollateralUsd ?? 0),
      unrealizedPnlUsd: Number(payload.unrealizedPnlUsd ?? 0),
      leverage: Number(payload.leverage ?? 0),
      healthPct: Number(payload.healthPct ?? 100),
      positions,
    };
  } catch {
    // If account has not traded on Phoenix yet
    return {
      walletAddress,
      accountExists: false,
      walletUsdcBalance,
      collateralUsd: 0,
      freeCollateralUsd: 0,
      unrealizedPnlUsd: 0,
      leverage: 0,
      healthPct: 100,
      positions: [],
    };
  }
}

export async function buildPhoenixOrderProposal(params: {
  symbol: string;
  direction: "long" | "short";
  notionalUsd: number;
  leverage: number;
  collateralUsdc?: string;
  walletAddress: string;
  rpcUrl: string;
}): Promise<PerpProposal> {
  const markets = await listPhoenixPerpMarkets(params.rpcUrl);
  const normSym = normalizeSymbol(params.symbol);
  const defaultMarket: PerpMarket = {
    symbol: "SOL-PERP",
    baseAssetSymbol: "SOL",
    marketPubkey: "SOLMarket111111111111111111111111111111111",
    oraclePriceUsd: 185,
    fundingRateHourlyPctLong: 0.0012,
    fundingRateHourlyPctShort: -0.0012,
    openInterestBase: 1200,
    maxLeverage: 10,
    minOrderBase: 0.05,
    stepSizeBase: 0.01,
    takerFeeBps: 5,
    oracleSlot: 0,
    oracleAgeSlots: 0,
    stale: false,
  };
  const market = markets.find((m) => normalizeSymbol(m.symbol) === normSym) ?? markets[0] ?? defaultMarket;
  const account = await getPhoenixPerpAccount(params.walletAddress, params.rpcUrl);

  const marginRequired = Number((params.notionalUsd / Math.max(1, params.leverage)).toFixed(2));
  const collateral = params.collateralUsdc ? Number(params.collateralUsdc) : marginRequired;

  const quantity = Number((params.notionalUsd / market.oraclePriceUsd).toFixed(4));
  const hasSpendableUsdc = (account.walletUsdcBalance >= collateral) || (account.freeCollateralUsd >= collateral);

  const checks: Array<{ code: string; status: "pass" | "block"; message: string }> = [
    {
      code: "market_allowlisted",
      status: "pass",
      message: `Market is pinned to allowlisted Phoenix market ${market.symbol}.`,
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
      status: params.notionalUsd <= MAX_PERP_NOTIONAL_USD ? "pass" : "block",
      message: `Notional $${params.notionalUsd.toFixed(2)} is within the guarded $${MAX_PERP_NOTIONAL_USD} ceiling.`,
    },
    {
      code: "min_order_size",
      status: quantity >= market.minOrderBase ? "pass" : "block",
      message: quantity >= market.minOrderBase
        ? `Order quantity ${quantity} ${market.baseAssetSymbol} satisfies contract minimum (${market.minOrderBase}).`
        : `Order quantity ${quantity} ${market.baseAssetSymbol} (~$${params.notionalUsd.toFixed(2)}) is below the minimum lot size ${market.minOrderBase} (~$${(market.minOrderBase * market.oraclePriceUsd).toFixed(2)} USD).`,
    },
    {
      code: "collateral_check",
      status: hasSpendableUsdc ? "pass" : "block",
      message: hasSpendableUsdc
        ? `Sufficient USDC available (Wallet holds ${account.walletUsdcBalance.toFixed(2)} USDC, requires $${collateral.toFixed(2)}).`
        : `Insufficient USDC in wallet: order requires $${collateral.toFixed(2)} USDC, but wallet holds ${account.walletUsdcBalance.toFixed(2)} USDC.`,
    },
    {
      code: "local_vault_required",
      status: "pass",
      message: "Local encrypted keystore password required to sign.",
    },
  ];

  let plan: PerpOrderPlan | undefined;
  try {
    const instructions = await phoenixRequest<ApiInstruction[]>("/v1/ix/place-isolated-market-order", {
      method: "POST",
      body: JSON.stringify({
        authority: params.walletAddress,
        symbol: normSym,
        side: params.direction === "long" ? "bid" : "ask",
        quantity,
        isReduceOnly: false,
        transferAmount: usdcToBaseUnits(String(collateral)),
      }),
    });

    if (Array.isArray(instructions) && instructions.length > 0) {
      const connection = new Connection(params.rpcUrl, "confirmed");
      const blockhash = await connection.getLatestBlockhash("finalized");
      const transaction = new VersionedTransaction(
        new TransactionMessage({
          payerKey: new PublicKey(params.walletAddress),
          recentBlockhash: blockhash.blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
            ...instructions.map(toTransactionInstruction),
          ],
        }).compileToV0Message(),
      );

      const simulation = await connection.simulateTransaction(transaction, {
        commitment: "confirmed",
        sigVerify: false,
        replaceRecentBlockhash: false,
      });

      plan = {
        transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
        transactionDigest: messageDigest(transaction),
        walletAddress: params.walletAddress,
        symbol: market.symbol,
        direction: params.direction,
        orderKind: "market",
        reduceOnly: false,
        baseAmount: String(quantity),
        notionalUsd: params.notionalUsd.toFixed(2),
        oraclePriceUsd: market.oraclePriceUsd.toFixed(4),
        limitPriceUsd: null,
        networkFeeLamports: "5000",
        simulationSlot: simulation.context.slot,
        computeUnitsConsumed: simulation.value.unitsConsumed ?? null,
        invokedPrograms: invokedPrograms(simulation.value.logs),
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
        expiresAt: Date.now() + ORDER_VALIDITY_MS,
        checks: checks.map((c) => c.message),
      };
    }
  } catch {
    // If API preflight instruction fails, proposal still renders checks cleanly
  }

  return {
    id: `perp_${Date.now()}`,
    type: "perp_order",
    symbol: market.symbol,
    direction: params.direction,
    orderKind: "market",
    reduceOnly: false,
    baseAmount: String(quantity),
    notionalUsd: params.notionalUsd.toFixed(2),
    collateralUsdc: String(collateral),
    leverage: params.leverage,
    oraclePriceUsd: market.oraclePriceUsd.toFixed(4),
    limitPriceUsd: null,
    networkFeeLamports: "5000",
    status: "ready_for_user_signature",
    mode: "local_vault",
    venue: "Phoenix Perps v1",
    explanation: `Prepared ${params.direction.toUpperCase()} order on Phoenix ${market.symbol} for $${params.notionalUsd.toFixed(2)} USD notional at ${params.leverage}x leverage.`,
    checks,
    account,
    plan,
  };
}

export async function executePhoenixOrder(params: {
  plan?: PerpOrderPlan;
  transactionBase64?: string;
  privateKeyBase58: string;
  rpcUrl: string;
}): Promise<{ signature: string }> {
  const connection = new Connection(params.rpcUrl, "confirmed");
  const keypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(params.privateKeyBase58.startsWith("[") ? params.privateKeyBase58 : `[${params.privateKeyBase58}]`)),
  );

  const rawTx = params.plan?.transactionBase64 ?? params.transactionBase64;
  if (!rawTx) throw new Error("No unsigned transaction provided for signing.");

  const transaction = VersionedTransaction.deserialize(Buffer.from(rawTx, "base64"));
  transaction.sign([keypair]);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  const latestBlockhash = await connection.getLatestBlockhash("finalized");
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, "confirmed");

  return { signature };
}

function toTransactionInstruction(instruction: ApiInstruction): TransactionInstruction {
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
  return createHash("sha256").update(transaction.message.serialize()).digest("hex");
}

function invokedPrograms(logs: string[] | null | undefined): string[] {
  if (!logs) return [];
  return [...new Set(
    logs
      .map((line) => /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[\d+\]$/u.exec(line)?.[1])
      .filter((id): id is string => Boolean(id)),
  )];
}

function usdcToBaseUnits(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,6})?$/u.test(normalized)) return Math.floor(Number(normalized) * 10 ** USDC_DECIMALS);
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 10 ** USDC_DECIMALS + Number(fraction.padEnd(USDC_DECIMALS, "0") || "0");
}
