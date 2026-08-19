"use client";

import type { WebProposal } from "@/lib/db";
import { SwapRouteCard } from "./SwapRouteCard";

function formatTokenUnits(raw: string | undefined): string | null {
  if (!raw || !/^\d+$/u.test(raw)) return null;
  const value = BigInt(raw);
  const tokenScale = BigInt(1_000_000);
  const whole = value / tokenScale;
  const fraction = (value % tokenScale).toString().padStart(6, "0").replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function SolanaBridgePreviewCard({
  proposal,
  busy = false,
  onPrepare,
}: {
  proposal: WebProposal;
  busy?: boolean;
  onPrepare: () => void;
}) {
  const confirmed = proposal.status === "confirmed" || proposal.status === "source_confirmed";
  const pending = proposal.status === "signing" || proposal.status === "submitted" || busy;
  const disabled = ["signing", "submitted", "source_confirmed", "confirmed"].includes(proposal.status) || busy;

  const estimatedOutput = formatTokenUnits(proposal.outputAmount) ?? (proposal.amountUsdc ? `${proposal.amountUsdc}` : null);
  const minimumOutput = formatTokenUnits(proposal.minimumOutputAmount);

  const statusLabel = proposal.status === "confirmed"
    ? "Confirmed"
    : proposal.status === "source_confirmed"
      ? "Settling on Robinhood"
      : proposal.status === "submitted"
        ? "Submitted"
        : proposal.status === "signing"
          ? "Signing…"
          : proposal.status === "unknown"
            ? "Verify transaction"
            : proposal.status === "reverted"
              ? "Reverted"
              : "Quote ready";

  const statusTone = confirmed
    ? "confirmed"
    : proposal.status === "unknown" || proposal.status === "reverted"
      ? "warning"
      : pending
        ? "pending"
        : "ready";

  const actionLabel = proposal.status === "confirmed"
    ? "Bridge completed"
    : proposal.status === "source_confirmed"
      ? "Settling on Robinhood..."
      : pending
        ? "Waiting for wallet…"
        : proposal.status === "unknown"
          ? "Check settlement"
          : "Review in Wallet";

  const details = [
    { label: "Source amount", value: `${proposal.amountUsdc ?? "0"} USDC` },
    { label: "Destination", value: "Robinhood Chain" },
    { label: "Expected receive", value: estimatedOutput ? `${estimatedOutput} USDG` : "Calculated at review" },
    { label: "Minimum receive", value: minimumOutput ? `${minimumOutput} USDG` : "Calculated at review" },
    { label: "Network fee", value: "Solana tx fee (~0.0001 SOL)" },
    { label: "Relay fee", value: "None / Included" },
    {
      label: "Recipient",
      value: proposal.destinationRecipient
        ? `${proposal.destinationRecipient.slice(0, 8)}...${proposal.destinationRecipient.slice(-6)}`
        : "Bound EVM wallet",
    },
    { label: "Route", value: "Relay · Cross-chain" },
  ];

  return (
    <SwapRouteCard
      network="solana"
      venue="Relay Bridge"
      inputSymbol="USDC"
      outputSymbol="USDG"
      statusLabel={statusLabel}
      statusTone={statusTone}
      details={details}
      checks={(proposal.checks ?? []).map(({ code, message }) => ({ code, message }))}
      helperText={proposal.explanation || "Bridge proposal is ready. Review the exact transaction in your wallet before signing."}
      actionLabel={actionLabel}
      actionDisabled={disabled}
      explorerUrl={proposal.sourceTxHash ? `https://solscan.io/tx/${proposal.sourceTxHash}` : null}
      onAction={onPrepare}
    />
  );
}
