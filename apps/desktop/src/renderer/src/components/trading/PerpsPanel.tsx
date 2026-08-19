import { useState, useEffect } from "react";
import { Activity, ShieldAlert, TrendingDown, TrendingUp, X, Wallet, RefreshCw } from "lucide-react";
import type { PerpMarket, PerpAccount } from "@mirae/contracts";

export function PerpsPanel({
  walletAddress,
  onClose,
  onSubmitProposal,
}: {
  walletAddress: string;
  onClose: () => void;
  onSubmitProposal: (params: {
    symbol: string;
    direction: "long" | "short";
    notionalUsd: number;
    leverage: number;
    collateralUsdc?: string;
    oraclePriceUsd: number;
    fundingRateHourlyPct: number;
  }) => void;
}) {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [account, setAccount] = useState<PerpAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string>("SOL-PERP");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [notionalUsd, setNotionalUsd] = useState<string>("10");
  const [leverage, setLeverage] = useState<number>(3);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [marketsRes, accountRes] = await Promise.all([
        window.mirae?.getPerpMarkets?.() ?? { markets: [] },
        window.mirae?.getPerpAccount?.(walletAddress) ?? { account: null },
      ]);

      if (marketsRes?.markets && marketsRes.markets.length > 0) {
        const first = marketsRes.markets[0];
        setMarkets(marketsRes.markets);
        if (first && !marketsRes.markets.some((m) => m.symbol === selectedSymbol)) {
          setSelectedSymbol(first.symbol);
        }
      }
      if (accountRes?.account) {
        setAccount(accountRes.account);
      }
    } catch (err: any) {
      console.error("Failed to load Phoenix perps data", err);
      setError(err?.message || "Failed to load live perp markets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(true), 10_000);
    return () => clearInterval(timer);
  }, [walletAddress]);

  const selectedMarket = markets.find((m) => m.symbol === selectedSymbol);
  const notionalNum = Number(notionalUsd) || 0;
  const marginRequired = (notionalNum / Math.max(1, leverage)).toFixed(2);
  const walletUsdc = account?.walletUsdcBalance ?? 0;
  const freeCollateral = account?.freeCollateralUsd ?? 0;
  const availableUsdc = Math.max(walletUsdc, freeCollateral);
  const hasSufficientBalance = availableUsdc >= Number(marginRequired);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarket || notionalNum <= 0) return;
    const rate = direction === "long" ? selectedMarket.fundingRateHourlyPctLong : selectedMarket.fundingRateHourlyPctShort;

    onSubmitProposal({
      symbol: selectedMarket.symbol,
      direction,
      notionalUsd: notionalNum,
      leverage,
      collateralUsdc: marginRequired,
      oraclePriceUsd: selectedMarket.oraclePriceUsd,
      fundingRateHourlyPct: rate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--sc-line,#333)] bg-[#0f1118] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222634] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-[#FF8A00]/40 bg-[#FF8A00]/10 text-[#FFAD45]">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Phoenix Perpetuals (Solana Mainnet)</h2>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                  LIVE PRICES
                </span>
              </div>
              <p className="text-xs text-gray-400">Direct wallet funding · Zero external app gates · Local vault signature</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
              title="Refresh live prices"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-[#FFAD45]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
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
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
              <Wallet className="size-3 text-[#FFAD45]" />
              <span>Wallet Spendable USDC</span>
            </div>
            <p className="text-sm font-semibold text-white">${walletUsdc.toFixed(2)} USDC</p>
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
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Live Perp Markets</h3>
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-500">Loading live Phoenix markets…</div>
            ) : (
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
                        <span className="text-xs text-gray-400">
                          Mark: <strong className="text-white">${m.oraclePriceUsd.toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center justify-end gap-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          <span>{isPositive ? "+" : ""}{m.fundingRateHourlyPctLong}%/hr</span>
                        </div>
                        <span className="text-[10px] text-gray-500">OI: {m.openInterestBase} {m.baseAssetSymbol}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

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
                  <span className="font-semibold text-[#FFAD45]">
                    {selectedMarket ? (direction === "long" ? selectedMarket.fundingRateHourlyPctLong : selectedMarket.fundingRateHourlyPctShort) : 0}% / hr
                  </span>
                </div>
              </div>

              {!hasSufficientBalance && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <ShieldAlert className="size-3.5 flex-none" />
                  <span>Insufficient USDC (${availableUsdc.toFixed(2)} available, requires ${marginRequired}).</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={notionalNum <= 0}
              className={`mt-4 w-full rounded-xl py-3 text-sm font-bold transition ${
                direction === "long"
                  ? "bg-emerald-500 text-black hover:bg-emerald-400"
                  : "bg-rose-500 text-white hover:bg-rose-400"
              } disabled:opacity-50`}
            >
              Review {direction.toUpperCase()} {selectedMarket?.symbol}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
