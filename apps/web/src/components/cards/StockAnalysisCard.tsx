"use client";

import { TrendingUp, TrendingDown, Building2, Globe, ShieldCheck, Zap, ArrowRightLeft } from "lucide-react";
import type { StockAnalysisIntelligence, OnChainStockToken } from "@/lib/finnhub-stock";

function formatMarketCap(millions?: number): string {
  if (!millions || millions <= 0) return "N/A";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(2)}B`;
  return `$${millions.toFixed(2)}M`;
}

export function StockAnalysisCard({
  intelligence,
  onSwap,
  busy = false,
}: {
  intelligence: StockAnalysisIntelligence;
  onSwap?: (token: OnChainStockToken) => void;
  busy?: boolean;
}) {
  const { ticker, companyName, quote, profile, metrics, recommendation, analystConsensus, onChainToken } = intelligence;
  const isPositive = quote.change >= 0;
  const changeFormatted = `${isPositive ? "+" : ""}$${quote.change.toFixed(2)} (${isPositive ? "+" : ""}${quote.percentChange.toFixed(2)}%)`;

  const consensusTone =
    analystConsensus === "Strong Buy" || analystConsensus === "Buy"
      ? "bg-emerald-50 text-emerald-700 border-emerald-500/40"
      : analystConsensus === "Sell" || analystConsensus === "Strong Sell"
        ? "bg-rose-50 text-rose-700 border-rose-500/40"
        : "bg-amber-50 text-amber-700 border-amber-500/40";

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[rgb(32,33,42,0.12)] bg-white shadow-sm" aria-label={`Stock analysis for ${ticker}`}>
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">
              US EQUITIES · FINNHUB REAL-TIME
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-[#20212a]">
            {companyName} <span className="font-mono font-medium text-[#686970]">({ticker})</span>
          </h3>
          <p className="mt-0.5 text-xs text-[#686970]">
            {profile.exchange} · {profile.industry}
          </p>
        </div>

        {analystConsensus && (
          <span className={`shrink-0 rounded border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${consensusTone}`}>
            Consensus: {analystConsensus}
          </span>
        )}
      </header>

      {/* Price Hero */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgb(32,33,42,0.12)] bg-white px-4 py-3.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#686970]">Current Price</span>
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <span className="text-2xl font-bold text-[#20212a]">${quote.currentPrice.toFixed(2)}</span>
            <span className={`flex items-center gap-0.5 font-mono text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
              {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {changeFormatted}
            </span>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-[10px] text-[#686970]">Day Range</span>
          <p className="font-mono font-semibold text-[#20212a]">
            ${quote.lowOfDay.toFixed(2)} — ${quote.highOfDay.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Key Financial Ledger */}
      <dl className="grid grid-cols-2 border-b border-[rgb(32,33,42,0.12)] text-xs sm:grid-cols-4">
        <div className="border-b border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">Market Cap</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">{formatMarketCap(profile.marketCapMillions)}</dd>
        </div>
        <div className="border-b border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5 sm:border-r">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">52-Week Range</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">
            {metrics.week52Low && metrics.week52High ? `$${metrics.week52Low.toFixed(2)} - $${metrics.week52High.toFixed(2)}` : "N/A"}
          </dd>
        </div>
        <div className="border-b border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">P/E Ratio (TTM)</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">{metrics.peRatio ? metrics.peRatio.toFixed(2) : "N/A"}</dd>
        </div>
        <div className="border-b border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">Beta / Volatility</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">{metrics.beta ? metrics.beta.toFixed(2) : "N/A"}</dd>
        </div>
        <div className="border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">EPS (TTM)</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">{metrics.eps ? `$${metrics.eps.toFixed(2)}` : "N/A"}</dd>
        </div>
        <div className="border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5 sm:border-r">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">Div Yield</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">{metrics.dividendYield ? `${metrics.dividendYield.toFixed(2)}%` : "0.00%"}</dd>
        </div>
        <div className="border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">Prev Close</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">${quote.previousClose.toFixed(2)}</dd>
        </div>
        <div className="bg-[#fcfcfb] px-3.5 py-2.5">
          <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">Open Price</dt>
          <dd className="mt-1 truncate font-semibold text-[#20212a]">${quote.openPrice.toFixed(2)}</dd>
        </div>
      </dl>

      {/* On-Chain Tokenized Stock Option (if discovered on Solana) */}
      {onChainToken && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(32,33,42,0.12)] bg-[#fff8f3] px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#df6b22]">
              <Zap className="size-3" /> Tokenized Stock on Solana Available
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#20212a]">
              {onChainToken.symbol} ({onChainToken.issuer ?? "SPL Token"}) ·{" "}
              <span className="font-mono text-[11px] font-normal text-[#686970]">
                {onChainToken.mint.slice(0, 6)}…{onChainToken.mint.slice(-4)}
              </span>
            </p>
          </div>
          {onSwap && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSwap(onChainToken)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(223,107,34,0.45)] bg-[#df6b22] px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-sm hover:bg-[#c95b18] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRightLeft className="size-3.5" />
              {busy ? "Loading Route…" : `Swap ${onChainToken.symbol} on Jupiter`}
            </button>
          )}
        </div>
      )}

      {/* Analyst Consensus Breakdown (if present) */}
      {recommendation && (
        <div className="border-b border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-4 py-3 text-xs">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#b84d10]">
            Wall Street Analyst Target Breakdown ({recommendation.period})
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
              Strong Buy: {recommendation.strongBuy}
            </span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
              Buy: {recommendation.buy}
            </span>
            <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200">
              Hold: {recommendation.hold}
            </span>
            <span className="rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700 border border-rose-200">
              Sell: {recommendation.sell}
            </span>
            {recommendation.strongSell > 0 && (
              <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                Strong Sell: {recommendation.strongSell}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer / Links */}
      <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#fffaf6] px-4 py-3">
        <span className="flex items-center gap-1.5 text-[10px] text-[#686970]">
          <ShieldCheck className="size-3.5 text-emerald-600" /> Real-time market feed from Finnhub. For informational & research purposes only.
        </span>
        <div className="flex items-center gap-2">
          {profile.weburl && (
            <a
              href={profile.weburl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-[rgb(32,33,42,0.14)] bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#20212a] hover:border-[#df6b22]/40 hover:text-[#df6b22] transition-colors"
            >
              <Globe className="size-3" /> Website
            </a>
          )}
          <a
            href={`https://finance.yahoo.com/quote/${ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-[rgb(32,33,42,0.14)] bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#20212a] hover:border-[#df6b22]/40 hover:text-[#df6b22] transition-colors"
          >
            <Building2 className="size-3" /> Yahoo Finance
          </a>
        </div>
      </footer>
    </section>
  );
}
