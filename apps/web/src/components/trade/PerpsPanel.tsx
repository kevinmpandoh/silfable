"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldAlert, TrendingDown, TrendingUp, X, Wallet, RefreshCw, Zap } from "lucide-react";

export type PerpMarket = {
  symbol: string;
  baseAssetSymbol: string;
  marketPubkey: string;
  oraclePriceUsd: number;
  fundingRateHourlyPctLong: number;
  fundingRateHourlyPctShort: number;
  openInterestBase: number;
  maxLeverage: number;
  minOrderBase: number;
  stepSizeBase: number;
  takerFeeBps: number;
  oracleSlot: number;
  oracleAgeSlots: number;
  stale: boolean;
};

export type PerpPosition = {
  symbol: string;
  direction: "long" | "short";
  baseAmount: number;
  entryPriceUsd: number;
  markPriceUsd: number;
  notionalUsd: number;
  unrealizedPnlUsd: number;
};

export type PerpAccount = {
  walletAddress: string;
  accountExists: boolean;
  walletUsdcBalance: number;
  collateralUsd: number;
  freeCollateralUsd: number;
  unrealizedPnlUsd: number;
  leverage: number;
  healthPct: number;
  positions: PerpPosition[];
};

export type PerpOrderRequest =
  | { action: "open"; symbol: string; direction: "long" | "short"; baseAmount?: string; notionalUsd?: string; collateralUsdc?: string }
  | { action: "close"; symbol: string };

export function PerpsPanel({
  walletAddress,
  busy,
  onClose,
  onSubmit,
  onGetUsdc,
}: {
  walletAddress: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: PerpOrderRequest) => void;
  onGetUsdc?: () => void;
}) {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [account, setAccount] = useState<PerpAccount | null>(null);
  const [maxNotionalUsd, setMaxNotionalUsd] = useState(5_000);
  const [feedStatus, setFeedStatus] = useState<{ live: boolean; chainSlot: number; updatedAt: number } | null>(null);
  const [selected, setSelected] = useState("SOL");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [sizeMode, setSizeMode] = useState<"notional" | "base">("notional");
  const [size, setSize] = useState("10");
  const [leverage, setLeverage] = useState<number>(3);
  const [collateral, setCollateral] = useState("");
  const [acknowledged, setAcknowledged] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readMarkets = useCallback(async () => {
    const response = await fetch("/api/perps/markets", { cache: "no-store" });
    const result = await response.json() as {
      markets?: PerpMarket[]; maxNotionalUsd?: number; chainSlot?: number; updatedAt?: number; live?: boolean; error?: string;
    };
    if (!response.ok || !result.markets) throw new Error(result.error || "Perpetual market data is unavailable.");
    return {
      markets: result.markets,
      maxNotionalUsd: result.maxNotionalUsd ?? 5_000,
      status: { live: result.live ?? false, chainSlot: result.chainSlot ?? 0, updatedAt: result.updatedAt ?? Date.now() },
    };
  }, []);

  const readAccount = useCallback(async () => {
    const response = await fetch(`/api/perps/account?walletAddress=${encodeURIComponent(walletAddress)}`, { cache: "no-store" });
    const result = await response.json() as { account?: PerpAccount; error?: string };
    if (!response.ok || !result.account) throw new Error(result.error || "The perpetuals account could not be read.");
    return result.account;
  }, [walletAddress]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [marketState, accountState] = await Promise.all([readMarkets(), readAccount()]);
      setMarkets(marketState.markets);
      setMaxNotionalUsd(marketState.maxNotionalUsd);
      setFeedStatus(marketState.status);
      setAccount(accountState);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Perpetual market state could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readMarkets, readAccount]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const pollMarkets = setInterval(() => {
      if (document.hidden) return;
      readMarkets()
        .then((state) => {
          setMarkets(state.markets);
          setMaxNotionalUsd(state.maxNotionalUsd);
          setFeedStatus(state.status);
        })
        .catch(() => setFeedStatus((current) => (current ? { ...current, live: false } : current)));
    }, 4_000);
    const pollAccount = setInterval(() => {
      if (document.hidden) return;
      readAccount().then(setAccount).catch(() => undefined);
    }, 15_000);
    return () => {
      clearInterval(pollMarkets);
      clearInterval(pollAccount);
    };
  }, [readMarkets, readAccount]);

  const market = markets.find((entry) => entry.baseAssetSymbol === selected) ?? markets[0];
  const position = account?.positions.find((entry) => entry.symbol === market?.symbol);
  const numericSize = Number(size.replace(",", "."));
  const estimatedNotional = !market || !Number.isFinite(numericSize) || numericSize <= 0
    ? null
    : sizeMode === "notional" ? numericSize : numericSize * market.oraclePriceUsd;
  const overCeiling = estimatedNotional !== null && estimatedNotional > maxNotionalUsd;

  // Auto-derive collateral if not manually entered
  const autoMargin = estimatedNotional ? (estimatedNotional / Math.max(1, leverage)).toFixed(2) : "0.00";
  const activeCollateral = collateral.trim() ? collateral : autoMargin;
  const collateralAmount = Number(activeCollateral);

  const walletUsdc = account && !Number.isNaN(account.walletUsdcBalance) ? account.walletUsdcBalance : 0;
  const freeCollateral = account?.freeCollateralUsd ?? 0;
  const totalAvailableUsdc = Math.max(walletUsdc, freeCollateral);
  const shortfall = collateralAmount > totalAvailableUsdc ? collateralAmount - totalAvailableUsdc : 0;

  const canOpen = Boolean(
    market && !market.stale && estimatedNotional !== null && !overCeiling && acknowledged && !busy
      && (account?.accountExists || isPositive(activeCollateral))
      && shortfall === 0,
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2a2e3f] bg-[#0c0f17] text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perps-title"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#1f2433] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#FF8A00]/30 bg-[#FF8A00]/10 text-[#FFAD45]">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="perps-title" className="text-base font-bold text-white">
                  Phoenix Perpetuals
                </h2>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                  SOLANA MAINNET
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Direct wallet funding · Zero external app gates · Unsigned preflight simulation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={busy || refreshing}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
              title="Refresh prices"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-[#FFAD45]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Close perpetuals panel"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Account Overview Strip (4-column balanced grid) */}
        <div className="grid grid-cols-2 gap-3 border-b border-[#1f2433] bg-[#121520] px-6 py-3 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <Wallet className="size-3 text-[#FFAD45]" />
              <span>Wallet USDC</span>
            </div>
            <p className="text-sm font-bold text-white">${walletUsdc.toFixed(2)} USDC</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Collateral</span>
            <p className="text-sm font-bold text-white">${(account?.collateralUsd ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Free Collateral</span>
            <p className="text-sm font-bold text-white">${(account?.freeCollateralUsd ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Account Health</span>
            <p className={`text-sm font-bold ${account?.accountExists ? ((account.healthPct < 25) ? "text-rose-400" : "text-emerald-400") : "text-gray-400"}`}>
              {account?.accountExists ? `${account.healthPct}%` : "Ready to Open"}
            </p>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-[#FFAD45]" />
              Reading live Phoenix market state…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => void loadData()} className="font-bold underline">
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* First-time Account Info Banner */}
              {!account?.accountExists && (
                <div className="rounded-xl border border-[#FF8A00]/30 bg-[#FF8A00]/5 p-3.5 text-xs text-[#FFD5A3]">
                  <p className="flex items-center gap-2 font-medium">
                    <Zap className="size-4 flex-none text-[#FF8A00]" />
                    <span>
                      <strong>Direct Wallet Settlement:</strong> Phoenix opens an isolated subaccount with your order. Margin is automatically funded from your wallet USDC in this single transaction.
                    </span>
                  </p>
                </div>
              )}

              {/* Open Positions (if any) */}
              {account?.accountExists && account.positions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Open Positions</h3>
                  <div className="space-y-2">
                    {account.positions.map((entry) => (
                      <div
                        key={entry.symbol}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#222738] bg-[#121624] p-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex size-6 items-center justify-center rounded-md ${entry.direction === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {entry.direction === "long" ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          </span>
                          <div>
                            <span className="font-bold text-white">{entry.symbol}</span>
                            <span className="ml-2 text-gray-400">
                              {entry.direction.toUpperCase()} · {entry.baseAmount} {entry.symbol.split("-")[0]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className={`font-semibold ${entry.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {entry.unrealizedPnlUsd >= 0 ? "+" : ""}${entry.unrealizedPnlUsd.toFixed(2)}
                            </span>
                            <p className="text-[10px] text-gray-500">Entry ${entry.entryPriceUsd.toFixed(2)}</p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onSubmit({ action: "close", symbol: entry.symbol.replace("-PERP", "") })}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Markets Watchlist (3x2 Grid) */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Live Perp Markets</h3>
                  {feedStatus && (
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <span className={`size-1.5 rounded-full ${feedStatus.live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
                      {feedStatus.live ? "Live Phoenix Stream" : "Connected"}
                    </span>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {markets.map((entry) => {
                    const isSelected = entry.baseAssetSymbol === selected;
                    const isPositive = entry.fundingRateHourlyPctLong >= 0;
                    return (
                      <button
                        key={entry.symbol}
                        type="button"
                        onClick={() => setSelected(entry.baseAssetSymbol)}
                        className={`rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? "border-[#FF8A00] bg-[#FF8A00]/10 shadow-sm"
                            : "border-[#222738] bg-[#121624] hover:border-gray-600 hover:bg-[#151a2b]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{entry.symbol}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-gray-300">
                            {entry.maxLeverage}x Max
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-bold text-white">
                            ${entry.oraclePriceUsd.toLocaleString(undefined, { minimumFractionDigits: entry.oraclePriceUsd >= 100 ? 2 : 4 })}
                          </span>
                          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                            {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {isPositive ? "+" : ""}{entry.fundingRateHourlyPctLong.toFixed(4)}%/h
                          </span>
                        </div>
                        {entry.stale && (
                          <span className="mt-1 block text-[10px] font-semibold text-amber-300">
                            Price Stale ({formatSlotAge(entry.oracleAgeSlots)} ago)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order Placement Form */}
              <div className="rounded-xl border border-[#222738] bg-[#121624] p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Left Column: Side & Size */}
                  <div className="space-y-4">
                    {/* Side (Long/Short) Toggle */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Order Direction
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDirection("long")}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                            direction === "long"
                              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                              : "border border-[#2e3448] bg-[#0c0f17] text-gray-400 hover:text-white"
                          }`}
                        >
                          <TrendingUp className="size-3.5" /> LONG
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirection("short")}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                            direction === "short"
                              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                              : "border border-[#2e3448] bg-[#0c0f17] text-gray-400 hover:text-white"
                          }`}
                        >
                          <TrendingDown className="size-3.5" /> SHORT
                        </button>
                      </div>
                    </div>

                    {/* Position Size Input */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Position Size
                        </label>
                        <button
                          type="button"
                          onClick={() => setSizeMode((m) => (m === "notional" ? "base" : "notional"))}
                          className="text-[10px] font-bold text-[#FFAD45] hover:underline"
                        >
                          Switch to {sizeMode === "notional" ? `${market?.baseAssetSymbol ?? "Base"}` : "USD Notional"}
                        </button>
                      </div>
                      <div className="relative">
                        {sizeMode === "notional" && (
                          <span className="absolute left-3 top-2.5 text-xs text-gray-400">$</span>
                        )}
                        <input
                          inputMode="decimal"
                          value={size}
                          onChange={(e) => setSize(sanitizeDecimal(e.target.value, 6))}
                          placeholder={sizeMode === "notional" ? "10" : "0.05"}
                          className={`w-full rounded-xl border border-[#2e3448] bg-[#0c0f17] py-2.5 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#FF8A00] focus:outline-none ${sizeMode === "notional" ? "pl-7" : "pl-3"}`}
                        />
                      </div>
                    </div>

                    {/* Leverage Quick Select */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wider text-gray-400">Leverage</span>
                        <span className="font-bold text-[#FFAD45]">{leverage}x</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[2, 3, 5, 10, 20].map((lev) => (
                          <button
                            key={lev}
                            type="button"
                            onClick={() => setLeverage(lev)}
                            className={`rounded-lg py-1.5 text-xs font-bold transition ${
                              leverage === lev
                                ? "bg-[#FF8A00] text-black shadow-sm"
                                : "border border-[#2e3448] bg-[#0c0f17] text-gray-400 hover:text-white"
                            }`}
                          >
                            {lev}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Margin & Order Summary */}
                  <div className="flex flex-col justify-between space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Collateral / Margin (USDC)
                      </label>
                      <input
                        inputMode="decimal"
                        value={collateral}
                        onChange={(e) => setCollateral(sanitizeDecimal(e.target.value, 6))}
                        placeholder={`Auto calculated: $${autoMargin} USDC`}
                        className="w-full rounded-xl border border-[#2e3448] bg-[#0c0f17] px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#FF8A00] focus:outline-none"
                      />
                      <span className="mt-1 block text-[10px] text-gray-500">
                        Isolated margin backing this order. Defaults to ${autoMargin} USDC at {leverage}x.
                      </span>
                    </div>

                    {/* Order Metrics Breakdown */}
                    <div className="space-y-2 rounded-xl border border-[#1f2433] bg-[#0c0f17] p-3.5 text-xs">
                      <div className="flex justify-between text-gray-400">
                        <span>Margin Required:</span>
                        <strong className="text-white">${activeCollateral} USDC</strong>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Est. Base Tokens:</span>
                        <strong className="text-white">
                          {market && estimatedNotional ? (estimatedNotional / market.oraclePriceUsd).toFixed(4) : "0"}{" "}
                          {market?.baseAssetSymbol}
                        </strong>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Hourly Funding:</span>
                        <strong className="text-[#FFAD45]">
                          {market ? (direction === "long" ? market.fundingRateHourlyPctLong : market.fundingRateHourlyPctShort).toFixed(4) : 0}% / hr
                        </strong>
                      </div>
                    </div>

                    {/* Warnings / Guidance */}
                    {shortfall > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                        <div className="flex items-center justify-between">
                          <span>
                            Need ${shortfall.toFixed(2)} more USDC (Wallet holds ${walletUsdc.toFixed(2)}).
                          </span>
                          {onGetUsdc && (
                            <button
                              type="button"
                              onClick={onGetUsdc}
                              className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30"
                            >
                              Swap SOL → USDC
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Acknowledgment Checkbox */}
                <label className="mt-4 flex items-start gap-2.5 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-gray-600 bg-transparent text-[#FF8A00] focus:ring-[#FF8A00]"
                  />
                  <span>
                    I acknowledge that perpetuals use isolated leverage and are subject to funding rates and liquidation risks.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-col gap-3 border-t border-[#1f2433] bg-[#121520] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <ShieldAlert className="size-3.5 flex-none text-[#FFAD45]" />
            <span>Preflight simulates unsigned on Solana Mainnet. Your wallet is never opened by this panel.</span>
          </span>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canOpen}
              onClick={() =>
                market &&
                onSubmit({
                  action: "open",
                  symbol: market.baseAssetSymbol,
                  direction,
                  ...(sizeMode === "base" ? { baseAmount: size } : { notionalUsd: size }),
                  ...(isPositive(activeCollateral) ? { collateralUsdc: activeCollateral } : {}),
                })
              }
              className={`rounded-xl px-6 py-2.5 text-xs font-bold transition shadow-lg disabled:opacity-40 ${
                direction === "long"
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                  : "bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20"
              }`}
            >
              {busy ? "Preparing…" : `Prepare ${direction.toUpperCase()} Order`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function formatSlotAge(slots: number): string {
  if (!Number.isFinite(slots) || slots >= Number.MAX_SAFE_INTEGER) return "an unknown time";
  const seconds = slots * 0.4;
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 5_400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

function sanitizeDecimal(value: string, decimals: number): string {
  const normalized = value.replace(/,/gu, ".").replace(/[^\d.]/gu, "");
  const [whole = "", ...fractions] = normalized.split(".");
  return fractions.length === 0 ? whole : `${whole}.${fractions.join("").slice(0, decimals)}`;
}

function isPositive(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
