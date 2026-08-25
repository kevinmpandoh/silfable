// @ts-nocheck
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Activity, ArrowUp, Bot, Brain, CirclePlus, Settings, ShieldCheck, Target } from 'lucide-react';
import { Button, Modal } from '../ui';
import { shorten, cn } from '../../lib/utils';

import {
  BridgeProposalCard, EvmBridgeProposalCard, EvmBridgeWorkspace
} from '../bridge/EvmBridge';
import {
  PumpTradePreviewCard, PumpExecutionCard
} from '../trading/PumpCards';
import {
  PumpLaunchDraftForm, EvmSwapProposalCard, FullAccessEvmAssetReviewCard, MissionPreviewCard, PumpSimulationCard, PumpLaunchDraftCard, LimitOrderPreviewCard
} from '../trading/ActivityCards';
import { PerpProposalCard } from '../trading/PerpProposalCard';
import { DriftPerpProposalCard } from '../trading/DriftPerpProposalCard';
import { Composer } from './WorkspacePanels';
import { AnimatedMarkdownMessage, MarkdownMessage, BridgePreparationForm } from './MarkdownComponents';
import { StatusPill, Notice, Field, SetupCard, SetupActions, Brand, BrandMark, CornerFooter, RailSection, ProviderCard } from '../setup/SetupHelpers';
import { ACTIVITY_LEVELS, INTEGRATION_CATEGORIES, SETUP_STEPS, STORAGE_KEY } from '../types';
import miraeLogo from '../../../../assets/mirae-logo.png';
import type { BridgePreflightEvidence, BridgeProposal, BridgeReceipt, BridgeDestinationChain, EmergencyStopStatus, EvmBridgeContract, EvmBridgePreflight, EvmBridgeQuote, EvmBridgeReceipt, EvmChainKey, EvmPortfolioSnapshot, EvmSessionExecutionReceipt, EvmSwapPreflightEvidence, EvmSwapProposal, LimitOrderCancelSimulation, LimitOrderContractPreview, LimitOrderExecutionReceipt, LimitOrderSimulationPreview, LegacyPumpLaunchMetadataPackage, MissionContractPreview, MissionExecutionReceipt, MissionSimulationPreview, OpenRouterModelView, PortfolioSnapshot, PumpExecutionRecord, PumpFinalRevalidation, PumpLaunchDraft, PumpLaunchDraftInput, PumpLaunchMetadata, PumpLaunchPreflight, PumpLaunchFinalRevalidation, PumpLaunchExecutionRecord, PumpRiskSettings, PumpSimulationArtifact, PumpTokenIntelligence, PumpTradeContractPreview, RuntimeStatus, SessionRecord, TransactionSettings, WalletActivitySnapshot } from '@mirae/contracts';
import { BRIDGE_ARBITRUM_CHAIN_ID, BRIDGE_ARBITRUM_USDC_ADDRESS, BRIDGE_AVALANCHE_CHAIN_ID, BRIDGE_AVALANCHE_USDC_ADDRESS, BRIDGE_BASE_CHAIN_ID, BRIDGE_BASE_USDC_ADDRESS, BRIDGE_ETHEREUM_CHAIN_ID, BRIDGE_ETHEREUM_USDC_ADDRESS, BRIDGE_OPTIMISM_CHAIN_ID, BRIDGE_OPTIMISM_USDC_ADDRESS, BRIDGE_POLYGON_CHAIN_ID, BRIDGE_POLYGON_USDC_ADDRESS, BRIDGE_ROBINHOOD_CHAIN_ID, BRIDGE_ROBINHOOD_USDG_ADDRESS, BRIDGE_SOLANA_CHAIN_ID, BRIDGE_SOLANA_USDC_MINT } from '@mirae/contracts';

function X402ResourcesCard({ message, restricted, onExecute }: { message: any; restricted: boolean; onExecute: (resource: import("@mirae/contracts").X402Resource, masterPassword?: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; provider: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const receipts = message.x402Receipts ?? [];
  const resources = message.x402Resources as import("@mirae/contracts").X402Resource[];
  const unpaid = resources.filter((resource) => selected.includes(resource.id) && !receipts.some((receipt: any) => receipt.resourceId === resource.id && receipt.status === "RESOURCE_RECEIVED"));
  const total = unpaid.reduce((sum, resource) => sum + Number(resource.requirements.amount) / 1_000_000, 0);
  return <section className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white text-[#20212a] shadow-sm">
    <header className="flex items-start justify-between gap-3 border-b border-black/10 bg-[#fffaf6] px-4 py-3.5"><div><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Solana x402 · Data purchase</p><h3 className="mt-1 text-base font-semibold">Choose external evidence</h3><p className="mt-1 text-xs text-[#686970]">One batch selection, with a separate verified approval for each provider.</p></div><span className="rounded border border-[#df6b22]/30 bg-[#fff8f3] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-wider text-[#b44f10]">{restricted ? "Restricted" : "Full access"}</span></header>
    <div className="p-4">
      {restricted ? <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Master password" className="mb-3 w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10" /> : <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><ShieldCheck size={14} />Vault signing session active. This purchase still requires your click.</p>}
      <div className="space-y-2">{resources.map((resource) => { const paid = receipts.find((receipt: any) => receipt.resourceId === resource.id && receipt.status === "RESOURCE_RECEIVED"); const checked = Boolean(paid) || selected.includes(resource.id); return <label key={resource.id} className={`block cursor-pointer rounded-xl border p-3 transition ${checked ? "border-[#df6b22]/45 bg-[#fff8f3] shadow-[inset_3px_0_0_#df6b22]" : "border-black/10 bg-[#fcfcfb] hover:border-[#df6b22]/30"}`}><div className="flex items-center gap-3"><input className="accent-[#df6b22]" type="checkbox" checked={checked} disabled={Boolean(paid) || progress !== null} onChange={() => setSelected((current) => current.includes(resource.id) ? current.filter((id) => id !== resource.id) : [...current, resource.id])} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{resource.resource.serviceName ?? new URL(resource.resource.url).hostname}</strong><span className="mt-0.5 block text-xs text-[#686970]">{resource.resource.description}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-[#929399]">External untrusted data · canonical USDC</span></div><div className="shrink-0 text-right"><strong className="block font-mono text-sm">${(Number(resource.requirements.amount) / 1_000_000).toFixed(4)}</strong><span className="font-mono text-[8px] uppercase text-[#929399]">{paid ? "Received" : "USDC"}</span></div></div>{paid?.signature ? <a className="mt-2 inline-block font-mono text-[9px] uppercase tracking-wider text-emerald-700 underline" href={`https://solscan.io/tx/${paid.signature}`}>View Solscan receipt</a> : null}{paid?.resourceResponse ? <details className="mt-2 border-t border-black/10 pt-2"><summary className="cursor-pointer font-mono text-[9px] uppercase tracking-wider text-[#686970]">Inspect provider evidence</summary><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f4f1] p-3 text-[11px] text-[#4c4d54]">{paid.resourceResponse.body.slice(0, 4_000)}</pre></details> : null}</label>; })}</div>
      {progress ? <div className="mt-3 rounded-lg border border-[#df6b22]/25 bg-[#fff8f3] p-3 text-xs text-[#9c450c]"><div className="flex justify-between font-mono text-[9px] font-semibold uppercase tracking-wider"><span>Wallet approval {progress.current}/{progress.total}</span><span>{Math.round((progress.current / progress.total) * 100)}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[#df6b22]/15"><div className="h-full bg-[#df6b22]" style={{ width: `${progress.current / progress.total * 100}%` }} /></div><p className="mt-1.5 truncate text-[#686970]">{progress.provider}</p></div> : null}
      {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p> : null}
    </div>
    <footer className="flex items-center justify-between gap-3 border-t border-black/10 bg-[#fffaf6] px-4 py-3.5"><div><p className="font-mono text-[8px] uppercase tracking-wider text-[#686970]">Maximum selected charge</p><strong className="text-sm">${total.toFixed(4)} USDC</strong></div><button type="button" disabled={unpaid.length === 0 || progress !== null || (restricted && !password)} onClick={async () => { setError(null); for (const [index, resource] of unpaid.entries()) { setProgress({ current: index + 1, total: unpaid.length, provider: resource.resource.serviceName ?? new URL(resource.resource.url).hostname }); try { await onExecute(resource, restricted ? password : undefined); } catch (cause) { setError(`${index} purchase(s) succeeded. Batch stopped safely: ${cause instanceof Error ? cause.message : "wallet approval rejected"}`); break; } } setProgress(null); setPassword(""); }} className="min-w-[190px] rounded-lg bg-[#df6b22] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95b18] disabled:opacity-40">{progress ? `Approve ${progress.current}/${progress.total}` : `Approve ${unpaid.length} selected`}</button></footer>
  </section>;
}

export function Conversation({
  session,
  draft,
  setDraft,
  onSend,
  onCreatePumpLaunchDraft,
  onPreflightPumpLaunch,
  onFinalRevalidatePumpLaunch,
  onExecutePumpLaunch,
  onVerifyPumpLaunchExecution,
  onPrepareBridge,
  preparingBridge,
  reconcilingBridgeIds,
  onRequestBridgeExecution,
  onReconcileBridge,
  onDispatchEvmBridge,
  dispatchingEvmBridgeIds,
  thinking,
  animatedMessageIds,
  onAnimationComplete,
  simulatingMissionIds,
  simulatingPumpIds,
  revalidatingPumpIds,
  executingPumpIds,
  verifyingPumpExecutionIds,
  executingMissionIds,
  verifyingReceiptIds,
  simulatingLimitIds,
  executingLimitIds,
  cancellingLimitIds,
  verifyingLimitExecutionIds,
  verifyingLimitCancelIds,
  preparingEvmIds,
  executingEvmIds,
  evmExecutionEnabled,
  evmExecutionMissing,
  fullAccessEvm,
  onPrepareEvmSwap,
  onRequestEvmExecution,
  onAuthorizeFullAccessEvmAsset,
  onRequestLimitSimulation,
  onRequestLimitExecution,
  onRequestLimitCancel,
  onRequestLimitCancelExecution,
  onVerifyLimitExecution,
  onVerifyLimitCancel,
  onRequestSimulation,
  onRequestPumpSimulation,
  onRequestPumpFinalRevalidation,
  onRequestPumpExecution,
  onVerifyPumpExecution,
  onRequestExecution,
  onVerifyExecution,
  onOpenDriftPerps,
  onExecuteX402,
}: {
  session: SessionItem;
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  onOpenDriftPerps?: () => void;
  onExecuteX402: (messageId: string, resource: import("@mirae/contracts").X402Resource, masterPassword?: string) => Promise<void>;
  onCreatePumpLaunchDraft: (input: PumpLaunchDraftInput) => Promise<void>;
  onPreflightPumpLaunch: (draft: PumpLaunchDraft) => Promise<void>;
  onFinalRevalidatePumpLaunch: (draft: PumpLaunchDraft, preflight: PumpLaunchPreflight) => Promise<void>;
  onExecutePumpLaunch: (
    draft: PumpLaunchDraft,
    preflight: PumpLaunchPreflight,
    revalidation: PumpLaunchFinalRevalidation,
    credentials: { masterPassword: string },
  ) => Promise<void>;
  onVerifyPumpLaunchExecution: (draft: PumpLaunchDraft, execution: PumpLaunchExecutionRecord) => Promise<void>;
  onPrepareBridge: (input: {
    destinationChain: BridgeDestinationChain;
    destinationRecipient: string;
    amountIn: string;
    minimumDestinationAmount: string;
    maximumTotalFeeUsd: number;
  }) => Promise<void>;
  preparingBridge: boolean;
  reconcilingBridgeIds: string[];
  onRequestBridgeExecution: (proposal: BridgeProposal, preflight: BridgePreflightEvidence) => void;
  onReconcileBridge: (receipt: BridgeReceipt) => void;
  onDispatchEvmBridge: (messageId: string, preparation: { quote: EvmBridgeQuote; preflight: EvmBridgePreflight; contract?: EvmBridgeContract }) => void;
  dispatchingEvmBridgeIds: string[];
  thinking: boolean;
  animatedMessageIds: string[];
  onAnimationComplete: (id: string) => void;
  simulatingMissionIds: string[];
  simulatingPumpIds: string[];
  revalidatingPumpIds: string[];
  executingPumpIds: string[];
  verifyingPumpExecutionIds: string[];
  executingMissionIds: string[];
  verifyingReceiptIds: string[];
  simulatingLimitIds: string[];
  executingLimitIds: string[];
  cancellingLimitIds: string[];
  verifyingLimitExecutionIds: string[];
  verifyingLimitCancelIds: string[];
  preparingEvmIds: string[];
  executingEvmIds: string[];
  evmExecutionEnabled: boolean;
  evmExecutionMissing: string[];
  fullAccessEvm?: boolean;
  onPrepareEvmSwap: (messageId: string, proposal: EvmSwapProposal) => void;
  onRequestEvmExecution: (
    messageId: string,
    proposal: EvmSwapProposal,
    preflight: EvmSwapPreflightEvidence,
  ) => void;
  onAuthorizeFullAccessEvmAsset: (reviewId: string) => Promise<void>;
  onRequestLimitSimulation: (
    messageId: string,
    preview: LimitOrderContractPreview,
  ) => void;
  onRequestLimitExecution: (
    messageId: string,
    preview: LimitOrderContractPreview,
    simulation: LimitOrderSimulationPreview,
  ) => void;
  onRequestLimitCancel: (
    messageId: string,
    walletAddress: string,
    orderId: string,
  ) => void;
  onRequestLimitCancelExecution: (
    messageId: string,
    walletAddress: string,
    orderId: string,
    simulation: LimitOrderCancelSimulation,
  ) => void;
  onVerifyLimitExecution: (
    messageId: string,
    preview: LimitOrderContractPreview,
    receipt: LimitOrderExecutionReceipt,
  ) => void;
  onVerifyLimitCancel: (
    messageId: string,
    receipt: NonNullable<
      SessionRecord["messages"][number]["limitOrderCancelReceipt"]
    >,
  ) => void;
  onRequestSimulation: (
    messageId: string,
    preview: MissionContractPreview,
  ) => void;
  onRequestPumpSimulation: (
    messageId: string,
    preview: PumpTradeContractPreview,
  ) => void;
  onRequestPumpFinalRevalidation: (
    messageId: string,
    preview: PumpTradeContractPreview,
  ) => void;
  onRequestPumpExecution: (
    messageId: string,
    preview: PumpTradeContractPreview,
    simulation: PumpSimulationArtifact,
    revalidation: PumpFinalRevalidation,
  ) => void;
  onVerifyPumpExecution: (
    messageId: string,
    preview: PumpTradeContractPreview,
    execution: PumpExecutionRecord,
  ) => void;
  onRequestExecution: (
    messageId: string,
    preview: MissionContractPreview,
    simulation: MissionSimulationPreview,
  ) => void;
  onVerifyExecution: (
    messageId: string,
    preview: MissionContractPreview,
    receipt: MissionExecutionReceipt,
  ) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const messages = messagesRef.current;
    if (messages === null) return;
    const scrollToLatest = () => {
      messages.scrollTop = messages.scrollHeight;
    };
    scrollToLatest();
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [session.id, session.messages.length]);

  return (
    <div className={`conversation${session.walletScope === "solana" && session.walletAddress !== null ? " conversationWithLaunch" : ""}`}>
      <header>
        <div>
          <span className="liveDot" />{" "}
          {session.workspace === "pump"
            ? "Pump.fun · manual restricted"
            : session.walletScope === "solana"
              ? session.mode === "mission"
                ? `Solana workspace · ${session.permission} mission`
                : `Solana workspace · ${session.permission} agent`
              : session.walletScope === "evm"
                ? session.mode === "mission"
                  ? `Robinhood workspace · ${session.permission} mission`
                  : `Robinhood workspace · ${session.permission} agent`
            : session.intent === "token-launch"
              ? "Token launch planning"
              : session.intent === "solana-swap"
                ? "Solana swap preparing"
                : session.intent === "evm-swap"
                  ? "EVM swap planning · release gated"
                  : session.intent === "bridge"
                    ? "Bridge planning · quote only"
                    : session.mode === "mission"
              ? "Mission preparing"
              : "Agent active"}
        </div>
        <StatusPill tone={session.permission === "full" ? "success" : "warning"}>
          {session.permission === "full" ? "Full Access" : "Restricted"}
        </StatusPill>
      </header>
      {session.walletScope === "solana" && session.walletAddress !== null && (
        <div className="conversationLaunchBar flex items-center justify-between gap-2">
          <PumpLaunchDraftForm
            creatorWallet={session.walletAddress}
            onCreate={onCreatePumpLaunchDraft}
          />
          {onOpenDriftPerps && (
            <button
              type="button"
              onClick={onOpenDriftPerps}
              className="perpsToggle"
            >
              <Activity className="size-3.5" />
              PERPS
            </button>
          )}
        </div>
      )}
      <div className="messages" ref={messagesRef}>
        {session.messages.map((message) => (
          <article className={message.role} key={message.id}>
            {message.role === "assistant" && (
              <span className="avatar" role="img" aria-label="Mirae AI">
                <img className="avatarLogo" src={miraeLogo} alt="" aria-hidden="true" />
              </span>
            )}
            <div>
              <small>
                {message.role === "user" ? "You" : "Mirae"} ·{" "}
                {new Date(message.at || (message as any).createdAt || Date.now()).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              {message.role === "assistant" &&
              animatedMessageIds.includes(message.id) ? (
                <AnimatedMarkdownMessage
                  message={message}
                  onComplete={() => onAnimationComplete(message.id)}
                />
              ) : (
                <MarkdownMessage text={message.text} />
              )}
              {message.evmSwapProposal && (
                <EvmSwapProposalCard
                  proposal={message.evmSwapProposal}
                  preflight={message.evmSwapPreflight ?? null}
                  receipts={message.evmExecutionReceipts ?? []}
                  preparing={preparingEvmIds.includes(message.evmSwapProposal.id)}
                  executing={executingEvmIds.includes(message.evmSwapProposal.id)}
                  executionEnabled={evmExecutionEnabled}
                  executionMissing={evmExecutionMissing}
                  fullAccess={fullAccessEvm}
                  onPrepare={() =>
                    onPrepareEvmSwap(message.id, message.evmSwapProposal!)
                  }
                  onExecute={() =>
                    onRequestEvmExecution(
                      message.id,
                      message.evmSwapProposal!,
                      message.evmSwapPreflight!,
                    )
                  }
                />
              )}
              {(message as any).perpProposal && (
                <PerpProposalCard
                  proposal={(message as any).perpProposal}
                  walletAddress={session.walletAddress ?? undefined}
                  fullAccess={session.permission === "full"}
                />
              )}
              {(message as any).x402Resources && (
                <X402ResourcesCard message={message as any} restricted={session.permission === "restricted"} onExecute={(resource, masterPassword) => onExecuteX402(message.id, resource, masterPassword)} />
              )}
              {(message as any).driftPerpProposal && (
                <PerpProposalCard
                  proposal={(message as any).driftPerpProposal}
                  walletAddress={session.walletAddress ?? undefined}
                  fullAccess={session.permission === "full"}
                />
              )}
              {(message as any).evmAssetAuthorizationReview && (
                <FullAccessEvmAssetReviewCard
                  review={(message as any).evmAssetAuthorizationReview}
                  onAuthorize={() => onAuthorizeFullAccessEvmAsset((message as any).evmAssetAuthorizationReview.id)}
                />
              )}
              {message.bridgeProposal && message.bridgePreflight && (
                <BridgeProposalCard
                  proposal={message.bridgeProposal}
                  preflight={message.bridgePreflight}
                  receipt={message.bridgeReceipt ?? null}
                  reconciling={message.bridgeReceipt
                    ? reconcilingBridgeIds.includes(message.bridgeReceipt.id)
                    : false}
                  onExecute={() => onRequestBridgeExecution(message.bridgeProposal!, message.bridgePreflight!)}
                  {...(message.bridgeReceipt
                    ? { onReconcile: () => onReconcileBridge(message.bridgeReceipt!) }
                    : {})}
                />
              )}
              {(message as any).evmBridgePreparation && (
                <EvmBridgeProposalCard
                  preparation={(message as any).evmBridgePreparation}
                  receipts={(message as any).evmBridgeReceipts ?? []}
                  fullAccess={session.permission === "full"}
                  dispatching={dispatchingEvmBridgeIds.includes(message.id)}
                  onDispatch={() => onDispatchEvmBridge(message.id, (message as any).evmBridgePreparation)}
                />
              )}
              {message.missionPreview && (
                <MissionPreviewCard
                  preview={message.missionPreview}
                  simulation={message.missionSimulation ?? null}
                  execution={message.missionExecution ?? null}
                  simulating={simulatingMissionIds.includes(
                    message.missionPreview.id,
                  )}
                  executing={executingMissionIds.includes(
                    message.missionPreview.id,
                  )}
                  verifying={
                    message.missionExecution
                      ? verifyingReceiptIds.includes(
                          message.missionExecution.id,
                        )
                      : false
                  }
                  fullAccess={session.permission === "full"}
                  onSimulate={() =>
                    onRequestSimulation(message.id, message.missionPreview!)
                  }
                  onExecute={() =>
                    onRequestExecution(
                      message.id,
                      message.missionPreview!,
                      message.missionSimulation!,
                    )
                  }
                  onVerify={() =>
                    onVerifyExecution(
                      message.id,
                      message.missionPreview!,
                      message.missionExecution!,
                    )
                  }
                />
              )}
              {message.pumpTradePreview && (
                <PumpTradePreviewCard
                  preview={message.pumpTradePreview}
                  simulation={message.pumpSimulation ?? null}
                  simulating={simulatingPumpIds.includes(message.pumpTradePreview.id)}
                  onSimulate={() => onRequestPumpSimulation(message.id, message.pumpTradePreview!)}
                />
              )}
              {message.pumpSimulation && (
                <PumpSimulationCard
                  simulation={message.pumpSimulation}
                  execution={message.pumpExecution ?? null}
                  revalidating={message.pumpTradePreview ? revalidatingPumpIds.includes(message.pumpTradePreview.id) : false}
                  executing={message.pumpTradePreview ? executingPumpIds.includes(message.pumpTradePreview.id) : false}
                  onFinalRevalidate={message.pumpTradePreview
                    ? () => onRequestPumpFinalRevalidation(message.id, message.pumpTradePreview!)
                    : undefined}
                  onRequestExecution={message.pumpTradePreview && message.pumpSimulation.finalRevalidation
                    ? () => onRequestPumpExecution(
                        message.id,
                        message.pumpTradePreview!,
                        message.pumpSimulation!,
                        message.pumpSimulation!.finalRevalidation!,
                      )
                    : undefined}
                />
              )}
              {message.pumpLaunchDraft && <PumpLaunchDraftCard
                draft={message.pumpLaunchDraft}
                metadataPackage={message.pumpLaunchMetadataPackage}
                preflight={message.pumpLaunchPreflight}
                revalidation={message.pumpLaunchFinalRevalidation}
                execution={message.pumpLaunchExecution}
                onPreflight={onPreflightPumpLaunch}
                onFinalRevalidate={onFinalRevalidatePumpLaunch}
                onExecute={onExecutePumpLaunch}
                onVerify={onVerifyPumpLaunchExecution}
              />}
              {message.pumpTradePreview && message.pumpExecution && (
                <PumpExecutionCard
                  execution={message.pumpExecution}
                  preview={message.pumpTradePreview}
                  simulation={message.pumpSimulation ?? null}
                  verifying={verifyingPumpExecutionIds.includes(message.pumpExecution.id)}
                  onVerify={() => onVerifyPumpExecution(
                    message.id,
                    message.pumpTradePreview!,
                    message.pumpExecution!,
                  )}
                />
              )}
              {message.limitOrderPreview && (
                <LimitOrderPreviewCard
                  preview={message.limitOrderPreview}
                  simulation={message.limitOrderSimulation ?? null}
                  execution={message.limitOrderExecution ?? null}
                  cancelSimulation={message.limitOrderCancelSimulation ?? null}
                  cancelReceipt={message.limitOrderCancelReceipt ?? null}
                  simulating={simulatingLimitIds.includes(
                    message.limitOrderPreview.id,
                  )}
                  executing={executingLimitIds.includes(
                    message.limitOrderPreview.id,
                  )}
                  cancelling={
                    message.limitOrderExecution?.orderId
                      ? cancellingLimitIds.includes(
                          message.limitOrderExecution.orderId,
                        )
                      : false
                  }
                  verifyingExecution={
                    message.limitOrderExecution
                      ? verifyingLimitExecutionIds.includes(
                          message.limitOrderExecution.id,
                        )
                      : false
                  }
                  verifyingCancel={
                    message.limitOrderCancelReceipt
                      ? verifyingLimitCancelIds.includes(
                          message.limitOrderCancelReceipt.id,
                        )
                      : false
                  }
                  onSimulate={() =>
                    onRequestLimitSimulation(
                      message.id,
                      message.limitOrderPreview!,
                    )
                  }
                  onExecute={() =>
                    onRequestLimitExecution(
                      message.id,
                      message.limitOrderPreview!,
                      message.limitOrderSimulation!,
                    )
                  }
                  onCancel={() =>
                    onRequestLimitCancel(
                      message.id,
                      message.limitOrderPreview!.walletAddress,
                      message.limitOrderExecution!.orderId!,
                    )
                  }
                  onExecuteCancel={() =>
                    onRequestLimitCancelExecution(
                      message.id,
                      message.limitOrderPreview!.walletAddress,
                      message.limitOrderExecution!.orderId!,
                      message.limitOrderCancelSimulation!,
                    )
                  }
                  onVerifyExecution={() =>
                    onVerifyLimitExecution(
                      message.id,
                      message.limitOrderPreview!,
                      message.limitOrderExecution!,
                    )
                  }
                  onVerifyCancel={() =>
                    onVerifyLimitCancel(
                      message.id,
                      message.limitOrderCancelReceipt!,
                    )
                  }
                />
              )}
            </div>
          </article>
        ))}
        {thinking && (
          <article className="assistant typingArticle">
            <span className="avatar">S</span>
            <div>
              <small>Mirae · reasoning</small>
              <div
                className="typingIndicator"
                aria-label="Mirae is preparing a response"
              >
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>
        )}
      </div>
      <div className="conversationComposer">
        {session.walletScope === "solana" && session.walletAddress !== null && (
          <>
            {session.mode === "mission" && (
              <BridgePreparationForm busy={preparingBridge} onPrepare={onPrepareBridge} />
            )}
          </>
        )}
        {session.walletScope === "evm" && session.walletAddress !== null && session.evmChainKey === "robinhood" && (
          <EvmBridgeWorkspace
            sessionId={session.id}
            sourceChainKey={session.evmChainKey}
            sourceWallet={session.walletAddress}
          />
        )}
        <Composer
          value={draft}
          setValue={setDraft}
          onSubmit={onSend}
          disabled={thinking}
          placeholder={thinking ? "Mirae is thinking..." : "Type a follow-up or refine the plan…"}
        />
      </div>
    </div>
  );
}
