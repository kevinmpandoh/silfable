import { ShieldAlert, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { DriftPerpProposal } from "@mirae/contracts";

export function DriftPerpProposalCard({
  proposal,
  onExecute,
  executing,
}: {
  proposal: DriftPerpProposal;
  onExecute?: () => void;
  executing?: boolean;
}) {
  const isLong = proposal.direction === "long";

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-[rgb(32_33_42_/_0.12)] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#20212A]/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-8 items-center justify-center rounded-lg border ${isLong ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-rose-200 bg-rose-50 text-rose-600"}`}>
            {isLong ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#20212A]">{proposal.market}</span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${isLong ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {proposal.direction.toUpperCase()} · {proposal.leverage}x
              </span>
            </div>
            <p className="text-[11px] text-[#686970]">{proposal.venue} · {proposal.orderType.toUpperCase()} ORDER</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#686970]">Oracle Price</span>
          <p className="font-mono text-xs font-bold text-[#20212A]">${proposal.oraclePriceUsd.toLocaleString()}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="my-4 grid grid-cols-3 gap-2 rounded-xl border border-[#20212A]/08 bg-[#F8F9FA] p-3 text-xs">
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Position Size</span>
          <p className="text-[13px] font-bold text-[#20212A]">${proposal.notionalUsd.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Margin Required</span>
          <p className="text-[13px] font-bold text-[#20212A]">${proposal.marginRequiredUsd.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Funding Rate</span>
          <p className="text-[13px] font-bold text-[#E85D04]">{proposal.fundingRateHourlyPct}%/hr</p>
        </div>
      </div>

      {/* Security Checks */}
      <div className="space-y-1.5 border-t border-[#20212A]/10 pt-3 text-[11px]">
        {proposal.checks.map((check) => (
          <div key={check.code} className="flex items-center gap-2 text-[#40424E]">
            {check.status === "pass" ? (
              <ShieldCheck className="size-3.5 flex-none text-emerald-600" />
            ) : (
              <ShieldAlert className="size-3.5 flex-none text-rose-600" />
            )}
            <span>{check.message}</span>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      {onExecute && (
        <div className="mt-4 pt-2">
          <button
            type="button"
            onClick={onExecute}
            disabled={executing}
            className={`w-full rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
              isLong
                ? "bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50"
                : "bg-[#F43F5E] text-white hover:bg-[#E11D48] disabled:opacity-50"
            }`}
          >
            {executing ? "Signing with Local Vault..." : `Confirm & Sign ${proposal.direction.toUpperCase()} Order`}
          </button>
        </div>
      )}
    </div>
  );
}
