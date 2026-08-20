import { useState } from "react";
import { ShieldAlert, ShieldCheck, TrendingDown, TrendingUp, KeyRound, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import type { PerpProposal } from "@mirae/contracts";

export function PerpProposalCard({
  proposal,
  walletAddress,
  onExecute,
}: {
  proposal: PerpProposal;
  walletAddress?: string;
  onExecute?: () => void;
}) {
  const [executing, setExecuting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLong = proposal.direction === "long";
  const hasFailingCheck = proposal.checks.some((c) => c.status === "block");

  const handleExecute = async () => {
    if (executing || signature) return;
    try {
      setExecuting(true);
      setError(null);

      const targetWallet = walletAddress ?? proposal.account?.walletAddress;
      if (!targetWallet) throw new Error("No active wallet address available for execution.");

      const res = await window.mirae?.executePerpOrder?.({
        plan: proposal.plan,
        walletAddress: targetWallet,
      });

      if (res?.signature) {
        setSignature(res.signature);
        onExecute?.();
      } else {
        throw new Error("No transaction signature returned.");
      }
    } catch (err: any) {
      console.error("Perp order execution failed", err);
      setError(err?.message || "Transaction signing or broadcast failed.");
    } finally {
      setExecuting(false);
    }
  };

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
              <span className="font-bold text-[#20212A]">{proposal.symbol}</span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${isLong ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {proposal.direction.toUpperCase()} · {proposal.leverage}x
              </span>
            </div>
            <p className="text-[11px] text-[#686970]">{proposal.venue} · ISOLATED MARKET ORDER</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#686970]">Mark Price</span>
          <p className="font-mono text-xs font-bold text-[#20212A]">${Number(proposal.oraclePriceUsd).toLocaleString()}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="my-4 grid grid-cols-3 gap-2 rounded-xl border border-[#20212A]/08 bg-[#F8F9FA] p-3 text-xs">
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Position Size</span>
          <p className="text-[13px] font-bold text-[#20212A]">${Number(proposal.notionalUsd).toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Collateral (USDC)</span>
          <p className="text-[13px] font-bold text-[#20212A]">${Number(proposal.collateralUsdc ?? (Number(proposal.notionalUsd) / proposal.leverage)).toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">Network Fee</span>
          <p className="text-[13px] font-bold text-[#E85D04]">~0.000005 SOL</p>
        </div>
      </div>

      {/* Security Checks */}
      <div className="space-y-1.5 border-t border-[#20212A]/10 pt-3 text-[11px]">
        {proposal.checks.map((check, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[#40424E]">
            {check.status === "pass" ? (
              <ShieldCheck className="size-3.5 flex-none text-emerald-600" />
            ) : (
              <ShieldAlert className="size-3.5 flex-none text-rose-600" />
            )}
            <span className={check.status === "block" ? "font-medium text-rose-700" : ""}>{check.message}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
          <strong>Execution Error:</strong> {error}
        </div>
      )}

      {signature ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Order executed and confirmed on Solana Mainnet!</span>
          </div>
          <a
            href={`https://solscan.io/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-bold text-emerald-700 hover:underline"
          >
            <span>View Solscan</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={hasFailingCheck || executing}
            onClick={handleExecute}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-sm ${
              hasFailingCheck
                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                : isLong
                  ? "bg-[#10B981] text-white hover:bg-[#059669]"
                  : "bg-[#F43F5E] text-white hover:bg-[#E11D48]"
            }`}
          >
            {executing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Signing & Broadcasting…</span>
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" />
                <span>Sign & Execute {proposal.direction.toUpperCase()} Order</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
