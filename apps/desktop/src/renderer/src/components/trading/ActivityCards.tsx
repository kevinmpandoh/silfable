// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Activity, ArrowUp, Bot, Brain, CirclePlus, Settings, ShieldCheck, Target, ShieldAlert, Sparkles, Zap, KeyRound, KeySquare, ChevronRight, MessageSquare, History, List, X, Flame } from 'lucide-react';
import { Button, Modal, Input, Badge } from '../ui';
import { shorten, cn } from '../../lib/utils';
import { formatEvmTokenAmount, formatWeiToGweiOrEth, formatRuntimeTokens, formatPortfolioUsd, portfolioAssetUsd, formatPortfolioAmount, formatPumpMetric, formatPumpPercent, formatPumpBps, formatPumpRawAmount } from '../../lib/formatters';
import { StatusPill, Notice, Field, SetupCard, SetupActions, Brand, BrandMark, CornerFooter, RailSection, ProviderCard } from '../setup/SetupHelpers';
import { ACTIVITY_LEVELS, INTEGRATION_CATEGORIES, SETUP_STEPS, STORAGE_KEY } from '../types';
import type { BridgePreflightEvidence, BridgeProposal, BridgeReceipt, BridgeDestinationChain, EmergencyStopStatus, EvmBridgeContract, EvmBridgePreflight, EvmBridgeQuote, EvmBridgeReceipt, EvmChainKey, EvmPortfolioSnapshot, EvmSessionExecutionReceipt, EvmSwapPreflightEvidence, EvmSwapProposal, LimitOrderCancelSimulation, LimitOrderContractPreview, LimitOrderExecutionReceipt, LimitOrderSimulationPreview, LegacyPumpLaunchMetadataPackage, MissionContractPreview, MissionExecutionReceipt, MissionSimulationPreview, OpenRouterModelView, PortfolioSnapshot, PumpExecutionRecord, PumpFinalRevalidation, PumpLaunchDraft, PumpLaunchDraftInput, PumpLaunchMetadata, PumpLaunchPreflight, PumpLaunchFinalRevalidation, PumpLaunchExecutionRecord, PumpRiskSettings, PumpSimulationArtifact, PumpTokenIntelligence, PumpTradeContractPreview, RuntimeStatus, SessionRecord, TransactionSettings, WalletActivitySnapshot, SetupState, AgentSettings } from '@silfable/contracts';
import { BRIDGE_ARBITRUM_CHAIN_ID, BRIDGE_ARBITRUM_USDC_ADDRESS, BRIDGE_AVALANCHE_CHAIN_ID, BRIDGE_AVALANCHE_USDC_ADDRESS, BRIDGE_BASE_CHAIN_ID, BRIDGE_BASE_USDC_ADDRESS, BRIDGE_ETHEREUM_CHAIN_ID, BRIDGE_ETHEREUM_USDC_ADDRESS, BRIDGE_OPTIMISM_CHAIN_ID, BRIDGE_OPTIMISM_USDC_ADDRESS, BRIDGE_POLYGON_CHAIN_ID, BRIDGE_POLYGON_USDC_ADDRESS, BRIDGE_ROBINHOOD_CHAIN_ID, BRIDGE_ROBINHOOD_USDG_ADDRESS, BRIDGE_SOLANA_CHAIN_ID, BRIDGE_SOLANA_USDC_MINT } from '@silfable/contracts';

export function EvmSwapProposalCard({
  proposal,
  preflight,
  receipts,
  preparing,
  executing,
  executionEnabled,
  executionMissing,
  onPrepare,
  onExecute,
}: {
  proposal: EvmSwapProposal;
  preflight: EvmSwapPreflightEvidence | null;
  receipts: EvmSessionExecutionReceipt[];
  preparing: boolean;
  executing: boolean;
  executionEnabled: boolean;
  executionMissing: string[];
  onPrepare: () => void;
  onExecute: () => void;
}) {
  const latestReceipt = receipts.at(-1) ?? null;
  const swapConfirmed = receipts.some(
    (receipt) => receipt.kind === "swap" && receipt.status === "confirmed",
  );
  const approvalConfirmed = receipts.some(
    (receipt) => receipt.kind === "approval" && receipt.status === "confirmed",
  );
  return (
    <section className={`missionPreview ${proposal.quote.liquidityAvailable ? "ready" : "blocked"}`}>
      <header>
        <div>
          <span>{proposal.chainKey ?? "EVM"} · {proposal.quote.provider ?? "chain router"} · quote only</span>
          <strong>
            {proposal.quote.sellTokenSymbol} → {proposal.quote.buyTokenSymbol}
          </strong>
        </div>
        <StatusPill tone={proposal.quote.liquidityAvailable ? "success" : "warning"}>
          {proposal.quote.liquidityAvailable ? "Liquidity found" : "Blocked"}
        </StatusPill>
      </header>
      <dl>
        <div><dt>Sell Amount</dt><dd>{formatEvmTokenAmount(proposal.quote.sellAmount, proposal.quote.sellTokenSymbol)}</dd></div>
        <div><dt>Expected Buy</dt><dd>{formatEvmTokenAmount(proposal.quote.buyAmount, proposal.quote.buyTokenSymbol)}</dd></div>
        <div><dt>Minimum Buy</dt><dd>{formatEvmTokenAmount(proposal.quote.minBuyAmount, proposal.quote.buyTokenSymbol)}</dd></div>
        <div><dt>Slippage Limit</dt><dd>{proposal.slippageBps} bps</dd></div>
        <div><dt>Provider / Chain</dt><dd>{proposal.quote.provider === "uniswap" ? "Uniswap Classic" : "KyberSwap"} · {proposal.chainKey ?? "EVM"}</dd></div>
        <div><dt>Wallet</dt><dd>{shorten(proposal.walletAddress)}</dd></div>
        <div><dt>Sell Contract</dt><dd>{shorten(proposal.quote.sellToken)}</dd></div>
        <div><dt>Buy Contract</dt><dd>{shorten(proposal.quote.buyToken)}</dd></div>
      </dl>
      {preflight && (
        <dl>
          <div><dt>Current Allowance</dt><dd>{formatEvmTokenAmount(preflight.currentAllowance, proposal.quote.sellTokenSymbol)}</dd></div>
          <div><dt>Approval Status</dt><dd>{preflight.allowanceRequired ? "Required" : "Not required"}</dd></div>
          <div><dt>Gas Limit</dt><dd>{Number(preflight.gasLimit).toLocaleString()} units</dd></div>
          <div><dt>Maximum Gas Fee</dt><dd>{formatWeiToGweiOrEth(preflight.maxGasCostWei)}</dd></div>
          <div><dt>Firm Minimum Buy</dt><dd>{formatEvmTokenAmount(preflight.minimumBuyAmount, proposal.quote.buyTokenSymbol)}</dd></div>
          <div><dt>Quote Expiry</dt><dd>{new Date(preflight.expiresAt).toLocaleTimeString()}</dd></div>
        </dl>
      )}
      {receipts.length > 0 && (
        <div className="activityList">
          {receipts.map((receipt) => {
            const chainKey = proposal.chainKey ?? "robinhood";
            const baseUrl = chainKey === "base"
              ? "https://basescan.org"
              : chainKey === "ethereum"
                ? "https://etherscan.io"
                : chainKey === "arbitrum"
                  ? "https://arbiscan.io"
                  : chainKey === "optimism"
                    ? "https://optimistic.etherscan.io"
                    : chainKey === "polygon"
                      ? "https://polygonscan.com"
                      : chainKey === "bsc"
                        ? "https://bscscan.com"
                        : chainKey === "avalanche"
                          ? "https://snowtrace.io"
                          : "https://explorer.mainnet.chain.robinhood.com";
            const explorerTxUrl = `${baseUrl}/tx/${receipt.transactionHash}`;
            return (
              <div key={receipt.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={receipt.status === "confirmed" ? "success" : "failed"}>
                    {receipt.status}
                  </span>
                  <div>
                    <strong>{receipt.kind} · {shorten(receipt.transactionHash)}</strong>
                    <small>{new Date(receipt.reconciledAt).toLocaleString()}</small>
                  </div>
                </div>
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "5px 12px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    borderRadius: "6px",
                    color: "#60a5fa",
                    fontSize: "11px",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>🔗</span> Open Explorer
                </a>
              </div>
            );
          })}
        </div>
      )}
      {!executionEnabled && (
        <Notice tone="info" title="EVM release gate remains locked">
          {executionMissing.length > 0
            ? `Missing evidence: ${executionMissing.join(", ")}.`
            : "Independent EVM release evidence has not been recorded."}
        </Notice>
      )}
      {latestReceipt?.status === "unknown" && (
        <Notice tone="warning" title="Broadcast status unknown">
          Reconcile this transaction from Settings before preparing another action.
        </Notice>
      )}
     <footer>
        <span>
          {swapConfirmed
            ? "Swap confirmed"
            : approvalConfirmed && !preflight
              ? "Approval confirmed · fresh review required"
              : "No signing authority granted"}
        </span>
        {!swapConfirmed && latestReceipt?.status !== "unknown" && !preflight && (
          <button
            className="primaryButton"
            disabled={preparing || !proposal.quote.liquidityAvailable}
            onClick={onPrepare}
          >
            {preparing
              ? "Preparing…"
              : approvalConfirmed
                ? "Prepare fresh swap review"
                : "Prepare trade review"}
          </button>
        )}
        {!swapConfirmed && preflight && (
          <button
            className="dangerButton"
            disabled={executing || !executionEnabled}
            onClick={onExecute}
          >
            {executing
              ? "Submitting…"
              : preflight.allowanceRequired
                ? "Review exact approval"
                : "Review restricted swap"}
          </button>
        )}
      </footer>
    </section>
  );
}
export function LimitOrderPreviewCard({
  preview,
  simulation,
  execution,
  cancelSimulation,
  cancelReceipt,
  simulating,
  executing,
  cancelling,
  verifyingExecution,
  verifyingCancel,
  onSimulate,
  onExecute,
  onCancel,
  onExecuteCancel,
  onVerifyExecution,
  onVerifyCancel,
}: {
  preview: LimitOrderContractPreview;
  simulation: LimitOrderSimulationPreview | null;
  execution: LimitOrderExecutionReceipt | null;
  cancelSimulation: LimitOrderCancelSimulation | null;
  cancelReceipt:
    SessionRecord["messages"][number]["limitOrderCancelReceipt"] | null;
  simulating: boolean;
  executing: boolean;
  cancelling: boolean;
  verifyingExecution: boolean;
  verifyingCancel: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  onCancel: () => void;
  onExecuteCancel: () => void;
  onVerifyExecution: () => void;
  onVerifyCancel: () => void;
}) {
  const passed = preview.checks.filter(
    (check) => check.status === "pass",
  ).length;
  return (
    <section
      className={`missionPreview ${preview.status === "blocked" ? "blocked" : "ready"}`}
    >
      <header>
        <div>
          <span>Jupiter limit-order contract</span>
          <strong>{preview.goal}</strong>
        </div>
        <StatusPill tone={preview.status === "blocked" ? "danger" : "success"}>
          {preview.status}
        </StatusPill>
      </header>
      <dl>
        <div>
          <dt>Deposit</dt>
          <dd>{preview.inputAmount} raw</dd>
        </div>
        <div>
          <dt>Estimated value</dt>
          <dd>
            {preview.estimatedInputValueUsd === null
              ? "Unavailable"
              : `$${preview.estimatedInputValueUsd.toFixed(2)}`}
          </dd>
        </div>
        <div>
          <dt>Trigger</dt>
          <dd>
            {preview.triggerCondition} ${preview.triggerPriceUsd}
          </dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>
            {passed}/{preview.checks.length} passed
          </dd>
        </div>
      </dl>
      <div className="missionChecks">
        {preview.checks.map((check) => (
          <div className={check.status} key={check.code}>
            <span>{check.status === "pass" ? "OK" : "BLOCK"}</span>
            <p>{check.message}</p>
          </div>
        ))}
      </div>
      {simulation && (
        <div className={`simulationResult ${simulation.status}`}>
          <strong>Vault deposit simulation {simulation.status}</strong>
          <small>
            {simulation.error ??
              `${simulation.programIds.length} programs · ${simulation.unitsConsumed ?? 0} compute units`}
          </small>
          <dl>
            <div>
              <dt>Network fee</dt>
              <dd>
                {simulation.feeLamports === null
                  ? "—"
                  : `${simulation.feeLamports.toLocaleString()} lamports`}
                {simulation.feeSol ? ` · ${simulation.feeSol} SOL` : ""}
                {simulation.feeUsd === null || simulation.feeUsd === undefined
                  ? ""
                  : ` · $${simulation.feeUsd.toFixed(4)}`}
              </dd>
            </div>
            <div>
              <dt>Fee percent</dt>
              <dd>
                {simulation.feePercent === null || simulation.feePercent === undefined
                  ? "—"
                  : `${simulation.feePercent.toFixed(2)}%`}
              </dd>
            </div>
            <div>
              <dt>Account funding</dt>
              <dd>
                {simulation.accountFundingLamports === null ||
                simulation.accountFundingLamports === undefined
                  ? "—"
                  : `${simulation.accountFundingLamports.toLocaleString()} lamports`}
              </dd>
            </div>
            <div>
              <dt>Estimated wallet outflow</dt>
              <dd>{simulation.estimatedWalletOutflowLamports ?? "—"} lamports</dd>
            </div>
            <div>
              <dt>Fee risk</dt>
              <dd>{simulation.feeRisk ?? "unavailable"}</dd>
            </div>
          </dl>
          {simulation.estimatedWalletOutflowLamports && (
            <p>
              Estimated SOL balance impact before signing:{" "}
              {simulation.estimatedWalletOutflowLamports} lamports. Token input/deposit is
              shown separately from network fee and account funding.
            </p>
          )}
          {simulation.feeGuardMessage && <p>{simulation.feeGuardMessage}</p>}
        </div>
      )}
      {execution && (
        <div
          className={`simulationResult ${execution.status === "active" ? "passed" : "failed"}`}
        >
          <strong>Order {execution.status}</strong>
          <small>
            {execution.orderId ??
              execution.error ??
              "Deposit broadcast status is awaiting verification."}
          </small>
          <dl>
            <div>
              <dt>Deposit amount</dt>
              <dd>{execution.inputAmount ?? preview.inputAmount} raw</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>
                {execution.networkFeeLamports === null ||
                execution.networkFeeLamports === undefined
                  ? "—"
                  : `${execution.networkFeeLamports.toLocaleString()} lamports`}
                {execution.feeSol ? ` · ${execution.feeSol} SOL` : ""}
                {execution.feeUsd === null || execution.feeUsd === undefined
                  ? ""
                  : ` · $${execution.feeUsd.toFixed(4)}`}
              </dd>
            </div>
            <div>
              <dt>Fee percent</dt>
              <dd>
                {execution.feePercent === null || execution.feePercent === undefined
                  ? "—"
                  : `${execution.feePercent.toFixed(2)}%`}
              </dd>
            </div>
            <div>
              <dt>Fee risk</dt>
              <dd>{execution.feeRisk ?? "unavailable"}</dd>
            </div>
            <div>
              <dt>On-chain status</dt>
              <dd>{execution.chainVerification}</dd>
            </div>
            <div>
              <dt>Verified slot</dt>
              <dd>{execution.chainSlot?.toLocaleString() ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Last verified</dt>
              <dd>
                {execution.verifiedAt
                  ? new Date(execution.verifiedAt).toLocaleString()
                  : "Not verified yet"}
              </dd>
            </div>
          </dl>
          {execution.depositSignature && (
            <p>
              Signature: <code>{shorten(execution.depositSignature)}</code>
            </p>
          )}
          {execution.error && <p className="executionError">{execution.error}</p>}
          {execution.feeGuardMessage && <p>{execution.feeGuardMessage}</p>}
          {execution.depositSignature && (
            <div className="receiptActions">
              <button
                onClick={() =>
                  void window.silfable.copyTransactionSignature({
                    schemaVersion: 1,
                    requestId: crypto.randomUUID(),
                    signature: execution.depositSignature!,
                  })
                }
              >
                Copy signature
              </button>
              <button
                onClick={() =>
                  void window.silfable.openTransactionInExplorer({
                    schemaVersion: 1,
                    requestId: crypto.randomUUID(),
                    signature: execution.depositSignature!,
                  })
                }
              >
                Open explorer
              </button>
              {execution.status === "unknown" && (
                <button disabled={verifyingExecution} onClick={onVerifyExecution}>
                  {verifyingExecution ? "Verifying..." : "Verify on-chain"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {cancelSimulation && (
        <div className={`simulationResult ${cancelSimulation.status}`}>
          <strong>Withdrawal simulation {cancelSimulation.status}</strong>
          <small>
            {cancelSimulation.error ??
              `${cancelSimulation.programIds.length} programs inspected`}
          </small>
        </div>
      )}
      {cancelReceipt && (
        <div
          className={`simulationResult ${cancelReceipt.status === "cancelled" ? "passed" : "failed"}`}
        >
          <strong>Order {cancelReceipt.status}</strong>
          <small>
            {cancelReceipt.error ??
              (cancelReceipt.status === "cancelled"
                ? "Vault withdrawal is confirmed."
                : "Withdrawal status is awaiting verification.")}
          </small>
          <dl>
            <div>
              <dt>On-chain status</dt>
              <dd>{cancelReceipt.chainVerification}</dd>
            </div>
            <div>
              <dt>Verified slot</dt>
              <dd>
                {cancelReceipt.chainSlot?.toLocaleString() ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Last verified</dt>
              <dd>
                {cancelReceipt.verifiedAt
                  ? new Date(cancelReceipt.verifiedAt).toLocaleString()
                  : "Not verified yet"}
              </dd>
            </div>
          </dl>
          {cancelReceipt.withdrawalSignature && (
            <>
              <p>
                Signature:{" "}
                <code>{shorten(cancelReceipt.withdrawalSignature)}</code>
              </p>
              <div className="receiptActions">
                <button
                  onClick={() =>
                    void window.silfable.copyTransactionSignature({
                      schemaVersion: 1,
                      requestId: crypto.randomUUID(),
                      signature: cancelReceipt.withdrawalSignature!,
                    })
                  }
                >
                  Copy signature
                </button>
                <button
                  onClick={() =>
                    void window.silfable.openTransactionInExplorer({
                      schemaVersion: 1,
                      requestId: crypto.randomUUID(),
                      signature: cancelReceipt.withdrawalSignature!,
                    })
                  }
                >
                  Open explorer
                </button>
                {cancelReceipt.status === "unknown" && (
                  <button disabled={verifyingCancel} onClick={onVerifyCancel}>
                    {verifyingCancel ? "Verifying..." : "Verify on-chain"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <footer>
        <div>
          <span>
            {cancelReceipt
              ? `Cancellation ${cancelReceipt.status}`
              : execution
                ? `Order ${execution.status}`
                : simulation?.status === "passed"
                  ? "Final authorization required"
                  : "Execution locked"}
          </span>
          <small>
            {cancelReceipt?.status === "unknown" ||
            execution?.status === "unknown"
              ? "Verification only reads the known signature and never rebroadcasts."
              : simulation?.status === "passed"
                ? "The exact simulated deposit can be authorized with your password."
                : "Vault registration may occur during simulation; no funds are signed or deposited."}
          </small>
        </div>
        {cancelReceipt ? null : cancelSimulation?.status === "passed" ? (
          <button disabled={cancelling} onClick={onExecuteCancel}>
            {cancelling ? "Withdrawing…" : "Authorize withdrawal"}
          </button>
        ) : execution?.status === "active" && execution.orderId ? (
          <button disabled={cancelling} onClick={onCancel}>
            {cancelling ? "Preparing…" : "Review cancellation"}
          </button>
        ) : simulation?.status === "passed" && !execution ? (
          <button disabled={executing} onClick={onExecute}>
            {executing ? "Submitting…" : "Create limit order"}
          </button>
        ) : (
          <button
            disabled={preview.status !== "ready-for-review" || simulating}
            onClick={onSimulate}
          >
            {simulating ? "Simulating…" : "Review vault simulation"}
          </button>
        )}
      </footer>
    </section>
  );
}
export function PumpSimulationCard({
  simulation,
  execution,
  revalidating,
  executing,
  onFinalRevalidate,
  onRequestExecution,
}: {
  simulation: PumpSimulationArtifact;
  execution: PumpExecutionRecord | null;
  revalidating: boolean;
  executing: boolean;
  onFinalRevalidate?: (() => void) | undefined;
  onRequestExecution?: (() => void) | undefined;
}) {
  const statusTone =
    simulation.status === "passed"
      ? "success"
      : simulation.status === "blocked"
        ? "warning"
        : "danger";
  const feeTone =
    simulation.feeRisk === "reasonable"
      ? "success"
      : simulation.feeRisk === "high"
        ? "warning"
        : simulation.feeRisk === "extreme"
          ? "danger"
          : "neutral";

  return (
    <section
      className={`missionPreview pumpSimulationCard ${
        simulation.status === "passed" ? "ready" : "blocked"
      }`}
    >
      <header>
        <div>
          <span>Pump.fun simulation evidence</span>
          <strong>Unsigned transaction simulation</strong>
        </div>
        <StatusPill tone={statusTone}>{simulation.status}</StatusPill>
      </header>
      <dl>
        {simulation.riskEvidence && (
          <>
            <div>
              <dt>Proposed Pump spend</dt>
              <dd>{simulation.riskEvidence.proposedSpendLamports} lamports</dd>
            </div>
            <div>
              <dt>Finalized wallet balance</dt>
              <dd>{simulation.riskEvidence.walletBalanceLamports} lamports</dd>
            </div>
            <div>
              <dt>Projected balance</dt>
              <dd>{simulation.riskEvidence.projectedWalletBalanceLamports} lamports</dd>
            </div>
            <div>
              <dt>Required SOL reserve</dt>
              <dd>{simulation.riskEvidence.reserveFloorLamports} lamports</dd>
            </div>
          </>
        )}
        {simulation.quoteEvidence && (
          <>
            <div>
              <dt>Fresh expected output</dt>
              <dd>{simulation.quoteEvidence.expectedOutputAmount} raw</dd>
            </div>
            <div>
              <dt>Effective minimum output</dt>
              <dd>{simulation.quoteEvidence.minimumOutputAmount} raw</dd>
            </div>
            <div>
              <dt>Quote slippage</dt>
              <dd>{simulation.quoteEvidence.maxSlippageBps} bps</dd>
            </div>
            <div>
              <dt>Finalized quote slot</dt>
              <dd>{simulation.quoteEvidence.stateSlot.toLocaleString()}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Simulation slot</dt>
          <dd>{simulation.simulationSlot.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Compute units</dt>
          <dd>{simulation.unitsConsumed?.toLocaleString() ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Network fee</dt>
          <dd>
            {simulation.networkFeeLamports === null
              ? "Unavailable"
              : `${simulation.networkFeeLamports.toLocaleString()} lamports`}
          </dd>
        </div>
        <div>
          <dt>Account funding</dt>
          <dd>
            {simulation.rentLamports === null
              ? "Unavailable"
              : `${simulation.rentLamports.toLocaleString()} lamports`}
          </dd>
        </div>
        <div>
          <dt>Network fee ratio</dt>
          <dd>
            {simulation.networkFeePercent === null
              ? "Unavailable"
              : `${simulation.networkFeePercent.toFixed(4)}%`}
          </dd>
        </div>
        <div>
          <dt>Total known fee</dt>
          <dd>
            {simulation.totalKnownFeeLamports === null
              ? "Unavailable"
              : `${simulation.totalKnownFeeLamports} lamports`}
          </dd>
        </div>
        <div>
          <dt>Invoked programs</dt>
          <dd>{simulation.invokedPrograms.length}</dd>
        </div>
        <div>
          <dt>Fee guard</dt>
          <dd>
            <StatusPill tone={feeTone}>{simulation.feeRisk}</StatusPill>
          </dd>
        </div>
      </dl>
      {simulation.error && (
        <div className={`simulationResult ${simulation.status}`}>
          <div>
            <strong>Simulation {simulation.status}</strong>
            <span>{new Date(simulation.simulatedAt).toLocaleString()}</span>
          </div>
          <p>{simulation.error}</p>
        </div>
      )}
      {simulation.riskEvidence && (
        <details className="pumpSimulationEvidence">
          <summary>
            Inspect global risk checks ({simulation.riskEvidence.checks.filter((check) => check.passed).length}/8 passed)
          </summary>
          <div>
            <p>
              Usage source: {simulation.riskEvidence.usageSource === "no-execution-baseline"
                ? "zero baseline — no finalized Pump receipt exists yet"
                : "persisted confirmed receipts"}
            </p>
            <ul>
              {simulation.riskEvidence.checks.map((check) => (
                <li key={check.id}>
                  <strong>{check.passed ? "PASS" : "BLOCK"} · {check.id}</strong> — {check.message}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {simulation.eligibilityEvidence && (
        <details className="pumpSimulationEvidence" open>
          <summary>
            Pump eligibility: {simulation.eligibilityEvidence.status} ({simulation.eligibilityEvidence.checks.filter((check) => check.passed).length}/14 passed)
          </summary>
          <div>
            <p>
              AI ranking: {simulation.eligibilityEvidence.rankingAllowed ? "allowed" : "blocked"} · execution: locked
            </p>
            <ul>
              {simulation.eligibilityEvidence.checks.map((check) => (
                <li key={check.id}>
                  <strong>{check.passed ? "PASS" : "BLOCK"} · {check.id}</strong> — {check.message}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {simulation.executionReadiness && (
        <details className="pumpSimulationEvidence" open>
          <summary>
            Final approval readiness: {simulation.executionReadiness.status} ({simulation.executionReadiness.checks.filter((check) => check.passed).length}/10 passed)
          </summary>
          <div>
            <p>
              Execution remains locked. A fresh final simulation, master password, and exact confirmation <code>{simulation.executionReadiness.requiredConfirmation}</code> are still required.
            </p>
            <ul>
              {simulation.executionReadiness.checks.map((check) => (
                <li key={check.id}>
                  <strong>{check.passed ? "PASS" : "BLOCK"} · {check.id}</strong> — {check.message}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {simulation.finalRevalidation && (
        <details className="pumpSimulationEvidence" open>
          <summary>
            Final pre-sign revalidation: {simulation.finalRevalidation.status} ({simulation.finalRevalidation.checks.filter((check) => check.passed).length}/12 passed)
          </summary>
          <div>
            <p>
              Fresh state slot {simulation.finalRevalidation.finalStateSlot.toLocaleString()} and simulation slot {simulation.finalRevalidation.finalSimulationSlot.toLocaleString()} are bound to transaction digest <code>{simulation.finalRevalidation.finalTransactionDigest.slice(0, 16)}...</code>.
            </p>
            <p>Signing remains locked until the master password and exact confirmation <code>{simulation.finalRevalidation.requiredConfirmation}</code> are entered in the final approval dialog.</p>
            <ul>
              {simulation.finalRevalidation.checks.map((check) => (
                <li key={check.id}>
                  <strong>{check.passed ? "PASS" : "BLOCK"} Â· {check.id}</strong> â€” {check.message}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      <details className="pumpSimulationEvidence">
        <summary>
          Inspect audited evidence ({simulation.invokedPrograms.length} programs, {simulation.logs.length} logs)
        </summary>
        <div>
          <strong>Invoked programs</strong>
          {simulation.invokedPrograms.length > 0 ? (
            <ul>
              {simulation.invokedPrograms.map((program) => (
                <li key={program}>{program}</li>
              ))}
            </ul>
          ) : (
            <p>No invoked program evidence was returned.</p>
          )}
          <strong>Bounded simulation logs</strong>
          {simulation.logs.length > 0 ? (
            <pre>{simulation.logs.join("\n")}</pre>
          ) : (
            <p>No simulation logs were returned.</p>
          )}
        </div>
      </details>
      <footer>
        <div>
          <span>No signature · no broadcast</span>
          <small>
            Encrypted session evidence only. A passing simulation never authorizes execution.
          </small>
        </div>
        {simulation.finalRevalidation?.status === "ready-for-password" ? (
          <button
            className="dangerButton"
            disabled={execution !== null || executing || onRequestExecution === undefined}
            onClick={onRequestExecution}
          >
            {executing ? "Submitting..." : execution ? "Execution recorded" : "Review & execute"}
          </button>
        ) : (
          <button
            disabled={onFinalRevalidate === undefined || revalidating || simulation.executionReadiness?.status !== "ready-for-final-approval"}
            onClick={onFinalRevalidate}
          >
            {revalidating ? "Revalidating..." : simulation.finalRevalidation ? "Revalidated" : "Final revalidation"}
          </button>
        )}
      </footer>
    </section>
  );
}
export function PumpLaunchDraftForm({
  creatorWallet,
  onCreate,
}: {
  creatorWallet: string;
  onCreate: (input: PumpLaunchDraftInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [quoteAsset, setQuoteAsset] = useState<PumpLaunchDraft["quoteAsset"]>("SOL");
  const [initialPurchase, setInitialPurchase] = useState("0");
  const [outflow, setOutflow] = useState("10000000");
  const [priorityFee, setPriorityFee] = useState("100000");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  if (!open) {
    return (
      <button className="launchDraftToggle" onClick={() => setOpen(true)}>
        Prepare Pump.fun token launch draft
      </button>
    );
  }
  const submit = async (): Promise<void> => {
    if (!name.trim() || !symbol.trim() || !imageUri.trim() || !acknowledged) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        creatorWallet,
        metadata: {
          name: name.trim(),
          symbol: symbol.trim(),
          description: description.trim(),
          imageUri: imageUri.trim(),
          metadataUri: metadataUri.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          xUrl: xUrl.trim() || null,
          telegramUrl: telegramUrl.trim() || null,
        },
        quoteAsset,
        initialPurchaseAmount: initialPurchase,
        maxCreatorOutflowLamports: outflow,
        maxPriorityFeeLamports: priorityFee,
        deadlineAt: deadline,
        acknowledgedIrreversiblePublication: true,
      });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The launch draft could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="launchDraftForm">
      <header>
        <div>
          <span>Token launch</span>
          <strong>Prepare a review-only Pump.fun draft</strong>
        </div>
        <StatusPill tone="warning">No execution</StatusPill>
      </header>
      <p>Metadata upload, transaction construction, signing, and broadcast are unavailable at this stage.</p>
      <div className="launchDraftGrid">
        <label>Name<input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} /></label>
        <label>Symbol<input value={symbol} maxLength={10} onChange={(event) => setSymbol(event.target.value.toUpperCase())} /></label>
        <label className="wide">HTTPS image URL<input value={imageUri} placeholder="https://..." onChange={(event) => setImageUri(event.target.value)} /></label>
        <label className="wide">Hosted metadata JSON URL (required before launch)<input value={metadataUri} placeholder="https://.../metadata.json" onChange={(event) => setMetadataUri(event.target.value)} /></label>
        <label className="wide">Description<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Website (optional)<input value={websiteUrl} placeholder="https://..." onChange={(event) => setWebsiteUrl(event.target.value)} /></label>
        <label>X profile (optional)<input value={xUrl} placeholder="https://x.com/..." onChange={(event) => setXUrl(event.target.value)} /></label>
        <label className="wide">Telegram (optional)<input value={telegramUrl} placeholder="https://t.me/..." onChange={(event) => setTelegramUrl(event.target.value)} /></label>
        <label>Quote asset<select value={quoteAsset} onChange={(event) => setQuoteAsset(event.target.value as PumpLaunchDraft["quoteAsset"])}><option value="SOL">SOL</option><option value="USDC">USDC</option></select></label>
        <label>Initial purchase (raw {quoteAsset})<input inputMode="numeric" value={initialPurchase} onChange={(event) => setInitialPurchase(event.target.value.replace(/\D/gu, ""))} /></label>
        <label>Max creator outflow (lamports)<input inputMode="numeric" value={outflow} onChange={(event) => setOutflow(event.target.value.replace(/\D/gu, ""))} /></label>
        <label>Max priority fee (lamports)<input inputMode="numeric" value={priorityFee} onChange={(event) => setPriorityFee(event.target.value.replace(/\D/gu, ""))} /></label>
      </div>
      <label className="launchDraftAcknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand this draft is not a launch and any future publication would be irreversible.</label>
      {error && <p className="launchDraftError">{error}</p>}
      <footer><button disabled={submitting} onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={submitting || !name.trim() || !symbol.trim() || !imageUri.trim() || !acknowledged} onClick={() => void submit()}>{submitting ? "Saving..." : "Save launch draft"}</button></footer>
    </section>
  );
}
export function PumpLaunchDraftCard({
  draft,
  metadataPackage,
  preflight,
  revalidation,
  execution,
  onPreflight,
  onFinalRevalidate,
  onExecute,
  onVerify,
  onOpenOfficialCreate,
}: {
  draft: PumpLaunchDraft;
  metadataPackage: LegacyPumpLaunchMetadataPackage | PumpLaunchMetadata | undefined;
  preflight: PumpLaunchPreflight | undefined;
  revalidation: PumpLaunchFinalRevalidation | undefined;
  execution: PumpLaunchExecutionRecord | undefined;
  onPreflight: (draft: PumpLaunchDraft) => Promise<void>;
  onFinalRevalidate: (draft: PumpLaunchDraft, preflight: PumpLaunchPreflight) => Promise<void>;
  onExecute: (
    draft: PumpLaunchDraft,
    preflight: PumpLaunchPreflight,
    revalidation: PumpLaunchFinalRevalidation,
    credentials: { masterPassword: string },
  ) => Promise<void>;
  onVerify: (draft: PumpLaunchDraft, execution: PumpLaunchExecutionRecord) => Promise<void>;
  onOpenOfficialCreate: (draft: PumpLaunchDraft) => Promise<void>;
}) {
  const [opening, setOpening] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handoff = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      await onOpenOfficialCreate(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The official Pump.fun page could not be opened.");
    } finally {
      setOpening(false);
    }
  };
  const simulate = async (): Promise<void> => {
    setSimulating(true);
    setError(null);
    try {
      await onPreflight(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Token Launch preflight failed safely.");
    } finally {
      setSimulating(false);
    }
  };
  const finalRevalidate = async (): Promise<void> => {
    if (preflight === undefined) return;
    setRevalidating(true);
    setError(null);
    try {
      await onFinalRevalidate(draft, preflight);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Final Token Launch revalidation failed safely.");
    } finally {
      setRevalidating(false);
    }
  };
  const execute = async (): Promise<void> => {
    if (preflight === undefined || revalidation === undefined) return;
    setExecuting(true);
    setError(null);
    try {
      await onExecute(draft, preflight, revalidation, { masterPassword });
      setMasterPassword("");
      setConfirmation("");
      setAcknowledged(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Token Launch execution failed safely.");
    } finally {
      setExecuting(false);
    }
  };
   const verify = async (): Promise<void> => {
    if (execution === undefined) return;
    setVerifying(true);
    setError(null);
    try {
      await onVerify(draft, execution);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Token Launch verification is temporarily unavailable.");
    } finally {
      setVerifying(false);
    }
  };
  const metadataReady = metadataPackage !== undefined || Boolean(draft.metadata.metadataUri);
  return (
    <section className="launchDraftCard">
      <header><div><span>Token launch draft</span><strong>{draft.metadata.name} (${draft.metadata.symbol})</strong></div><StatusPill tone={execution?.status === "finalized" ? "success" : execution?.status === "failed" ? "danger" : preflight ? "success" : "warning"}>{execution?.status ?? (preflight ? "Preflight passed" : "Draft only")}</StatusPill></header>
      <dl>
        <div><dt>Creator</dt><dd>{shorten(draft.creatorWallet)}</dd></div>
        <div><dt>Pairing</dt><dd>{draft.quoteAsset}</dd></div>
        <div><dt>Initial purchase</dt><dd>{draft.initialPurchaseAmount} raw {draft.quoteAsset}</dd></div>
        <div><dt>Metadata JSON</dt><dd>{metadataPackage ? "Published" : draft.metadata.metadataUri ? "Provided" : "Not published"}</dd></div>
        <div><dt>Outflow cap</dt><dd>{draft.maxCreatorOutflowLamports} lamports</dd></div>
        <div><dt>Priority cap</dt><dd>{draft.maxPriorityFeeLamports} lamports</dd></div>
      </dl>
      <p>{metadataPackage ? `Metadata URI: ${(metadataPackage as any).uri || (metadataPackage as any).metadataUri || draft.metadata.metadataUri}` : draft.metadata.metadataUri ? "Hosted metadata JSON is recorded for a future preflight." : "Supply your own hosted metadata URL before preparing the launch."} No transaction, signing, or broadcast occurred.</p>
      {metadataReady && (
        <button className="launchDraftHandoff" disabled={simulating} onClick={() => void simulate()}>
          {simulating ? "Simulating unsigned launch..." : preflight ? "Refresh unsigned Mainnet preflight" : "Run unsigned Mainnet preflight"}
        </button>
      )}
      {preflight && (
        <div className="launchPreflightReview">
          <strong>Unsigned create_v2 review</strong>
          <dl>
            <div><dt>Mint</dt><dd>{shorten(preflight.mintAddress)}</dd></div>
            <div><dt>Simulation slot</dt><dd>{preflight.simulationSlot.toLocaleString()}</dd></div>
            <div><dt>Compute</dt><dd>{preflight.computeUnitsConsumed?.toLocaleString() ?? "Unavailable"} CU</dd></div>
            <div><dt>Network fee</dt><dd>{preflight.networkFeeLamports} lamports</dd></div>
            <div><dt>Priority fee</dt><dd>{preflight.priorityFeeLamports} lamports</dd></div>
            <div><dt>Account rent</dt><dd>{preflight.rentLamports} lamports</dd></div>
            <div><dt>Total estimate</dt><dd>{preflight.totalEstimatedOutflowLamports} lamports</dd></div>
            <div><dt>Expires</dt><dd>{new Date(preflight.expiresAt).toLocaleTimeString()}</dd></div>
          </dl>
          <p>Digest: {preflight.transactionDigest.slice(0, 16)}… · {preflight.checks.length}/{preflight.checks.length} checks passed. The non-extractable mint signer exists only in volatile main-process memory and is discarded on expiry or lock.</p>
        </div>
      )}
      {preflight && execution === undefined && (
        <button className="launchDraftHandoff" disabled={revalidating} onClick={() => void finalRevalidate()}>
          {revalidating ? "Revalidating..." : revalidation ? "Refresh final Mainnet checks" : "Run final Mainnet checks"}
        </button>
      )}
      {revalidation?.status === "blocked" && execution === undefined && (
        <div className="launchDraftError">
          Final approval is blocked. Run a new unsigned preflight before trying again.
        </div>
      )}
      {revalidation?.status === "ready-for-password" && execution === undefined && (
         <div className="launchPreflightReview">
          <strong>Irreversible Mainnet approval</strong>
          <p>{revalidation.checks.filter((check) => check.passed).length}/{revalidation.checks.length} final checks passed. This action creates a real token mint and cannot be undone.</p>
          <label>Master password<input type="password" autoComplete="current-password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} /></label>
          <label>Type LAUNCH TOKEN MAINNET<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <label className="launchDraftAcknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I approve one local signing operation and one Mainnet broadcast attempt for this exact digest.</label>
          <button
            className="executeButton"
            disabled={executing || !masterPassword || confirmation !== "LAUNCH TOKEN MAINNET" || !acknowledged}
            onClick={() => void execute()}
          >
            {executing ? "Signing and submitting..." : "Launch token on Mainnet"}
          </button>
        </div>
      )}
      {execution && (
        <div className="launchPreflightReview">
          <strong>Encrypted Token Launch receipt</strong>
          <dl>
            <div><dt>Status</dt><dd>{execution.status}</dd></div>
            <div><dt>Mint</dt><dd>{shorten(execution.mintAddress)}</dd></div>
            <div><dt>Network fee estimate</dt><dd>{execution.networkFeeLamports} lamports</dd></div>
            <div><dt>Rent estimate</dt><dd>{execution.rentLamports} lamports</dd></div>
            <div><dt>Actual network fee</dt><dd>{execution.actualNetworkFeeLamports === null ? "Pending" : `${execution.actualNetworkFeeLamports.toLocaleString()} lamports`}</dd></div>
            <div><dt>Actual account funding</dt><dd>{execution.actualAccountFundingLamports === null ? "Pending" : `${execution.actualAccountFundingLamports.toLocaleString()} lamports`}</dd></div>
            <div><dt>Actual wallet outflow</dt><dd>{execution.actualWalletOutflowLamports === null ? "Pending" : `${execution.actualWalletOutflowLamports} lamports`}</dd></div>
            <div><dt>Finalized slot</dt><dd>{execution.finalizedSlot?.toLocaleString() ?? "Pending"}</dd></div>
          </dl>
          <p>Signature: {shorten(execution.signature)}. {execution.error ?? "No RPC error is recorded."}</p>
          {execution.status !== "finalized" && execution.status !== "failed" && (
            <button className="launchDraftHandoff" disabled={verifying} onClick={() => void verify()}>
              {verifying ? "Checking on-chain..." : "Verify on-chain"}
            </button>
          )}
        </div>
      )}
      <button className="launchDraftHandoff" disabled={opening} onClick={() => void handoff()}>{opening ? "Opening..." : "Open official Pump.fun create page"}</button>
      {error && <p className="launchDraftError">{error}</p>}
    </section>
  );
}
export function MissionPreviewCard({
  preview,
  simulation,
  execution,
  simulating,
  executing,
  verifying,
  onSimulate,
  onExecute,
  onVerify,
}: {
  preview: MissionContractPreview;
  simulation: MissionSimulationPreview | null;
  execution: MissionExecutionReceipt | null;
  simulating: boolean;
  executing: boolean;
  verifying: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  onVerify: () => void;
}) {
  const passed = preview.checks.filter(
    (check) => check.status === "pass",
  ).length;
  return (
    <section
      className={`missionPreview ${preview.status === "blocked" ? "blocked" : "ready"}`}
    >
      <header>
        <div>
          <span>Mission contract</span>
          <strong>{preview.goal}</strong>
        </div>
        <StatusPill tone={preview.status === "blocked" ? "danger" : "success"}>
          {preview.status}
        </StatusPill>
      </header>
      <dl>
        <div>
          <dt>Input</dt>
          <dd>{preview.inputAmount} raw</dd>
        </div>
        <div>
          <dt>Expected output</dt>
          <dd>{preview.quote?.outAmount ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Slippage limit</dt>
          <dd>{preview.maxSlippageBps} bps</dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>
            {passed}/{preview.checks.length} passed
          </dd>
        </div>
      </dl>
      <div className="missionChecks">
        {preview.checks.map((check) => (
          <div className={check.status} key={check.code}>
            <span>{check.status === "pass" ? "OK" : "BLOCK"}</span>
            <p>{check.message}</p>
          </div>
        ))}
      </div>
      {simulation && <SimulationResult simulation={simulation} />}
      {execution && (
        <ExecutionResult
          receipt={execution}
          verifying={verifying}
          onVerify={onVerify}
        />
      )}
      <footer>
        <div>
          <span>
            {execution
              ? `Execution ${execution.status}`
              : simulation?.status === "passed"
                ? "Final approval required"
                : "Execution locked"}
          </span>
          <small>
            {execution
              ? "This receipt is persisted with the encrypted session."
              : "Simulation never authorizes a transaction by itself."}
          </small>
        </div>
         {simulation?.status === "passed" && !execution ? (
          <button
            className="executeButton"
            disabled={executing}
            onClick={onExecute}
          >
            {executing ? "Submitting…" : "Execute Mainnet"}
          </button>
        ) : (
          <button
            disabled={
              preview.status !== "ready-for-review" ||
              simulating ||
              execution !== null
            }
            onClick={onSimulate}
          >
            {simulating
              ? "Simulating…"
              : simulation
                ? "Simulate again"
                : "Review & simulate"}
          </button>
        )}
      </footer>
    </section>
  );
}
export function SimulationResult({
  simulation,
}: {
  simulation: MissionSimulationPreview;
}) {
  return (
    <div className={`simulationResult ${simulation.status}`}>
      <div>
        <strong>Simulation {simulation.status}</strong>
        <span>{new Date(simulation.simulatedAt).toLocaleString()}</span>
      </div>
      <dl>
        <div>
          <dt>Router</dt>
          <dd>{simulation.router ?? "—"}</dd>
        </div>
        <div>
          <dt>Compute units</dt>
          <dd>{simulation.unitsConsumed?.toLocaleString() ?? "—"}</dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>
            {simulation.feeLamports === null
              ? "—"
              : `${simulation.feeLamports.toLocaleString()} lamports`}
          </dd>
        </div>
        <div>
          <dt>Programs</dt>
          <dd>{simulation.programIds.length}</dd>
        </div>
        <div>
          <dt>Fee value</dt>
          <dd>{simulation.feeSol ? `${simulation.feeSol} SOL` : "—"}{simulation.feeUsd === null || simulation.feeUsd === undefined ? "" : ` · $${simulation.feeUsd.toFixed(4)}`}</dd>
        </div>
        <div>
          <dt>Fee percentage</dt>
          <dd>{simulation.feePercent === null || simulation.feePercent === undefined ? "—" : `${simulation.feePercent.toFixed(2)}%`}</dd>
        </div>
        <div>
          <dt>Account funding</dt>
          <dd>{simulation.accountFundingLamports === null || simulation.accountFundingLamports === undefined ? "—" : `${simulation.accountFundingLamports.toLocaleString()} lamports`}</dd>
        </div>
        <div>
          <dt>Estimated wallet outflow</dt>
          <dd>{simulation.estimatedWalletOutflowLamports ?? "—"} lamports</dd>
        </div>
        <div>
          <dt>Fee guard</dt>
          <dd>{simulation.feeRisk ?? "unavailable"}</dd>
        </div>
      </dl>
      {simulation.estimatedWalletOutflowLamports && (
        <p>
          Estimated SOL balance impact before signing:{" "}
          {simulation.estimatedWalletOutflowLamports} lamports. Token input is shown
          separately from network fee and account funding.
        </p>
      )}
      {simulation.feeGuardMessage && <p>{simulation.feeGuardMessage}</p>}
      {simulation.error && <p>{simulation.error}</p>}
      <small>Unsigned · no broadcast attempted</small>
    </div>
  );
}
export function ExecutionResult({
  receipt,
  verifying,
  onVerify,
}: {
  receipt: MissionExecutionReceipt;
  verifying: boolean;
  onVerify: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const verification = receipt.chainVerification ?? "unavailable";
  async function copySignature(): Promise<void> {
    if (!receipt.signature) return;
    await window.silfable.copyTransactionSignature({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      signature: receipt.signature,
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }
  async function openExplorer(): Promise<void> {
    if (!receipt.signature) return;
    await window.silfable.openTransactionInExplorer({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      signature: receipt.signature,
    });
  }
  return (
    <div className={`executionResult ${receipt.status}`}>
      <div>
        <strong>Mainnet execution {receipt.status}</strong>
        <span>{new Date(receipt.executedAt).toLocaleString()}</span>
      </div>
      <dl>
        <div>
          <dt>Input settled</dt>
          <dd>{receipt.inputAmount ?? "—"}</dd>
        </div>
        <div>
          <dt>Output settled</dt>
          <dd>{receipt.outputAmount ?? "—"}</dd>
        </div>
        <div>
          <dt>Router</dt>
          <dd>{receipt.router}</dd>
        </div>
        <div>
          <dt>Expected output</dt>
          <dd>{receipt.expectedOutputAmount ?? "—"}</dd>
        </div>
        <div>
          <dt>Actual slippage</dt>
          <dd>{receipt.actualSlippageBps === null || receipt.actualSlippageBps === undefined ? "—" : `${receipt.actualSlippageBps.toFixed(2)} bps`}</dd>
        </div>
        <div>
          <dt>Output delta</dt>
          <dd>{receipt.actualSlippageRawAmount ?? "—"} raw</dd>
        </div>
        <div>
          <dt>Estimated network fee</dt>
          <dd>{receipt.networkFeeLamports === null || receipt.networkFeeLamports === undefined ? "—" : `${receipt.networkFeeLamports.toLocaleString()} lamports`}</dd>
        </div>
        <div>
          <dt>Actual network fee</dt>
          <dd>{receipt.actualNetworkFeeLamports === null || receipt.actualNetworkFeeLamports === undefined ? "—" : `${receipt.actualNetworkFeeLamports.toLocaleString()} lamports`}</dd>
        </div>
        <div>
          <dt>Account/rent funding</dt>
          <dd>{receipt.accountFundingLamports === null || receipt.accountFundingLamports === undefined ? "—" : `${Number(receipt.accountFundingLamports).toLocaleString()} lamports`}</dd>
        </div>
        <div>
          <dt>Total wallet outflow</dt>
          <dd>{receipt.totalWalletOutflowLamports === null || receipt.totalWalletOutflowLamports === undefined ? "—" : `${Number(receipt.totalWalletOutflowLamports).toLocaleString()} lamports`}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd>{receipt.code ?? "—"}</dd>
        </div>
        <div>
          <dt>On-chain</dt>
          <dd>{verification}</dd>
        </div>
        <div>
          <dt>Slot</dt>
          <dd>{receipt.chainSlot?.toLocaleString() ?? "—"}</dd>
        </div>
      </dl>
      {receipt.signature && (
        <div className="receiptSignature">
          <span>Transaction signature</span>
          <code>{receipt.signature}</code>
          <div className="receiptActions">
            <button onClick={() => void copySignature()}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => void openExplorer()}>Open Explorer</button>
            <button disabled={verifying} onClick={onVerify}>
              {verifying ? "Verifying…" : "Verify on-chain"}
            </button>
          </div>
        </div>
      )}
      {receipt.error && <p>{receipt.error}</p>}
      {receipt.chainError && receipt.chainError !== receipt.error && (
        <p>{receipt.chainError}</p>
      )}
      <small>
        {receipt.verifiedAt
          ? `Solana RPC checked ${new Date(receipt.verifiedAt).toLocaleString()}`
          : "Not independently verified yet"}{" "}
        · never retry an unknown broadcast without checking the signature
      </small>
    </div>
  );
}

