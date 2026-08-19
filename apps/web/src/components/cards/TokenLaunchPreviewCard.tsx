"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";

import type { WebProposal } from "@/lib/db";

export function TokenLaunchPreviewCard({
  proposal,
  busy,
  hasVolatileMint,
  onPrepare,
  onExecute,
  onVerify,
}: {
  proposal: WebProposal;
  busy: boolean;
  hasVolatileMint: boolean;
  onPrepare: () => void;
  onExecute: () => void;
  onVerify: () => void;
}) {
  const now = useClock();
  const stage = proposal.launchStage ?? "draft";
  const confirmed = stage === "confirmed";
  const terminal = confirmed || stage === "failed";
  const expiresAt = proposal.launchExpiresAt;
  const preflightExpired = Boolean(expiresAt && now >= expiresAt);
  const canExecute = stage === "final-review" && !preflightExpired && hasVolatileMint;
  const hasCreatorBuy = Boolean(proposal.launchCreatorBuyLamports && proposal.launchCreatorBuyLamports !== "0");
  const lamportsToSol = (value?: string) => (value && /^\d+$/u.test(value) ? `${(Number(value) / 1_000_000_000).toFixed(6)} SOL` : "Pending");

  return (
    <section
      className={`mt-4 overflow-hidden rounded-xl border ${
        confirmed
          ? "border-emerald-500/40 bg-emerald-50/20"
          : stage === "failed"
            ? "border-rose-500/40 bg-rose-50/20"
            : "border-[rgb(32,33,42,0.12)] bg-white"
      } shadow-sm`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-4 py-3.5">
        <div>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Pump.fun · Token Launch</p>
          <h3 className="mt-1 text-base font-semibold text-[#20212a]">
            {proposal.launchName} (${proposal.launchSymbol})
          </h3>
        </div>
        <span
          className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] ${
            confirmed
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
              : stage === "failed"
                ? "border-rose-500/40 bg-rose-50 text-rose-700"
                : "border-[rgb(223,107,34,0.35)] bg-[#fff8f3] text-[#df6b22]"
          }`}
        >
          {stage.replace(/-/gu, " ")}
        </span>
      </header>

      <div className="grid grid-cols-2 border-b border-[rgb(32,33,42,0.12)] bg-white text-xs sm:grid-cols-3">
        <Fact label="Creator" value={short(proposal.launchCreatorWallet)} />
        <Fact label="Mint" value={proposal.launchMintAddress ? short(proposal.launchMintAddress) : "Generated at preflight"} />
        <Fact label="Metadata" value={proposal.launchMetadataUri?.startsWith("ipfs://") ? "Published to IPFS" : "Hosted HTTPS"} />
        {hasCreatorBuy && <Fact label="Creator-buy protection" value={proposal.launchCreatorBuySlippageBps ? `${proposal.launchCreatorBuySlippageBps} bps max` : "Not applicable"} />}
        <Fact label="Automatic safety ceiling" value={lamportsToSol(proposal.maxCreatorOutflowLamports)} />
        <Fact label="Network fee" value={lamportsToSol(proposal.launchNetworkFeeLamports)} />
        <Fact label="Account rent" value={lamportsToSol(proposal.launchRentLamports)} />
        <Fact label="Total estimate" value={lamportsToSol(proposal.launchTotalEstimatedOutflowLamports)} />
        {(stage === "preflight" || stage === "final-review") && <Fact label="Unsigned preflight" value={formatExpiry(expiresAt, now)} />}
      </div>

      {hasCreatorBuy && (stage === "preflight" || stage === "final-review") && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[rgb(32,33,42,0.12)] bg-[#fff8f3] px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#686970]">Creator buy</p>
            <p className="mt-1 truncate text-sm font-semibold text-[#20212a]">{lamportsToSol(proposal.launchCreatorBuyLamports)}</p>
          </div>
          <span className="font-mono text-sm text-[#df6b22]" aria-hidden="true">→</span>
          <div className="min-w-0 text-right">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#686970]">Estimated tokens received</p>
            <p className="mt-1 truncate text-sm font-semibold text-[#df6b22]">{formatTokenAmount(proposal.launchExpectedCreatorTokensRaw, proposal.launchSymbol)}</p>
          </div>
          <p className="col-span-3 text-[10px] leading-4 text-[#686970]">Estimated from the current Pump.fun bonding curve and fee tier. The confirmed on-chain result is final.</p>
        </div>
      )}

      <div className="space-y-2 bg-white px-4 py-3 text-xs leading-5 text-[#4e5058]">
        <p className="flex items-start gap-2 text-[#20212a]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          Metadata URI and creator wallet are pinned to this review card.
        </p>
        {proposal.launchTransactionDigest && (
          <p className="font-mono text-[10px] text-[#686970]">
            Digest: {proposal.launchTransactionDigest.slice(0, 20)}… · simulation slot {proposal.launchSimulationSlot?.toLocaleString() ?? "pending"}
          </p>
        )}
        {(stage === "preflight" || stage === "final-review") && expiresAt && (
          <p
            className={`rounded-md border p-2 ${
              preflightExpired
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-[rgb(223,107,34,0.3)] bg-[#fff8f3] text-[#9c450c]"
            }`}
          >
            {preflightExpired ? (
              "This unsigned preflight has expired. Prepare a fresh preflight before signing."
            ) : (
              <>
                Unsigned transaction expires at <strong>{formatLocalTime(expiresAt)}</strong> ({formatRemaining(expiresAt - now)} remaining). It is also bound to Solana block height {proposal.launchLastValidBlockHeight?.toLocaleString() ?? "pending"}; prepare again if the wallet prompt is delayed.
              </>
            )}
          </p>
        )}
        {stage === "final-review" && !hasVolatileMint && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
            The temporary mint signer expired after reload. Run preflight again to generate a fresh mint safely.
          </p>
        )}
        {proposal.launchError && (
          <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-rose-800">{proposal.launchError}</p>
        )}
      </div>

      {stage === "final-review" && hasVolatileMint && !preflightExpired && (
        <div className="mx-4 mb-4 space-y-2 rounded-lg border border-[rgb(223,107,34,0.35)] bg-[#fff8f3] p-3">
          <p className="flex items-start gap-2 text-xs font-semibold text-[#b84d10]">
            <TriangleAlert className="size-4 shrink-0 text-[#df6b22]" />
            Irreversible Mainnet authorization
          </p>
          <p className="text-xs leading-5 text-[#4e5058]">
            This creates a real Pump.fun token mint{hasCreatorBuy ? " and executes the reviewed creator buy in the same transaction" : ""}. Review the exact mint, total outflow, fee ceiling, and wallet in Phantom/Solflare.
          </p>
          <p className="text-[11px] leading-5 text-[#686970]">
            Continue only when the mint, wallet, and estimated outflow match your intent. Phantom/Solflare will show the final transaction approval.
          </p>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-4 py-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#686970]">Browser wallet approval required</span>
        <div className="flex flex-wrap gap-2">
          {(stage === "draft" || stage === "preflight") && (
            <Action disabled={busy} onClick={onPrepare}>
              {busy ? "Simulating…" : "Prepare launch review"}
            </Action>
          )}
          {stage === "final-review" && (!hasVolatileMint || preflightExpired) && (
            <Action disabled={busy} onClick={onPrepare}>
              {busy ? "Preparing…" : "Refresh launch review"}
            </Action>
          )}
          {stage === "final-review" && hasVolatileMint && !preflightExpired && (
            <Action danger disabled={busy || !canExecute} onClick={onExecute}>
              {busy ? "Submitting…" : "Review & launch in wallet"}
            </Action>
          )}
          {(stage === "submitted" || stage === "unknown") && (
            <Action disabled={busy} onClick={onVerify}>
              {busy ? "Checking…" : "Verify on-chain"}
            </Action>
          )}
          {proposal.launchExplorerUrl && (
            <button
              type="button"
              onClick={() => window.open(proposal.launchExplorerUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center gap-1 rounded-md border border-[rgb(32,33,42,0.16)] bg-white px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#20212a] hover:border-[#df6b22]/40 hover:text-[#df6b22] transition-colors"
            >
              <ExternalLink className="size-3" /> Open explorer
            </button>
          )}
          {terminal && stage === "failed" && (
            <Action disabled={busy} onClick={onPrepare}>
              Prepare fresh launch
            </Action>
          )}
        </div>
      </footer>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-r border-[rgb(32,33,42,0.08)] bg-[#fcfcfb] px-3 py-2.5">
      <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#686970]">{label}</dt>
      <dd className="mt-1 truncate text-[11px] font-semibold text-[#20212a]">{value}</dd>
    </div>
  );
}

function Action({
  children,
  disabled,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-rose-400/60 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-[rgb(223,107,34,0.45)] bg-[#fff8f3] text-[#df6b22] hover:bg-[#fff1e8]"
      }`}
    >
      {children}
    </button>
  );
}

function short(value?: string): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Unavailable";
}

function formatTokenAmount(raw: string | undefined, symbol: string | undefined): string {
  if (!raw || !/^\d+$/u.test(raw) || raw === "0") return "Calculated at preflight";
  const value = BigInt(raw);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/u, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} ${symbol ?? "tokens"}`;
}

function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

function formatLocalTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function formatExpiry(expiresAt: number | undefined, now: number): string {
  if (!expiresAt) return "Pending";
  return now >= expiresAt ? "Expired" : `${formatRemaining(expiresAt - now)} remaining`;
}
