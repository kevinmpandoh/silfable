"use client";

import { Check, CircleDollarSign, Database, ExternalLink, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import type { WebProposal } from "@/lib/db";

function safeResourceHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "External provider";
  }
}

function friendlyProviderName(resource: NonNullable<WebProposal["x402Resources"]>[number]) {
  const name = resource.resource.serviceName ?? safeResourceHostname(resource.resource.url);
  if (/^x402Atlas Hyperliquid Perps$/iu.test(name)) return "Atlas · Hyperliquid Perpetuals";
  if (/^x402Atlas Hyperliquid Mid Prices$/iu.test(name)) return "Atlas · Hyperliquid Prices";
  if (/^three\.ws Market Derivatives$/iu.test(name)) return "three.ws · Derivatives Market Data";
  return name.replace(/^x402\s*/iu, "").trim() || "External market data";
}

class X402CardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("x402 purchase card render failed", error, info);
  }

  render() {
    if (this.state.failed) {
      return <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">This x402 card could not be displayed safely. Refresh the session and create a fresh data request; no payment was prepared or charged.</section>;
    }
    return this.props.children;
  }
}

export function X402PurchaseCard({ proposal, busy, onPurchase }: { proposal: WebProposal; busy: boolean; onPurchase: (selectedResourceIds: string[]) => void }) {
  const resources = proposal.x402Resources ?? [];
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>(() => {
    const availableIds = new Set(resources.map((resource) => resource.id));
    return (proposal.x402SelectedResourceIds ?? []).filter((id) => availableIds.has(id));
  });
  const selected = new Set(selectedResourceIds);
  const receipts = proposal.x402Receipts ?? [];
  const receivedIds = new Set(receipts.filter((receipt) => receipt.status === "RESOURCE_RECEIVED").map((receipt) => receipt.resourceId));
  const hasUnpaidSelection = resources.some((resource) => selected.has(resource.id) && !receivedIds.has(resource.id));
  const selectedResources = resources.filter((resource) => selected.has(resource.id));
  const total = selectedResources.reduce((sum, resource) => sum + Number(resource.requirements.amount) / 1_000_000, 0);
  const unpaidSelectedCount = selectedResources.filter((resource) => !receivedIds.has(resource.id)).length;
  const showPurchaseAction = busy || hasUnpaidSelection || receivedIds.size === 0;
  const recommendedResourceId = resources.find((resource) => /(?:perps|derivatives)/iu.test(resource.resource.serviceName ?? "") || /(?:funding|open interest)/iu.test(resource.resource.description ?? ""))?.id ?? resources[0]?.id;

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[rgb(32,33,42,0.12)] bg-white text-[#20212a] shadow-[0_18px_45px_-32px_rgba(32,33,42,0.5)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgb(32,33,42,0.1)] bg-[#fffaf6] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#df6b22]/25 bg-[#df6b22]/8 text-[#df6b22]"><Database size={17} aria-hidden="true" /></span>
          <div><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Solana x402 · Market data</p><h3 className="mt-1 text-base font-semibold">Choose market data</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#686970]">Select the data Mirae should use for this analysis. You’ll review each payment separately in your wallet before anything is charged.</p></div>
        </div>
        <span className="rounded border border-[#df6b22]/30 bg-[#fff8f3] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#b44f10]">Wallet approval required</span>
      </header>

      <div className="p-4 sm:p-5">
        <div className="space-y-2.5">
          {resources.length === 0 ? <p className="rounded-lg border border-dashed border-black/15 bg-[#f8f8f6] p-4 text-sm text-[#686970]">No compatible USDC Solana resource was found.</p> : resources.map((resource) => {
            const checked = selected.has(resource.id); const paid = receivedIds.has(resource.id);
            const recommended = resource.id === recommendedResourceId;
            return <div key={`${proposal.id}:${resource.id}`} className={`group flex items-start gap-3 rounded-xl border p-3.5 transition ${checked || paid ? "border-[#df6b22]/45 bg-[#fff8f3] shadow-[inset_3px_0_0_#df6b22]" : "border-black/10 bg-[#fcfcfb] hover:border-[#df6b22]/30 hover:bg-[#fffaf6]"}`}>
              <label className="relative mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center" aria-label={`Select ${friendlyProviderName(resource)}`}><input className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded border border-black/20 bg-white transition checked:border-[#df6b22] checked:bg-[#df6b22] disabled:cursor-not-allowed disabled:opacity-60" type="checkbox" checked={checked || paid} disabled={busy || paid} onChange={(event) => { const nextChecked = event.currentTarget.checked; setSelectedResourceIds((current) => nextChecked ? [...new Set([...current, resource.id])] : current.filter((id) => id !== resource.id)); }} /><Check className="pointer-events-none relative text-transparent peer-checked:text-white" size={13} strokeWidth={3} aria-hidden="true" /></label>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-semibold">{friendlyProviderName(resource)}</strong>{recommended && !paid ? <span className="rounded bg-[#fff0e5] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-wider text-[#a9470c]">Recommended</span> : null}{paid ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-emerald-700">Received</span> : null}</span><span className="mt-1 block text-xs leading-relaxed text-[#686970]">{resource.resource.description ?? resource.resource.url}</span><span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.08em] text-[#929399]">External provider · paid with USDC</span></span>
              <span className="shrink-0 text-right"><strong className="block font-mono text-sm">${(Number(resource.requirements.amount) / 1_000_000).toFixed(4)}</strong><small className="font-mono text-[8px] uppercase tracking-wider text-[#929399]">USDC</small></span>
            </div>;
          })}
        </div>

        {proposal.x402Error ? <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700"><TriangleAlert className="mt-0.5 shrink-0" size={15} aria-hidden="true" /><span>{proposal.x402Error}</span></div> : null}
        {proposal.x402Progress ? <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#df6b22]/25 bg-[#fff8f3] px-3 py-2.5"><LoaderCircle className="animate-spin text-[#df6b22]" size={16} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex justify-between font-mono text-[9px] font-semibold uppercase tracking-wider text-[#9c450c]"><span>Wallet approval {proposal.x402Progress.current}/{proposal.x402Progress.total}</span><span>{Math.round((proposal.x402Progress.current / proposal.x402Progress.total) * 100)}%</span></div><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#df6b22]/15"><div className="h-full rounded-full bg-[#df6b22] transition-all" style={{ width: `${(proposal.x402Progress.current / proposal.x402Progress.total) * 100}%` }} /></div><p className="mt-1 truncate text-[10px] text-[#686970]">{proposal.x402Progress.provider}</p></div></div> : null}
        {receipts.map((receipt) => <div key={receipt.id} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><ShieldCheck size={15} aria-hidden="true" />Resource received · ${(Number(receipt.amount) / 1_000_000).toFixed(4)} USDC</span>{receipt.signature ? <a className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-700 underline underline-offset-2" href={`https://solscan.io/tx/${receipt.signature}`} target="_blank" rel="noreferrer">Solscan <ExternalLink size={11} /></a> : null}</div><p className="mt-1 font-mono text-[9px] text-emerald-700/70">{safeResourceHostname(receipt.resourceUrl)}</p>{receipt.resourceResponse ? <details className="mt-2 border-t border-emerald-200 pt-2"><summary className="cursor-pointer font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-800">Inspect provider evidence</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-black/5 bg-white/70 p-3 text-[11px] text-[#4c4d54]">{receipt.resourceResponse.body.slice(0, 4_000)}</pre></details> : null}</div>)}
      </div>

      <footer className="flex flex-col gap-3 border-t border-[rgb(32,33,42,0.1)] bg-[#fffaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 text-[#df6b22]" size={16} aria-hidden="true" /><div><p className="font-mono text-[9px] uppercase tracking-wider text-[#686970]">Total selected</p><p className="mt-0.5 text-sm font-semibold">${total.toFixed(4)} USDC <span className="font-normal text-[#929399]">· network fee covered</span></p>{unpaidSelectedCount > 0 ? <p className="mt-1 text-[10px] text-[#686970]">{unpaidSelectedCount} separate wallet approval{unpaidSelectedCount === 1 ? "" : "s"}</p> : <p className="mt-1 text-[10px] text-[#929399]">Nothing is charged until you approve in your wallet.</p>}</div></div>{showPurchaseAction ? <button type="button" disabled={busy || !hasUnpaidSelection} onClick={() => onPurchase(selectedResourceIds)} className="min-w-[225px] rounded-lg bg-[#df6b22] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(223,107,34,0.8)] transition hover:bg-[#c95b18] disabled:cursor-not-allowed disabled:opacity-45">{busy ? proposal.x402Progress ? `Wallet approval ${proposal.x402Progress.current}/${proposal.x402Progress.total}` : "Processing…" : hasUnpaidSelection ? `Review purchase · $${total.toFixed(4)}` : "Select at least one source"}</button> : null}</footer>
    </section>
  );
}

export function SafeX402PurchaseCard(props: Parameters<typeof X402PurchaseCard>[0]) {
  return <X402CardErrorBoundary><X402PurchaseCard {...props} /></X402CardErrorBoundary>;
}
