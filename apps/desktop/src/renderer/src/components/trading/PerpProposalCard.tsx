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
    <div className="my-3 overflow-hidden rounded-2xl border border-[#FF8A00]/30 bg-[#0c101c] p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#22283a] pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-8 items-center justify-center rounded-lg ${isLong ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {isLong ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{proposal.symbol}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                {proposal.direction.toUpperCase()} · {proposal.leverage}x
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{proposal.venue} · ISOLATED MARKET ORDER</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400">Mark Price</span>
          <p className="font-mono text-xs font-bold text-white">${Number(proposal.oraclePriceUsd).toLocaleString()}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-[#131929] p-3 text-xs">
        <div>
          <span className="text-[10px] text-gray-400">Position Size</span>
          <p className="font-semibold text-white">${Number(proposal.notionalUsd).toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Collateral (USDC)</span>
          <p className="font-semibold text-white">${Number(proposal.collateralUsdc ?? (Number(proposal.notionalUsd) / proposal.leverage)).toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Network Fee</span>
          <p className="font-semibold text-[#FFAD45]">~0.000005 SOL</p>
        </div>
      </div>

      {/* Security Checks */}
      <div className="space-y-1.5 border-t border-[#22283a] pt-3 text-[11px]">
        {proposal.checks.map((check, idx) => (
          <div key={idx} className="flex items-center gap-2 text-gray-300">
            {check.status === "pass" ? (
              <ShieldCheck className="size-3.5 flex-none text-emerald-400" />
            ) : (
              <ShieldAlert className="size-3.5 flex-none text-rose-400" />
            )}
            <span className={check.status === "block" ? "text-rose-300" : ""}>{check.message}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <strong>Execution Error:</strong> {error}
        </div>
      )}

      {signature ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Order executed and confirmed on Solana Mainnet!</span>
          </div>
          <a
            href={`https://solscan.io/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-bold text-emerald-400 hover:underline"
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
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
              hasFailingCheck
                ? "cursor-not-allowed border border-gray-700 bg-gray-800 text-gray-500"
                : isLong
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                  : "bg-rose-500 text-white hover:bg-rose-400 shadow-md shadow-rose-500/20"
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
