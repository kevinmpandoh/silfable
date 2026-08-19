import "server-only";

import { createHash } from "node:crypto";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { selectSolanaRpc } from "@/lib/server-solana-rpc";

/**
 * Phoenix perpetuals (perp-api.phoenix.trade).
 *
 * Phoenix builds the instructions and returns them as plain DTOs, so this module
 * never needs the Phoenix SDK — which is built on @solana/kit and would drag a
 * second Solana stack into an app that runs entirely on @solana/web3.js 1.x.
 * The guarded pipeline is unchanged from the rest of the app: build unsigned,
 * simulate on Mainnet, verify the invoked programs, then hand a base64
 * transaction to the browser wallet, which performs the only signature.
 */
const PHOENIX_API = process.env.PHOENIX_PERP_API_URL?.trim() || "https://perp-api.phoenix.trade";
const REQUEST_TIMEOUT_MS = 15_000;
/** Mark prices are republished continuously; anything older than this is not tradable. */
export const MAX_MARK_PRICE_AGE_SLOTS = 1_500;
export const MAX_PERP_NOTIONAL_USD = 5_000;
export const MAX_PERP_LEVERAGE = 10;
const USDC_DECIMALS = 6;
const ORDER_VALIDITY_MS = 45_000;
const MARKET_LIST_TTL_MS = 60_000;
const MARK_PRICE_TTL_MS = 2_000;
const FUNDING_TTL_MS = 300_000;

/** Only deep, liquid markets are exposed. Extend deliberately, not by default. */
export const MIRAE_PERP_SYMBOLS = ["SOL", "BTC", "ETH", "JUP", "ONDO", "DOGE"] as const;

const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
/** Phoenix accepts USDC as its only collateral, so this is the balance that matters. */
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export type PerpMarketSnapshot = {
  symbol: string;
  baseAssetSymbol: string;
  marketPubkey: string;
  /** Phoenix mark price in USD. */
  oraclePriceUsd: number;
  fundingRateHourlyPctLong: number;
  fundingRateHourlyPctShort: number;
  openInterestBase: number;
  maxLeverage: number;
  minOrderBase: number;
  stepSizeBase: number;
  takerFeeBps: number;
  /** Slot the mark price was published at, and how far behind the exchange that is. */
  oracleSlot: number;
  oracleAgeSlots: number;
  stale: boolean;
};

export type PerpPositionSnapshot = {
  symbol: string;
  direction: "long" | "short";
  baseAmount: number;
  entryPriceUsd: number;
  markPriceUsd: number;
  notionalUsd: number;
  unrealizedPnlUsd: number;
};

export type PerpAccountSnapshot = {
  walletAddress: string;
  accountExists: boolean;
  /** Spendable USDC sitting in the wallet, which is what funds a new position. */
  walletUsdcBalance: number;
  collateralUsd: number;
  freeCollateralUsd: number;
  unrealizedPnlUsd: number;
  leverage: number;
  healthPct: number;
  positions: PerpPositionSnapshot[];
};

export type PerpMarketFeed = {
  markets: PerpMarketSnapshot[];
  chainSlot: number;
  updatedAt: number;
  live: boolean;
};

export type PerpOrderPlan = {
  transactionBase64: string;
  transactionDigest: string;
  walletAddress: string;
  symbol: string;
  direction: "long" | "short";
  orderKind: "market" | "limit";
  reduceOnly: boolean;
  baseAmount: string;
  notionalUsd: string;
  oraclePriceUsd: string;
  limitPriceUsd: string | null;
  networkFeeLamports: string;
  simulationSlot: number;
  computeUnitsConsumed: number | null;
  invokedPrograms: string[];
  lastValidBlockHeight: number;
  expiresAt: number;
  checks: string[];
};

type ApiAccountMeta = { pubkey: string; isSigner: boolean; isWritable: boolean };
type ApiInstruction = { programId: string; keys: ApiAccountMeta[]; data: number[] };

async function phoenixRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    const response = await fetch(`${PHOENIX_API}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 429 && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempts));
      continue;
    }
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
      throw new PhoenixApiError(message, response.status);
    }
    return payload as T;
  }
  throw new PhoenixApiError("Phoenix is busy. Please try again in a few moments.", 429);
}

/**
 * Phoenix rate-limits bursts, and a panel refreshing every few seconds would
 * otherwise re-ask for data that barely moves. Each kind of read gets a lifetime
 * matched to how fast it actually changes, and concurrent callers share one
 * in-flight request instead of racing each other into a 429.
 */
const cacheEntries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = cacheEntries.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as Promise<T>;
  const value = loader().catch((error: unknown) => {
    // A failed read must not be served to everyone for the rest of the TTL.
    cacheEntries.delete(key);
    throw error;
  });
  cacheEntries.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await run(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export class PhoenixApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PhoenixApiError";
  }
}

type PhoenixMarket = {
  symbol: string;
  assetId: number;
  marketStatus: string;
  marketPubkey: string;
  baseLotsDecimals: number;
  takerFee: number;
  fundingIntervalSeconds: number;
  leverageTiers?: Array<{ maxLeverage: number }>;
  statsSnapshot?: { slot?: number; openInterestBaseLots?: string };
};

export function isAllowedSymbol(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const normalized = candidate.trim().toUpperCase().replace(/-PERP$/u, "");
  return (MIRAE_PERP_SYMBOLS as readonly string[]).includes(normalized);
}

export function normalizeSymbol(candidate: string): string {
  return candidate.trim().toUpperCase().replace(/-PERP$/u, "");
}

export async function listPerpMarkets(): Promise<PerpMarketFeed> {
  const all = await cached("markets", MARKET_LIST_TTL_MS, () =>
    phoenixRequest<PhoenixMarket[]>("/v1/view/exchange/markets"));
  const selected = all.filter((market) => isAllowedSymbol(market.symbol) && market.marketStatus === "active");

  const details = await mapWithConcurrency(selected, 3, async (market) => {
    const [mark, funding] = await Promise.all([
      cached(`mark:${market.symbol}`, MARK_PRICE_TTL_MS, () =>
        phoenixRequest<{ slot: number; markPrice: { price: number; slot: number } }>(`/v1/market/${market.symbol}/mark-price`)),
      // Funding settles hourly, so refetching it on every panel tick is waste.
      cached(`funding:${market.symbol}`, FUNDING_TTL_MS, () =>
        phoenixRequest<{ rates: Array<{ timestamp: number; fundingRatePercentage: string }> }>(`/v1/funding/${market.symbol}/rates`))
        .catch(() => ({ rates: [] as Array<{ timestamp: number; fundingRatePercentage: string }> })),
    ]);
    return { market, mark, funding };
  });

  let chainSlot = 0;
  const markets = details.map(({ market, mark, funding }) => {
    if (mark.slot > chainSlot) chainSlot = mark.slot;
    const oracleSlot = mark.markPrice.slot;
    const oracleAgeSlots = Math.max(0, mark.slot - oracleSlot);
    const step = 10 ** -market.baseLotsDecimals;
    // Phoenix quotes funding per interval; every listed market funds hourly.
    const latest = funding.rates.at(-1);
    const hourlyPct = latest ? Number(latest.fundingRatePercentage) : 0;
    return {
      symbol: `${market.symbol}-PERP`,
      baseAssetSymbol: market.symbol,
      marketPubkey: market.marketPubkey,
      oraclePriceUsd: mark.markPrice.price,
      // A positive rate is paid by longs, so the short side receives it.
      fundingRateHourlyPctLong: hourlyPct,
      fundingRateHourlyPctShort: -hourlyPct,
      openInterestBase: Number(market.statsSnapshot?.openInterestBaseLots ?? 0) * step,
      maxLeverage: market.leverageTiers?.[0]?.maxLeverage ?? 0,
      minOrderBase: step,
      stepSizeBase: step,
      takerFeeBps: Math.round(market.takerFee * 10_000),
      oracleSlot,
      oracleAgeSlots,
      stale: oracleAgeSlots > MAX_MARK_PRICE_AGE_SLOTS,
    } satisfies PerpMarketSnapshot;
  });

  return { markets, chainSlot, updatedAt: Date.now(), live: markets.some((market) => !market.stale) };
}

export async function getPerpAccount(walletAddress: string): Promise<PerpAccountSnapshot> {
  const walletUsdcBalance = await getWalletUsdcBalance(walletAddress);
  const empty: PerpAccountSnapshot = {
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
  let state: PhoenixTraderState;
  try {
    state = await phoenixRequest<PhoenixTraderState>(`/v1/trader/state/${encodeURIComponent(walletAddress)}`);
  } catch (error) {
    // Phoenix answers 404 until the wallet's first collateral deposit creates it.
    if (error instanceof PhoenixApiError && error.status === 404) return empty;
    throw error;
  }

  const positions = (state.positions ?? []).flatMap((position) => {
    const base = Number(position.baseAmount ?? position.netBaseLots ?? 0);
    if (!Number.isFinite(base) || base === 0) return [];
    const mark = Number(position.markPrice ?? 0);
    return [{
      symbol: `${position.symbol}-PERP`,
      direction: base > 0 ? "long" : "short",
      baseAmount: Math.abs(base),
      entryPriceUsd: Number(position.entryPrice ?? 0),
      markPriceUsd: mark,
      notionalUsd: Math.abs(base) * mark,
      unrealizedPnlUsd: Number(position.unrealizedPnl ?? 0),
    } satisfies PerpPositionSnapshot];
  });

  return {
    ...empty,
    accountExists: true,
    collateralUsd: Number(state.totalCollateral ?? state.collateral ?? 0),
    freeCollateralUsd: Number(state.freeCollateral ?? 0),
    unrealizedPnlUsd: positions.reduce((sum, position) => sum + position.unrealizedPnlUsd, 0),
    leverage: Number(state.leverage ?? 0),
    healthPct: Number(state.healthPercentage ?? state.health ?? 100),
    positions,
  };
}

type PhoenixTraderState = {
  totalCollateral?: number | string;
  collateral?: number | string;
  freeCollateral?: number | string;
  leverage?: number | string;
  healthPercentage?: number | string;
  health?: number | string;
  positions?: Array<{
    symbol: string;
    baseAmount?: number | string;
    netBaseLots?: number | string;
    entryPrice?: number | string;
    markPrice?: number | string;
    unrealizedPnl?: number | string;
  }>;
};

/**
 * Reads the wallet's own USDC, not the exchange balance: Phoenix funds an
 * isolated position from the wallet at order time, so an empty wallet means the
 * order cannot be built no matter what the exchange account says.
 */
export async function getWalletUsdcBalance(walletAddress: string): Promise<number> {
  try {
    const owner = new PublicKey(walletAddress);
    const connection = new Connection(selectSolanaRpc(), "confirmed");
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
    return accounts.value.reduce((sum, account) => {
      const amount = account.account.data.parsed?.info?.tokenAmount?.uiAmount;
      return typeof amount === "number" ? sum + amount : sum;
    }, 0);
  } catch {
    // A balance that cannot be read must not be reported as zero funds available.
    return Number.NaN;
  }
}

export type BuildPerpOrderInput = {
  walletAddress: string;
  symbol: string;
  direction: "long" | "short";
  baseAmount?: string;
  notionalUsd?: string;
  reduceOnly?: boolean;
  /** USDC moved into the isolated subaccount alongside the order, in whole USDC. */
  collateralUsdc?: string;
};

export async function buildPerpOrderTransaction(input: BuildPerpOrderInput): Promise<PerpOrderPlan> {
  const symbol = normalizeSymbol(input.symbol);
  if (!isAllowedSymbol(symbol)) throw new Error(`${symbol}-PERP is not an allowlisted Mirae market.`);
  const walletAddress = new PublicKey(input.walletAddress).toBase58();

  const feed = await listPerpMarkets();
  const market = feed.markets.find((entry) => entry.baseAssetSymbol === symbol);
  if (!market) throw new Error(`${symbol}-PERP is not currently active on Phoenix.`);
  if (market.stale) {
    throw new Error(`The ${market.symbol} mark price is ${market.oracleAgeSlots} slots behind, so it is not tradable right now.`);
  }

  const connection = new Connection(selectSolanaRpc(), "confirmed");
  const solBalanceLamports = await connection.getBalance(new PublicKey(walletAddress)).catch(() => 0);
  if (solBalanceLamports < 1_000_000) {
    const shortAddr = walletAddress.length > 10 ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : walletAddress;
    throw new Error(`Your wallet (${shortAddr}) holds ${solBalanceLamports === 0 ? "0" : (solBalanceLamports / 1e9).toFixed(4)} SOL on Solana Mainnet. To cover on-chain network transaction fees, please fund at least 0.01 SOL to your wallet address.`);
  }

  const quantity = resolveQuantity(input, market);
  const notionalUsd = quantity * market.oraclePriceUsd;

  let effectiveCollateral = Number(input.collateralUsdc ?? 0);
  if (!input.reduceOnly) {
    const account = await getPerpAccount(walletAddress);
    if (!account.accountExists) {
      const solBal = solBalanceLamports / 1e9;
      if (solBalanceLamports < 40_000_000) {
        const needed = Math.max(0, 0.0382 - solBal).toFixed(4);
        throw new Error(`Initializing a Phoenix perpetuals subaccount on Solana Mainnet requires an on-chain rent deposit (~0.0382 SOL / ~$2.95 USD). Your wallet holds ${solBal.toFixed(4)} SOL (~${needed} SOL short). Please fund a small additional amount of SOL (recommended: at least 0.05 SOL) to activate your on-chain trading account.`);
      }
    }
    if (!effectiveCollateral || effectiveCollateral <= 0) {
      if (!account.accountExists || account.freeCollateralUsd < (notionalUsd / MAX_PERP_LEVERAGE)) {
        effectiveCollateral = Number((notionalUsd / 2).toFixed(2));
      }
    }

    if (effectiveCollateral > 0) {
      const available = account.walletUsdcBalance;
      if (Number.isNaN(available)) throw new Error("The wallet's USDC balance could not be verified, so no order was built.");
      if (available <= 0) {
        throw new Error("This wallet holds 0 USDC. Phoenix requires USDC collateral to open a position. Please swap SOL to USDC first.");
      }
      if (available < effectiveCollateral) {
        const minMargin = Number((notionalUsd / MAX_PERP_LEVERAGE).toFixed(2));
        if (available >= minMargin) {
          effectiveCollateral = Number(available.toFixed(2));
        } else {
          throw new Error(`Insufficient USDC in wallet: order requires at least $${minMargin.toFixed(2)} USDC (at ${MAX_PERP_LEVERAGE}x max leverage), but wallet holds $${available.toFixed(2)} USDC.`);
        }
      }
    }

    if (notionalUsd > MAX_PERP_NOTIONAL_USD) {
      throw new Error(`Position notional $${notionalUsd.toFixed(2)} exceeds the guarded $${MAX_PERP_NOTIONAL_USD} per-order ceiling.`);
    }
    if (effectiveCollateral > 0 && notionalUsd / effectiveCollateral > MAX_PERP_LEVERAGE) {
      throw new Error(`This order implies ${(notionalUsd / effectiveCollateral).toFixed(1)}x leverage against $${effectiveCollateral.toFixed(2)} collateral, above the guarded ${MAX_PERP_LEVERAGE}x ceiling.`);
    }
  }

  const instructions = await phoenixRequest<ApiInstruction[]>("/v1/ix/place-isolated-market-order", {
    method: "POST",
    body: JSON.stringify({
      authority: walletAddress,
      symbol,
      side: input.direction === "long" ? "bid" : "ask",
      quantity,
      isReduceOnly: Boolean(input.reduceOnly),
      ...(effectiveCollateral > 0 ? { transferAmount: usdcToBaseUnits(String(effectiveCollateral)) } : {}),
    }),
  });
  if (!Array.isArray(instructions) || instructions.length === 0) {
    throw new Error("Phoenix returned no instructions for this order.");
  }

  const blockhash = await connection.getLatestBlockhash("finalized");
  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: new PublicKey(walletAddress),
      recentBlockhash: blockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ...instructions.map(toTransactionInstruction),
      ],
    }).compileToV0Message(),
  );

  const [simulation, fee, blockHeight] = await Promise.all([
    connection.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: false, replaceRecentBlockhash: false }),
    connection.getFeeForMessage(transaction.message, "confirmed"),
    connection.getBlockHeight("confirmed"),
  ]);
  if (simulation.value.err) throw new Error(describeSimulationError(simulation.value.err, simulation.value.logs));
  if (fee.value === null) throw new Error("The order network fee could not be verified.");
  const programs = invokedPrograms(simulation.value.logs);
  assertAllowedPrograms(programs, instructions);
  if (blockHeight > blockhash.lastValidBlockHeight) throw new Error("The order blockhash expired during preflight.");

  return {
    transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
    // Digested over the message, not the whole transaction: signing changes the
    // signature bytes, so only the message survives the round trip unchanged and
    // can prove at broadcast that this is the transaction the server simulated.
    transactionDigest: messageDigest(transaction),
    walletAddress,
    symbol: market.symbol,
    direction: input.direction,
    orderKind: "market",
    reduceOnly: Boolean(input.reduceOnly),
    baseAmount: String(quantity),
    notionalUsd: notionalUsd.toFixed(2),
    oraclePriceUsd: market.oraclePriceUsd.toFixed(4),
    limitPriceUsd: null,
    networkFeeLamports: String(fee.value),
    simulationSlot: simulation.context.slot,
    computeUnitsConsumed: simulation.value.unitsConsumed ?? null,
    invokedPrograms: programs,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    expiresAt: Date.now() + ORDER_VALIDITY_MS,
    checks: [
      `Market is pinned to the allowlisted market ${market.symbol}.`,
      `Mark price published ${market.oracleAgeSlots} slots ago, inside the ${MAX_MARK_PRICE_AGE_SLOTS}-slot freshness window.`,
      input.reduceOnly
        ? "Order is reduce-only, so it can only shrink an existing position."
        : `Notional $${notionalUsd.toFixed(2)} is within the guarded $${MAX_PERP_NOTIONAL_USD} ceiling.`,
      "Only the exchange program returned by Phoenix and Solana system programs were invoked.",
      "Unsigned Mainnet simulation completed successfully.",
      "Your browser wallet remains the only signer.",
    ],
  } satisfies PerpOrderPlan;
}

export async function buildRegisterTraderTransaction(walletAddress: string): Promise<PerpOrderPlan> {
  const address = new PublicKey(walletAddress).toBase58();
  const ix = await phoenixRequest<ApiInstruction>("/v1/ix/register-trader", {
    method: "POST",
    body: JSON.stringify({ authority: address }),
  });
  if (!ix || !ix.programId) throw new Error("Phoenix returned no register instruction.");

  const connection = new Connection(selectSolanaRpc(), "confirmed");
  const blockhash = await connection.getLatestBlockhash("finalized");
  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: new PublicKey(address),
      recentBlockhash: blockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        toTransactionInstruction(ix),
      ],
    }).compileToV0Message(),
  );

  const [simulation, fee, blockHeight] = await Promise.all([
    connection.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: false, replaceRecentBlockhash: false }),
    connection.getFeeForMessage(transaction.message, "confirmed"),
    connection.getBlockHeight("confirmed"),
  ]);
  if (simulation.value.err) throw new Error(describeSimulationError(simulation.value.err, simulation.value.logs));
  if (fee.value === null) throw new Error("The network fee could not be verified.");
  const programs = invokedPrograms(simulation.value.logs);
  assertAllowedPrograms(programs, [ix]);

  return {
    transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
    transactionDigest: messageDigest(transaction),
    walletAddress: address,
    symbol: "ACCOUNT-INIT",
    direction: "long",
    orderKind: "market",
    reduceOnly: false,
    baseAmount: "0",
    notionalUsd: "0.00",
    oraclePriceUsd: "0.0000",
    limitPriceUsd: null,
    networkFeeLamports: String(fee.value),
    simulationSlot: simulation.context.slot,
    computeUnitsConsumed: simulation.value.unitsConsumed ?? null,
    invokedPrograms: programs,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    expiresAt: Date.now() + ORDER_VALIDITY_MS,
    checks: [
      "Initializes your Phoenix perpetuals trading subaccount on Solana Mainnet.",
      "Unsigned Mainnet simulation completed successfully.",
      "Your browser wallet remains the only signer.",
    ],
  };
}

function resolveQuantity(input: BuildPerpOrderInput, market: PerpMarketSnapshot): number {
  const raw = input.baseAmount
    ? Number(input.baseAmount)
    : input.notionalUsd
      ? Number(input.notionalUsd) / market.oraclePriceUsd
      : Number.NaN;
  if (!Number.isFinite(raw) || raw <= 0) throw new Error("Provide either a base size or a USD notional for the position.");
  // Phoenix sizes in base lots, so anything finer than the step is not placeable.
  const stepped = Math.floor(raw / market.stepSizeBase) * market.stepSizeBase;
  const rounded = Number(stepped.toFixed(Math.max(0, Math.round(-Math.log10(market.stepSizeBase)))));
  if (rounded < market.minOrderBase) {
    const minUsd = (market.minOrderBase * market.oraclePriceUsd).toFixed(2);
    throw new Error(`The minimum ${market.symbol} order size is ${market.minOrderBase} ${market.baseAssetSymbol} (~$${minUsd} USD). Order size of $${input.notionalUsd ?? raw} is below the contract lot minimum.`);
  }
  return rounded;
}

export function messageDigest(transaction: VersionedTransaction): string {
  return createHash("sha256").update(transaction.message.serialize()).digest("hex");
}

export function toTransactionInstruction(instruction: ApiInstruction): TransactionInstruction {
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

export function invokedPrograms(logs: string[] | null | undefined): string[] {
  if (!logs) throw new Error("Simulation logs are unavailable.");
  if (logs.some((line) => /log truncated/iu.test(line))) throw new Error("Simulation logs were truncated.");
  return [...new Set(
    logs
      .map((line) => /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[\d+\]$/u.exec(line)?.[1])
      .filter((id): id is string => Boolean(id)),
  )];
}

/**
 * The exchange program is whatever Phoenix itself put in the instructions it
 * returned, so a silently swapped program id cannot slip through: the simulation
 * may only touch those programs plus Solana's own.
 */
export function assertAllowedPrograms(programs: string[], instructions: ApiInstruction[]): void {
  const allowed = new Set([
    ...instructions.map((instruction) => instruction.programId),
    COMPUTE_BUDGET_PROGRAM,
    TOKEN_PROGRAM,
    ASSOCIATED_TOKEN_PROGRAM,
    SYSTEM_PROGRAM,
  ]);
  const exchangePrograms = instructions.map((instruction) => instruction.programId);
  if (!exchangePrograms.some((program) => programs.includes(program))) {
    throw new Error("Simulation did not invoke the Phoenix exchange program.");
  }
  const denied = programs.find((program) => !allowed.has(program));
  if (denied) throw new Error(`Simulation invoked a non-allowlisted program: ${denied}`);
}

export function describeSimulationError(err: unknown, logs: string[] | null | undefined): string {
  const anchorError = logs?.find((line) => /Error Message:/u.test(line))?.split("Error Message:")[1]?.trim();
  if (anchorError) return `Phoenix rejected the simulated order: ${anchorError}`;
  if (logs?.some((line) => /insufficient/iu.test(line))) {
    return "Phoenix rejected the order for insufficient collateral. Deposit more USDC or reduce the size.";
  }
  return `The unsigned simulation failed: ${JSON.stringify(err)}`;
}

function usdcToBaseUnits(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,6})?$/u.test(normalized)) throw new Error("Enter a valid USDC amount with at most 6 decimals.");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 10 ** USDC_DECIMALS + Number(fraction.padEnd(USDC_DECIMALS, "0") || "0");
}
