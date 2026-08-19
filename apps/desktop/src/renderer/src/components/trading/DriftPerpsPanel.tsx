import React, { useEffect, useState, useCallback } from "react";
import { Activity, ShieldAlert, TrendingDown, TrendingUp, X } from "lucide-react";
import type { DriftPerpMarket, DriftPerpAccount } from "@mirae/contracts";

export function DriftPerpsPanel({
  walletAddress,
  busy,
  onClose,
  onSubmit,
}: {
  walletAddress: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: {
    marketIndex: number;
    symbol: string;
    direction: "long" | "short";
    orderType: "market" | "limit";
    oraclePriceUsd: number;
    baseAmount?: number;
    notionalUsd: number;
    limitPriceUsd?: number | null;
    leverage: number;
    fundingRateHourlyPct: number;
  }) => void;
}) {
  const [markets, setMarkets] = useState<DriftPerpMarket[]>([]);
  const [account, setAccount] = useState<DriftPerpAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState("SOL-PERP");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [notionalUsd, setNotionalUsd] = useState("50");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage] = useState(3);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [marketsRes, accountRes] = await Promise.all([
        (window as any).mirae?.getDriftMarkets?.(),
        (window as any).mirae?.getDriftAccount?.(walletAddress),
      ]);
      if (marketsRes?.markets) setMarkets(marketsRes.markets);
      if (accountRes?.account) setAccount(accountRes.account);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch Drift protocol data");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const selectedMarket = markets.find((m) => m.symbol === selectedSymbol) ?? markets[0];
  const notionalNum = Number(notionalUsd) || 0;
  const marginRequired = Number((notionalNum / Math.max(1, leverage)).toFixed(2));
  const freeCollateral = account?.freeCollateralUsd ?? 0;
  const hasCollateral = freeCollateral >= marginRequired;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarket || notionalNum <= 0) return;
    const fundingRate = direction === "long" ? selectedMarket.fundingRateHourlyPctLong : selectedMarket.fundingRateHourlyPctShort;
    onSubmit({
      marketIndex: selectedMarket.marketIndex,
      symbol: selectedMarket.symbol,
      direction,
      orderType,
      oraclePriceUsd: selectedMarket.oraclePriceUsd,
      notionalUsd: notionalNum,
      limitPriceUsd: orderType === "limit" ? Number(limitPrice) || null : null,
      leverage,
      fundingRateHourlyPct: fundingRate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--sc-line,#333)] bg-[#0f1118] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222634] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-[#FF8A00]/40 bg-[#FF8A00]/10 text-[#FFAD45]">
              <Activity className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Drift Perpetuals (Solana Mainnet)</h2>
              <p className="text-xs text-gray-400">Non-custodial on-chain perpetual futures with local vault security</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/10 px-6 py-2 text-xs text-rose-400">
            <ShieldAlert className="size-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

        {/* Account Overview Bar */}
        <div className="grid grid-cols-2 gap-3 border-b border-[#222634] bg-[#141722] px-6 py-3 sm:grid-cols-4">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Free Collateral</span>
            <p className="text-sm font-semibold text-white">${freeCollateral.toFixed(2)} USDC</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Total Collateral</span>
            <p className="text-sm font-semibold text-white">${(account?.collateralUsd ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Active Leverage</span>
            <p className="text-sm font-semibold text-white">{(account?.leverage ?? 0).toFixed(2)}x</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Health Score</span>
            <p className={`text-sm font-semibold ${(account?.healthPct ?? 100) < 25 ? "text-red-400" : "text-emerald-400"}`}>
              {account?.healthPct ?? 100}%
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.1fr_1fr]">
          {/* Markets Watchlist */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Allowlisted Markets</h3>
            <div className="space-y-2">
              {markets.map((m) => {
                const isSelected = m.symbol === selectedSymbol;
                const isPositive = m.fundingRateHourlyPctLong >= 0;
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(m.symbol)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-[#FF8A00] bg-[#FF8A00]/10 shadow-sm"
                        : "border-[#222634] bg-[#141722]/60 hover:border-gray-600 hover:bg-[#141722]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.symbol}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-gray-300">
                          {m.maxLeverage}x Max
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">Oracle: ${m.oraclePriceUsd.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center justify-end gap-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        <span>{isPositive ? "+" : ""}{m.fundingRateHourlyPctLong}%/hr</span>
                      </div>
                      <span className="text-[10px] text-gray-500">OI: {m.openInterestLongBase} {m.baseAssetSymbol}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Positions */}
            {account && account.positions.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Open Positions</h3>
                <div className="space-y-2">
                  {account.positions.map((pos) => (
                    <div key={pos.symbol} className="flex items-center justify-between rounded-xl border border-[#222634] bg-[#141722] p-3 text-xs">
                      <div>
                        <span className={`font-bold ${pos.direction === "long" ? "text-emerald-400" : "text-rose-400"}`}>
                          {pos.direction.toUpperCase()} {pos.symbol}
                        </span>
                        <p className="text-gray-400">{pos.baseAmount} {pos.symbol.split("-")[0]} · Entry ${pos.entryPriceUsd}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${pos.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pos.unrealizedPnlUsd >= 0 ? "+" : ""}${pos.unrealizedPnlUsd.toFixed(2)}
                        </p>
                        <span className="text-[10px] text-gray-400">${pos.notionalUsd.toFixed(2)} Notional</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order Placement Form */}
          <form onSubmit={handleSubmit} className="flex flex-col justify-between rounded-xl border border-[#222634] bg-[#141722] p-5">
            <div className="space-y-4">
              {/* Direction Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("long")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    direction === "long"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "border border-[#222634] bg-[#0f1118] text-gray-400 hover:text-white"
                  }`}
                >
                  <TrendingUp className="size-3.5" /> LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("short")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    direction === "short"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                      : "border border-[#222634] bg-[#0f1118] text-gray-400 hover:text-white"
                  }`}
                >
                  <TrendingDown className="size-3.5" /> SHORT
                </button>
              </div>

              {/* Order Type */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOrderType("market")}
                  className={`flex-1 rounded-md py-1.5 transition ${orderType === "market" ? "bg-white/15 font-semibold text-white" : "text-gray-400"}`}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("limit")}
                  className={`flex-1 rounded-md py-1.5 transition ${orderType === "limit" ? "bg-white/15 font-semibold text-white" : "text-gray-400"}`}
                >
                  Limit
                </button>
              </div>

              {/* Notional Size Input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Position Size (USD Notional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="1"
                    value={notionalUsd}
                    onChange={(e) => setNotionalUsd(e.target.value)}
                    className="w-full rounded-lg border border-[#2e3346] bg-[#0f1118] py-2 pl-7 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#FF8A00] focus:outline-none"
                    placeholder="10"
                  />
                </div>
              </div>

              {/* Limit Price Input if limit order */}
              {orderType === "limit" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Limit Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      step="any"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full rounded-lg border border-[#2e3346] bg-[#0f1118] py-2 pl-7 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#FF8A00] focus:outline-none"
                      placeholder={selectedMarket ? String(selectedMarket.oraclePriceUsd) : "0.00"}
                    />
                  </div>
                </div>
              )}

              {/* Leverage Selector */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-400">Leverage</span>
                  <span className="font-bold text-[#FFAD45]">{leverage}x</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 5, 10].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`rounded-md py-1.5 text-xs font-semibold transition ${
                        leverage === lev
                          ? "bg-[#FF8A00] text-[#160A02] shadow-sm font-bold"
                          : "border border-[#2e3346] bg-[#0f1118] text-gray-400 hover:text-white"
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-1.5 rounded-lg border border-[#222634] bg-[#0f1118] p-3 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Margin Required:</span>
                  <span className="font-semibold text-white">${marginRequired} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Base Tokens:</span>
                  <span className="font-semibold text-white">
                    {selectedMarket ? (notionalNum / selectedMarket.oraclePriceUsd).toFixed(4) : "0"} {selectedMarket?.baseAssetSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Funding Rate:</span>
                  <span className="font-semibold text-white">
                    {selectedMarket ? (direction === "long" ? selectedMarket.fundingRateHourlyPctLong : selectedMarket.fundingRateHourlyPctShort) : 0}% / hr
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-5 space-y-2">
              {!hasCollateral && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <ShieldAlert className="size-3.5" /> Insufficient free collateral (${freeCollateral.toFixed(2)} available).
                </p>
              )}
              <button
                type="submit"
                disabled={busy || loading || notionalNum <= 0}
                className={`w-full rounded-xl py-3 text-xs font-bold transition ${
                  direction === "long"
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
                    : "bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50"
                }`}
              >
                {busy ? "Preparing Order..." : `Review ${direction.toUpperCase()} ${selectedMarket?.symbol}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
