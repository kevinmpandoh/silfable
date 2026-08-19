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
    <div className="my-3 overflow-hidden rounded-2xl border border-[#FF8A00]/30 bg-[#0c101c] p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#22283a] pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-8 items-center justify-center rounded-lg ${isLong ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {isLong ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{proposal.market}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                {proposal.direction.toUpperCase()} · {proposal.leverage}x
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{proposal.venue} · {proposal.orderType.toUpperCase()} ORDER</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400">Oracle Price</span>
          <p className="font-mono text-xs font-bold text-white">${proposal.oraclePriceUsd.toLocaleString()}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-[#131929] p-3 text-xs">
        <div>
          <span className="text-[10px] text-gray-400">Position Size</span>
          <p className="font-semibold text-white">${proposal.notionalUsd.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Margin Required</span>
          <p className="font-semibold text-white">${proposal.marginRequiredUsd.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Funding Rate</span>
          <p className="font-semibold text-[#FFAD45]">{proposal.fundingRateHourlyPct}%/hr</p>
        </div>
      </div>

      {/* Security Checks */}
      <div className="space-y-1.5 border-t border-[#22283a] pt-3 text-[11px]">
        {proposal.checks.map((check) => (
          <div key={check.code} className="flex items-center gap-2 text-gray-300">
            {check.status === "pass" ? (
              <ShieldCheck className="size-3.5 flex-none text-emerald-400" />
            ) : (
              <ShieldAlert className="size-3.5 flex-none text-rose-400" />
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
            className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
              isLong
                ? "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
                : "bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50"
            }`}
          >
            {executing ? "Signing with Local Vault..." : `Confirm & Sign ${proposal.direction.toUpperCase()} Order`}
          </button>
        </div>
      )}
    </div>
  );
}
