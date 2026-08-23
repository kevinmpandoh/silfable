import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type {
  PerpAccount,
  PerpCandle,
  PerpMarket,
  PerpProposal,
} from "@mirae/contracts";
import { PerpProposalCard } from "./PerpProposalCard";

type ProposalInput = {
  symbol: string;
  direction: "long" | "short";
  notionalUsd: number;
  leverage: number;
  collateralUsdc?: string;
  oraclePriceUsd: number;
  fundingRateHourlyPct: number;
  reduceOnly?: boolean;
  baseAmount?: number;
};

function PriceChart({
  candles,
  market,
  loading,
  error,
}: {
  candles: PerpCandle[];
  market?: PerpMarket | undefined;
  loading: boolean;
  error: string | null;
}) {
  const width = 900,
    height = 350,
    bottom = 48;
  if (loading)
    return (
      <div className="grid h-[350px] place-items-center text-xs text-[#777880]">
        Loading live candles…
      </div>
    );
  if (candles.length < 2)
    return (
      <div className="grid h-[350px] place-items-center px-6 text-center text-xs text-[#777880]">
        {error ?? "Live candles unavailable for this interval."}
      </div>
    );
  const min = Math.min(...candles.map((item) => item.low)),
    max = Math.max(...candles.map((item) => item.high)),
    range = Math.max(max - min, max * 0.002);
  const cell = (width - 36) / candles.length,
    y = (value: number) =>
      22 + ((max - value) / range) * (height - bottom - 22),
    maxVolume = Math.max(1, ...candles.map((item) => item.volume));
  const last = candles.at(-1)!;
  return (
    <div className="relative m-4 h-[350px] overflow-hidden rounded-2xl border border-[#E7DDD4] bg-gradient-to-b from-white to-[#FFF8F2] shadow-[0_18px_55px_rgba(63,39,24,0.06)]">
      <div className="absolute left-5 top-4 z-10 flex gap-4 text-[11px]">
        <b>{market?.symbol}</b>
        <span
          className={
            last.close >= last.open ? "text-emerald-600" : "text-rose-600"
          }
        >
          O {last.open.toPrecision(5)} H {last.high.toPrecision(5)} L{" "}
          {last.low.toPrecision(5)} C {last.close.toPrecision(5)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${market?.symbol ?? "Market"} candlestick chart`}
      >
        {[0, 1, 2, 3, 4].map((line) => (
          <line
            key={line}
            x1="0"
            x2={width}
            y1={22 + line * 64}
            y2={22 + line * 64}
            stroke="#E85D04"
            strokeOpacity=".08"
          />
        ))}
        {candles.map((item, index) => {
          const x = 18 + index * cell + cell / 2,
            up = item.close >= item.open,
            color = up ? "#10B981" : "#F43F5E",
            top = y(Math.max(item.open, item.close)),
            low = y(Math.min(item.open, item.close)),
            volume = (item.volume / maxVolume) * 36;
          return (
            <g key={`${item.time}-${index}`}>
              <rect
                x={x - cell * 0.3}
                y={height - 6 - volume}
                width={Math.max(1, cell * 0.6)}
                height={volume}
                fill={color}
                opacity=".16"
              />
              <line
                x1={x}
                x2={x}
                y1={y(item.high)}
                y2={y(item.low)}
                stroke={color}
              />
              <rect
                x={x - cell * 0.3}
                y={top}
                width={Math.max(1.5, cell * 0.6)}
                height={Math.max(1.5, low - top)}
                fill={color}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-3 right-4 rounded border bg-white px-2 py-1 font-mono text-[10px] text-[#686970]">
        LIVE · {new Date(last.time).toLocaleTimeString()}
      </div>
    </div>
  );
}

export function PerpsPanel({
  walletAddress,
  onClose,
}: {
  walletAddress: string;
  onClose: () => void;
}) {
  const [markets, setMarkets] = useState<PerpMarket[]>([]),
    [account, setAccount] = useState<PerpAccount | null>(null),
    [candles, setCandles] = useState<PerpCandle[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("SOL-PERP"),
    [timeframe, setTimeframe] = useState("1h"),
    [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long"),
    [notionalUsd, setNotionalUsd] = useState("0.50"),
    [leverage, setLeverage] = useState(2);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [candleLoading, setCandleLoading] = useState(false),
    [candleError, setCandleError] = useState<string | null>(null);
  const [preparingReview, setPreparingReview] = useState(false),
    [preparedProposal, setPreparedProposal] = useState<PerpProposal | null>(
      null
    );
  const selectedMarket = markets.find(
    (market) => market.symbol === selectedSymbol
  );
  const loadData = async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const [marketResult, accountResult] = await Promise.all([
        window.mirae.getPerpMarkets(),
        window.mirae.getPerpAccount(walletAddress),
      ]);
      setMarkets(marketResult.markets);
      if (
        !marketResult.markets.some(
          (market) => market.symbol === selectedSymbol
        ) &&
        marketResult.markets[0]
      )
        setSelectedSymbol(marketResult.markets[0].symbol);
      setAccount(accountResult.account);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load perpetual markets."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(true), 30000);
    return () => clearInterval(timer);
  }, [walletAddress]);
  useEffect(() => {
    if (!selectedMarket) {
      setCandles([]);
      setCandleError(
        markets.length ? "Select a market to load its chart." : null
      );
      return;
    }
    let alive = true;
    setCandleLoading(true);
    setCandleError(null);
    setCandles([]);
    window.mirae
      .getPerpCandles({ symbol: selectedMarket.symbol, timeframe, limit: 120 })
      .then((result) => {
        if (!alive) return;
        setCandles(result.candles);
        if (result.candles.length < 2)
          setCandleError(
            `No ${timeframe} candles are available for ${selectedMarket.symbol}.`
          );
      })
      .catch((reason) => {
        if (!alive) return;
        setCandles([]);
        setCandleError(
          reason instanceof Error
            ? reason.message
            : `Could not load ${selectedMarket.symbol} candles.`
        );
      })
      .finally(() => {
        if (alive) setCandleLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedMarket?.symbol, timeframe]);
  const minimum = selectedMarket
      ? Math.max(
          0.5,
          Math.ceil(
            selectedMarket.minOrderBase * selectedMarket.oraclePriceUsd * 100
          ) / 100
        )
      : 0.5,
    notional = Number(notionalUsd) || 0,
    margin = notional / Math.max(1, leverage),
    free = account?.freeCollateralUsd ?? 0,
    hasFundingSource =
      margin <= free || margin <= (account?.walletUsdcBalance ?? 0);
  const filteredMarkets = useMemo(
    () =>
      markets.filter((market) =>
        market.symbol.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [markets, query]
  );
  const prepareInsidePanel = async (request: ProposalInput) => {
    if (preparingReview) return;
    try {
      setPreparingReview(true);
      setError(null);
      const result = await window.mirae.preparePerpOrder({
        walletAddress,
        ...request,
      });
      setPreparedProposal(result.proposal);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not prepare the perpetual order review."
      );
    } finally {
      setPreparingReview(false);
    }
  };
  const submit = () => {
    if (!selectedMarket || notional < minimum || !hasFundingSource) return;
    void prepareInsidePanel({
      symbol: selectedMarket.symbol,
      direction,
      notionalUsd: notional,
      leverage,
      collateralUsdc: margin.toFixed(2),
      oraclePriceUsd: selectedMarket.oraclePriceUsd,
      fundingRateHourlyPct:
        direction === "long"
          ? selectedMarket.fundingRateHourlyPctLong
          : selectedMarket.fundingRateHourlyPctShort,
    });
  };
  const closePosition = (position: PerpAccount["positions"][number]) => {
    const market = markets.find((item) => item.symbol === position.symbol);
    if (!market)
      return setError(`Live market ${position.symbol} is unavailable.`);
    const closeDirection = position.direction === "long" ? "short" : "long";
    void prepareInsidePanel({
      symbol: position.symbol,
      direction: closeDirection,
      notionalUsd: position.notionalUsd,
      leverage: 1,
      collateralUsdc: "0",
      oraclePriceUsd: market.oraclePriceUsd,
      fundingRateHourlyPct:
        closeDirection === "long"
          ? market.fundingRateHourlyPctLong
          : market.fundingRateHourlyPctShort,
      reduceOnly: true,
      baseAmount: position.baseAmount,
    });
  };
  return (
    <div className="fixed inset-0 z-50 bg-[#25232A]/35 p-3 backdrop-blur-md">
      <div className="relative mx-auto flex h-full max-w-[1580px] flex-col overflow-hidden rounded-[24px] border border-[#E85D04]/25 bg-[#FFFCF8] shadow-[0_30px_90px_rgba(32,20,14,0.22)]">
        <header className="flex items-center justify-between border-b border-[#E7DDD4] bg-gradient-to-r from-white via-white to-[#FFF0E4] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg border border-[#E85D04]/30 bg-[#FFF5EB] text-[#E85D04]">
              <Activity className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold">Mirae Perpetuals</h2>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  SOLANA MAINNET
                </span>
              </div>
              <p className="text-[11px] text-[#686970]">
                Every Long, Short, and Close opens a confirmation card before
                signing.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="rounded-lg p-2 hover:bg-[#F1F1EF]"
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-[#F1F1EF]"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>
        {error && (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-800">
            <ShieldAlert className="size-4" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-4 border-b border-[#E7DDD4] bg-[#FFF8F2] px-5 py-2.5 text-xs">
          {[
            ["Wallet USDC", account?.walletUsdcBalance ?? 0],
            ["Collateral", account?.collateralUsd ?? 0],
            ["Free collateral", free],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span className="text-[9px] uppercase text-[#686970]">
                {label}
              </span>
              <b className="block">${Number(value).toFixed(2)}</b>
            </div>
          ))}
          <div>
            <span className="text-[9px] uppercase text-[#686970]">Health</span>
            <b className="block text-emerald-600">
              {account?.healthPct ?? 100}%
            </b>
          </div>
        </div>
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col border-r border-[#E7DDD4] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E7DDD4] bg-[#FFFCF8] px-4 py-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-[#888]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search markets"
                  className="w-full rounded-lg border py-2 pl-8 pr-2 text-xs outline-none focus:border-[#E85D04]"
                />
              </div>
              <select
                value={selectedSymbol}
                onChange={(event) => setSelectedSymbol(event.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-xs font-bold"
              >
                {filteredMarkets.map((market) => (
                  <option key={market.symbol}>{market.symbol}</option>
                ))}
              </select>
              <div className="ml-auto flex gap-1">
                {["1m", "5m", "15m", "1h", "4h", "1d"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setTimeframe(item)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                      timeframe === item
                        ? "bg-[#E85D04] text-white"
                        : "bg-[#F1F1EF] text-[#686970]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              candles={candles}
              market={selectedMarket}
              loading={candleLoading}
              error={candleError}
            />
            <div className="min-h-0 flex-1 overflow-auto border-t border-[#E7DDD4] bg-[#FFFCF8] p-4">
              <div className="mb-3 flex justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  Open positions ({account?.positions.length ?? 0})
                </h3>
                <span className="text-[10px] text-[#686970]">
                  Close creates a reduce-only review
                </span>
              </div>
              {account?.positions.length ? (
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[1.1fr_.7fr_.8fr_.8fr_.8fr_auto] bg-[#F7F7F5] px-3 py-2 text-[9px] uppercase text-[#686970]">
                    <span>Market</span>
                    <span>Size</span>
                    <span>Entry</span>
                    <span>Mark</span>
                    <span>uPnL</span>
                    <span>Action</span>
                  </div>
                  {account.positions.map((position) => (
                    <div
                      key={`${position.symbol}-${position.direction}`}
                      className="grid grid-cols-[1.1fr_.7fr_.8fr_.8fr_.8fr_auto] items-center border-t px-3 py-3 text-xs"
                    >
                      <b
                        className={
                          position.direction === "long"
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      >
                        {position.symbol} · {position.direction.toUpperCase()}
                      </b>
                      <span>{position.baseAmount}</span>
                      <span>${position.entryPriceUsd.toPrecision(5)}</span>
                      <span>${position.markPriceUsd.toPrecision(5)}</span>
                      <b
                        className={
                          position.unrealizedPnlUsd >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {position.unrealizedPnlUsd >= 0 ? "+" : ""}$
                        {position.unrealizedPnlUsd.toFixed(3)}
                      </b>
                      <button
                        type="button"
                        onClick={() => closePosition(position)}
                        className="rounded-lg border border-[#E85D04]/40 px-3 py-2 text-[10px] font-bold text-[#C94E00] hover:bg-[#FFF5EB]"
                      >
                        REVIEW CLOSE
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed py-10 text-center text-xs text-[#777880]">
                  No open positions.
                </div>
              )}
            </div>
          </section>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col bg-[#FFF8F2] p-5"
          >
            <div className="mb-4">
              <span className="text-[10px] uppercase tracking-widest text-[#686970]">
                Selected market
              </span>
              <div className="mt-1 flex items-end justify-between">
                <h3 className="text-xl font-bold">
                  {selectedMarket?.symbol ?? "Market"}
                </h3>
                <b>${selectedMarket?.oraclePriceUsd.toLocaleString() ?? "—"}</b>
              </div>
              <p className="text-[10px] text-[#686970]">
                Funding {selectedMarket?.fundingRateHourlyPctLong ?? 0}% / hr ·{" "}
                {selectedMarket?.maxLeverage ?? 0}x max
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("long")}
                className={`rounded-xl py-3 text-xs font-bold ${
                  direction === "long"
                    ? "bg-emerald-500 text-white"
                    : "border bg-white"
                }`}
              >
                <TrendingUp className="mr-1 inline size-4" />
                LONG / BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection("short")}
                className={`rounded-xl py-3 text-xs font-bold ${
                  direction === "short"
                    ? "bg-rose-500 text-white"
                    : "border bg-white"
                }`}
              >
                <TrendingDown className="mr-1 inline size-4" />
                SHORT / SELL
              </button>
            </div>
            <label className="mt-5 text-[10px] font-bold uppercase tracking-widest text-[#686970]">
              Position size (USD notional)
            </label>
            <div className="mt-1 flex rounded-xl border border-[#E7DDD4] bg-white px-3 shadow-[0_8px_24px_rgba(63,39,24,0.04)]">
              <span className="py-3 text-[#686970]">$</span>
              <input
                type="number"
                value={notionalUsd}
                min={minimum}
                max={5000}
                step=".01"
                onChange={(event) => setNotionalUsd(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-lg font-bold outline-none"
              />
            </div>
            <div className="mt-4 flex justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#686970]">
                Leverage
              </span>
              <b className="text-[#E85D04]">{leverage}x</b>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[2, 3, 5, 10]
                .filter((item) => item <= (selectedMarket?.maxLeverage ?? 10))
                .map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setLeverage(item)}
                    className={`rounded-lg py-2 text-xs font-bold ${
                      leverage === item
                        ? "bg-[#E85D04] text-white"
                        : "border bg-white"
                    }`}
                  >
                    {item}x
                  </button>
                ))}
            </div>
            <div className="mt-5 space-y-2 rounded-xl border border-[#E7DDD4] bg-white p-4 text-xs shadow-[0_8px_24px_rgba(63,39,24,0.04)]">
              <div className="flex justify-between">
                <span>Available collateral</span>
                <b>${free.toFixed(2)}</b>
              </div>
              <div className="flex justify-between">
                <span>Margin required</span>
                <b>${margin.toFixed(2)}</b>
              </div>
              <div className="flex justify-between">
                <span>Estimated base size</span>
                <b>
                  {selectedMarket
                    ? (notional / selectedMarket.oraclePriceUsd).toFixed(5)
                    : "0"}{" "}
                  {selectedMarket?.baseAssetSymbol}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Order type</span>
                <b>Isolated market</b>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <p className="mb-3 text-[10px] leading-relaxed text-[#686970]">
                This only adds a deterministic review card to chat. A separate
                wallet confirmation is required before broadcast.
              </p>
              <button
                type="submit"
                disabled={
                  loading ||
                  preparingReview ||
                  !selectedMarket ||
                  notional < minimum ||
                  !hasFundingSource
                }
                className={`w-full rounded-xl py-4 text-sm font-bold text-white disabled:bg-[#D7D7D5] ${
                  direction === "long"
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-rose-500 hover:bg-rose-600"
                }`}
              >
                {preparingReview
                  ? "PREPARING REVIEW…"
                  : `REVIEW ${direction.toUpperCase()} ${
                      selectedMarket?.symbol ?? ""
                    }`}
              </button>
            </div>
          </form>
        </main>
        {preparedProposal && (
          <div className="absolute -inset-px z-20 grid place-items-center bg-[#25232A]/40 p-5 backdrop-blur-md">
            <div className="max-h-[92%] w-full max-w-3xl overflow-auto rounded-[24px] bg-[#FFF8F2] p-3 shadow-[0_28px_90px_rgba(32,20,14,0.32)]">
              <div className="flex items-center justify-between px-3 pt-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#E85D04]">
                    Final confirmation
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-[#20212A]">
                    Review before signing
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreparedProposal(null)}
                  className="rounded-full border border-[#E7DDD4] bg-white p-2 text-[#20212A] hover:bg-[#FFF0E4]"
                  aria-label="Reject and close review"
                >
                  <X className="size-4" />
                </button>
              </div>
              <PerpProposalCard
                proposal={preparedProposal}
                walletAddress={walletAddress}
                embedded
                onReject={() => setPreparedProposal(null)}
                onExecute={() => {
                  setPreparedProposal(null);
                  void loadData(true);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
