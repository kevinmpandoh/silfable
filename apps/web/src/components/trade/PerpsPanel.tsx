"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

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
  const [sizeMode, setSizeMode] = useState<"base" | "notional">("notional");
  const [size, setSize] = useState("");
  const [collateral, setCollateral] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Both readers leave React state alone, so every caller owns its own updates. */
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([readMarkets(), readAccount()])
      .then(([marketState, accountState]) => {
        if (cancelled) return;
        setMarkets(marketState.markets);
        setMaxNotionalUsd(marketState.maxNotionalUsd);
        setFeedStatus(marketState.status);
        setAccount(accountState);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Perpetual market state could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readMarkets, readAccount]);

  // Prices and funding move continuously, so they are re-read on a short beat.
  // Collateral and positions only change when an order fills, so they are polled
  // far less often. Both pause while the tab is hidden — a background panel does
  // not need fresh quotes, and the RPC should not pay for them.
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

  function retry() {
    setLoading(true);
    setError(null);
    Promise.all([readMarkets(), readAccount()])
      .then(([marketState, accountState]) => {
        setMarkets(marketState.markets);
        setMaxNotionalUsd(marketState.maxNotionalUsd);
        setFeedStatus(marketState.status);
        setAccount(accountState);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Perpetual market state could not be loaded."))
      .finally(() => setLoading(false));
  }

  const market = markets.find((entry) => entry.baseAssetSymbol === selected) ?? markets[0];
  const position = account?.positions.find((entry) => entry.symbol === market?.symbol);
  const numericSize = Number(size.replace(",", "."));
  const estimatedNotional = !market || !Number.isFinite(numericSize) || numericSize <= 0
    ? null
    : sizeMode === "notional" ? numericSize : numericSize * market.oraclePriceUsd;
  const overCeiling = estimatedNotional !== null && estimatedNotional > maxNotionalUsd;
  const collateralAmount = Number(collateral);
  const walletUsdc = account && !Number.isNaN(account.walletUsdcBalance) ? account.walletUsdcBalance : null;
  const shortfall = walletUsdc !== null && Number.isFinite(collateralAmount) && collateralAmount > walletUsdc
    ? collateralAmount - walletUsdc
    : 0;
  const canOpen = Boolean(
    market && !market.stale && estimatedNotional !== null && !overCeiling && acknowledged && !busy
      && (account?.accountExists || isPositive(collateral))
      && shortfall === 0,
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#030611]/85 p-3 backdrop-blur-md sm:p-6" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#0a1020] shadow-[0_38px_120px_rgba(0,0,0,0.72)] sm:max-h-[calc(100vh-3rem)]" role="dialog" aria-modal="true" aria-labelledby="perps-title">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-cyan-300">PERPETUALS · PHOENIX PERPETUALS</p>
            <h2 id="perps-title" className="mt-1 text-lg font-semibold text-white">Open or close a perpetual position</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Mirae builds and simulates the order unsigned on Mainnet. Phantom/Solflare performs the only signature, and a single order is capped at ${maxNotionalUsd.toLocaleString()} notional.</p>
            {feedStatus && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
                <span className={`size-1.5 rounded-full ${feedStatus.live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
                {feedStatus.live ? "Live oracle stream" : "Reconnecting · one-shot read"}
                {feedStatus.chainSlot > 0 && <span className="text-slate-500">· slot {feedStatus.chainSlot.toLocaleString()}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-slate-400 transition hover:border-cyan-300/40 hover:text-white disabled:opacity-40" aria-label="Close perpetuals panel">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Reading live perpetual market state…</p>
          ) : error ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">
              {error}
              <button type="button" onClick={retry} className="ml-2 underline">Retry</button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="Collateral" value={account ? `$${account.collateralUsd.toFixed(2)}` : "—"} />
                <Stat label="Free collateral" value={account ? `$${account.freeCollateralUsd.toFixed(2)}` : "—"} />
                <Stat label="Account health" value={account?.accountExists ? `${account.healthPct}%` : "No account"} tone={account?.accountExists && account.healthPct < 20 ? "warn" : "normal"} />
                <Stat
                  label="Wallet USDC"
                  value={account ? (Number.isNaN(account.walletUsdcBalance) ? "Unavailable" : `$${account.walletUsdcBalance.toFixed(2)}`) : "—"}
                  tone={account && account.walletUsdcBalance <= 0 ? "warn" : "normal"}
                />
              </div>

              {!account?.accountExists && (
                <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                  <p className="text-xs leading-5 text-amber-100">This wallet has no perpetuals account yet. Phoenix opens an isolated
                  subaccount with your first order, so set the collateral below and it is funded in the same transaction.</p>
                </div>
              )}

              {account?.accountExists && account.positions.length > 0 && (
                <div className="mt-4 grid gap-2">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-slate-400">OPEN POSITIONS</p>
                  {account.positions.map((entry) => (
                    <div key={entry.symbol} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm text-white">
                        {entry.direction === "long" ? <TrendingUp className="size-4 text-emerald-400" /> : <TrendingDown className="size-4 text-rose-400" />}
                        {entry.symbol} · {entry.direction} {entry.baseAmount}
                      </span>
                      <span className="text-xs text-slate-400">entry ${entry.entryPriceUsd.toFixed(4)} · mark ${entry.markPriceUsd.toFixed(4)}</span>
                      <span className={`text-xs ${entry.unrealizedPnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{entry.unrealizedPnlUsd >= 0 ? "+" : ""}${entry.unrealizedPnlUsd.toFixed(2)}</span>
                      <button type="button" disabled={busy} onClick={() => onSubmit({ action: "close", symbol: entry.symbol.replace("-PERP", "") })} className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-200 hover:border-cyan-300/40 disabled:opacity-40">Close</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-3">
                <p className="font-mono text-[10px] tracking-[0.18em] text-slate-400">MARKET</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {markets.map((entry) => (
                    <button
                      key={entry.symbol}
                      type="button"
                      onClick={() => setSelected(entry.baseAssetSymbol)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${entry.baseAssetSymbol === selected ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}
                    >
                      <span className="block text-sm font-semibold text-white">{entry.symbol}</span>
                      <span className="block text-xs text-slate-400">${entry.oraclePriceUsd.toFixed(entry.oraclePriceUsd >= 100 ? 2 : 4)} · up to {entry.maxLeverage}x</span>
                      {entry.stale && (
                        <span className="mt-1 block text-[10px] font-semibold text-amber-300">
                          Oracle stale · last published {formatSlotAge(entry.oracleAgeSlots)} ago
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Activity className="size-3" />funding {entry.fundingRateHourlyPctLong >= 0 ? "+" : ""}{entry.fundingRateHourlyPctLong.toFixed(4)}%/h</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-slate-400">SIDE</span>
                  <div className="flex gap-2">
                    {(["long", "short"] as const).map((side) => (
                      <button key={side} type="button" onClick={() => setDirection(side)} className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition ${direction === side ? (side === "long" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-rose-400/60 bg-rose-400/10 text-rose-200") : "border-white/10 bg-black/20 text-slate-300"}`}>{side}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-slate-400">SIZE</span>
                  <div className="flex gap-2">
                    <input inputMode="decimal" value={size} onChange={(event) => setSize(sanitizeDecimal(event.target.value, 9))} placeholder={sizeMode === "notional" ? "USD notional" : `${market?.baseAssetSymbol ?? "Base"} amount`} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                    <button type="button" onClick={() => setSizeMode((mode) => (mode === "notional" ? "base" : "notional"))} className="shrink-0 rounded-md border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/40">{sizeMode === "notional" ? "USD" : market?.baseAssetSymbol ?? "BASE"}</button>
                  </div>
                </div>
                <label className="text-xs text-slate-300 sm:col-span-2">
                  Collateral to post with this order (USDC)
                  <input inputMode="decimal" value={collateral} onChange={(event) => setCollateral(sanitizeDecimal(event.target.value, 6))} placeholder="USDC" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">Isolated margin: this amount backs the position and is the most it can lose. Required for the first order on a new account.</span>
                </label>
              </div>

              {estimatedNotional !== null && market && (
                <p className={`mt-3 text-xs ${overCeiling ? "text-rose-300" : "text-slate-400"}`}>
                  Estimated notional ${estimatedNotional.toFixed(2)}
                  {overCeiling ? ` exceeds the guarded $${maxNotionalUsd.toLocaleString()} per-order ceiling.` : ` at the current ${market.symbol} oracle price. The exact size is re-derived during preflight.`}
                </p>
              )}
              {account && !Number.isNaN(account.walletUsdcBalance) && account.walletUsdcBalance <= 0 && (
                <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                  <p className="text-xs leading-5 text-amber-100">
                    This wallet holds no USDC, and Phoenix funds positions with USDC only. Deposit USDC into
                    {" "}{shortAddress(account.walletAddress)}, or swap into it first — a position cannot be opened without it.
                  </p>
                  {onGetUsdc && (
                    <button type="button" onClick={onGetUsdc} className="mt-2 rounded-full border border-amber-300/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100 hover:border-amber-300">
                      Swap SOL to USDC
                    </button>
                  )}
                </div>
              )}
              {shortfall > 0 && (
                <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
                  This order posts ${Number(collateral).toFixed(2)} collateral but the wallet holds ${account?.walletUsdcBalance.toFixed(2)} USDC.
                  Top up ${shortfall.toFixed(2)} more, or lower the collateral.
                </p>
              )}
              {market?.stale && (
                <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
                  {market.symbol} has not published a fresh oracle price for {formatSlotAge(market.oracleAgeSlots)}. Preflight refuses to size a
                  leveraged position against a stale price, so ordering is disabled for this market until the feed resumes.
                </p>
              )}
              {position && (
                <p className="mt-1 text-xs text-amber-200">You already hold a {position.direction} {position.symbol} position. A same-side order increases it; the opposite side reduces it.</p>
              )}

              <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-300">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
                <span>I understand a perpetual position is leveraged, pays or receives funding every hour, and can be liquidated — losing the collateral backing it.</span>
              </label>
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-white/10 bg-[#0c1326] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-1 text-[10px] leading-4 text-slate-500"><ShieldAlert className="size-3.5 shrink-0" /> Preflight simulates the order unsigned. Your wallet is never opened by this panel.</span>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-white/30 disabled:opacity-40">Cancel</button>
            <button
              type="button"
              disabled={!canOpen}
              onClick={() => market && onSubmit({
                action: "open",
                symbol: market.baseAssetSymbol,
                direction,
                ...(sizeMode === "base" ? { baseAmount: size } : { notionalUsd: size }),
                ...(isPositive(collateral) ? { collateralUsdc: collateral } : {}),
              })}
              className="primaryButton inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
            >
              {busy ? "Preparing…" : `Prepare ${direction} order`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "warn" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="block font-mono text-[10px] tracking-[0.14em] text-slate-500">{label.toUpperCase()}</span>
      <span className={`block text-sm ${tone === "warn" ? "text-amber-300" : "text-white"}`}>{value}</span>
    </div>
  );
}

/** Solana slots land at roughly 0.4s, which is close enough for a staleness label. */
function formatSlotAge(slots: number): string {
  if (!Number.isFinite(slots) || slots >= Number.MAX_SAFE_INTEGER) return "an unknown time";
  const seconds = slots * 0.4;
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 5_400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
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
