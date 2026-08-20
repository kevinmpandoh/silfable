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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[rgb(32_33_42_/_0.15)] bg-white text-[#20212A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#20212A]/10 bg-[#FAFAFB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-[#E85D04]/30 bg-[#FFF5EB] text-[#E85D04]">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#20212A]">Phoenix Perpetuals (Solana Mainnet)</h2>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  LIVE PRICES
                </span>
              </div>
              <p className="text-xs text-[#686970]">Direct wallet funding · Zero external app gates · Local vault signature</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="rounded-lg p-1.5 text-[#686970] transition hover:bg-[#F0F1F3] hover:text-[#20212A]"
              title="Refresh live prices"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-[#E85D04]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#686970] transition hover:bg-[#F0F1F3] hover:text-[#20212A]"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs font-medium text-rose-800">
            <ShieldAlert className="size-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

        {/* Account Overview Bar */}
        <div className="grid grid-cols-2 gap-3 border-b border-[#20212A]/10 bg-[#F6F7F9] px-6 py-3 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#686970]">
              <Wallet className="size-3 text-[#E85D04]" />
              <span>Wallet Spendable USDC</span>
            </div>
            <p className="text-sm font-bold text-[#20212A]">${walletUsdc.toFixed(2)} USDC</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#686970]">Total Collateral</span>
            <p className="text-sm font-bold text-[#20212A]">${(account?.collateralUsd ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#686970]">Active Leverage</span>
            <p className="text-sm font-bold text-[#20212A]">{(account?.leverage ?? 0).toFixed(2)}x</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#686970]">Health Score</span>
            <p className={`text-sm font-bold ${(account?.healthPct ?? 100) < 25 ? "text-rose-600" : "text-emerald-600"}`}>
              {account?.healthPct ?? 100}%
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.1fr_1fr]">
          {/* Markets Watchlist */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#686970]">Live Perp Markets</h3>
            {loading ? (
              <div className="py-8 text-center text-xs text-[#686970]">Loading live Phoenix markets…</div>
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
                          ? "border-[#E85D04] bg-[#FFF5EB] shadow-sm"
                          : "border-[#20212A]/10 bg-[#FAFAFB] hover:border-[#E85D04]/40 hover:bg-[#F6F7F9]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#20212A]">{m.symbol}</span>
                          <span className="rounded border border-[#20212A]/10 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#40424E]">
                            {m.maxLeverage}x Max
                          </span>
                        </div>
                        <span className="text-xs text-[#686970]">
                          Mark: <strong className="text-[#20212A]">${m.oraclePriceUsd.toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          <span>{isPositive ? "+" : ""}{m.fundingRateHourlyPctLong}%/hr</span>
                        </div>
                        <span className="text-[10px] text-[#686970]">OI: {m.openInterestBase} {m.baseAssetSymbol}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Positions */}
            {account && account.positions.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#686970]">Open Positions</h3>
                <div className="space-y-2">
                  {account.positions.map((pos) => (
                    <div key={pos.symbol} className="flex items-center justify-between rounded-xl border border-[#20212A]/10 bg-[#FAFAFB] p-3 text-xs">
                      <div>
                        <span className={`font-bold ${pos.direction === "long" ? "text-emerald-700" : "text-rose-700"}`}>
                          {pos.direction.toUpperCase()} {pos.symbol}
                        </span>
                        <p className="text-[#686970]">{pos.baseAmount} {pos.symbol.split("-")[0]} · Entry ${pos.entryPriceUsd}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${pos.unrealizedPnlUsd >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {pos.unrealizedPnlUsd >= 0 ? "+" : ""}${pos.unrealizedPnlUsd.toFixed(2)}
                        </p>
                        <span className="text-[10px] text-[#686970]">${pos.notionalUsd.toFixed(2)} Notional</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order Placement Form */}
          <form onSubmit={handleSubmit} className="flex flex-col justify-between rounded-xl border border-[#20212A]/10 bg-[#FAFAFB] p-5">
            <div className="space-y-4">
              {/* Direction Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("long")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
                    direction === "long"
                      ? "bg-[#10B981] text-white shadow-emerald-500/20"
                      : "border border-[#20212A]/10 bg-white text-[#686970] hover:text-[#20212A]"
                  }`}
                >
                  <TrendingUp className="size-3.5" /> LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("short")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
                    direction === "short"
                      ? "bg-[#F43F5E] text-white shadow-rose-500/20"
                      : "border border-[#20212A]/10 bg-white text-[#686970] hover:text-[#20212A]"
                  }`}
                >
                  <TrendingDown className="size-3.5" /> SHORT
                </button>
              </div>

              {/* Notional Size Input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[#686970]">Position Size (USD Notional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-[#686970]">$</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="1"
                    value={notionalUsd}
                    onChange={(e) => setNotionalUsd(e.target.value)}
                    className="w-full rounded-xl border border-[#20212A]/15 bg-white py-2 pl-7 pr-3 text-sm font-semibold text-[#20212A] placeholder-gray-400 focus:border-[#E85D04] focus:outline-none"
                    placeholder="10"
                  />
                </div>
              </div>

              {/* Leverage Selector */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#686970]">Leverage</span>
                  <span className="font-bold text-[#E85D04]">{leverage}x</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 5, 10].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition ${
                        leverage === lev
                          ? "bg-[#E85D04] text-white shadow-sm"
                          : "border border-[#20212A]/10 bg-white text-[#40424E] hover:border-[#E85D04]/30"
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-1.5 rounded-xl border border-[#20212A]/10 bg-white p-3.5 text-xs text-[#686970]">
                <div className="flex justify-between">
                  <span>Margin Required:</span>
                  <span className="font-bold text-[#20212A]">${marginRequired} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Base Tokens:</span>
                  <span className="font-bold text-[#20212A]">
                    {selectedMarket ? (notionalNum / selectedMarket.oraclePriceUsd).toFixed(4) : "0"} {selectedMarket?.baseAssetSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Funding Rate:</span>
                  <span className="font-bold text-[#E85D04]">
                    {selectedMarket ? (direction === "long" ? selectedMarket.fundingRateHourlyPctLong : selectedMarket.fundingRateHourlyPctShort) : 0}% / hr
                  </span>
                </div>
              </div>

              {!hasSufficientBalance && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                  <ShieldAlert className="size-3.5 flex-none text-amber-600" />
                  <span>Insufficient USDC (${availableUsdc.toFixed(2)} available, requires ${marginRequired}).</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={notionalNum <= 0}
              className={`mt-4 w-full rounded-xl py-3 text-xs font-bold transition shadow-sm ${
                direction === "long"
                  ? "bg-[#10B981] text-white hover:bg-[#059669]"
                  : "bg-[#F43F5E] text-white hover:bg-[#E11D48]"
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
