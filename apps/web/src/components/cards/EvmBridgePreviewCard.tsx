"use client";

import type { WebProposal } from "@/lib/db";
import { SwapRouteCard } from "./SwapRouteCard";

function formatUnits(raw?: string): string | null {
  if (!raw || !/^\d+$/u.test(raw)) return null;
  const value = BigInt(raw);
  const whole = value / BigInt(1_000_000);
  const fraction = (value % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function EvmBridgePreviewCard({
  proposal,
  busy,
  onPrepare,
}: {
  proposal: WebProposal;
  busy: boolean;
  onPrepare: () => void;
}) {
  const approvalConfirmed = proposal.status === "approval_confirmed" || Boolean(proposal.bridgeApprovalTxHash && !proposal.sourceTxHash && !proposal.bridgeAction);
  const estimatedOutput = approvalConfirmed ? null : formatUnits(proposal.outputAmount);
  const minimumOutput = approvalConfirmed ? null : formatUnits(proposal.minimumOutputAmount);
  const confirmed = proposal.status === "confirmed";
  const pending = busy || proposal.status === "signing" || proposal.status === "source_confirmed";
  const disabled = ["confirmed", "reverted"].includes(proposal.status) || busy || proposal.status === "signing";

  const buttonLabel = busy || proposal.status === "signing"
    ? "Waiting..."
    : proposal.status === "confirmed"
      ? "Bridge completed"
      : proposal.status === "reverted"
        ? "Source reverted"
        : proposal.status === "source_confirmed"
          ? "Check settlement"
          : proposal.status === "unknown"
            ? "Check source / settlement"
            : approvalConfirmed
              ? "Prepare deposit quote"
              : proposal.bridgeAction === "approval"
                ? "Approve exact USDG"
                : proposal.bridgeAction === "deposit"
                  ? "Review bridge in wallet"
                  : "Prepare quote";

  const statusLabel = confirmed
    ? "Confirmed"
    : approvalConfirmed
      ? "Approval confirmed"
      : proposal.status === "source_confirmed"
        ? "Settling"
        : proposal.status === "reverted"
          ? "Reverted"
          : proposal.status === "unknown"
            ? "Verify status"
            : proposal.bridgeAction === "deposit"
              ? "Quote ready"
              : "Approval required";

  const statusTone = confirmed || approvalConfirmed
    ? "confirmed"
    : proposal.status === "reverted" || proposal.status === "unknown"
      ? "warning"
      : pending
        ? "pending"
        : "ready";

  const details = [
    { label: "Source amount", value: `${proposal.amountUsdg ?? "0"} USDG` },
    { label: "Destination", value: "Solana Mainnet" },
    { label: "Expected receive", value: estimatedOutput ? `${estimatedOutput} USDC` : "Calculated at review" },
    { label: "Minimum receive", value: minimumOutput ? `${minimumOutput} USDC` : "Calculated at review" },
    ...(proposal.bridgeTotalFeeUsd != null ? [{ label: "Relay impact / fees", value: `$${proposal.bridgeTotalFeeUsd.toFixed(4)}` }] : []),
    ...(proposal.bridgeEstimatedSeconds != null ? [{ label: "Estimated time", value: `~${proposal.bridgeEstimatedSeconds}s` }] : []),
    {
      label: "Solana recipient",
      value: proposal.destinationRecipient
        ? `${proposal.destinationRecipient.slice(0, 6)}...${proposal.destinationRecipient.slice(-6)}`
        : "Solana wallet",
    },
    { label: "Route", value: "Relay · Cross-chain" },
  ];

  return (
    <SwapRouteCard
      network="robinhood"
      venue="Relay Bridge"
      inputSymbol="USDG"
      outputSymbol="USDC"
      statusLabel={statusLabel}
      statusTone={statusTone}
      details={details}
      checks={(proposal.checks ?? []).map(({ code, message }) => ({ code, message }))}
      helperText={proposal.explanation || "Approval and bridge deposit are separate wallet actions. Destination completion is independently checked on Solana."}
      actionLabel={buttonLabel}
      actionDisabled={disabled}
      explorerUrl={proposal.sourceTxHash ? `https://robinhoodchain.blockscout.com/tx/${proposal.sourceTxHash}` : proposal.destinationTxHash ? `https://solscan.io/tx/${proposal.destinationTxHash}` : null}
      onAction={onPrepare}
    />
  );
}
