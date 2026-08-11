"use client";

import React from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { WebProposal } from "@/lib/db";

interface JupiterSwapPreviewCardProps {
  proposal: WebProposal;
  status: WebProposal["status"];
  maxSlippageBps?: string;
  onExecute: () => void;
}

function formatUsdc(raw?: string): string {
  const value = Number(raw ?? "0") / 1_000_000;
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0";
}

function formatRaw(raw: string | undefined, decimals: number): string {
  if (!raw) return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/u, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}

export function JupiterSwapPreviewCard({
  proposal,
  status,
  maxSlippageBps = "100",
  onExecute,
}: JupiterSwapPreviewCardProps) {
  const disabled = ["signed", "signing", "submitted", "confirmed", "reverted", "unknown"].includes(status) || !proposal.quoteResponse;
  const inputSymbol = proposal.inputSymbol ?? "SOL";
  const outputSymbol = proposal.outputSymbol ?? "USDC";
  const inputDisplay = proposal.inputAmount
    ? formatRaw(proposal.inputAmount, proposal.inputDecimals ?? 9)
    : proposal.solAmount;
  const outputDisplay = proposal.outputDecimals == null
    ? formatUsdc(proposal.outputAmount)
    : formatRaw(proposal.outputAmount, proposal.outputDecimals);
  const isConfirmed = status === "confirmed" || status === "signed";
  const explorerUrl = proposal.transactionSignature ? `https://solscan.io/tx/${proposal.transactionSignature}` : null;

  return (
    <div className="missionPreview border border-blue-500/25 bg-slate-950/70 rounded-xl p-4">
      <header className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-indigo-400 block uppercase">
            JUPITER MAINNET SWAP PROPOSAL
          </span>
          <strong className="text-sm text-white font-mono flex items-center gap-2">
            {inputSymbol} <ArrowRight className="size-3.5 text-indigo-400" /> {outputSymbol}
          </strong>
        </div>
        <span className={`statusPill border ${isConfirmed ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : status === "unknown" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
          {isConfirmed ? "Confirmed" : status === "unknown" ? "Verification required" : "Restricted"}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs mb-3 bg-black/30 p-2.5 rounded-lg border border-white/5">
        <div>
          <dt className="text-slate-500 font-mono">Input</dt>
          <dd className="text-emerald-400 font-semibold">{inputDisplay} {inputSymbol}</dd>
        </div>
        <div>
          <dt className="text-slate-500 font-mono">Expected Output</dt>
          <dd className="text-slate-200 font-mono">{outputDisplay} {outputSymbol}</dd>
        </div>
        <div>
          <dt className="text-slate-500 font-mono">Max Slippage</dt>
          <dd className="text-slate-200 font-mono">{maxSlippageBps} bps</dd>
        </div>
        <div>
          <dt className="text-slate-500 font-mono">Venue</dt>
          <dd className="text-slate-200 font-mono">{proposal.venue ?? "Jupiter"}</dd>
        </div>
      </dl>

      <div className="space-y-1.5 mb-4 text-xs">
        {(proposal.checks ?? []).map((check) => (
          <div key={check.code} className="flex items-start gap-2 text-slate-300">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p>{check.message}</p>
          </div>
        ))}
      </div>

      <footer className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
        <div className="text-[11px] text-slate-400">
          <span className="block font-medium text-slate-300 flex items-center gap-1">
            <ShieldCheck className="size-3.5" /> Wallet approval required
          </span>
          <small className="text-slate-500 block leading-tight mt-0.5">
            {proposal.explanation}
          </small>
        </div>
        {explorerUrl ? (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="primaryButton shrink-0 px-4 py-2 text-xs font-semibold">
            Open Explorer
          </a>
        ) : (
          <button
            disabled={disabled}
            onClick={onExecute}
            className="primaryButton shrink-0 px-4 py-2 text-xs font-semibold"
          >
            {status === "submitted"
              ? "Confirming on-chain..."
              : status === "unknown"
                ? "Verification required"
                : status === "reverted"
                  ? "Reverted"
                  : status === "signing"
                    ? "Waiting for wallet..."
                    : "Approve in Wallet"}
          </button>
        )}
      </footer>
    </div>
  );
}
