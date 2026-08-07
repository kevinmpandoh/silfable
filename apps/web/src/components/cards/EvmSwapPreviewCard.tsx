"use client";

import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import type { WebProposal } from "@/lib/db";

function formatRaw(value: string | undefined, decimals: number): string {
  if (!value || !/^\d+$/u.test(value)) return "—";
  const raw = BigInt(value);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/u, "").slice(0, 8);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function EvmSwapPreviewCard({ proposal, onPrepare, busy }: { proposal: WebProposal; onPrepare: () => void; busy: boolean }) {
  const hasQuote = Boolean(proposal.quoteResponse && proposal.buyAmount);
  const final = ["signing", "submitted", "confirmed", "unknown"].includes(proposal.status);
  const outputDecimals = proposal.buyToken === "ETH" ? 18 : 6;
  return <div className="missionPreview border border-cyan-400/25 bg-slate-950/70 rounded-xl p-4">
    <header className="flex items-center justify-between border-b border-white/10 pb-3 mb-3"><div><span className="text-[11px] font-mono tracking-wider text-cyan-300 block uppercase">ROBINHOOD · UNISWAP · {hasQuote ? "QUOTE READY" : "QUOTE ONLY"}</span><strong className="text-sm text-white font-mono flex items-center gap-2">{proposal.sellToken} <ArrowRight className="size-3.5 text-cyan-300" /> {proposal.buyToken}</strong></div><span className="statusPill border bg-amber-500/10 text-amber-300 border-amber-500/30">Restricted</span></header>
    <dl className="grid grid-cols-2 gap-2 text-xs mb-3 bg-black/30 p-2.5 rounded-lg border border-white/5"><div><dt className="text-slate-500 font-mono">Sell amount</dt><dd className="text-white font-mono">{proposal.sellAmount} {proposal.sellToken}</dd></div><div><dt className="text-slate-500 font-mono">Expected buy</dt><dd className="text-white font-mono">{hasQuote ? `${formatRaw(proposal.buyAmount, outputDecimals)} ${proposal.buyToken}` : "Prepare quote"}</dd></div><div><dt className="text-slate-500 font-mono">Minimum buy</dt><dd className="text-white font-mono">{hasQuote ? `${formatRaw(proposal.minimumBuyAmount, outputDecimals)} ${proposal.buyToken}` : "—"}</dd></div><div><dt className="text-slate-500 font-mono">Slippage limit</dt><dd className="text-white font-mono">Included in quote</dd></div></dl>
    <div className="space-y-1.5 mb-4 text-xs">{(proposal.checks ?? []).map((check) => <div key={check.code} className="flex items-start gap-2 text-slate-300"><CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" /><p>{check.message}</p></div>)}</div>
    <footer className="flex items-center justify-between gap-3 pt-3 border-t border-white/10"><div className="text-[11px] text-slate-400"><span className="block font-medium text-slate-300 flex items-center gap-1"><ShieldCheck className="size-3.5" /> EVM wallet approval required</span><small>{hasQuote ? "Review the live quote, then prepare the wallet transaction." : "Preparing a quote does not open the wallet or broadcast a transaction."}</small></div><button type="button" disabled={busy || final} onClick={onPrepare} className="primaryButton shrink-0 px-4 py-2 text-xs font-semibold">{busy ? "PREPARING..." : hasQuote ? "PREPARE WALLET REVIEW" : "PREPARE QUOTE"}</button></footer>
  </div>;
}
