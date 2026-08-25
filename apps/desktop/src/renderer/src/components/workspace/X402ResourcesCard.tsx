import { Check, CircleDollarSign, Database, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { X402Receipt, X402Resource } from "@mirae/contracts";

function safeHostname(value: string) {
  try { return new URL(value).hostname; } catch { return "External provider"; }
}

function friendlyProviderName(resource: X402Resource) {
  const name = resource.resource.serviceName ?? safeHostname(resource.resource.url);
  if (/^x402Atlas Hyperliquid Perps$/iu.test(name)) return "Atlas · Hyperliquid Perpetuals";
  if (/^x402Atlas Hyperliquid Mid Prices$/iu.test(name)) return "Atlas · Hyperliquid Prices";
  if (/^three\.ws Market Derivatives$/iu.test(name)) return "three.ws · Derivatives Market Data";
  return name.replace(/^x402\s*/iu, "").trim() || "External market data";
}

function friendlyPurchaseError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "Approval was rejected.";
  if (/Keystore file is invalid/iu.test(raw)) return "The local vault uses an older x402 record format. Restart with the latest Mirae build; do not reset or recreate your wallet.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

export function X402ResourcesCard({ message, restricted, onExecute, onAnalyze }: {
  message: any;
  restricted: boolean;
  onExecute: (resource: X402Resource, masterPassword?: string) => Promise<X402Receipt>;
  onAnalyze: (receiptIds: string[]) => Promise<void>;
}) {
  const resources = (message.x402Resources ?? []) as X402Resource[];
  const receipts = (message.x402Receipts ?? []) as X402Receipt[];
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<string[]>(() => [...new Set([...(message.x402SelectedResourceIds ?? []), ...receipts.filter((receipt) => receipt.status === "RESOURCE_RECEIVED").map((receipt) => receipt.resourceId)])]);
  const [progress, setProgress] = useState<{ current: number; total: number; provider: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const receivedIds = useMemo(() => new Set(receipts.filter((receipt) => receipt.status === "RESOURCE_RECEIVED").map((receipt) => receipt.resourceId)), [receipts]);
  const selectedResources = resources.filter((resource) => selected.includes(resource.id));
  const unpaid = selectedResources.filter((resource) => !receivedIds.has(resource.id));
  const total = selectedResources.reduce((sum, resource) => sum + Number(resource.requirements.amount) / 1_000_000, 0);
  const showAction = restricted && (progress !== null || unpaid.length > 0 || receivedIds.size === 0);
  const recommendedId = resources.find((resource) => /(?:perps|derivatives)/iu.test(resource.resource.serviceName ?? "") || /(?:funding|open interest)/iu.test(resource.resource.description ?? ""))?.id ?? resources[0]?.id;

  useEffect(() => {
    if (!Array.isArray(message.x402SelectedResourceIds)) return;
    setSelected((current) => [...new Set([...current, ...message.x402SelectedResourceIds])]);
  }, [message.x402SelectedResourceIds]);

  const executeSelected = async () => {
    if (inFlight.current || unpaid.length === 0 || (restricted && !password)) return;
    inFlight.current = true;
    setError(null);
    const newReceiptIds: string[] = [];
    try {
      for (const [index, resource] of unpaid.entries()) {
        setProgress({ current: index + 1, total: unpaid.length, provider: friendlyProviderName(resource) });
        try {
          const receipt = await onExecute(resource, restricted ? password : undefined);
          newReceiptIds.push(receipt.id);
        } catch (cause) {
          const result = index === 0 ? "No purchase was submitted." : `${index} purchase${index === 1 ? "" : "s"} succeeded.`;
          setError(`${result} The batch stopped safely: ${friendlyPurchaseError(cause)}`);
          break;
        }
      }
      if (newReceiptIds.length > 0) {
        setProgress({ current: newReceiptIds.length, total: newReceiptIds.length, provider: "Mirae is analyzing verified market data…" });
        const allReceiptIds = [...new Set([...receipts.filter((receipt) => receipt.status === "RESOURCE_RECEIVED").map((receipt) => receipt.id), ...newReceiptIds])];
        try { await onAnalyze(allReceiptIds); }
        catch (cause) { setError(`The data was received and remains recorded, but analysis failed safely: ${cause instanceof Error ? cause.message : "unknown error"}`); }
      }
    } finally {
      setProgress(null);
      setPassword("");
      inFlight.current = false;
    }
  };

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[rgb(32_33_42_/_0.12)] bg-white text-[#20212a] shadow-[0_18px_45px_-32px_rgba(32,33,42,0.5)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 bg-[#fffaf6] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#df6b22]/25 bg-[#fff3e9] text-[#df6b22]"><Database size={17} /></span><div><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Solana x402 · Market data</p><h3 className="mt-1 text-base font-semibold">{restricted ? "Choose paid market data" : "AI-managed market data"}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#686970]">{restricted ? "Select only the sources you want Mirae to use. You will review each charge before payment." : "Mirae selects and purchases only the smallest useful provider set within your Full Access x402 limits."}</p></div></div>
        <span className="rounded border border-[#df6b22]/30 bg-[#fff8f3] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#b44f10]">{restricted ? "Restricted · manual" : "Full Access · AI managed"}</span>
      </header>
      <div className="p-4 sm:p-5">
        {restricted ? <div className="mb-3"><label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">Master password · required at purchase</label><input type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="Enter master password" autoComplete="current-password" className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10" /></div> : <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900"><ShieldCheck size={14} />Full Access is active. Mirae selects the smallest useful data set and pays within the x402 budget automatically.</p>}
        <div className="space-y-2.5">{resources.map((resource) => {
          const receipt = receipts.find((candidate) => candidate.resourceId === resource.id && candidate.status === "RESOURCE_RECEIVED"); const paid = Boolean(receipt); const checked = paid || selected.includes(resource.id); const recommended = resource.id === recommendedId;
          return <div key={`${message.id}:${resource.id}`} className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${paid ? "border-emerald-300 bg-emerald-50/60 shadow-[inset_3px_0_0_#059669]" : checked ? "border-[#e85d04] bg-[#fff1e6] shadow-[inset_3px_0_0_#e85d04]" : "border-black/10 bg-[#fcfcfb] hover:border-[#df6b22]/40 hover:bg-[#fffaf6]"}`}>
            {restricted ? <label className="relative mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center"><input className={`peer absolute inset-0 size-5 cursor-pointer appearance-none rounded border bg-white transition checked:text-white disabled:cursor-not-allowed disabled:opacity-100 ${paid ? "border-emerald-600 checked:border-emerald-600 checked:bg-emerald-600" : "border-black/25 checked:border-[#e85d04] checked:bg-[#e85d04]"}`} type="checkbox" checked={checked} disabled={paid || progress !== null} onChange={(event) => { const next = event.currentTarget.checked; setSelected((current) => next ? [...new Set([...current, resource.id])] : current.filter((id) => id !== resource.id)); }} /><Check className="pointer-events-none relative text-transparent peer-checked:text-white" size={13} strokeWidth={3} /></label> : <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${paid ? "border-emerald-600 bg-emerald-600 text-white" : checked ? "border-[#e85d04] bg-[#e85d04] text-white" : "border-black/15 bg-[#f4f2ef] text-transparent"}`}><Check size={12} strokeWidth={3} /></span>}
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-semibold text-[#20212a]">{friendlyProviderName(resource)}</strong>{recommended && !paid ? <span className="rounded border border-[#f3b48c] bg-[#fff0e5] px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-[#913b08]">Recommended</span> : null}{paid ? <span className="rounded border border-emerald-200 bg-white/70 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-emerald-800">Received</span> : null}</div><p className="mt-1 text-xs leading-relaxed text-[#55565e]">{resource.resource.description ?? resource.resource.url}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#777880]">External source · paid with USDC</p>{receipt?.signature ? <a className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-800 underline" href={`https://solscan.io/tx/${receipt.signature}`}>View payment on Solscan <ExternalLink size={10} /></a> : null}{receipt?.resourceResponse ? <details className="mt-2 border-t border-emerald-200 pt-2"><summary className="cursor-pointer font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-800">Inspect provider data</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-black/5 bg-white/70 p-3 text-[11px] text-[#4c4d54]">{receipt.resourceResponse.body.slice(0, 4_000)}</pre></details> : null}</div>
            <div className="shrink-0 text-right"><strong className="block font-mono text-sm">${(Number(resource.requirements.amount) / 1_000_000).toFixed(4)}</strong><small className="font-mono text-[8px] uppercase tracking-wider text-[#929399]">USDC</small></div>
          </div>;
        })}</div>
        {progress ? <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#df6b22]/25 bg-[#fff8f3] px-3 py-2.5"><LoaderCircle className="animate-spin text-[#df6b22]" size={16} /><div className="min-w-0 flex-1"><div className="flex justify-between font-mono text-[9px] font-semibold uppercase tracking-wider text-[#9c450c]"><span>Approval {progress.current}/{progress.total}</span><span>{Math.round(progress.current / progress.total * 100)}%</span></div><p className="mt-1 truncate text-[10px] text-[#686970]">{progress.provider}</p></div></div> : null}
        {!restricted && ["selecting", "purchasing", "analyzing"].includes(message.x402AutoStatus) ? <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#df6b22]/25 bg-[#fff8f3] px-3 py-2.5 text-xs font-medium text-[#8e3d0a]"><LoaderCircle className="animate-spin" size={15} />{message.x402AutoStatus === "selecting" ? "AI is selecting the most relevant source…" : message.x402AutoStatus === "purchasing" ? "Purchasing AI-selected market data…" : "Analyzing verified provider data…"}</div> : null}
        {message.x402SelectionRationale ? <p className="mt-3 rounded-lg border border-black/10 bg-[#f8f8f6] px-3 py-2.5 text-xs leading-relaxed text-[#55565e]"><strong>Why Mirae selected this:</strong> {message.x402SelectionRationale}</p> : null}
        {error || message.x402AutoError ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700">{error ?? message.x402AutoError}</p> : null}
      </div>
      <footer className="flex flex-col gap-3 border-t border-black/10 bg-[#fffaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 text-[#df6b22]" size={16} /><div><p className="font-mono text-[9px] uppercase tracking-wider text-[#686970]">{restricted ? "Purchase total" : "AI-selected total"}</p><p className="mt-0.5 text-sm font-semibold text-[#20212a]">${total.toFixed(4)} USDC <span className="font-normal text-[#777880]">· network fee covered</span></p><p className="mt-1 text-[10px] text-[#5f6067]">{restricted ? (unpaid.length > 0 ? `${unpaid.length} provider approval${unpaid.length === 1 ? "" : "s"} required` : "Choose a source to continue. Nothing has been charged.") : (selected.length > 0 ? `${selected.length} source${selected.length === 1 ? "" : "s"} selected within the $0.10 mission cap.` : "AI selection is pending; no payment has been submitted.")}</p></div></div>{showAction ? <button type="button" disabled={progress !== null || unpaid.length === 0 || (restricted && !password)} onClick={() => void executeSelected()} className="min-w-[225px] rounded-lg bg-[#e85d04] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c94e00] disabled:cursor-not-allowed disabled:bg-[#e8e5e1] disabled:text-[#55565e] disabled:shadow-none disabled:opacity-100">{progress ? `Processing ${progress.current}/${progress.total}` : unpaid.length > 0 ? `Review purchase · $${total.toFixed(4)}` : "Choose a data source"}</button> : null}</footer>
    </section>
  );
}
