import { Check, ShieldAlert, TrendingDown, TrendingUp, X } from "lucide-react";
import type { BullishPerpSetupAssessment } from "@mirae/contracts";

export function PerpAnalysisCard({ market, assessment }: { market: string; assessment: BullishPerpSetupAssessment }) {
  const qualified = assessment.verdict !== "neutral";
  const bearish = assessment.direction === "short";
  const total = assessment.checks.length;
  const progress = total > 0 ? Math.min(100, Math.max(0, assessment.score / total * 100)) : 0;
  const remaining = Math.max(0, assessment.requiredScore - assessment.score);

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[rgba(32,33,42,0.12)] bg-white text-[#20212a] shadow-[0_16px_40px_-32px_rgba(32,33,42,0.5)]" aria-label={`${market} setup analysis`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-[#fffaf6] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${qualified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#df6b22]/25 bg-[#fff3e9] text-[#c95b18]"}`}>
            {qualified ? (bearish ? <TrendingDown size={17} /> : <TrendingUp size={17} />) : <ShieldAlert size={17} />}
          </span>
          <div><p className="font-mono text-[8px] font-semibold uppercase tracking-[0.17em] text-[#df6b22]">Perpetuals · Setup review</p><h3 className="mt-0.5 text-base font-semibold tracking-tight">{market}</h3></div>
        </div>
        <span className={`rounded-md border px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.12em] ${qualified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#df6b22]/25 bg-[#fff3e9] text-[#a9470c]"}`}>{qualified ? `${bearish ? "Bearish" : "Bullish"} · qualified` : "Threshold not met"}</span>
      </header>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-[#f8f8f6] px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-baseline gap-2 sm:min-w-32"><strong className="text-2xl font-semibold tracking-tight">{assessment.score}/{total}</strong><span className="font-mono text-[8px] uppercase tracking-wider text-[#7d7e84]">checks passed</span></div>
          <div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full ${qualified ? "bg-emerald-500" : "bg-[#df6b22]"}`} style={{ width: `${progress}%` }} /></div><p className="mt-1.5 text-[10px] text-[#686970]">{qualified ? `Policy threshold of ${assessment.requiredScore} checks passed.` : `${remaining} more passing check${remaining === 1 ? "" : "s"} required to prepare an order.`}</p></div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {assessment.checks.map((check) => <div key={check.code} className={`flex min-h-16 items-start gap-2.5 rounded-lg border-l-[3px] border-y border-r px-3 py-2.5 ${check.passed ? "border-emerald-400 border-y-black/8 border-r-black/8 bg-white" : "border-rose-400 border-y-black/8 border-r-black/8 bg-[#fffafa]"}`}><span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-white ${check.passed ? "bg-emerald-600" : "bg-rose-500"}`}>{check.passed ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}</span><div className="min-w-0"><span className={`font-mono text-[7px] font-bold uppercase tracking-[0.12em] ${check.passed ? "text-emerald-700" : "text-rose-700"}`}>{check.passed ? "Pass" : "Block"}</span><p className="mt-0.5 text-[11px] leading-[1.45] text-[#4c4d54]">{check.message}</p></div></div>)}
        </div>
      </div>
      <footer className={`flex items-start gap-2.5 border-t px-5 py-3 text-[11px] leading-relaxed ${qualified ? "border-emerald-200 bg-emerald-50/60 text-emerald-800" : "border-[#df6b22]/20 bg-[#fffaf6] text-[#8e3d0a]"}`}><ShieldAlert className="mt-0.5 shrink-0" size={14} /><p>{qualified ? "Setup qualified. The order still requires a separate preflight and explicit approval." : "No transaction prepared. Market conditions did not meet Mirae’s guarded entry policy."}</p></footer>
    </section>
  );
}
