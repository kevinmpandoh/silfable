"use client";

import { useEffect, useState } from "react";

import type { WebProposal } from "@/lib/db";
import { SwapRouteCard } from "./SwapRouteCard";

const STAGE_LABELS: Record<string, { label: string; tone: "ready" | "pending" | "confirmed" | "warning" }> = {
  draft: { label: "Preflight required", tone: "pending" },
  preflight: { label: "Simulating", tone: "pending" },
  ready: { label: "Simulated · ready", tone: "ready" },
  submitted: { label: "Submitted", tone: "pending" },
  confirmed: { label: "Confirmed", tone: "confirmed" },
  failed: { label: "Failed", tone: "warning" },
  unknown: { label: "Status unknown", tone: "warning" },
};

/**
 * The simulated blockhash expires on a wall clock, so the card watches it with a
 * timer rather than reading the clock during render.
 */
function useExpired(expiresAt: number | undefined): boolean {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      const reset = setTimeout(() => setExpired(false), 0);
      return () => clearTimeout(reset);
    }
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      const immediate = setTimeout(() => setExpired(true), 0);
      return () => clearTimeout(immediate);
    }
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  return expired;
}

export function PerpPreviewCard({
  proposal,
  busy,
  onPrepare,
  onExecute,
  onChooseDirection,
}: {
  proposal: WebProposal;
  busy: boolean;
  onPrepare: () => void;
  onExecute: () => void;
  onChooseDirection: (direction: "long" | "short") => void;
}) {
  // A proposal with no side yet is a question, not an order: the two buttons
  // below are the answer, and picking one runs preflight straight away.
  const awaitingSide = !proposal.perpDirection && !proposal.perpReduceOnly;
  const stage = proposal.perpStage ?? "draft";
  const status = STAGE_LABELS[stage] ?? STAGE_LABELS.draft;
  const ready = stage === "ready" && Boolean(proposal.perpTransactionBase64);
  const settled = stage === "submitted" || stage === "confirmed" || stage === "unknown";
  const direction = proposal.perpDirection === "short" ? "SHORT" : "LONG";
  const market = proposal.perpMarket ?? "PERP";
  const expired = useExpired(ready && !settled ? proposal.perpExpiresAt : undefined);

  const size = proposal.perpBaseAmount
    ? `${proposal.perpBaseAmount} ${market.replace("-PERP", "")}`
    : proposal.perpNotionalUsd
      ? `$${proposal.perpNotionalUsd} notional`
      : "Resolved at preflight";

  if (awaitingSide) {
    return (
      <section className="swapRouteCard swapRouteCard--solana" aria-label="Choose a perpetual side">
        <header className="swapRouteHeader">
          <div className="swapRouteHeading">
            <span className="swapRouteEyebrow">Solana · Perpetuals</span>
            <strong className="swapRoutePair"><span>{market}</span></strong>
          </div>
          <span className="swapRouteStatus swapRouteStatus--pending">Choose a side</span>
        </header>
        <dl className="swapRouteLedger">
          <div><dt>Size</dt><dd>{size}</dd></div>
          <div><dt>Market</dt><dd>{market}</dd></div>
        </dl>
        <footer className="swapRouteFooter">
          <div>
            <span>Wallet confirmation required</span>
            <small>{proposal.perpError ?? "Selecting a side simulates the order unsigned, then your wallet asks for one approval."}</small>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="primaryButton" disabled={busy} onClick={() => onChooseDirection("long")}>
              {busy ? "Working…" : "Long"}
            </button>
            <button type="button" className="primaryButton" disabled={busy} onClick={() => onChooseDirection("short")}>
              {busy ? "Working…" : "Short"}
            </button>
          </div>
        </footer>
      </section>
    );
  }

  const isAccountInit = market === "ACCOUNT-INIT" || market === "REGISTER";

  if (isAccountInit) {
    return <SwapRouteCard
      network="solana"
      venue="Perpetuals"
      inputSymbol="ACTIVATE"
      outputSymbol="ACCOUNT"
      statusLabel={expired && !settled ? "Preflight expired" : status.label}
      statusTone={expired && !settled ? "warning" : status.tone}
      details={[
        { label: "Action", value: "Initialize Trading Account" },
        { label: "Network", value: "Solana Mainnet" },
        { label: "Rent deposit", value: "~0.0382 SOL (persisted on-chain)" },
        { label: "Network fee", value: proposal.perpNetworkFeeLamports ? `${(Number(proposal.perpNetworkFeeLamports) / 1_000_000_000).toFixed(6)} SOL` : "Measured by simulation" },
      ]}
      checks={(proposal.checks ?? []).filter((check) => check.status === "pass").map(({ code, message }) => ({ code, message }))}
      helperText={
        proposal.perpError
          ? proposal.perpError
          : settled
            ? "Your perpetuals trading account was created. You can now place orders."
            : expired
              ? "The simulated blockhash expired. Run preflight again to rebuild the transaction."
              : ready
                ? "Simulated unsigned on Solana Mainnet. Approving initializes your trading account."
                : "Preflight simulates account initialization unsigned on Solana Mainnet."
      }
      actionLabel={busy ? "Working…" : settled ? "Account Activated" : expired ? "Re-run preflight" : ready ? "Activate Account in Wallet" : "Prepare Activation"}
      actionDisabled={busy || settled}
      explorerUrl={proposal.perpExplorerUrl ?? null}
      onAction={() => (ready && !expired ? onExecute() : onPrepare())}
    />;
  }

  return <SwapRouteCard
    network="solana"
    venue="Perpetuals"
    inputSymbol={proposal.perpReduceOnly ? "CLOSE" : direction}
    outputSymbol={market}
    statusLabel={expired && !settled ? "Preflight expired" : status.label}
    statusTone={expired && !settled ? "warning" : status.tone}
    details={[
      { label: "Side", value: proposal.perpReduceOnly ? (proposal.perpDirection ? `Reduce-only ${direction.toLowerCase()}` : "Reduce-only close") : direction.toLowerCase() },
      { label: "Size", value: size },
      { label: "Order type", value: proposal.perpLimitPriceUsd ? `Limit @ $${proposal.perpLimitPriceUsd}` : "Market" },
      { label: "Oracle price", value: proposal.perpOraclePriceUsd ? `$${proposal.perpOraclePriceUsd}` : "Read at preflight" },
      { label: "Notional", value: proposal.perpNotionalUsd ? `$${proposal.perpNotionalUsd}` : "Computed at preflight" },
      ...(proposal.perpRequestedLeverage ? [{ label: "Target leverage", value: `${proposal.perpRequestedLeverage}x` }] : []),
      ...(proposal.perpCollateralUsdc ? [{ label: "Order collateral", value: `$${proposal.perpCollateralUsdc} USDC` }] : []),
      { label: "Free collateral", value: proposal.perpFreeCollateralUsd ? `$${proposal.perpFreeCollateralUsd}` : "Unavailable" },
      { label: "Account health", value: proposal.perpAccountHealthPct === undefined ? "Unavailable" : `${proposal.perpAccountHealthPct}%` },
      ...(proposal.perpAnalysisVerdict ? [{ label: "Setup", value: `${proposal.perpAnalysisVerdict} · ${proposal.perpAnalysisScore}/${proposal.perpAnalysisTotalChecks} passed (minimum ${proposal.perpAnalysisRequiredScore})` }] : []),
      ...(proposal.perpPlannedStopLossPriceUsd ? [{ label: "Planned stop loss", value: `$${proposal.perpPlannedStopLossPriceUsd} (-${proposal.perpStopLossPct}%)` }] : []),
      ...(proposal.perpPlannedTakeProfitPriceUsd ? [{ label: "Planned take profit", value: `$${proposal.perpPlannedTakeProfitPriceUsd} (+${proposal.perpTakeProfitPct}%)` }] : []),
      ...(proposal.perpExitProtectionStatus ? [{ label: "Exit protection", value: "Planned · not placed" }] : []),
      { label: "Network fee", value: proposal.perpNetworkFeeLamports ? `${(Number(proposal.perpNetworkFeeLamports) / 1_000_000_000).toFixed(6)} SOL` : "Measured by simulation" },
    ]}
    // Blocking checks are risk statements, not satisfied guarantees, so they are
    // surfaced in the helper text rather than as a green check row.
    checks={(proposal.checks ?? []).filter((check) => check.status === "pass").map(({ code, message }) => ({ code, message }))}
    helperText={
      proposal.perpError
        ? proposal.perpError
        : settled
          ? "The order was submitted. Position and collateral update once the fill settles."
          : expired
            ? "The simulated blockhash expired. Run preflight again to rebuild the transaction."
            : ready
              ? proposal.perpExitProtectionStatus
                ? "Simulated unsigned on Mainnet. This approval opens only the entry; planned stop-loss/take-profit targets are not active orders."
                : "Simulated unsigned on Mainnet. Approving opens a leveraged position that can be liquidated."
              : "Preflight simulates the order unsigned and measures the fee. It does not open your wallet."
    }
    actionLabel={busy ? "Working…" : settled ? "Submitted" : expired ? "Re-run preflight" : ready ? "Approve in wallet" : "Prepare order"}
    actionDisabled={busy || settled}
    explorerUrl={proposal.perpExplorerUrl ?? null}
    onAction={() => (ready && !expired ? onExecute() : onPrepare())}
  />;
}
