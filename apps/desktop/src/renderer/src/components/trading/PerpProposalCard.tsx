import { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  KeyRound,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Zap,
} from "lucide-react";
import type { PerpProposal } from "@mirae/contracts";

export function PerpProposalCard({
  proposal: initialProposal,
  walletAddress,
  onExecute,
  onReject,
  embedded = false,
  fullAccess = false,
}: {
  proposal: PerpProposal;
  walletAddress?: string;
  onExecute?: () => void;
  onReject?: () => void;
  embedded?: boolean;
  fullAccess?: boolean;
}) {
  const [proposal, setProposal] = useState(initialProposal);
  const [executing, setExecuting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoExecutedRef = useRef(false);

  const isLong = proposal.direction === "long";
  const isFunding = proposal.action === "fund_collateral";
  const isRegistration = proposal.action === "register_account";
  const hasFailingCheck = proposal.checks.some((c) => c.status === "block");
  const canExecute =
    proposal.status === "ready_for_user_signature" &&
    Boolean(proposal.plan) &&
    !hasFailingCheck;
  const executionLabel = isRegistration
    ? "Register Account"
    : isFunding
    ? "Fund Collateral"
    : proposal.reduceOnly
    ? "Close Position"
    : `Execute ${proposal.direction.toUpperCase()} Order`;

  useEffect(() => {
    setProposal(initialProposal);
    setSignature(null);
    setError(null);
    autoExecutedRef.current = false;
  }, [initialProposal]);

  const refreshExpiredPreflight = async (targetWallet: string) => {
    const refreshed = await window.mirae.preparePerpOrder({
      walletAddress: targetWallet,
      symbol: proposal.symbol,
      direction: proposal.direction,
      notionalUsd: Number(proposal.notionalUsd),
      leverage: proposal.leverage,
      collateralUsdc: Number(
        proposal.collateralUsdc ??
          Number(proposal.notionalUsd) / proposal.leverage
      ).toFixed(2),
      reduceOnly: proposal.reduceOnly,
      baseAmount: proposal.reduceOnly ? Number(proposal.baseAmount) : undefined,
    });
    setProposal(refreshed.proposal);
    setError(
      "Preflight was refreshed with current market and account data. Review the updated checks, then press Execute again to sign."
    );
  };

  const handleExecute = async () => {
    if (executing || signature || !canExecute || !proposal.plan) return;
    try {
      setExecuting(true);
      setError(null);

      const targetWallet = walletAddress ?? proposal.account?.walletAddress;
      if (!targetWallet)
        throw new Error("No active wallet address available for execution.");

      if (proposal.plan.expiresAt <= Date.now()) {
        await refreshExpiredPreflight(targetWallet);
        return;
      }

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
      const message = err?.message || "Transaction signing or broadcast failed.";
      const targetWallet = walletAddress ?? proposal.account?.walletAddress;
      if (targetWallet && /preflight expired/i.test(message)) {
        try {
          await refreshExpiredPreflight(targetWallet);
        } catch (refreshError: any) {
          setError(
            refreshError?.message || "The expired preflight could not be refreshed."
          );
        }
      } else {
        setError(message);
      }
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    if (
      fullAccess &&
      canExecute &&
      !executing &&
      !signature &&
      !error &&
      !autoExecutedRef.current
    ) {
      autoExecutedRef.current = true;
      void handleExecute();
    }
  }, [fullAccess, canExecute, executing, signature, error]);

  return (
    <div
      className={`${
        embedded
          ? "mt-2"
          : "my-3 rounded-2xl border border-[rgb(32_33_42_/_0.12)] bg-white shadow-sm"
      } overflow-hidden p-5`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#20212A]/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 items-center justify-center rounded-lg border ${
              isLong
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-rose-200 bg-rose-50 text-rose-600"
            }`}
          >
            {isLong ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#20212A]">
                {proposal.symbol}
              </span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
                  isLong
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {isRegistration
                  ? "REGISTER ACCOUNT"
                  : isFunding
                  ? "FUND COLLATERAL"
                  : proposal.reduceOnly
                  ? "REDUCE ONLY"
                  : `${proposal.direction.toUpperCase()} · ${
                      proposal.leverage
                    }x`}
              </span>
              {fullAccess && (
                <span className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                  <Zap className="size-2.5 fill-amber-500 text-amber-500" />
                  <span>FULL ACCESS</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#686970]">
              {proposal.venue} ·{" "}
              {isRegistration
                ? "STEP 1 OF 3"
                : isFunding
                ? "STEP 2 OF 3"
                : proposal.reduceOnly
                ? "CLOSE POSITION"
                : "ISOLATED MARKET ORDER"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#686970]">Mark Price</span>
          <p className="font-mono text-xs font-bold text-[#20212A]">
            ${Number(proposal.oraclePriceUsd).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F6F2EE] p-3 text-xs">
        <div>
          <span className="text-[10px] font-medium text-[#686970]">
            Position Size
          </span>
          <p className="text-[13px] font-bold text-[#20212A]">
            ${Number(proposal.notionalUsd).toFixed(2)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">
            {proposal.reduceOnly ? "Added Collateral" : "Collateral (USDC)"}
          </span>
          <p className="text-[13px] font-bold text-[#20212A]">
            $
            {Number(
              proposal.collateralUsdc ??
                Number(proposal.notionalUsd) / proposal.leverage
            ).toFixed(2)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#686970]">
            Network Fee
          </span>
          <p className="text-[13px] font-bold text-[#E85D04]">
            {(Number(proposal.networkFeeLamports ?? 0) / 1_000_000_000).toFixed(
              9
            )}{" "}
            SOL
          </p>
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
            <span
              className={
                check.status === "block" ? "font-medium text-rose-700" : ""
              }
            >
              {check.message}
            </span>
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
            <span>
              {fullAccess ? "⚡ Full Access: " : ""}
              {isRegistration
                ? "Trading account registered. Prepare the order again to fund collateral."
                : isFunding
                ? "Collateral deposit submitted. Wait for it to be credited, then refresh before preparing the order."
                : "Order executed and confirmed on Solana Mainnet!"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void window.mirae
                .openTransactionInExplorer({
                  schemaVersion: 1,
                  requestId: crypto.randomUUID(),
                  signature,
                })
                .catch((reason) => {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not open Solscan."
                  );
                });
            }}
            className="flex items-center gap-1 font-bold text-emerald-700 hover:underline"
          >
            <span>View Solscan</span>
            <ExternalLink className="size-3" />
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-end gap-3">
          {onReject && (
            <button
              type="button"
              disabled={executing}
              onClick={onReject}
              className="rounded-xl border-2 border-[#E85D04] bg-white px-6 py-2.5 text-xs font-bold text-[#C94E00] transition hover:bg-[#FFF0E4] disabled:border-[#D9B9A4] disabled:text-[#A98D7B] disabled:opacity-100"
            >
              Reject
            </button>
          )}
          <button
            type="button"
            disabled={!canExecute || executing}
            onClick={handleExecute}
            className={`flex min-w-[240px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs font-bold text-white shadow-[0_10px_24px_rgba(32,20,14,0.12)] transition disabled:cursor-wait disabled:!text-white disabled:opacity-80 ${
              !canExecute
                ? "cursor-not-allowed !bg-[#B8B6B3]"
                : isRegistration || isFunding
                ? "bg-[#E85D04] hover:bg-[#C94E00]"
                : isLong
                ? "bg-[#10B981] text-white hover:bg-[#059669]"
                : "bg-[#F43F5E] text-white hover:bg-[#E11D48]"
            }`}
          >
            {executing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>
                  {fullAccess
                    ? "⚡ Full Access: Signing & Broadcasting…"
                    : "Signing & Broadcasting…"}
                </span>
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" />
                <span>
                  {canExecute
                    ? `${
                        onReject ? "Agree & Sign" : "Sign"
                      } · ${executionLabel}`
                    : "Order unavailable"}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
