/* eslint-disable */
// @ts-nocheck
/* eslint-disable */
"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import {
  getAllSessions,
  saveSession,
  deleteSession,
  deleteAllSessions,
  getSessionMessages,
  saveMessage,
  SessionItem,
  WebMessage,
  WebProposal,
  WebUsage,
} from "@/lib/db";
import { PumpTradePreviewCard } from "@/components/cards/PumpTradePreviewCard";
import { PumpAnalysisCard } from "@/components/cards/PumpAnalysisCard";
import { LimitOrderPreviewCard } from "@/components/cards/LimitOrderPreviewCard";
import { JupiterSwapPreviewCard } from "@/components/cards/JupiterSwapPreviewCard";
import { EvmSwapPreviewCard } from "@/components/cards/EvmSwapPreviewCard";
import { EvmBridgePreviewCard } from "@/components/cards/EvmBridgePreviewCard";
import { SolanaBridgePreviewCard } from "@/components/cards/SolanaBridgePreviewCard";
import { TokenLaunchPreviewCard } from "@/components/cards/TokenLaunchPreviewCard";
import { StockAnalysisCard } from "@/components/cards/StockAnalysisCard";
import type { OnChainStockToken } from "@/lib/finnhub-stock";
import { InvestmentRecommendationCard, type InvestmentPrepareInput } from "@/components/cards/InvestmentRecommendationCard";
import { WebNewSessionModal, type LinkedWebWallet } from "@/components/trade/WebNewSessionModal";
import { WebMissionsView } from "@/components/trade/WebMissionsView";
import { WebAutomationView } from "@/components/trade/WebAutomationView";
import { TokenLaunchPanel, type PublishedTokenLaunchDraft } from "@/components/trade/TokenLaunchPanel";
import { PerpsPanel, type PerpOrderRequest } from "@/components/trade/PerpsPanel";
import { PerpPreviewCard } from "@/components/cards/PerpPreviewCard";
import { TradeHomeState, TradeMessageFeed, TradeSessionLoading, TradeSessionRail, TradeWorkspaceLayout } from "@/components/trade/workspace";
import { getWebEvmChain } from "@/lib/evm-chains";
import { switchToRobinhoodChain } from "@/lib/evm-browser-wallet";
import { isUserRejectedWalletRequest } from "@/lib/wallet-errors";

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function shortWallet(address?: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "unbound";
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function normalizeWalletActionError(cause: unknown, fallback: string): string {
  if (isUserRejectedWalletRequest(cause)) {
    return "Wallet request was cancelled. Nothing was signed or broadcast.";
  }
  const error = cause && typeof cause === "object" ? cause as { message?: unknown } : null;
  return typeof error?.message === "string" && error.message.trim() ? error.message : fallback;
}

/**
 * Rebuilds the prepare request from a stored proposal so a perps card still
 * works after a reload, when the in-memory request map is gone.
 */
function proposalToPerpRequest(proposal: WebProposal): PerpOrderRequest | null {
  const symbol = proposal.perpMarket?.replace("-PERP", "").trim();
  if (!symbol) return null;
  if (proposal.perpReduceOnly) return { action: "close", symbol };
  if (!proposal.perpDirection) return null;
  if (!proposal.perpBaseAmount && !proposal.perpNotionalUsd) return null;
  return {
    action: "open",
    symbol,
    direction: proposal.perpDirection,
    baseAmount: proposal.perpBaseAmount,
    notionalUsd: proposal.perpNotionalUsd,
    collateralUsdc: proposal.perpCollateralUsdc,
  };
}

function isLegacyEvmBridgeProgressMessage(message: WebMessage): boolean {
  if (message.role !== "assistant" || message.proposal) return false;
  return /^(?:Exact USDG approval confirmed\.|Bridge source transaction confirmed on Robinhood Chain\.|Robinhood (?:â†’|→) Solana bridge confirmed after independent Solana USDC balance verification\.)/u.test(message.content.trim());
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n\s](?:[^*\n]*[^*\n\s])?\*|_[^_\n\s](?:[^_\n]*[^_\n\s])?_)/gu;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    const token = match[0];
    if (token.startsWith("```") && token.endsWith("```")) {
      nodes.push(
        <pre key={`${start}-pre`} className="my-1.5 overflow-x-auto rounded-lg bg-[rgb(32,33,42,0.06)] p-2.5 font-mono text-xs text-[#20212a]">
          <code>{token.slice(3, -3).trim()}</code>
        </pre>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={`${start}-code`} className="rounded bg-[rgb(32,33,42,0.06)] px-1.5 py-0.5 font-mono text-xs text-[#df6b22]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("***") && token.endsWith("***")) {
      nodes.push(
        <strong key={`${start}-bi`}>
          <em>{token.slice(3, -3)}</em>
        </strong>,
      );
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      nodes.push(<strong key={`${start}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(<del key={`${start}-del`}>{token.slice(2, -2)}</del>);
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      nodes.push(<em key={`${start}-em`}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/u.exec(token);
      nodes.push(
        link ? (
          <a key={`${start}-link`} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[#df6b22] underline hover:text-[#c95b18]">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function renderMessageContent(content: string) {
  return content
    .split(/\n+/u)
    .filter(Boolean)
    .map((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#### ")) {
        return <h4 key={`${trimmed}-${index}`} className="mt-3 mb-1 text-sm font-semibold text-[#20212a]">{renderInlineMarkdown(trimmed.replace(/^####\s+/u, ""))}</h4>;
      }
      if (trimmed.startsWith("### ")) {
        return <h3 key={`${trimmed}-${index}`} className="mt-3.5 mb-1 text-base font-bold text-[#20212a]">{renderInlineMarkdown(trimmed.replace(/^###\s+/u, ""))}</h3>;
      }
      if (trimmed.startsWith("## ")) {
        return <h2 key={`${trimmed}-${index}`} className="mt-4 mb-1 text-lg font-bold text-[#20212a]">{renderInlineMarkdown(trimmed.replace(/^##\s+/u, ""))}</h2>;
      }
      if (trimmed.startsWith("# ")) {
        return <h2 key={`${trimmed}-${index}`} className="mt-4 mb-1.5 text-xl font-bold text-[#20212a]">{renderInlineMarkdown(trimmed.replace(/^#\s+/u, ""))}</h2>;
      }
      if (trimmed.startsWith(">")) {
        const quoteText = trimmed.replace(/^>+\s*/u, "");
        return (
          <blockquote key={`${trimmed}-${index}`} className="my-2 rounded-r border-l-2 border-[#df6b22] bg-[rgb(223,107,34,0.06)] py-1.5 pl-3 text-xs leading-5 text-[#52545d]">
            {renderInlineMarkdown(quoteText)}
          </blockquote>
        );
      }
      if (/^[-*_]{3,}$/u.test(trimmed)) {
        return <hr key={`${trimmed}-${index}`} className="my-3 border-t border-[rgb(32,33,42,0.12)]" />;
      }
      if (/^[-*+•]\s+/u.test(trimmed)) {
        return <p key={`${trimmed}-${index}`} className="messageBullet">• {renderInlineMarkdown(trimmed.replace(/^[-*+•]\s+/u, ""))}</p>;
      }
      if (/^\d+[.)]\s+/u.test(trimmed)) {
        const match = /^(\d+[.)])\s+(.+)$/u.exec(trimmed);
        return <p key={`${trimmed}-${index}`} className="messageBullet"><span className="font-semibold text-[#df6b22]">{match?.[1]}</span> {renderInlineMarkdown(match?.[2] ?? trimmed)}</p>;
      }
      return <p key={`${trimmed}-${index}`}>{renderInlineMarkdown(trimmed)}</p>;
    });
}

function parseWebUsage(value: unknown, fallbackModel: string): WebUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const numberOrZero = (input: unknown) => {
    const number = typeof input === "number" ? input : Number(input);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };
  return {
    inputTokens: numberOrZero(usage.inputTokens),
    outputTokens: numberOrZero(usage.outputTokens),
    totalTokens: numberOrZero(usage.totalTokens),
    costUsd: usage.costUsd == null ? null : numberOrZero(usage.costUsd),
    model: typeof usage.model === "string" && usage.model ? usage.model : fallbackModel,
  };
}

type PreparedEvmBridgeQuote = {
  action: "approval" | "deposit";
  transaction: { kind: "approval" | "deposit"; from: string; to: string; data: string; value: string; chainId: number };
  requestId: string;
  amountIn: string;
  estimatedAmountOut: string;
  minimumAmountOut: string;
  totalFeeUsd: number;
  estimatedSeconds: number;
  destinationRecipient: string;
  quoteExpiresAt: number;
};

type RailAutomationStrategy = {
  id: string;
  sessionId: string;
  kind: "DCA" | "EXIT";
  status: string;
  inputSymbol: string;
  outputSymbol: string;
  amount: string;
  intervalSeconds?: number | null;
  maximumExecutions?: number | null;
  completedExecutions: number;
  takeProfitPriceUsd?: number | null;
  stopLossPriceUsd?: number | null;
  nextWakeAt?: number | null;
  expiresAt: number;
  lastError?: string | null;
  proposals: Array<{ id: string; reason: string; status: string; expiresAt: number }>;
};

export default function TradePage() {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const { setVisible: setSolanaWalletVisible } = useWalletModal();
  const walletAddress = publicKey?.toBase58() ?? null;
  const activeWalletAddressRef = useRef<string | null>(walletAddress);
  const { connection } = useConnection();
  const router = useRouter();

  useEffect(() => {
    activeWalletAddressRef.current = walletAddress;
  }, [walletAddress]);

  // Workspace Mode: restricted Mainnet parity with the desktop app.
  const mode = "restricted";

  const [authenticatedWallet, setAuthenticatedWallet] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // IndexedDB Sessions & Messages State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "agent" | "mission">("all");
  const [workspaceView, setWorkspaceView] = useState<"chat" | "missions" | "automation">("chat");
  const [automationContext, setAutomationContext] = useState<{ workspace: "solana" | "evm"; walletAddress: string } | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSessionMode, setNewSessionMode] = useState<"agent" | "mission">("agent");
  const [sessionModalKey, setSessionModalKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | "all" | null>(null);
  const [deletingSessions, setDeletingSessions] = useState(false);
  const [pendingSessionPrompt, setPendingSessionPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [sessionMessagesLoading, setSessionMessagesLoading] = useState(false);
  const messagesRef = useRef<WebMessage[]>([]);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const preparedEvmBridgeQuotesRef = useRef(new Map<string, PreparedEvmBridgeQuote>());
  const autoEvmQuoteRequestsRef = useRef(new Set<string>());
  const portfolioRequestRef = useRef(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [tokenLaunchBusyId, setTokenLaunchBusyId] = useState<string | null>(null);
  const [stockSwapBusyId, setStockSwapBusyId] = useState<string | null>(null);
  const [investmentBusyKey, setInvestmentBusyKey] = useState<string | null>(null);
  const [showTokenLaunchPanel, setShowTokenLaunchPanel] = useState(false);
  const [showPerpsPanel, setShowPerpsPanel] = useState(false);
  const [perpBusyId, setPerpBusyId] = useState<string | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWebWallet[]>([]);
  const [activeEvmAddress, setActiveEvmAddress] = useState<string | null>(null);
  const [activeEvmChainId, setActiveEvmChainId] = useState<number | null>(null);

  function writeSessionQuery(sessionId: string, mode: "push" | "replace" = "push") {
    const url = new URL(window.location.href);
    if (sessionId) url.searchParams.set("session", sessionId);
    else url.searchParams.delete("session");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (mode === "replace") window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  }

  function selectSession(sessionId: string, mode: "push" | "replace" = "push") {
    setSessionMessagesLoading(Boolean(sessionId));
    setActiveSessionId(sessionId);
    setWorkspaceView("chat");
    writeSessionQuery(sessionId, mode);
  }

  function changeWorkspaceView(view: "chat" | "missions" | "automation") {
    if (view !== "automation") {
      setWorkspaceView(view);
      return;
    }

    const session = sessions.find((item) => item.id === activeSessionId);
    const evm = session?.workspace === "evm" && session.chainKey === "robinhood";
    const contextWallet = evm
      ? (session.sessionWalletAddress ?? activeEvmAddress)
      : (session?.workspace === "solana" ? session.sessionWalletAddress : walletAddress);

    if (contextWallet) {
      setAutomationContext({ workspace: evm ? "evm" : "solana", walletAddress: contextWallet });
    }
    setActiveSessionId("");
    setSessionMessagesLoading(false);
    setWorkspaceView("automation");
    writeSessionQuery("");
  }
  const tokenLaunchMintSignersRef = useRef(new Map<string, Keypair>());
  const perpRequestsRef = useRef(new Map<string, PerpOrderRequest>());

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [portfolioAssets, setPortfolioAssets] = useState<{ symbol: string; amount: number; valueUsd: number; network?: "Robinhood" | "Solana" }[]>([]);
  const [portfolioTotalUsd, setPortfolioTotalUsd] = useState<number | null>(null);
  // Perps equity lives on the exchange, not in the wallet's token accounts, so it
  // is fetched separately and shown as its own block rather than mixed into the
  // spot asset rows.
  const [perpEquity, setPerpEquity] = useState<{ collateralUsd: number; unrealizedPnlUsd: number; positions: Array<{ symbol: string; direction: "long" | "short"; baseAmount: number; unrealizedPnlUsd: number }> } | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState("Refreshing Mainnet balance...");
  const [portfolioCopyFeedback, setPortfolioCopyFeedback] = useState<{ address: string; status: "copied" | "failed" } | null>(null);
  const portfolioCopyTimerRef = useRef<number | null>(null);
  const [automationStrategies, setAutomationStrategies] = useState<RailAutomationStrategy[]>([]);
  const [automationClock, setAutomationClock] = useState(() => Date.now());
  const autoPreparingAutomationProposalIdsRef = useRef(new Set<string>());
  const accountWalletAddress = authenticatedWallet ?? walletAddress;
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const dashboardWallet = linkedWallets.find((linked) => linked.namespace === "solana") ?? linkedWallets.find((linked) => linked.address.toLowerCase() === accountWalletAddress?.toLowerCase()) ?? linkedWallets[0];
  const portfolioWorkspace = activeSession?.workspace === "evm" ? "evm" : activeSession ? "solana" : dashboardWallet?.namespace;
  const portfolioWalletAddress = activeSession?.sessionWalletAddress ?? dashboardWallet?.address ?? accountWalletAddress;

  async function copyPortfolioAddress(address: string) {
    if (portfolioCopyTimerRef.current !== null) window.clearTimeout(portfolioCopyTimerRef.current);
    try {
      await navigator.clipboard.writeText(address);
      setPortfolioCopyFeedback({ address, status: "copied" });
    } catch {
      setPortfolioCopyFeedback({ address, status: "failed" });
    }
    portfolioCopyTimerRef.current = window.setTimeout(() => setPortfolioCopyFeedback(null), 1_600);
  }

  useEffect(() => () => {
    if (portfolioCopyTimerRef.current !== null) window.clearTimeout(portfolioCopyTimerRef.current);
  }, []);

  const refreshAutomation = useCallback(async () => {
    const evmAutomation = activeSession?.workspace === "evm" && activeSession.chainKey === "robinhood";
    const automationWallet = evmAutomation
      ? (activeSession.sessionWalletAddress ?? activeEvmAddress)
      : walletAddress;
    if (!authChecked || !authenticatedWallet || !automationWallet) return;
    const response = await fetch(`${evmAutomation ? "/api/evm/automation" : "/api/automation"}?walletAddress=${encodeURIComponent(automationWallet)}`, {
      headers: {},
    });
    if (!response.ok) return;
    const result = await response.json() as { strategies?: RailAutomationStrategy[] };
    const strategies = result.strategies ?? [];
    setAutomationStrategies(strategies);

    // Monitoring creates only a durable proposal. Once the browser sees that
    // proposal, prepare its fresh quote and put the review card in the source
    // chat session. Automation never opens the wallet or signs anything.
    const due = strategies
      .flatMap((strategy) => strategy.proposals.map((proposal) => ({ strategy, proposal })))
      .find(({ proposal }) => proposal.status === "AWAITING_APPROVAL" && !autoPreparingAutomationProposalIdsRef.current.has(proposal.id));
    if (!due) return;

    autoPreparingAutomationProposalIdsRef.current.add(due.proposal.id);
    try {
      const prepareResponse = await fetch(evmAutomation ? "/api/evm/automation" : "/api/automation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: automationWallet, proposalId: due.proposal.id, action: "prepare" }),
      });
      const rawPrepared = await prepareResponse.text();
      let prepared: { proposal?: WebProposal; error?: string } = {};
      try { prepared = rawPrepared ? JSON.parse(rawPrepared) as typeof prepared : {}; }
      catch { throw new Error(`Automation quote endpoint returned HTTP ${prepareResponse.status} without valid JSON.`); }
      if (!prepareResponse.ok || !prepared.proposal) throw new Error(prepared.error || "Automation quote preparation was unavailable.");
      await handleAutomationPrepared(due.strategy.sessionId, prepared.proposal);
      setAutomationStrategies((current) => current.map((strategy) => strategy.id === due.strategy.id
        ? { ...strategy, status: "AWAITING_APPROVAL", proposals: strategy.proposals.map((proposal) => proposal.id === due.proposal.id ? { ...proposal, status: "PREPARED" } : proposal) }
        : strategy));
    } catch (error) {
      console.warn("[Automation quote preparation]", error);
      autoPreparingAutomationProposalIdsRef.current.delete(due.proposal.id);
    }
  }, [activeEvmAddress, activeSession?.chainKey, activeSession?.sessionWalletAddress, activeSession?.workspace, authChecked, authenticatedWallet, walletAddress]);

  useEffect(() => {
    if (!authChecked || !authenticatedWallet || (!walletAddress && !activeEvmAddress && !activeSession?.sessionWalletAddress)) return;
    const initialTimer = window.setTimeout(() => void refreshAutomation(), 0);
    const interval = window.setInterval(() => void refreshAutomation(), 20_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(interval); };
  }, [activeEvmAddress, activeSession?.sessionWalletAddress, authChecked, authenticatedWallet, refreshAutomation, walletAddress]);

  // The strategy API is polled less frequently, but the visible next-run timer should
  // stay accurate between refreshes without performing any extra network requests.
  useEffect(() => {
    const interval = window.setInterval(() => setAutomationClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  async function patchProposal(messageId: string, proposalId: string, patch: Partial<WebProposal>) {
    if (!accountWalletAddress) return;
    const current = messagesRef.current.find((message) => (message.id === messageId || message.proposal?.id === proposalId) && message.proposal);
    if (!current?.proposal) return;
    const updated: WebMessage = { ...current, proposal: { ...current.proposal, ...patch } };
    const nextMessages = messagesRef.current.map((message) => (message.id === current.id || message.proposal?.id === proposalId) ? updated : message);
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    const saved = await saveMessage(accountWalletAddress, updated);
    if (saved && saved.id !== updated.id) {
      const persistedMessages = messagesRef.current.map((message) => message.id === updated.id ? saved : message);
      messagesRef.current = persistedMessages;
      setMessages(persistedMessages);
    }
  }

  async function handleAutomationPrepared(sessionId: string, proposal: WebProposal) {
    if (!accountWalletAddress) return;
    const message: WebMessage = {
      id: `automation_${Date.now()}`,
      sessionId,
      role: "assistant",
      content: `${proposal.automationReason?.replaceAll("_", " ") ?? "Automation"} triggered. A live ${proposal.venue ?? "market"} route is ready for review; nothing has been signed or broadcast.`,
      proposal,
      createdAt: Date.now(),
    };
    const saved = await saveMessage(accountWalletAddress, message);
    if (activeSessionId !== sessionId) selectSession(sessionId);
    else setWorkspaceView("chat");
    setMessages((current) => [...current.filter((item) => item.sessionId === sessionId), saved ?? message]);
  }

  async function checkEvmBridgeSettlement(proposal: WebProposal, messageId: string) {
    const sessionWallet = activeSession?.sessionWalletAddress;
    if (!sessionWallet || !proposal.bridgeRequestId || !proposal.destinationRecipient || !proposal.minimumOutputAmount) {
      throw new Error("Bridge settlement evidence is incomplete. Do not submit the bridge again.");
    }
    const response = await fetch("/api/bridge/evm-to-solana/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: sessionWallet,
        requestId: proposal.bridgeRequestId,
        destinationRecipient: proposal.destinationRecipient,
        minimumAmountOut: proposal.minimumOutputAmount,
      }),
    });
    const result = await response.json() as { error?: string; relayStatus?: string; destinationConfirmed?: boolean; destinationTxHash?: string | null; receivedAmount?: string; warning?: string };
    if (!response.ok) throw new Error(result.error || "Bridge settlement could not be checked.");
    if (result.destinationConfirmed && result.destinationTxHash) {
      await patchProposal(messageId, proposal.id, { status: "confirmed", destinationTxHash: result.destinationTxHash, outputAmount: result.receivedAmount ?? proposal.outputAmount, bridgeStatusMessage: "Bridge confirmed after independent Solana USDC balance verification.", bridgeError: undefined });
      void fetchWalletBalance();
      return;
    }
    if (["failure", "refund", "refunded"].includes(result.relayStatus ?? "")) {
      await patchProposal(messageId, proposal.id, { status: "unknown", bridgeError: `Relay reports bridge status ${result.relayStatus}. Do not submit the bridge again until the source transaction and any refund are reconciled.` });
      return;
    }
    await patchProposal(messageId, proposal.id, { status: "source_confirmed", bridgeStatusMessage: `Robinhood source transaction is confirmed. Solana settlement is still ${result.relayStatus ?? "pending"}; no completion is claimed yet.`, bridgeError: undefined });
  }

  async function handlePrepareEvmBridge(proposal: WebProposal, messageId: string) {
    if (!activeSession || activeSession.workspace !== "evm" || activeSession.chainKey !== "robinhood") {
      alert("Robinhood → Solana bridge can only be prepared from a bound Robinhood session.");
      return;
    }
    const sessionWallet = activeSession.sessionWalletAddress;
    if (!sessionWallet) return;
    if (!proposal.amountUsdg || !proposal.destinationRecipient) return;
    setBridgeBusy(true);
    let submittedHash: string | null = null;
    let submittedAction: "approval" | "deposit" | null = null;
    let confirmedSourceHash: string | null = null;
    let confirmedApprovalHash: string | null = null;
    let revertedHash: string | null = null;
    let settlementOnly = false;
    try {
      if ((proposal.status === "source_confirmed" || proposal.status === "unknown") && proposal.sourceTxHash) {
        settlementOnly = true;
        await checkEvmBridgeSettlement(proposal, messageId);
        return;
      }

      let prepared = preparedEvmBridgeQuotesRef.current.get(proposal.id);
      if (!prepared || prepared.quoteExpiresAt <= Date.now()) {
        preparedEvmBridgeQuotesRef.current.delete(proposal.id);
        const response = await fetch("/api/bridge/evm-to-solana/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: sessionWallet,
            destinationRecipient: proposal.destinationRecipient,
            amountUsdg: proposal.amountUsdg,
          }),
        });
        const result = await response.json() as PreparedEvmBridgeQuote & { error?: string };
        if (!response.ok || !result.transaction || !result.requestId) throw new Error(result.error || "Relay did not return a valid Robinhood to Solana quote.");
        if (result.action === "approval" && proposal.bridgeApprovalTxHash) {
          throw new Error("Relay has not indexed the confirmed USDG allowance yet. Wait a few seconds, then prepare the deposit quote again; do not approve USDG twice.");
        }
        prepared = result;
        preparedEvmBridgeQuotesRef.current.set(proposal.id, prepared);
        await patchProposal(messageId, proposal.id, {
          status: "ready_for_user_signature",
          bridgeAction: prepared.action,
          bridgeRequestId: prepared.requestId,
          inputAmount: prepared.amountIn,
          outputAmount: prepared.estimatedAmountOut,
          minimumOutputAmount: prepared.minimumAmountOut,
          bridgeTotalFeeUsd: prepared.totalFeeUsd,
          bridgeEstimatedSeconds: prepared.estimatedSeconds,
          quoteExpiresAt: prepared.quoteExpiresAt,
          bridgeStatusMessage: prepared.action === "approval" ? "Live quote prepared. Review the exact USDG approval in your wallet." : "Live quote prepared. Review the bridge deposit in your wallet.",
          bridgeError: undefined,
        });
        return;
      }

      await switchToRobinhoodChain();
      const provider = window.ethereum;
      if (!provider) throw new Error("EVM wallet extension is not available.");
      const [accounts, chainId, latestBlock] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
        provider.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
      ]);
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || accounts[0].toLowerCase() !== sessionWallet.toLowerCase()) throw new Error("The active EVM account no longer matches this session.");
      if (chainId !== "0x1237" || !latestBlock) throw new Error("The wallet is not connected to a healthy Robinhood Chain RPC.");
      const balances = await assertEvmBridgeFunds({
        rpcUrl: DEFAULT_ROBINHOOD_RPC,
        walletAddress: sessionWallet,
        amountIn: prepared.amountIn,
        transaction: prepared.transaction,
      });
      await patchProposal(messageId, proposal.id, {
        status: "signing",
        bridgeStatusMessage: prepared.action === "approval" ? "Waiting for USDG approval in the EVM wallet." : "Waiting for bridge deposit approval in the EVM wallet.",
        bridgeError: undefined,
        checks: [
          ...(proposal.checks ?? []).filter((check) => !["source_usdg_balance", "source_eth_fee"].includes(check.code)),
          { code: "source_usdg_balance", status: "pass", message: `Live balance verified: ${balances.availableUsdg} USDG.` },
          { code: "source_eth_fee", status: "pass", message: `ETH fee reserve verified: ${balances.availableEth} ETH available; estimated action fee ${balances.estimatedNetworkFeeEth} ETH.` },
        ],
      });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: prepared.transaction.from, to: prepared.transaction.to, data: prepared.transaction.data, value: prepared.transaction.value }],
      });
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/iu.test(hash)) throw new Error("Wallet did not return a valid Robinhood transaction hash.");
      submittedHash = hash;
      submittedAction = prepared.action;
      let confirmed = false;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
        if (receipt && typeof receipt === "object") {
          const status = (receipt as { status?: unknown }).status;
          if (status === "0x0" || status === 0) {
            revertedHash = hash;
            submittedHash = null;
            await patchProposal(messageId, proposal.id, { status: "reverted", sourceTxHash: prepared.action === "deposit" ? hash : proposal.sourceTxHash, bridgeApprovalTxHash: prepared.action === "approval" ? hash : proposal.bridgeApprovalTxHash });
            throw new Error(`Robinhood transaction reverted: ${hash}`);
          }
          confirmed = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2_500));
      }
      if (!confirmed) throw new Error(`Transaction was submitted but confirmation is still pending: ${hash}`);
      preparedEvmBridgeQuotesRef.current.delete(proposal.id);

      if (prepared.action === "approval") {
        confirmedApprovalHash = hash;
        submittedHash = null;
        await patchProposal(messageId, proposal.id, {
          status: "approval_confirmed",
          bridgeAction: undefined,
          bridgeRequestId: undefined,
          quoteExpiresAt: undefined,
          bridgeApprovalTxHash: hash,
          outputAmount: undefined,
          minimumOutputAmount: undefined,
          bridgeTotalFeeUsd: undefined,
          bridgeEstimatedSeconds: undefined,
          bridgeStatusMessage: "Exact USDG approval confirmed. Prepare a fresh Relay quote for the bridge deposit.",
          bridgeError: undefined,
          checks: [
            ...(proposal.checks ?? []).filter((check) => check.code !== "bridge_approval_confirmed"),
            { code: "bridge_approval_confirmed", status: "pass", message: "Exact USDG approval confirmed on Robinhood Chain." },
          ],
        });
        return;
      }

      const sourceConfirmedProposal = {
        ...proposal,
        status: "source_confirmed" as const,
        sourceTxHash: hash,
        bridgeRequestId: prepared.requestId,
        minimumOutputAmount: prepared.minimumAmountOut,
        outputAmount: prepared.estimatedAmountOut,
      };
      confirmedSourceHash = hash;
      await patchProposal(messageId, proposal.id, {
        status: "source_confirmed",
        sourceTxHash: hash,
        bridgeRequestId: prepared.requestId,
        minimumOutputAmount: prepared.minimumAmountOut,
        outputAmount: prepared.estimatedAmountOut,
        bridgeStatusMessage: "Bridge source transaction confirmed on Robinhood Chain. Solana settlement is pending.",
        bridgeError: undefined,
      });
      submittedHash = null;
      await checkEvmBridgeSettlement(sourceConfirmedProposal, messageId);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
      const cancelled = code === 4001 || code === "4001";
      const rawMessage = error instanceof Error ? error.message : "Robinhood to Solana bridge could not be prepared.";
      const message = cancelled ? "Wallet approval cancelled. No new transaction was signed or broadcast." : rawMessage;
      if (settlementOnly) {
        await patchProposal(messageId, proposal.id, { status: proposal.status === "unknown" ? "unknown" : "source_confirmed", bridgeError: `Settlement verification is temporarily unavailable. The source transaction has already been submitted; do not submit the bridge again. ${message}` });
      } else if (revertedHash) {
        await patchProposal(messageId, proposal.id, { status: "reverted", sourceTxHash: submittedAction === "deposit" ? revertedHash : proposal.sourceTxHash, bridgeApprovalTxHash: submittedAction === "approval" ? revertedHash : proposal.bridgeApprovalTxHash, bridgeError: message });
      } else if (confirmedSourceHash) {
        await patchProposal(messageId, proposal.id, { status: "source_confirmed", sourceTxHash: confirmedSourceHash, bridgeError: `Robinhood source transaction is confirmed, but Solana settlement could not be checked. Do not submit the bridge again; use Check settlement later. ${message}` });
      } else if (confirmedApprovalHash) {
        preparedEvmBridgeQuotesRef.current.delete(proposal.id);
        await patchProposal(messageId, proposal.id, { status: "approval_confirmed", bridgeAction: undefined, bridgeRequestId: undefined, quoteExpiresAt: undefined, bridgeApprovalTxHash: confirmedApprovalHash, outputAmount: undefined, minimumOutputAmount: undefined, bridgeTotalFeeUsd: undefined, bridgeEstimatedSeconds: undefined, bridgeStatusMessage: "Exact USDG approval confirmed. Prepare a fresh Relay quote for the bridge deposit.", bridgeError: undefined });
      } else if (submittedHash) {
        await patchProposal(messageId, proposal.id, { status: "unknown", sourceTxHash: submittedAction === "deposit" ? submittedHash : proposal.sourceTxHash, bridgeApprovalTxHash: submittedAction === "approval" ? submittedHash : proposal.bridgeApprovalTxHash, bridgeError: `A Robinhood transaction was submitted, but confirmation is unknown. Do not submit it again until it is inspected. ${message}` });
      } else {
        await patchProposal(messageId, proposal.id, { status: proposal.bridgeAction ? "ready_for_user_signature" : proposal.bridgeApprovalTxHash ? "approval_confirmed" : "preview_only", bridgeError: message });
      }
    } finally {
      setBridgeBusy(false);
    }
  }

  async function handlePrepareSolanaBridgeProposal(proposal: WebProposal, msgId: string) {
    if (!connected || !publicKey || !walletAddress) {
      alert("Please connect your Solana wallet (Phantom / Solflare) first!");
      return;
    }
    if (activeSession?.workspace !== "solana") {
      alert("Solana bridge can only run from a bound Solana session.");
      return;
    }
    if (!proposal.amountUsdc || !proposal.destinationRecipient) {
      alert("Bridge proposal is missing amount or destination recipient.");
      return;
    }
    setBridgeBusy(true);
    let submittedSignature: string | null = null;
    try {
      await patchProposal(msgId, proposal.id, { status: "signing" });
      const response = await fetch("/api/bridge/solana-to-evm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          amountUsdc: proposal.amountUsdc,
          destination: proposal.destination || "robinhood",
          destinationRecipient: proposal.destinationRecipient,
        }),
      });
      const quote = await response.json() as {
        error?: string;
        transaction?: string;
        destination?: { label: string; symbol: string };
        requestId?: string | null;
        estimatedAmountOut?: string | null;
        minimumAmountOut?: string | null;
        estimatedSeconds?: number | null;
      };
      if (!response.ok || typeof quote.transaction !== "string") {
        throw new Error(quote.error || "Bridge provider did not return an executable transaction.");
      }
      const transaction = VersionedTransaction.deserialize(base64ToBytes(quote.transaction));
      const signature = await sendTransaction(transaction, connection, { skipPreflight: false, maxRetries: 2 });
      submittedSignature = signature;

      await patchProposal(msgId, proposal.id, {
        status: "submitted",
        sourceTxHash: signature,
        bridgeRequestId: quote.requestId,
        outputAmount: quote.estimatedAmountOut ?? proposal.outputAmount,
        minimumOutputAmount: quote.minimumAmountOut ?? proposal.minimumOutputAmount,
        bridgeEstimatedSeconds: quote.estimatedSeconds ?? proposal.bridgeEstimatedSeconds,
        bridgeStatusMessage: "Bridge source transaction broadcast. Waiting for Solana confirmation...",
        bridgeError: undefined,
      });

      const sourceReceipt = await connection.confirmTransaction(signature, "confirmed");
      if (sourceReceipt.value.err) throw new Error(`Solana rejected the bridge source transaction: ${JSON.stringify(sourceReceipt.value.err)}`);

      await patchProposal(msgId, proposal.id, {
        status: "source_confirmed",
        sourceTxHash: signature,
        bridgeStatusMessage: `Bridge source transaction confirmed on Solana. Settling on ${quote.destination?.label ?? "Robinhood Chain"}...`,
        bridgeError: undefined,
      });

      setTimeout(() => {
        void fetchWalletBalance();
      }, 2000);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
      const cancelled = code === 4001 || code === "4001" || normalizeWalletActionError(error, "").includes("cancelled");
      const message = cancelled ? "Wallet approval cancelled. No transaction was signed or broadcast." : (error instanceof Error ? error.message : "Bridge execution failed.");
      if (submittedSignature) {
        await patchProposal(msgId, proposal.id, {
          status: "unknown",
          sourceTxHash: submittedSignature,
          bridgeError: `Bridge source transaction was submitted, but confirmation could not be verified. Do not submit again until you inspect the signature. ${message}`,
        });
      } else {
        await patchProposal(msgId, proposal.id, {
          status: "preview_only",
          bridgeError: message,
        });
      }
    } finally {
      setBridgeBusy(false);
    }
  }

  useEffect(() => {
    activeWalletAddressRef.current = accountWalletAddress;
  }, [accountWalletAddress]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const activeRailAutomations = automationStrategies.filter((strategy) =>
    strategy.sessionId === activeSessionId && !["CANCELLED", "COMPLETED", "EXPIRED"].includes(strategy.status),
  );
  const activeMessageCount = messages.reduce((count, message) => count + (message.sessionId === activeSessionId ? 1 : 0), 0);
  const expectedEvmChain = activeSession?.chainKey ? getWebEvmChain(activeSession.chainKey) : null;
  const evmWalletMismatch = activeSession?.workspace === "evm" && (
    (activeEvmAddress !== null && activeEvmAddress.toLowerCase() !== activeSession.sessionWalletAddress?.toLowerCase())
    || (activeEvmChainId !== null && activeEvmChainId !== expectedEvmChain?.chainId)
  );

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      setActiveEvmAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
    };
    const onChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0];
      setActiveEvmChainId(typeof chainIdHex === "string" ? Number.parseInt(chainIdHex, 16) : null);
    };
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/wallet/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (cancelled) return;
        if (session.authenticated === true && typeof session.walletAddress === "string") {
          setAuthenticatedWallet(session.walletAddress);
          return;
        }
        const tradeReturnUrl = `/trade${window.location.search}`;
        router.replace(`/connect?next=${encodeURIComponent(tradeReturnUrl)}`);
      })
      .catch(() => {
        if (!cancelled) {
          const tradeReturnUrl = `/trade${window.location.search}`;
          router.replace(`/connect?next=${encodeURIComponent(tradeReturnUrl)}`);
        }
      }).finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    function restoreSessionFromUrl() {
      const requestedSessionId = new URLSearchParams(window.location.search).get("session")?.trim() ?? "";
      if (!requestedSessionId) {
        setSessionMessagesLoading(false);
        setActiveSessionId("");
        setWorkspaceView("chat");
        return;
      }
      if (sessions.some((session) => session.id === requestedSessionId)) {
        setSessionMessagesLoading(true);
        setActiveSessionId(requestedSessionId);
        setWorkspaceView("chat");
        return;
      }
      setSessionMessagesLoading(false);
      setActiveSessionId("");
      writeSessionQuery("", "replace");
    }

    window.addEventListener("popstate", restoreSessionFromUrl);
    return () => window.removeEventListener("popstate", restoreSessionFromUrl);
  }, [sessions]);

  // --------------------------------------------------------------------------
  // INITIALIZATION: Load Sessions
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      if (!accountWalletAddress) return;
      try {
        setSessions([]);
        setMessages([]);
        setSessionMessagesLoading(false);
        setActiveSessionId("");
        setLoading(false);

        localStorage.removeItem(`mirae_web_setup_v1:${accountWalletAddress}`);
        localStorage.removeItem(`mirae_web_setup_draft_v1:${accountWalletAddress}`);
        sessionStorage.removeItem(`mirae_web_setup_secrets_v1:${accountWalletAddress}`);

        // Load IndexedDB Sessions
        const [storedSessions, walletResponse] = await Promise.all([
          getAllSessions(accountWalletAddress),
          fetch("/api/wallets", { cache: "no-store" }),
        ]);
        if (walletResponse.ok) {
          const walletData = await walletResponse.json();
          setLinkedWallets(Array.isArray(walletData.wallets) ? walletData.wallets : []);
        }
        if (cancelled) return;
        const legacyPlaceholder = storedSessions.length === 1
          && ["Default Trading Workspace", "New trading workspace"].includes(storedSessions[0].title);
        if (legacyPlaceholder) {
          const placeholderMessages = await getSessionMessages(walletAddress, storedSessions[0].id);
          if (cancelled) return;
          if (placeholderMessages.length === 0) {
            await deleteSession(accountWalletAddress, storedSessions[0].id);
            if (cancelled) return;
            setSessions([]);
            setActiveSessionId("");
            setSessionMessagesLoading(false);
            setMessages([]);
            writeSessionQuery("", "replace");
            return;
          }
        }
        if (storedSessions.length === 0) {
          setSessions([]);
          setActiveSessionId("");
          setSessionMessagesLoading(false);
          setMessages([]);
          writeSessionQuery("", "replace");
        } else {
          setSessions(storedSessions);
          setMessages([]);
          const requestedSessionId = new URLSearchParams(window.location.search).get("session")?.trim() ?? "";
          const requestedSession = storedSessions.find((session) => session.id === requestedSessionId);
          setSessionMessagesLoading(Boolean(requestedSession));
          setActiveSessionId(requestedSession?.id ?? "");
          if (requestedSessionId && !requestedSession) writeSessionQuery("", "replace");
        }
      } catch (err) {
        console.error("Workspace initialization error:", err);
      }
    }

    if (accountWalletAddress) {
      void initWorkspace();
    }

    return () => {
      cancelled = true;
    };
  }, [accountWalletAddress]);

  // Load Messages when Active Session changes
  useEffect(() => {
    let cancelled = false;
    const loadStartedAt = Date.now();
    setMessages([]);
    messagesRef.current = [];

    async function loadActiveMessages() {
      if (!accountWalletAddress || !activeSessionId) {
        if (!cancelled) setSessionMessagesLoading(false);
        return;
      }
      setSessionMessagesLoading(true);
      const targetId = activeSessionId;
      try {
        const msgs = await getSessionMessages(accountWalletAddress, targetId);
        if (!cancelled) {
          const persisted = msgs.filter((message) => message.sessionId === targetId);
          const localUpdates = messagesRef.current.filter((message) => message.sessionId === targetId && message.createdAt >= loadStartedAt);
          const merged = [...persisted];
          for (const local of localUpdates) {
            const alreadyPresent = merged.some((message) => message.id === local.id || (
              message.role === local.role
              && message.content === local.content
              && message.proposal?.id === local.proposal?.id
              && Math.abs(message.createdAt - local.createdAt) < 10_000
            ));
            if (!alreadyPresent) merged.push(local);
          }
          merged.sort((left, right) => left.createdAt - right.createdAt);
          messagesRef.current = merged;
          setMessages(merged);
        }
      } catch (error) {
        console.error("Session message loading error:", error);
      } finally {
        if (!cancelled) setSessionMessagesLoading(false);
      }
    }
    void loadActiveMessages();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, accountWalletAddress]);

  // Open every session at its newest message, after the async history load has painted.
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !activeSessionId) return;
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSessionId, activeMessageCount]);

const DEFAULT_ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
const ROBINHOOD_USDG_ADDRESS = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const ROBINHOOD_WETH_ADDRESS = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";

async function queryEvmRpc(_rpcUrl: string, method: string, params: unknown[]) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("/api/evm/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null) as { result?: string; error?: string } | null;
    if (!response.ok || json?.error || typeof json?.result !== "string") throw new Error(json?.error || `RPC error status ${response.status}`);
    return json.result;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw new Error("The server-configured Robinhood RPC timed out.");
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatAutomationCountdown(timestamp?: number | null, now = Date.now()): string {
  if (!timestamp) return "Waiting for evaluation";
  const remaining = Math.max(0, timestamp - now);
  if (remaining === 0) return "Due now";
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return `Due in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `Due in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `Due in ${hours}h`;
}

function formatEvmUnits(value: bigint, decimals: number): string {
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/u, "").slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function assertEvmSwapFunds(input: {
  rpcUrl: string;
  walletAddress: string;
  sellToken: string;
  sellTokenAddress: string;
  sellTokenDecimals: number;
  amountIn: string;
  transaction: { from: string; to: string; data: string; value: string };
}) {
  const balanceOfData = `0x70a08231000000000000000000000000${input.walletAddress.replace(/^0x/i, "").toLowerCase()}`;
  const nativeInput = input.sellTokenAddress === "0x0000000000000000000000000000000000000000";
  const [nativeBalance, gasLimit, gasPrice, simulation, tokenBalance] = await Promise.all([
    queryEvmRpc(input.rpcUrl, "eth_getBalance", [input.walletAddress, "latest"]),
    queryEvmRpc(input.rpcUrl, "eth_estimateGas", [{ from: input.transaction.from, to: input.transaction.to, data: input.transaction.data, value: input.transaction.value }]),
    queryEvmRpc(input.rpcUrl, "eth_gasPrice", []),
    queryEvmRpc(input.rpcUrl, "eth_call", [{ from: input.transaction.from, to: input.transaction.to, data: input.transaction.data, value: input.transaction.value }, "latest"]),
    !nativeInput
      ? queryEvmRpc(input.rpcUrl, "eth_call", [{ to: input.sellTokenAddress, data: balanceOfData }, "latest"])
      : Promise.resolve("0x0"),
  ]);
  if (!/^0x[0-9a-f]*$/iu.test(simulation)) throw new Error("Robinhood preflight returned an invalid simulation result.");
  const nativeRequired = BigInt(input.transaction.value) + BigInt(gasLimit) * BigInt(gasPrice);
  if (BigInt(nativeBalance) < nativeRequired) {
    throw new Error(`Insufficient ETH for this swap and network fee. Required about ${formatEvmUnits(nativeRequired, 18)} ETH, available ${formatEvmUnits(BigInt(nativeBalance), 18)} ETH.`);
  }
  if (!nativeInput && BigInt(tokenBalance) < BigInt(input.amountIn)) {
    throw new Error(`Insufficient ${input.sellToken}. Swap requires ${formatEvmUnits(BigInt(input.amountIn), input.sellTokenDecimals)} ${input.sellToken}, available ${formatEvmUnits(BigInt(tokenBalance), input.sellTokenDecimals)} ${input.sellToken}.`);
  }
}

async function assertEvmBridgeFunds(input: {
  rpcUrl: string;
  walletAddress: string;
  amountIn: string;
  transaction: { from: string; to: string; data: string; value: string };
}) {
  const balanceOfData = `0x70a08231000000000000000000000000${input.walletAddress.replace(/^0x/i, "").toLowerCase()}`;
  const [nativeBalance, usdgBalance, targetCode, gasLimit, gasPrice] = await Promise.all([
    queryEvmRpc(input.rpcUrl, "eth_getBalance", [input.walletAddress, "latest"]),
    queryEvmRpc(input.rpcUrl, "eth_call", [{ to: ROBINHOOD_USDG_ADDRESS, data: balanceOfData }, "latest"]),
    queryEvmRpc(input.rpcUrl, "eth_getCode", [input.transaction.to, "latest"]),
    queryEvmRpc(input.rpcUrl, "eth_estimateGas", [{ from: input.transaction.from, to: input.transaction.to, data: input.transaction.data, value: input.transaction.value }]),
    queryEvmRpc(input.rpcUrl, "eth_gasPrice", []),
  ]);
  if (targetCode === "0x" || targetCode === "0x0") throw new Error("Relay transaction target has no deployed contract code on Robinhood Chain.");
  if (BigInt(usdgBalance) < BigInt(input.amountIn)) {
    throw new Error(`Insufficient USDG. Bridge requires ${formatEvmUnits(BigInt(input.amountIn), 6)} USDG, available ${formatEvmUnits(BigInt(usdgBalance), 6)} USDG.`);
  }
  const requiredNative = BigInt(input.transaction.value) + BigInt(gasLimit) * BigInt(gasPrice);
  if (BigInt(nativeBalance) < requiredNative) {
    throw new Error(`Insufficient ETH for the bridge action and network fee. Required about ${formatEvmUnits(requiredNative, 18)} ETH, available ${formatEvmUnits(BigInt(nativeBalance), 18)} ETH.`);
  }
  return {
    availableUsdg: formatEvmUnits(BigInt(usdgBalance), 6),
    availableEth: formatEvmUnits(BigInt(nativeBalance), 18),
    estimatedNetworkFeeEth: formatEvmUnits(BigInt(gasLimit) * BigInt(gasPrice), 18),
  };
}

  // Fetch the single connected Mainnet wallet through the configured RPC.
  const fetchWalletBalance = useCallback(async () => {
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const dashboardWallet = linkedWallets.find((linked) => linked.namespace === "solana") ?? linkedWallets.find((linked) => linked.address.toLowerCase() === accountWalletAddress?.toLowerCase()) ?? linkedWallets[0];
    const targetWorkspace = activeSession?.workspace === "evm" ? "evm" : activeSession ? "solana" : dashboardWallet?.namespace;
    const targetAddress = activeSession?.sessionWalletAddress ?? dashboardWallet?.address ?? accountWalletAddress;
    const requestId = ++portfolioRequestRef.current;
    setWalletBalance(null);
    setPortfolioAssets([]);
    setPortfolioTotalUsd(null);
    if (!targetWorkspace || !targetAddress) {
      setPortfolioStatus("Link a wallet to view its portfolio.");
      return;
    }
    setPortfolioStatus("Refreshing Mainnet balance...");
    try {
      if (targetWorkspace === "evm") {
        const address = targetAddress || activeEvmAddress;
        if (!address) throw new Error("No EVM wallet connected to this session.");
        const rpcUrl = DEFAULT_ROBINHOOD_RPC;
        const balanceOfData = `0x70a08231000000000000000000000000${address.replace(/^0x/i, "").toLowerCase()}`;
        const portfolioRpc = async (method: string, params: unknown[]) => {
          try {
            return await queryEvmRpc(rpcUrl, method, params);
          } catch (error) { throw error; }
        };

        const ethPriceRequest = fetch("/api/evm/uniswap/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: address, sellToken: "ETH", buyToken: "USDG", amount: "1", slippageBps: "100" }),
            }).then(async (response) => {
              const result = await response.json() as { outputAmount?: string };
              return response.ok && typeof result.outputAmount === "string" ? Number(BigInt(result.outputAmount)) / 1e6 : null;
            }).catch(() => null);

        const tokenBalancesRequest = fetch(`/api/evm/portfolio?walletAddress=${encodeURIComponent(address)}`, { cache: "no-store" })
          .then(async (response) => {
            const result = await response.json() as { tokens?: Array<{ address: string; symbol: string; decimals: number; rawBalance: string; exchangeRate: number | null }> };
            return response.ok && Array.isArray(result.tokens) ? result.tokens : [];
          }).catch(() => []);

        const [nativeHex, usdgHex, blockHex, ethPriceUsd, indexedTokens] = await Promise.all([
          portfolioRpc("eth_getBalance", [address, "latest"]),
          portfolioRpc("eth_call", [{ to: ROBINHOOD_USDG_ADDRESS, data: balanceOfData }, "latest"]).catch(() => "0x0"),
          portfolioRpc("eth_blockNumber", []).catch(() => null),
          ethPriceRequest,
          tokenBalancesRequest,
        ]);

        const ethAmount = typeof nativeHex === "string" ? Number(BigInt(nativeHex)) / 1e18 : 0;
        const usdgAmount = typeof usdgHex === "string" ? Number(BigInt(usdgHex)) / 1e6 : 0;
        const ethValueUsd = typeof ethPriceUsd === "number" && Number.isFinite(ethPriceUsd) && ethPriceUsd > 0 ? ethAmount * ethPriceUsd : 0;

        if (requestId !== portfolioRequestRef.current) return;

        setWalletBalance(ethAmount);
        const proposalTokenAddresses = new Set(messagesRef.current.flatMap((message) => {
          const proposal = message.proposal;
          return [proposal?.sellTokenAddress, proposal?.buyTokenAddress].filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase());
        }));
        const erc20Assets = indexedTokens
          .filter((token) => token.address !== ROBINHOOD_USDG_ADDRESS && (token.exchangeRate !== null || token.address === ROBINHOOD_WETH_ADDRESS || proposalTokenAddresses.has(token.address)))
          .map((token) => {
            const amount = Number(BigInt(token.rawBalance)) / (10 ** token.decimals);
            const price = token.address === ROBINHOOD_WETH_ADDRESS && ethPriceUsd ? ethPriceUsd : token.exchangeRate;
            return { symbol: token.symbol, amount, valueUsd: price && Number.isFinite(price) ? amount * price : 0 };
          })
          .filter((asset) => Number.isFinite(asset.amount) && asset.amount > 0)
          .sort((a, b) => b.valueUsd - a.valueUsd);
        const robinhoodAssets = [
          { symbol: "ETH", amount: ethAmount, valueUsd: ethValueUsd },
          ...(usdgAmount > 0 ? [{ symbol: "USDG", amount: usdgAmount, valueUsd: usdgAmount }] : []),
          ...erc20Assets,
        ].map((asset) => ({ ...asset, network: "Robinhood" as const }));
        let assets = robinhoodAssets;
        let totalUsd = robinhoodAssets.reduce((total, asset) => total + asset.valueUsd, 0);
        let linkedSolanaLoaded = 0;
        if (!activeSession) {
          const solanaWallets = linkedWallets.filter((wallet, index, wallets) => wallet.namespace === "solana" && wallets.findIndex((candidate) => candidate.namespace === "solana" && candidate.address === wallet.address) === index);
          const solanaResults = await Promise.allSettled(solanaWallets.map(async (wallet) => {
            const response = await fetch("/api/solana/portfolio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: wallet.address }),
            });
            const result = await response.json() as { assets?: Array<{ symbol: string; amount: number; valueUsd: number }>; totalUsd?: number; error?: string };
            if (!response.ok) throw new Error(result.error || "Solana portfolio could not be loaded.");
            return result;
          }));
          const loadedSolana = solanaResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
          linkedSolanaLoaded = loadedSolana.length;
          assets = [...robinhoodAssets, ...loadedSolana.flatMap((portfolio) => (portfolio.assets ?? []).map((asset) => ({ ...asset, network: "Solana" as const })))].sort((left, right) => right.valueUsd - left.valueUsd);
          totalUsd += loadedSolana.reduce((sum, portfolio) => sum + (typeof portfolio.totalUsd === "number" ? portfolio.totalUsd : 0), 0);
        }
        setPortfolioAssets(assets);
        setPortfolioTotalUsd(totalUsd);
        const block = typeof blockHex === "string" ? Number.parseInt(blockHex, 16) : null;
        const rpcLabel = "Robinhood RPC";
        const priceLabel = ethValueUsd > 0 ? "ETH priced via Uniswap" : "ETH price unavailable";
        setPortfolioStatus(!activeSession && linkedSolanaLoaded > 0
          ? `Robinhood Chain + Solana · ${1 + linkedSolanaLoaded} linked wallets`
          : `${rpcLabel}${Number.isFinite(block) ? ` · block #${block}` : ""} · ${priceLabel}`);
        return;
      }

      const solanaPortfolioAddress = targetAddress;
      if (!solanaPortfolioAddress) throw new Error("No Solana wallet is bound to this session.");
      const response = await fetch("/api/solana/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: solanaPortfolioAddress,
        }),
      });
      const result = await response.json() as { sol?: number; assets?: any[]; totalUsd?: number; slot?: number; source?: string; error?: string };
      if (!response.ok || typeof result.sol !== "number") {
        throw new Error(typeof result.error === "string" ? result.error : "Mainnet balance could not be loaded.");
      }
      if (requestId !== portfolioRequestRef.current) return;
      setWalletBalance(result.sol);
      setPortfolioAssets(result.assets ?? []);
      const spotTotal = typeof result.totalUsd === "number" ? result.totalUsd : null;
      setPortfolioTotalUsd(spotTotal);
      const source = "Mirae managed Mainnet RPC";
      setPortfolioStatus(`${source}${typeof result.slot === "number" ? ` - slot ${result.slot.toLocaleString()}` : ""}`);

      // Perps equity sits on the exchange, so the portfolio total only tells the
      // whole story once collateral and open PnL are added to the spot holdings.
      fetch(`/api/perps/account?walletAddress=${encodeURIComponent(solanaPortfolioAddress)}`, { cache: "no-store" })
        .then((perpsResponse) => perpsResponse.ok ? perpsResponse.json() : null)
        .then((perps: { account?: { collateralUsd: number; unrealizedPnlUsd: number; accountExists: boolean; positions: Array<{ symbol: string; direction: "long" | "short"; baseAmount: number; unrealizedPnlUsd: number }> } } | null) => {
          if (requestId !== portfolioRequestRef.current) return;
          const account = perps?.account;
          if (!account?.accountExists) {
            setPerpEquity(null);
            return;
          }
          setPerpEquity({
            collateralUsd: account.collateralUsd,
            unrealizedPnlUsd: account.unrealizedPnlUsd,
            positions: account.positions,
          });
          const equity = account.collateralUsd + account.unrealizedPnlUsd;
          if (spotTotal !== null && equity !== 0) setPortfolioTotalUsd(spotTotal + equity);
        })
        .catch(() => {
          // Perps are additive to the portfolio; a failed read must not blank the spot view.
          if (requestId === portfolioRequestRef.current) setPerpEquity(null);
        });
    } catch (error) {
      if (requestId !== portfolioRequestRef.current) return;
      setWalletBalance(null);
      setPortfolioAssets([]);
      setPortfolioTotalUsd(null);
      setPerpEquity(null);
      setPortfolioStatus(error instanceof Error ? error.message : "Mainnet balance could not be loaded.");
    }
  }, [activeSessionId, sessions, linkedWallets, accountWalletAddress, activeEvmAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWalletBalance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeSessionId, fetchWalletBalance]);

  // --------------------------------------------------------------------------
  // SESSION HANDLERS (IndexedDB CRUD)
  // --------------------------------------------------------------------------
  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const target = sessions.find((session) => session.id === id);
    if (target) setDeleteTarget(target);
  }

  function handleDeleteAllSessions() {
    if (sessions.length > 0) setDeleteTarget("all");
  }

  async function confirmDeleteSessions() {
    if (!accountWalletAddress) return;
    const target = deleteTarget;
    if (!target) return;
    setDeletingSessions(true);
    try {
      if (target === "all") {
        await deleteAllSessions(accountWalletAddress);
        setSessions([]);
        setActiveSessionId("");
        writeSessionQuery("", "replace");
        setMessages([]);
        setInput("");
      } else {
        await deleteSession(accountWalletAddress, target.id);
        const updated = await getAllSessions(accountWalletAddress);
        setSessions(updated);
        if (activeSessionId === target.id) {
          const nextSession = updated[0];
          setMessages([]);
          selectSession(nextSession?.id ?? "", "replace");
        }
      }
      setDeleteTarget(null);
    } finally {
      setDeletingSessions(false);
    }
  }

  function openNewSession(prompt = "", sessionMode: "agent" | "mission" = "agent") {
    setPendingSessionPrompt(prompt.trim() || null);
    setNewSessionMode(sessionMode);
    setSessionModalKey((value) => value + 1);
    setInput("");
    setShowSessionModal(true);
  }

  // --------------------------------------------------------------------------
  // CHAT & EXECUTION ENGINE HANDLERS
  // --------------------------------------------------------------------------
  async function handleSendMessage(promptText?: string) {
    const text = promptText || input;
    if (!accountWalletAddress || !activeSessionId || !text.trim() || loading) return;
    const requestWalletAddress = accountWalletAddress;

    const activeSessionMessages = messages.filter((m) => m.sessionId === activeSessionId);
    const userMsg: WebMessage = {
      id: `user_${Date.now()}`,
      sessionId: activeSessionId,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    if (!promptText) setInput("");
    setLoading(true);

    setMessages((prev) => {
      const next = [...prev.filter((m) => m.sessionId === activeSessionId), userMsg];
      messagesRef.current = next;
      return next;
    });
    const savedUserMsg = await saveMessage(accountWalletAddress, userMsg);
    if (savedUserMsg) {
      setMessages((prev) => {
        const next = prev.map((message) => message.id === userMsg.id ? savedUserMsg : message);
        messagesRef.current = next;
        return next;
      });
    }

    try {
  const activeSession = sessions.find((session) => session.id === activeSessionId);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...activeSessionMessages, userMsg],
          mode,
          sessionMode: activeSession?.filter === "mission" || activeSession?.filter === "pump" ? "mission" : "agent",
          walletAddress: accountWalletAddress,
          workspace: activeSession?.workspace ?? "solana",
          chainKey: activeSession?.chainKey,
          sessionWalletAddress: activeSession?.sessionWalletAddress ?? accountWalletAddress,
          sessionId: activeSession?.id,
        }),
      });
      const data = await res.json();
      if (activeWalletAddressRef.current !== requestWalletAddress) return;

      const assistantMsg: WebMessage = {
        id: `asst_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: typeof data.content === "string"
          ? data.content
          : "The AI response was invalid. No Mainnet action was attempted.",
        proposal: data.proposal,
        usage: parseWebUsage(data.usage, "server-managed"),
        createdAt: Date.now(),
      };

      const savedAssistantMsg = await saveMessage(accountWalletAddress, assistantMsg);
      const displayedAssistantMsg = savedAssistantMsg ?? assistantMsg;
      setMessages((prev) => {
        const next = [...prev.filter((m) => m.sessionId === activeSessionId), displayedAssistantMsg];
        messagesRef.current = next;
        return next;
      });
      if (data.automationCreated === true) void refreshAutomation();

      // Update session timestamp in IndexedDB
      const activeSess = sessions.find((s) => s.id === activeSessionId);
      if (activeSess) {
        const updated = { ...activeSess, updatedAt: Date.now() };
        await saveSession(accountWalletAddress, updated);
        const reloaded = await getAllSessions(accountWalletAddress);
        setSessions(reloaded);
      }
    } catch {
      if (activeWalletAddressRef.current !== requestWalletAddress) return;
      const errMsg: WebMessage = {
        id: `err_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: "Failed to connect to AI Trading service. Please check your network and try again.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(accountWalletAddress, errMsg);
    } finally {
      if (activeWalletAddressRef.current === requestWalletAddress) {
        setLoading(false);
      }
    }
  }

  async function handleTokenLaunchDraftPublished(draft: PublishedTokenLaunchDraft) {
    if (!accountWalletAddress || !activeSession || activeSession.workspace !== "solana" || !activeSession.sessionWalletAddress) return;
    const message: WebMessage = {
      id: `launch_${Date.now()}`,
      sessionId: activeSession.id,
      role: "assistant",
      content: `Token Launch draft ${draft.name} (${draft.symbol}) was created${draft.creatorBuyLamports === "0" ? " without a creator buy" : ` with a ${(Number(draft.creatorBuyLamports) / 1_000_000_000).toFixed(9).replace(/0+$/u, "").replace(/\.$/u, "")} SOL creator buy`}. Metadata has been published to IPFS; no transaction, signature, or broadcast was created.`,
      createdAt: Date.now(),
      proposal: {
        id: `token_launch_${crypto.randomUUID()}`,
        type: "token_launch",
        mint: draft.metadataUri,
        solAmount: "0",
        estimatedTokens: draft.symbol,
        status: "preview_only",
        mode: "restricted_browser_wallet",
        explanation: "Pump.fun create_v2 requires one unsigned Mainnet simulation followed by explicit browser-wallet approval.",
        venue: "Pump.fun create_v2",
        launchName: draft.name,
        launchSymbol: draft.symbol,
        launchDescription: draft.description,
        launchImageUri: draft.imageUri,
        launchMetadataUri: draft.metadataUri,
        launchMetadataGatewayUrl: draft.metadataGatewayUrl,
        launchMetadataSha256: draft.metadataSha256,
        launchCreatorWallet: activeSession.sessionWalletAddress,
        launchStage: "draft",
        launchCreatorBuyLamports: draft.creatorBuyLamports,
        maxCreatorOutflowLamports: draft.maxCreatorOutflowLamports,
        maxPriorityFeeLamports: draft.maxPriorityFeeLamports,
      },
    };
    const saved = await saveMessage(accountWalletAddress, message);
    const displayed = saved ?? message;
    setMessages((current) => {
      const next = [...current.filter((item) => item.sessionId === activeSession.id), displayed];
      messagesRef.current = next;
      return next;
    });
    setShowTokenLaunchPanel(false);
  }

  /**
   * The panel only creates the typed proposal and immediately runs preflight, so
   * a perps order reaches the wallet through the same preview → simulate → sign
   * path a chat-created proposal does.
   */
  async function handlePerpsPanelSubmit(request: PerpOrderRequest) {
    if (!accountWalletAddress || !activeSession || activeSession.workspace !== "solana" || !activeSession.sessionWalletAddress) return;
    const label = request.action === "close"
      ? `A reduce-only close for ${request.symbol}-PERP is ready to prepare.`
      : `A ${request.direction} ${request.symbol}-PERP order is ready to prepare.`;
    const message: WebMessage = {
      id: `perp_${Date.now()}`,
      sessionId: activeSession.id,
      role: "assistant",
      content: `${label} Preflight simulates the transaction unsigned on Mainnet; nothing has been signed or broadcast.`,
      createdAt: Date.now(),
      proposal: {
        id: `perp_${crypto.randomUUID()}`,
        type: "perp_order",
        mint: "",
        solAmount: "0",
        estimatedTokens: "Preflight pending",
        status: "preview_only",
        mode: "restricted_browser_wallet",
        venue: "Phoenix Perpetuals",
        explanation: "Application code resolves the size against the live oracle, enforces the notional ceiling, and simulates the transaction unsigned. Your wallet performs the only signature.",
        perpMarket: `${request.symbol}-PERP`,
        // A close resolves its side from the live position during preflight.
        // A close resolves its side from the live position during preflight.
        perpDirection: request.action === "open" ? request.direction : undefined,
        perpReduceOnly: request.action === "close",
        perpBaseAmount: request.action === "open" ? request.baseAmount : undefined,
        perpNotionalUsd: request.action === "open" ? request.notionalUsd : undefined,
        perpCollateralUsdc: request.action === "open" ? request.collateralUsdc : undefined,
        perpStage: "draft",
      },
    };
    const saved = await saveMessage(accountWalletAddress, message);
    const displayed = saved ?? message;
    setMessages((current) => {
      const next = [...current.filter((item) => item.sessionId === activeSession.id), displayed];
      messagesRef.current = next;
      return next;
    });
    setShowPerpsPanel(false);
    perpRequestsRef.current.set(displayed.proposal!.id, request);
    await handlePreparePerpOrder(displayed.proposal!, displayed.id);
  }

  /**
   * One click on Long or Short carries the order all the way to the wallet:
   * the side is recorded, preflight simulates it unsigned, and the approval
   * prompt opens on its own. The signature itself can never be skipped — this
   * app holds no key — so that stays a deliberate act by the user.
   */
  async function handleChoosePerpDirection(proposal: WebProposal, messageId: string, direction: "long" | "short") {
    const request = proposalToPerpRequest({ ...proposal, perpDirection: direction });
    if (!request) {
      await patchProposal(messageId, proposal.id, { perpError: "This proposal is missing its market or size. Create a new one from the PERPS panel." });
      return;
    }
    perpRequestsRef.current.set(proposal.id, request);
    await patchProposal(messageId, proposal.id, { perpDirection: direction, perpError: undefined });
    const prepared = await handlePreparePerpOrder({ ...proposal, perpDirection: direction }, messageId);
    if (prepared) await handleExecutePerpOrder(prepared, messageId);
  }

  /** Returns the prepared proposal so a caller can chain straight into signing. */
  async function handlePreparePerpOrder(proposal: WebProposal, messageId: string): Promise<WebProposal | null> {
    if (!activeSession || activeSession.workspace !== "solana") {
      await patchProposal(messageId, proposal.id, { perpError: "Open the Solana session bound to this wallet to trade perpetuals." });
      return null;
    }
    if (!connected || !publicKey || !walletAddress) {
      setSolanaWalletVisible(true);
      await patchProposal(messageId, proposal.id, { perpError: `Connect ${shortWallet(activeSession.sessionWalletAddress)} in the browser wallet, then run preflight again.` });
      return null;
    }
    if (activeSession.sessionWalletAddress !== walletAddress) {
      await patchProposal(messageId, proposal.id, { perpError: "The connected Solana wallet does not match this session." });
      return null;
    }
    const request = perpRequestsRef.current.get(proposal.id) ?? proposalToPerpRequest(proposal);
    if (!request) {
      await patchProposal(messageId, proposal.id, { perpError: "This perpetuals proposal is missing its market or size. Create a new one from the PERPS panel." });
      return null;
    }
    setPerpBusyId(proposal.id);
    await patchProposal(messageId, proposal.id, { perpStage: "preflight", perpError: undefined });
    try {
      const response = await fetch("/api/perps/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, sessionId: activeSession.id, walletAddress }),
      });
      const result = await response.json();
      if (!response.ok || !result.plan?.transactionBase64) throw new Error(result.error || "The perpetuals preflight failed safely.");
      const plan = result.plan;
      const patch = {
        status: "ready_for_user_signature" as const,
        perpStage: "ready" as const,
        perpMarket: plan.symbol,
        perpDirection: plan.direction,
        perpReduceOnly: plan.reduceOnly,
        perpBaseAmount: plan.baseAmount,
        perpNotionalUsd: plan.notionalUsd,
        perpOraclePriceUsd: plan.oraclePriceUsd,
        perpLimitPriceUsd: plan.limitPriceUsd ?? undefined,
        perpNetworkFeeLamports: plan.networkFeeLamports,
        perpTransactionBase64: plan.transactionBase64,
        perpTransactionDigest: plan.transactionDigest,
        perpExpiresAt: plan.expiresAt,
        perpError: undefined,
        checks: Array.isArray(plan.checks)
          ? plan.checks.map((message: string, index: number) => ({ code: `perp_${index}`, status: "pass" as const, message }))
          : proposal.checks,
      };
      await patchProposal(messageId, proposal.id, patch);
      return { ...proposal, ...patch };
    } catch (cause) {
      await patchProposal(messageId, proposal.id, {
        perpStage: "draft",
        perpError: normalizeWalletActionError(cause, "The perpetuals preflight failed safely."),
      });
      return null;
    } finally {
      setPerpBusyId(null);
    }
  }

  async function handleExecutePerpOrder(proposal: WebProposal, messageId: string) {
    if (!signTransaction || !walletAddress || !activeSession || !proposal.perpTransactionBase64) {
      await patchProposal(messageId, proposal.id, { perpStage: "draft", perpError: "The simulated order expired. Run preflight again." });
      return;
    }
    if (proposal.perpExpiresAt && Date.now() >= proposal.perpExpiresAt) {
      await patchProposal(messageId, proposal.id, { perpStage: "draft", perpError: "The simulated blockhash expired. Run preflight again." });
      return;
    }
    setPerpBusyId(proposal.id);
    try {
      const transaction = VersionedTransaction.deserialize(base64ToBytes(proposal.perpTransactionBase64));
      const signed = await signTransaction(transaction);
      const response = await fetch("/api/perps/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          walletAddress,
          signedTransaction: bytesToBase64(signed.serialize()),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The perpetuals order was not broadcast.");
      await patchProposal(messageId, proposal.id, {
        status: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : "submitted",
        perpStage: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : result.status === "unknown" ? "unknown" : "submitted",
        perpSignature: result.signature,
        perpExplorerUrl: result.explorerUrl,
        perpError: result.error,
      });
      if (result.status === "confirmed") void refreshPortfolio();
    } catch (cause) {
      await patchProposal(messageId, proposal.id, { perpError: normalizeWalletActionError(cause, "The perpetuals order was not submitted.") });
    } finally {
      setPerpBusyId(null);
    }
  }

  async function handlePrepareTokenLaunch(proposal: WebProposal, messageId: string) {
    if (!activeSession || activeSession.workspace !== "solana") {
      await patchProposal(messageId, proposal.id, { launchError: "Open the Solana session that owns this Token Launch draft." });
      return;
    }
    if (!connected || !publicKey || !walletAddress) {
      setSolanaWalletVisible(true);
      await patchProposal(messageId, proposal.id, { launchError: `This Solana session is active, but the browser wallet extension is disconnected. Connect ${shortWallet(activeSession.sessionWalletAddress)} and run preflight again.` });
      return;
    }
    if (activeSession.sessionWalletAddress !== walletAddress || proposal.launchCreatorWallet !== walletAddress) {
      await patchProposal(messageId, proposal.id, { launchError: "The connected Solana wallet does not match this Token Launch session." });
      return;
    }
    if (!proposal.launchName || !proposal.launchSymbol || !proposal.launchMetadataUri) return;
    setTokenLaunchBusyId(proposal.id);
    try {
      let mintSigner = tokenLaunchMintSignersRef.current.get(proposal.id);
      if (!mintSigner) {
        mintSigner = Keypair.generate();
        tokenLaunchMintSignersRef.current.set(proposal.id, mintSigner);
      }
      const response = await fetch("/api/token-launch/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          walletAddress,
          mintAddress: mintSigner.publicKey.toBase58(),
          name: proposal.launchName,
          symbol: proposal.launchSymbol,
          metadataUri: proposal.launchMetadataUri,
          maxCreatorOutflowLamports: proposal.maxCreatorOutflowLamports ?? "10000000",
          maxPriorityFeeLamports: proposal.maxPriorityFeeLamports ?? "100000",
          creatorBuyLamports: proposal.launchCreatorBuyLamports ?? "0",
        }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.transactionBase64 !== "string") throw new Error(result.error || "Token Launch preflight failed safely.");
      await patchProposal(messageId, proposal.id, {
        launchError: undefined,
        status: "ready_for_user_signature",
        launchStage: "final-review",
        launchMintAddress: result.mintAddress,
        launchTransactionBase64: result.transactionBase64,
        launchTransactionDigest: result.transactionDigest,
        launchSimulationSlot: result.simulationSlot,
        launchComputeUnitsConsumed: result.computeUnitsConsumed,
        launchNetworkFeeLamports: result.networkFeeLamports,
        launchPriorityFeeLamports: result.priorityFeeLamports,
        launchRentLamports: result.rentLamports,
        launchTotalEstimatedOutflowLamports: result.totalEstimatedOutflowLamports,
        launchCreatorBuyLamports: result.creatorBuyLamports,
        launchMaximumCreatorBuyLamports: result.maximumCreatorBuyLamports,
        launchExpectedCreatorTokensRaw: result.expectedCreatorTokensRaw,
        launchCreatorBuySlippageBps: result.creatorBuySlippageBps,
        launchLastValidBlockHeight: result.lastValidBlockHeight,
        launchExpiresAt: result.expiresAt,
        launchError: undefined,
      });
    } catch (cause) {
      await patchProposal(messageId, proposal.id, { launchError: cause instanceof Error ? cause.message : "Token Launch preflight failed safely." });
    } finally {
      setTokenLaunchBusyId(null);
    }
  }

  async function handleExecuteTokenLaunch(proposal: WebProposal, messageId: string) {
    const mintSigner = tokenLaunchMintSignersRef.current.get(proposal.id);
    if (!signTransaction || !walletAddress || !activeSession || !mintSigner || !proposal.launchTransactionBase64 || !proposal.launchMintAddress) {
      await patchProposal(messageId, proposal.id, { launchError: "The final launch review expired. Prepare a fresh unsigned preflight." });
      return;
    }
    if (proposal.launchExpiresAt && Date.now() >= proposal.launchExpiresAt) {
      tokenLaunchMintSignersRef.current.delete(proposal.id);
      await patchProposal(messageId, proposal.id, { launchStage: "draft", launchError: "The launch blockhash expired. Prepare a fresh unsigned preflight." });
      return;
    }
    setTokenLaunchBusyId(proposal.id);
    try {
      const transaction = VersionedTransaction.deserialize(base64ToBytes(proposal.launchTransactionBase64));
      transaction.sign([mintSigner]);
      const signed = await signTransaction(transaction);
      const response = await fetch("/api/token-launch/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          walletAddress,
          mintAddress: proposal.launchMintAddress,
          signedTransaction: bytesToBase64(signed.serialize()),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Token Launch broadcast failed safely.");
      tokenLaunchMintSignersRef.current.delete(proposal.id);
      await patchProposal(messageId, proposal.id, {
        status: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : "submitted",
        launchStage: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : result.status === "unknown" ? "unknown" : "submitted",
        launchSignature: result.signature,
        launchExplorerUrl: result.explorerUrl,
        launchError: result.error,
      });
      if (result.status === "confirmed") void refreshPortfolio();
    } catch (cause) {
      const error = normalizeWalletActionError(cause, "Token Launch was not submitted.");
      await patchProposal(messageId, proposal.id, { launchError: error });
    } finally {
      setTokenLaunchBusyId(null);
    }
  }

  async function handleVerifyTokenLaunch(proposal: WebProposal, messageId: string) {
    if (!walletAddress || !proposal.launchSignature || !proposal.launchMintAddress) return;
    setTokenLaunchBusyId(proposal.id);
    try {
      const response = await fetch("/api/token-launch/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature: proposal.launchSignature, mintAddress: proposal.launchMintAddress }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Token Launch verification failed.");
      await patchProposal(messageId, proposal.id, {
        status: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : "submitted",
        launchStage: result.status === "confirmed" ? "confirmed" : result.status === "failed" ? "failed" : "unknown",
        launchExplorerUrl: result.explorerUrl ?? proposal.launchExplorerUrl,
        launchNetworkFeeLamports: result.networkFeeLamports == null ? proposal.launchNetworkFeeLamports : String(result.networkFeeLamports),
        launchError: result.error,
      });
      if (result.status === "confirmed") void refreshPortfolio();
    } catch (cause) {
      await patchProposal(messageId, proposal.id, { launchError: cause instanceof Error ? cause.message : "Token Launch verification failed." });
    } finally {
      setTokenLaunchBusyId(null);
    }
  }

  async function waitForSolanaHttpConfirmation(signature: string, ownerWallet: string): Promise<"confirmed" | "failed"> {
    const deadline = Date.now() + 45_000;
    let lastError = "";
    while (Date.now() < deadline) {
      try {
        const response = await fetch("/api/solana/transaction-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: ownerWallet, signature }),
        });
        const result = await response.json() as { status?: "confirmed" | "failed" | "pending"; error?: string };
        if (!response.ok) lastError = result.error || "HTTP confirmation request failed.";
        else if (result.status === "confirmed" || result.status === "failed") return result.status;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "HTTP confirmation request failed.";
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    }
    throw new Error(`Transaction was submitted but HTTP confirmation is still pending after 45 seconds.${lastError ? ` ${lastError}` : ""}`);
  }

  async function handlePrepareInvestment(input: InvestmentPrepareInput) {
    if (!activeSessionId || !accountWalletAddress || !walletAddress) return;
    const key = `${input.profileId}:${input.allocationIndex}`;
    setInvestmentBusyKey(key);
    try {
      const response = await fetch("/api/investment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, walletAddress }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The allocation could not be prepared.");
      const message: WebMessage = {
        id: `investment_prepare_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: typeof data.content === "string" ? data.content : "Allocation route refreshed.",
        proposal: data.proposal,
        createdAt: Date.now(),
      };
      const saved = await saveMessage(accountWalletAddress, message);
      setMessages((previous) => {
        const next = [...previous.filter((item) => item.sessionId === activeSessionId), saved ?? message];
        messagesRef.current = next;
        return next;
      });
    } catch (error) {
      const message: WebMessage = {
        id: `investment_error_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: `${error instanceof Error ? error.message : "The allocation could not be prepared."} No transaction was created.`,
        createdAt: Date.now(),
      };
      setMessages((previous) => [...previous.filter((item) => item.sessionId === activeSessionId), message]);
      await saveMessage(accountWalletAddress, message);
    } finally {
      setInvestmentBusyKey(null);
    }
  }

  async function handlePrepareStockSwap(token: OnChainStockToken, proposalId: string) {
    if (!activeSessionId || !accountWalletAddress || !walletAddress) return;
    setStockSwapBusyId(proposalId);
    try {
      const response = await fetch("/api/stock/swap-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          tokenMint: token.mint,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          tokenName: token.name,
          targetAmountUsd: 10,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The on-chain stock route could not be prepared.");
      const message: WebMessage = {
        id: `stock_swap_msg_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: typeof data.content === "string" ? data.content : `Jupiter route for ${token.symbol} is ready for review.`,
        proposal: data.proposal,
        createdAt: Date.now(),
      };
      const saved = await saveMessage(accountWalletAddress, message);
      setMessages((previous) => {
        const next = [...previous.filter((item) => item.sessionId === activeSessionId), saved ?? message];
        messagesRef.current = next;
        return next;
      });
    } catch (error) {
      const message: WebMessage = {
        id: `stock_swap_err_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: `${error instanceof Error ? error.message : "The swap route could not be prepared."} No transaction was created.`,
        createdAt: Date.now(),
      };
      setMessages((previous) => [...previous.filter((item) => item.sessionId === activeSessionId), message]);
      await saveMessage(accountWalletAddress, message);
    } finally {
      setStockSwapBusyId(null);
    }
  }

  async function handleExecuteJupiterSwap(proposal: WebProposal, msgId: string) {
    if (!connected || !publicKey || !walletAddress) {
      alert("Please connect your Solana wallet (Phantom / Solflare) first!");
      return;
    }
    if (activeSession?.workspace !== "solana") {
      alert("Jupiter Solana swap can only run from a bound Solana session.");
      return;
    }
    const activeWalletAddress = walletAddress;

    if (!proposal.quoteResponse) {
      const errMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: "Swap quote is missing. Ask the AI to refresh the proposal first.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(activeWalletAddress, errMsg);
      return;
    }

    let submittedSignature: string | null = null;
    let chainRejected = false;
    try {
      setMessages((prev) =>
        prev.map((m) =>
          (m.id === msgId || (m.proposal && m.proposal.id === proposal.id)) && m.proposal
            ? { ...m, proposal: { ...m.proposal, status: "signing" as const } }
            : m,
        ),
      );

      const swapRes = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: proposal.quoteResponse,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const swapData = await swapRes.json();
      if (!swapRes.ok || typeof swapData.swapTransaction !== "string") {
        throw new Error(swapData.error || "Jupiter did not return a transaction.");
      }
      const transaction = VersionedTransaction.deserialize(base64ToBytes(swapData.swapTransaction));
      const signature = await sendTransaction(transaction, connection, { skipPreflight: false, maxRetries: 2 });
      submittedSignature = signature;

      setMessages((prev) =>
        prev.map((m) => {
          if ((m.id === msgId || (m.proposal && m.proposal.id === proposal.id)) && m.proposal) {
            const updatedM = { ...m, proposal: { ...m.proposal, status: "submitted" as const, transactionSignature: signature } };
            void saveMessage(activeWalletAddress, updatedM);
            return updatedM;
          }
          return m;
        }),
      );

      const confirmation = await waitForSolanaHttpConfirmation(signature, activeWalletAddress);
      if (confirmation === "failed") {
        chainRejected = true;
        throw new Error("Solana rejected the swap.");
      }
      setMessages((prev) => prev.map((message) => {
        if ((message.id === msgId || message.proposal?.id === proposal.id) && message.proposal) {
          const updated = { ...message, proposal: { ...message.proposal, status: "confirmed" as const, transactionSignature: signature } };
          void saveMessage(activeWalletAddress, updated);
          return updated;
        }
        return message;
      }));

      if (proposal.automationProposalId) {
        // The swap is confirmed first; a tracking update must never relabel a
        // confirmed Mainnet transaction as failed if the monitor is briefly unavailable.
        try {
          const completion = await fetch("/api/automation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: activeWalletAddress, proposalId: proposal.automationProposalId, action: "complete", transactionSignature: signature }),
          });
          if (!completion.ok) console.warn("[Automation completion]", await completion.text());
          else await refreshAutomation();
        } catch (error) {
          console.warn("[Automation completion]", error);
        }
      }

      setTimeout(() => {
        void fetchWalletBalance();
      }, 1500);
      setTimeout(() => {
        void fetchWalletBalance();
      }, 5000);

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);

      const errMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: submittedSignature
          ? `${chainRejected ? "Swap was rejected on-chain" : "Swap was submitted, but confirmation could not be verified"}. Do not submit it again until you inspect the signature.\n\n${message}\n\n[Inspect transaction](https://solscan.io/tx/${submittedSignature})`
          : `Swap cancelled or failed before broadcast: ${message}`,
        createdAt: Date.now(),
      };

      setMessages((prev) => {
        const updated = prev.map((m) => {
          if ((m.id === msgId || (m.proposal && m.proposal.id === proposal.id)) && m.proposal) {
            const updatedM = { ...m, proposal: { ...m.proposal, status: submittedSignature ? (chainRejected ? "reverted" as const : "unknown" as const) : "failed" as const, transactionSignature: submittedSignature ?? m.proposal.transactionSignature } };
            void saveMessage(activeWalletAddress, updatedM);
            return updatedM;
          }
          return m;
        });
        return [...updated.filter((m) => m.sessionId === activeSessionId), errMsg];
      });
      await saveMessage(activeWalletAddress, errMsg);
    }
  }

  async function handlePrepareEvmSwap(proposal: WebProposal, msgId: string) {
    if (!activeSession || activeSession.workspace !== "evm" || activeSession.chainKey !== "robinhood") {
      alert("Robinhood EVM swap can only be prepared from a bound Robinhood session.");
      return;
    }
    const sessionWallet = activeSession.sessionWalletAddress;
    if (!sessionWallet) return;
    if (!proposal.sellToken || !proposal.buyToken || !proposal.sellAmount) return;
    setBridgeBusy(true);
    let submittedEvmHash: string | null = null;
    let evmSwapStage: "quote" | "build" | "preflight" | "wallet" | "confirmation" = proposal.quoteResponse && proposal.buyAmount ? "build" : "quote";
    try {
      if (proposal.quoteResponse && proposal.buyAmount) {
        await switchToRobinhoodChain();
        const walletProvider = window.ethereum;
        if (!walletProvider) throw new Error("EVM wallet extension is not available.");
        const [accounts, chainIdHex, latestBlock, gasPrice] = await Promise.all([
          walletProvider.request({ method: "eth_accounts" }),
          walletProvider.request({ method: "eth_chainId" }),
          walletProvider.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
          walletProvider.request({ method: "eth_gasPrice" }),
        ]);
        const currentAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
        const currentChainId = typeof chainIdHex === "string" ? Number.parseInt(chainIdHex, 16) : null;
        setActiveEvmAddress(currentAddress);
        setActiveEvmChainId(currentChainId);
        if (currentAddress?.toLowerCase() !== sessionWallet.toLowerCase() || currentChainId !== expectedEvmChain?.chainId) {
          throw new Error(`Switch the browser wallet to ${shortWallet(sessionWallet)} on Robinhood Chain before reviewing this transaction.`);
        }
        if (!latestBlock || typeof gasPrice !== "string" || !/^0x[0-9a-f]+$/iu.test(gasPrice)) {
          throw new Error("Wallet RPC could not retrieve Robinhood block and gas data.");
        }
        setMessages((previous) => previous.map((message) => (message.id === msgId && message.proposal ? { ...message, proposal: { ...message.proposal, status: "signing" as const } } : message)));
        const buildResponse = await fetch("/api/evm/uniswap/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: sessionWallet, quote: proposal.quoteResponse, routing: proposal.quoteRouting, tokenIn: proposal.sellTokenAddress, tokenOut: proposal.buyTokenAddress, amountIn: proposal.inputAmount }) });
        const buildRaw = await buildResponse.text();
        let built: { error?: string; approvalRequired?: boolean; approval?: { from: string; to: string; data: string; value: string }; transaction?: { from: string; to: string; data: string; value: string } };
        try {
          built = JSON.parse(buildRaw) as typeof built;
        } catch {
          throw new Error(`Transaction builder returned HTTP ${buildResponse.status} with an invalid response. Request a fresh quote and try again.`);
        }
        if (!buildResponse.ok) throw new Error(built.error || "Uniswap could not build the wallet transaction.");
        const provider = window.ethereum;
        if (!provider) throw new Error("EVM wallet extension is not available.");
        const transactionForPreflight = built.approvalRequired === true ? built.approval : built.transaction;
        if (!transactionForPreflight) throw new Error("Uniswap did not return a wallet transaction for balance verification.");
        evmSwapStage = "preflight";
        await assertEvmSwapFunds({
          rpcUrl: DEFAULT_ROBINHOOD_RPC,
          walletAddress: sessionWallet,
          sellToken: proposal.sellToken,
          sellTokenAddress: proposal.sellTokenAddress!,
          sellTokenDecimals: proposal.sellTokenDecimals ?? 18,
          amountIn: proposal.inputAmount,
          transaction: transactionForPreflight,
        });
        const sendAndConfirm = async (transaction: { from: string; to: string; data: string; value: string }) => {
          evmSwapStage = "wallet";
          const hash = await provider.request({ method: "eth_sendTransaction", params: [transaction] });
          if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/iu.test(hash)) throw new Error("Wallet did not return a valid transaction hash.");
          submittedEvmHash = hash;
          evmSwapStage = "confirmation";
          for (let attempt = 0; attempt < 24; attempt += 1) {
            const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
            if (receipt && typeof receipt === "object") {
              const status = (receipt as { status?: unknown }).status;
              if (status === "0x0" || status === 0) throw new Error(`Transaction reverted on Robinhood Chain: ${hash}`);
              return hash;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 2_500));
          }
          throw new Error(`Transaction was submitted but confirmation is still pending: ${hash}`);
        };
        if (built.approvalRequired === true && built.approval) {
          const approvalHash = await sendAndConfirm(built.approval);
          submittedEvmHash = null;
          setMessages((previous) => previous.map((message) => (message.id === msgId && message.proposal ? { ...message, proposal: { ...message.proposal, status: "ready_for_user_signature" as const } } : message)));
          const info: WebMessage = { id: `sys_${Date.now()}`, sessionId: activeSessionId, role: "assistant", content: `Token allowance confirmed. Click **REVIEW IN WALLET** once more to review and sign the swap transaction.\n\n[Open approval in Robinhood Explorer](https://robinhoodchain.blockscout.com/tx/${approvalHash})`, createdAt: Date.now() };
          setMessages((previous) => [...previous.filter((message) => message.sessionId === activeSessionId), info]);
          await saveMessage(walletAddress, info);
          return;
        }
        if (!built.transaction) throw new Error("Uniswap did not return a swap transaction.");
        const swapHash = await sendAndConfirm(built.transaction);
        setMessages((previous) => previous.map((message) => {
          if ((message.id === msgId || message.proposal?.id === proposal.id) && message.proposal) {
            const updated = { ...message, proposal: { ...message.proposal, status: "confirmed" as const, transactionHash: swapHash } };
            void saveMessage(walletAddress, updated);
            return updated;
          }
          return message;
        }));
        if (proposal.automationProposalId) {
          try {
            const completion = await fetch("/api/evm/automation", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: sessionWallet, proposalId: proposal.automationProposalId, action: "complete", transactionHash: swapHash }),
            });
            if (!completion.ok) console.warn("[EVM automation completion]", await completion.text());
            else await refreshAutomation();
          } catch (error) { console.warn("[EVM automation completion]", error); }
        }
        void fetchWalletBalance();
        return;
      }
      const response = await fetch("/api/evm/uniswap/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: sessionWallet, sellToken: proposal.sellTokenAddress ?? proposal.sellToken, buyToken: proposal.buyTokenAddress ?? proposal.buyToken, amount: proposal.sellAmount }) });
      const rawResponse = await response.text();
      let quote: { quote?: unknown; routing?: "CLASSIC" | "WRAP" | "UNWRAP"; outputAmount?: unknown; error?: unknown; amountIn?: unknown; minimumOutputAmount?: unknown; estimatedNetworkFeeUsd?: unknown; slippageBps?: unknown; expiresAt?: unknown; sellToken?: { address: string; symbol: string; decimals: number }; buyToken?: { address: string; symbol: string; decimals: number } };
      try {
        quote = JSON.parse(rawResponse) as typeof quote;
      } catch {
        throw new Error(`Robinhood quote endpoint returned HTTP ${response.status}, not JSON: ${rawResponse.slice(0, 180)}`);
      }
      if (!response.ok || !quote.quote || typeof quote.outputAmount !== "string") throw new Error(typeof quote.error === "string" ? quote.error : "Uniswap did not return a valid Robinhood quote.");
      setMessages((previous) => previous.map((message) => {
        if ((message.id === msgId || message.proposal?.id === proposal.id) && message.proposal) {
          const updated = { ...message, proposal: { ...message.proposal, quoteResponse: quote.quote, quoteRouting: quote.routing, inputAmount: quote.amountIn, buyAmount: quote.outputAmount, minimumBuyAmount: quote.minimumOutputAmount, estimatedNetworkFeeUsd: typeof quote.estimatedNetworkFeeUsd === "string" ? quote.estimatedNetworkFeeUsd : undefined, slippageBps: typeof quote.slippageBps === "number" || typeof quote.slippageBps === "string" ? String(quote.slippageBps) : undefined, quoteExpiresAt: quote.expiresAt, sellToken: quote.sellToken?.symbol ?? message.proposal.sellToken, buyToken: quote.buyToken?.symbol ?? message.proposal.buyToken, sellTokenAddress: quote.sellToken?.address ?? message.proposal.sellTokenAddress, buyTokenAddress: quote.buyToken?.address ?? message.proposal.buyTokenAddress, sellTokenDecimals: quote.sellToken?.decimals ?? message.proposal.sellTokenDecimals, buyTokenDecimals: quote.buyToken?.decimals ?? message.proposal.buyTokenDecimals, status: "ready_for_user_signature" as const } };
          void saveMessage(walletAddress, updated);
          return updated;
        }
        return message;
      }));

    } catch (error) {
      const walletErrorCode = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
      const wasCancelled = walletErrorCode === 4001 || walletErrorCode === "4001";
      if (wasCancelled) console.info("[EVM swap preparation] Wallet approval cancelled by user.");
      else console.error("[EVM swap preparation]", error);
      const serializedError = typeof error === "string" ? error : JSON.stringify(error);
      const rawMessage = error instanceof Error ? error.message : serializedError || "Unable to prepare the EVM quote.";
      const transactionReverted = Boolean(submittedEvmHash) && /transaction reverted/iu.test(rawMessage);
      const message = wasCancelled
        ? "Wallet approval cancelled. No transaction was signed or broadcast."
        : evmSwapStage === "wallet" && /JSON\.parse|unexpected character|unexpected token/iu.test(rawMessage)
        ? "Your wallet extension received an invalid response from its Robinhood Chain network. No transaction hash was returned. Reload the wallet network, then request a fresh quote. Mirae's own reads continue to use the server-managed RPC."
        : rawMessage.includes("RPC endpoint returned too many errors") || rawMessage.includes("eth_getBlockByNumber")
        ? "The Robinhood RPC in your wallet extension is failing or rate-limited. No transaction was broadcast. Reload the wallet network and request a fresh quote; Mirae's own reads use the server-configured RPC."
        : rawMessage;
      if (submittedEvmHash) {
        setMessages((previous) => previous.map((entry) => (entry.id === msgId && entry.proposal ? { ...entry, proposal: { ...entry.proposal, status: transactionReverted ? "reverted" as const : "unknown" as const } } : entry)));
      } else {
        setMessages((previous) => previous.map((entry) => (entry.id === msgId && entry.proposal && entry.proposal.status === "signing" ? { ...entry, proposal: { ...entry.proposal, status: "ready_for_user_signature" as const } } : entry)));
      }
      const failure: WebMessage = { id: `sys_${Date.now()}`, sessionId: activeSessionId, role: "assistant", content: submittedEvmHash ? `${transactionReverted ? "Swap reverted on Robinhood Chain. The swap did not complete; only network gas was consumed." : "Swap was submitted, but confirmation is unknown. Do not submit it again until you inspect the transaction."}\n\n${message}\n\n[Open transaction in Robinhood Explorer](https://robinhoodchain.blockscout.com/tx/${submittedEvmHash})` : message, createdAt: Date.now() };
      setMessages((previous) => [...previous.filter((item) => item.sessionId === activeSessionId), failure]);
      await saveMessage(walletAddress, failure);
    } finally {
      setBridgeBusy(false);
    }
  }

  useEffect(() => {
    if (!activeSession || activeSession.workspace !== "evm" || activeSession.chainKey !== "robinhood" || sessionMessagesLoading) return;
    const proposalMessage = messages.find((message) =>
      message.sessionId === activeSession.id
      && message.proposal?.type === "evm_swap"
      && !message.proposal.quoteResponse
      && !["signing", "submitted", "confirmed", "unknown"].includes(message.proposal.status));
    if (!proposalMessage?.proposal || autoEvmQuoteRequestsRef.current.has(proposalMessage.proposal.id)) return;
    autoEvmQuoteRequestsRef.current.add(proposalMessage.proposal.id);
    void handlePrepareEvmSwap(proposalMessage.proposal, proposalMessage.id);
  }, [activeSession?.chainKey, activeSession?.id, activeSession?.workspace, messages, sessionMessagesLoading]);

  useEffect(() => {
    if (!pendingSessionPrompt || !activeSessionId || loading) return;
    const prompt = pendingSessionPrompt;
    setPendingSessionPrompt(null);
    void handleSendMessage(prompt);
  }, [activeSessionId, loading, pendingSessionPrompt]);

  async function handlePrepareSolanaBridge(request: SolanaBridgeRequest) {
    if (!connected || !publicKey || !walletAddress) {
      const errMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: "Connect a Solana wallet before preparing a bridge.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(walletAddress, errMsg);
      return;
    }
    if (activeSession?.workspace !== "bridge" || request.destination !== activeSession.chainKey) {
      const errMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: "Bridge request was blocked because its destination does not match the chain bound to this session.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(walletAddress, errMsg);
      return;
    }
    setBridgeBusy(true);
    let submittedSignature: string | null = null;
    try {
      const response = await fetch("/api/bridge/solana-to-evm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, ...request }),
      });
      const quote = await response.json() as { error?: string; transaction?: string; destination?: { label: string; symbol: string }; requestId?: string | null };
      if (!response.ok || typeof quote.transaction !== "string") {
        throw new Error(quote.error || "Bridge provider did not return an executable transaction.");
      }
      const transaction = VersionedTransaction.deserialize(base64ToBytes(quote.transaction));
      const signature = await sendTransaction(transaction, connection, { skipPreflight: false, maxRetries: 2 });
      submittedSignature = signature;
      const sourceReceipt = await connection.confirmTransaction(signature, "confirmed");
      if (sourceReceipt.value.err) throw new Error(`Solana rejected the bridge source transaction: ${JSON.stringify(sourceReceipt.value.err)}`);

      const successMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: `Bridge source transaction confirmed on Solana. Destination settlement on ${quote.destination?.label ?? request.destination} is still pending and is not claimed as complete.\n\n[View source transaction on Solana Explorer](https://solscan.io/tx/${signature})${quote.requestId ? `\n\nRelay request: ${quote.requestId}` : ""}`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev.filter((m) => m.sessionId === activeSessionId), successMsg]);
      await saveMessage(walletAddress, successMsg);

      setTimeout(() => {
        void fetchWalletBalance();
      }, 1500);
      setTimeout(() => {
        void fetchWalletBalance();
      }, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge was cancelled or failed safely.";
      const errMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: submittedSignature
          ? `Bridge source transaction was submitted, but its confirmation could not be verified. Do not submit it again until you inspect the signature. Destination settlement is unknown.\n\n${message}\n\n[Inspect source transaction](https://solscan.io/tx/${submittedSignature})`
          : `Bridge was not broadcast: ${message}`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(walletAddress, errMsg);
    } finally {
      setBridgeBusy(false);
    }
  }

  // Loading Gate while checking Wallet Connection
  if (!authChecked || !authenticatedWallet) {
    return (
      <div className="tradeDesktopShell gateScreenLayout">
        <div className="authLoadingGate" role="status" aria-live="polite">
          <div className="authLoaderOrbit"><span /><span /><span /></div>
          <p className="authLoadingEyebrow">Mirae secure access</p>
          <h1>Verifying your wallet</h1>
          <p className="authLoadingCopy">Checking the signed session boundary. No transaction permission is requested.</p>
          <div className="authLoadingProgress"><span /></div>
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    if (!window.confirm("Sign out of Mirae Web? Your active session cookie will be cleared.")) return;
    await fetch("/api/auth/wallet/session", { method: "DELETE" });
    router.replace("/connect");
  }

  return (
    <div className="layout">
      <WebNewSessionModal
        key={sessionModalKey}
        isOpen={showSessionModal}
        defaultMode={newSessionMode}
        linkedWallets={linkedWallets}
        onWalletLinked={(linkedWallet) => setLinkedWallets((current) => [
          ...current.filter((wallet) => !(wallet.namespace === linkedWallet.namespace && wallet.address.toLowerCase() === linkedWallet.address.toLowerCase())),
          linkedWallet,
        ])}
        onClose={() => setShowSessionModal(false)}
        onCancel={() => {
          setPendingSessionPrompt(null);
          setShowSessionModal(false);
        }}
        onCreateRestrictedSession={async ({ title, mode, workspace, chainKey, sessionWalletAddress }) => {
          if (!accountWalletAddress) return;
          const draftSession: SessionItem = {
            id: "",
            title,
            filter: mode,
            workspace,
            chainKey,
            sessionWalletAddress,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const saved = await saveSession(accountWalletAddress, draftSession);
          if (saved) {
            setSessions((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
            setMessages([]);
            selectSession(saved.id);
          }
        }}
      />
      {deleteTarget && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deletingSessions) setDeleteTarget(null);
        }}>
          <section className="deleteSessionDialog" role="dialog" aria-modal="true" aria-labelledby="delete-session-title" style={{ width: "min(500px, calc(100vw - 44px))", overflow: "hidden", border: "1px solid rgba(123, 162, 255, 0.36)", borderRadius: "16px", background: "linear-gradient(145deg, #151c34, #0d1224 72%)", boxShadow: "0 42px 120px rgba(0, 0, 0, 0.68)" }}>
            <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "22px", padding: "24px 26px 20px", borderBottom: "1px solid rgba(123, 162, 255, 0.18)" }}>
              <div>
                <p className="modalKicker">SESSION MANAGEMENT</p>
                <h2 id="delete-session-title" style={{ margin: "6px 0 0", color: "#f3f6ff", fontSize: "22px", fontWeight: 600, letterSpacing: "-0.025em" }}>{deleteTarget === "all" ? "Delete all sessions" : "Delete session"}</h2>
              </div>
              <button type="button" className="modalClose" onClick={() => setDeleteTarget(null)} disabled={deletingSessions} aria-label="Close delete confirmation">×</button>
            </header>
            <div className="deleteSessionDialogBody" style={{ display: "grid", gap: "16px", padding: "24px 26px", color: "#d4dbeb", fontSize: "14px", lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>{deleteTarget === "all" ? "Are you sure you want to delete every web session?" : <>Are you sure you want to delete <strong>“{deleteTarget.title}”</strong>?</>}</p>
              <div className="deleteSessionWarning" style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", gap: "10px", alignItems: "start", padding: "14px", border: "1px solid rgba(255, 95, 109, 0.38)", borderRadius: "10px", color: "#f5bbc1", background: "rgba(255, 95, 109, 0.08)", fontSize: "12px" }}><span>!</span><p style={{ margin: 0 }}>{deleteTarget === "all" ? "All sessions, messages, and local session history will be permanently removed. Wallet connections will remain unchanged." : "All messages and history associated with this session will be permanently removed."}</p></div>
            </div>
            <footer className="modalFooterActions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", margin: 0, padding: "16px 26px 22px", borderTop: "1px solid rgba(123, 162, 255, 0.18)" }}>
              <button type="button" className="railBtn" style={{ minWidth: "96px", padding: "10px 15px" }} onClick={() => setDeleteTarget(null)} disabled={deletingSessions}>Cancel</button>
              <button type="button" className="dangerButton" style={{ minWidth: "148px", padding: "10px 15px", border: "1px solid rgba(255, 95, 109, 0.82)", borderRadius: "20px", color: "#fff", background: "rgba(235, 66, 81, 0.92)", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: deletingSessions ? "wait" : "pointer" }} onClick={() => void confirmDeleteSessions()} disabled={deletingSessions}>{deletingSessions ? "Deleting..." : deleteTarget === "all" ? "Delete all sessions" : "Delete session"}</button>
            </footer>
          </section>
        </div>
      )}

      {/* 3-Column Desktop Workspace Shell */}
      <TradeWorkspaceLayout>
        {/* LEFT RAIL: DESKTOP WORKSPACE SESSIONS & FILTERS */}
        <TradeSessionRail
          sessions={sessions}
          activeSessionId={activeSessionId}
          sessionFilter={sessionFilter}
          workspaceView={workspaceView}
          onFilterChange={setSessionFilter}
          onNewSession={() => openNewSession()}
          onSelectSession={selectSession}
          onDeleteSession={handleDeleteSession}
          onDeleteAll={() => void handleDeleteAllSessions()}
          onViewChange={changeWorkspaceView}
          onSignOut={() => void handleSignOut()}
        />

        {/* CENTER STAGE: CONVERSATION CHAT FEED & COMPOSER */}
        <section className="centerStage">
          {workspaceView === "automation" ? (
            <WebAutomationView
              walletAddress={automationContext?.walletAddress ?? walletAddress}
              workspace={automationContext?.workspace ?? "solana"}
              onOpenSession={(sessionId) => {
                selectSession(sessionId);
              }}
            />
          ) : workspaceView === "missions" ? (
            <WebMissionsView
              sessions={sessions.filter((session) => session.filter === "mission" || session.filter === "pump")}
              onCreateMission={() => openNewSession("", "mission")}
              onOpenSession={(sessionId) => {
                selectSession(sessionId);
              }}
            />
          ) : !activeSessionId ? (
            <TradeHomeState input={input} newSession onInputChange={setInput} onSubmit={(prompt) => openNewSession(prompt ?? input)} />
          ) : sessionMessagesLoading ? (
            <TradeSessionLoading />
          ) : messages.length === 0 ? (
            <TradeHomeState input={input} loading={loading} onInputChange={setInput} onSubmit={(prompt) => handleSendMessage(prompt)} />
          ) : (
            <div className="conversation">
              <header>
                <span>MODE / {(activeSession?.workspace ?? "solana").toUpperCase()} · {activeSession?.chainKey ? getWebEvmChain(activeSession.chainKey)?.name.toUpperCase() : "MAINNET"}</span>
                <span>RESTRICTED POSTURE</span>
              </header>

              {walletAddress && authenticatedWallet && walletAddress.toLowerCase() !== authenticatedWallet.toLowerCase() && (
                <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  <span>Phantom aktif ({shortWallet(walletAddress)}) belum disinkronkan dengan sesi login ({shortWallet(authenticatedWallet)}).</span>
                  <button
                    type="button"
                    onClick={() => router.push(`/connect?force=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                    className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1 font-bold text-amber-100 hover:bg-amber-500/30"
                  >
                    Sync Dompet Aktif
                  </button>
                </div>
              )}

              <TradeMessageFeed
                messages={messages}
                activeSessionId={activeSessionId}
                loading={loading}
                viewportRef={messagesViewportRef}
                renderProposal={(msg) => msg.proposal && msg.proposal.type === "perp_order" ? (
                        <PerpPreviewCard
                          proposal={msg.proposal}
                          busy={perpBusyId === msg.proposal.id}
                          onPrepare={() => void handlePreparePerpOrder(msg.proposal!, msg.id)}
                          onExecute={() => void handleExecutePerpOrder(msg.proposal!, msg.id)}
                          onChooseDirection={(direction) => void handleChoosePerpDirection(msg.proposal!, msg.id, direction)}
                        />
                      ) : msg.proposal && msg.proposal.type === "token_launch" ? (
                        <TokenLaunchPreviewCard
                          proposal={msg.proposal}
                          busy={tokenLaunchBusyId === msg.proposal.id}
                          hasVolatileMint={tokenLaunchMintSignersRef.current.has(msg.proposal.id)}
                          onPrepare={() => void handlePrepareTokenLaunch(msg.proposal!, msg.id)}
                          onExecute={() => void handleExecuteTokenLaunch(msg.proposal!, msg.id)}
                          onVerify={() => void handleVerifyTokenLaunch(msg.proposal!, msg.id)}
                        />
                      ) : msg.proposal && msg.proposal.type === "stock_analysis" && msg.proposal.stockIntelligence ? (
                        <StockAnalysisCard
                          intelligence={msg.proposal.stockIntelligence}
                          busy={stockSwapBusyId === msg.proposal.id}
                          onSwap={(token) => void handlePrepareStockSwap(token, msg.proposal!.id)}
                        />
                      ) : msg.proposal && msg.proposal.type === "investment_recommendation" && msg.proposal.investmentRecommendation ? (
                        <InvestmentRecommendationCard proposal={msg.proposal} busyKey={investmentBusyKey} onPrepare={handlePrepareInvestment} />
                      ) : msg.proposal && msg.proposal.type === "pump_analysis" && msg.proposal.pumpIntelligence ? (
                        <PumpAnalysisCard intelligence={msg.proposal.pumpIntelligence} />
                      ) : msg.proposal && msg.proposal.type === "evm_bridge" ? (
                        <EvmBridgePreviewCard proposal={msg.proposal} busy={bridgeBusy} onPrepare={() => handlePrepareEvmBridge(msg.proposal!, msg.id)} />
                      ) : msg.proposal && msg.proposal.type === "solana_bridge" ? (
                        <SolanaBridgePreviewCard proposal={msg.proposal} busy={bridgeBusy} onPrepare={() => handlePrepareSolanaBridgeProposal(msg.proposal!, msg.id)} />
                      ) : msg.proposal && msg.proposal.type === "evm_swap" ? (
                        <EvmSwapPreviewCard proposal={msg.proposal} busy={bridgeBusy} onPrepare={() => handlePrepareEvmSwap(msg.proposal!, msg.id)} />
                      ) : msg.proposal && msg.proposal.type === "jupiter_swap" ? (
                        <JupiterSwapPreviewCard
                          proposal={msg.proposal}
                          status={msg.proposal.status}
                          onExecute={() => handleExecuteJupiterSwap(msg.proposal!, msg.id)}
                        />
                      ) : msg.proposal && msg.proposal.type === "limit_order" ? (
                        <LimitOrderPreviewCard
                          proposal={msg.proposal}
                          status={msg.proposal.status}
                          onExecute={() => alert("Limit order web execution is not enabled yet.")}
                        />
                      ) : msg.proposal ? (
                        <PumpTradePreviewCard
                          proposal={msg.proposal}
                          status={msg.proposal.status}
                          onExecuteOptionA={() => alert("Pump.fun web execution is not enabled yet.")}
                        />
                      ) : null}
              />

              {/* Quick Suggestions Chips & Composer */}
              <div className="conversationComposer">
                {activeSession?.workspace === "solana" && showTokenLaunchPanel && activeSession.sessionWalletAddress && (
                  <TokenLaunchPanel
                    creatorWallet={activeSession.sessionWalletAddress}
                    onClose={() => setShowTokenLaunchPanel(false)}
                    onPublished={(draft) => void handleTokenLaunchDraftPublished(draft)}
                  />
                )}
                {activeSession?.workspace === "solana" && showPerpsPanel && activeSession.sessionWalletAddress && (
                  <PerpsPanel
                    walletAddress={activeSession.sessionWalletAddress}
                    busy={perpBusyId !== null}
                    onClose={() => setShowPerpsPanel(false)}
                    onSubmit={(request) => void handlePerpsPanelSubmit(request)}
                    onGetUsdc={() => {
                      // Reuses the existing Jupiter swap flow rather than adding a
                      // second way to acquire collateral.
                      setShowPerpsPanel(false);
                      void handleSendMessage("Swap 1 SOL to USDC on Mainnet with restricted wallet approval.");
                    }}
                  />
                )}
                {activeSession?.workspace === "bridge" && (
                  <SolanaBridgePanel
                    onPrepare={handlePrepareSolanaBridge}
                    busy={bridgeBusy}
                    boundDestination={activeSession.chainKey as SolanaBridgeRequest["destination"]}
                  />
                )}
                {activeSession?.workspace === "evm" && evmWalletMismatch && (
                  <div className="evmReleaseNotice evmWalletMismatch">
                    <strong>{getWebEvmChain(activeSession.chainKey ?? "")?.name ?? "EVM"} · {shortWallet(activeSession.sessionWalletAddress)}</strong>
                    <span>Execution locked: switch the browser wallet to {shortWallet(activeSession.sessionWalletAddress)} on {expectedEvmChain?.name ?? "the bound chain"}.</span>
                  </div>
                )}
                <div className="suggestions">
                  {activeSession?.workspace === "solana" && (
                    <button onClick={() => setShowTokenLaunchPanel((value) => !value)}>
                      {showTokenLaunchPanel ? "CLOSE TOKEN LAUNCH" : "TOKEN LAUNCH"}
                    </button>
                  )}
                  {activeSession?.workspace === "solana" && (
                    <button onClick={() => setShowPerpsPanel((value) => !value)}>
                      {showPerpsPanel ? "CLOSE PERPS" : "PERPS"}
                    </button>
                  )}
                  {activeSession?.workspace === "evm" ? (
                    <button onClick={() => handleSendMessage("Swap 0.001 ETH to USDG on Robinhood Chain with explicit wallet approval.")}>
                      0.001 ETH to USDG
                    </button>
                  ) : (
                    <button onClick={() => handleSendMessage("Swap 1 SOL to USDC on Mainnet with restricted wallet approval.")}>
                      1 SOL to USDC
                    </button>
                  )}
                  <button
                    onClick={() => handleSendMessage("What can the web AI trading agent do safely right now?")}
                  >
                    Web trading limits
                  </button>
                </div>

                <div className="composer">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={activeSession?.workspace === "evm"
                      ? "Enter a Robinhood Chain instruction... e.g. Swap 0.001 ETH to USDG"
                      : activeSession?.workspace === "bridge"
                        ? "Describe the bridge amount, destination, recipient, and fee limit..."
                        : "Enter a Solana instruction... e.g. Swap 1 SOL to USDC"}
                    rows={1}
                  />

                  <button disabled={!input.trim() || loading} onClick={() => handleSendMessage()}>
                    ↑
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT RAIL: DESKTOP STATUS PANEL */}
        <aside className="rightRail">
          <div className="rightTop">
            <span>MAINNET</span>
            <strong className="text-[#f7b733]">healthy</strong>
          </div>

          <section className="railSection">
            <h3 className="mb-4 text-[9px] tracking-[0.2em] text-[var(--blue-2)] uppercase">PORTFOLIO</h3>
            <div className="mb-4">
              <span className="text-[8px] tracking-[0.16em] uppercase text-[var(--muted)]">{!activeSession ? "ACCOUNT PORTFOLIO" : activeSession.workspace === "evm" ? "ROBINHOOD PORTFOLIO" : "SOLANA PORTFOLIO"}</span>
              {(portfolioTotalUsd !== null || walletBalance !== null) && (
                <div className="text-[28px] font-bold mt-1 text-white">
                  {portfolioTotalUsd !== null
                    ? `$${portfolioTotalUsd.toFixed(2)}`
                    : `${walletBalance!.toFixed(6)} ${portfolioWorkspace === "evm" ? "ETH" : "SOL"}`}
                </div>
              )}
              <div className="text-[8px] text-[var(--muted)] mt-1 mb-3">{portfolioStatus}</div>
              {portfolioAssets.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {portfolioAssets.slice(0, 8).map((asset, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-white/5 px-2 py-1.5 rounded">
                      <span className="text-[var(--paper)] font-medium">{asset.symbol}{!activeSession && asset.network && <small className="mt-0.5 block font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">{asset.network}</small>}</span>
                      <div className="text-right">
                        <span className="text-white block">{asset.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        <span className="text-[var(--blue-2)] text-[8px]">${asset.valueUsd.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {perpEquity && (perpEquity.collateralUsd > 0 || perpEquity.positions.length > 0) && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <span className="text-[8px] tracking-[0.16em] uppercase text-[var(--muted)]">PERPS · PHOENIX</span>
                  <div className="flex justify-between items-center text-[10px] bg-white/5 px-2 py-1.5 rounded">
                    <span className="text-[var(--paper)] font-medium">Collateral</span>
                    <span className="text-white">${perpEquity.collateralUsd.toFixed(2)}</span>
                  </div>
                  {perpEquity.positions.map((position) => (
                    <div key={position.symbol} className="flex justify-between items-center text-[10px] bg-white/5 px-2 py-1.5 rounded">
                      <span className="text-[var(--paper)] font-medium">
                        {position.symbol}
                        <small className="mt-0.5 block font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">{position.direction} {position.baseAmount}</small>
                      </span>
                      <span className={position.unrealizedPnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {position.unrealizedPnlUsd >= 0 ? "+" : ""}${position.unrealizedPnlUsd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {portfolioWalletAddress && <div className="flex flex-col gap-2">
              {!activeSession ? linkedWallets.filter((wallet, index, wallets) => wallets.findIndex((candidate) => candidate.namespace === wallet.namespace && candidate.address.toLowerCase() === wallet.address.toLowerCase()) === index).map((wallet) => (
                <div key={`${wallet.namespace}:${wallet.address}`} className="flex items-center justify-between p-3 rounded-lg border border-[rgb(148,163,184,0.16)] bg-transparent hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--paper)]"><span className="text-[var(--muted)]">{wallet.namespace === "evm" ? "ROBINHOOD" : "SOLANA"}</span> {shortWallet(wallet.address)}</div>
                  <button onClick={() => void copyPortfolioAddress(wallet.address)} className="min-w-12 text-right text-[8px] text-[var(--blue-2)] tracking-[0.1em] uppercase hover:text-white">{portfolioCopyFeedback?.address === wallet.address ? portfolioCopyFeedback.status === "copied" ? "COPIED" : "FAILED" : "COPY"}</button>
                </div>
              )) : <div className="flex items-center justify-between p-3 rounded-lg border border-[rgb(148,163,184,0.16)] bg-transparent hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--paper)]">
                  <span className="text-[var(--muted)]">{activeSession.workspace === "solana" ? "SESSION SOLANA" : "PRIMARY"}</span> {shortWallet(portfolioWalletAddress ?? undefined)}
                </div>
                <button onClick={() => portfolioWalletAddress && void copyPortfolioAddress(portfolioWalletAddress)} className="min-w-12 text-right text-[8px] text-[var(--blue-2)] tracking-[0.1em] uppercase hover:text-white">{portfolioCopyFeedback?.address === portfolioWalletAddress ? portfolioCopyFeedback.status === "copied" ? "COPIED" : "FAILED" : "COPY"}</button>
              </div>}

              {activeSession?.workspace === "evm" && activeSession.sessionWalletAddress && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5">
                  <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--paper)]"><span className="text-emerald-300">SESSION EVM</span> {shortWallet(activeSession.sessionWalletAddress)}</div>
                  <button onClick={() => void copyPortfolioAddress(activeSession.sessionWalletAddress!)} className="min-w-12 text-right text-[8px] text-[var(--blue-2)] tracking-[0.1em] uppercase hover:text-white">{portfolioCopyFeedback?.address === activeSession.sessionWalletAddress ? portfolioCopyFeedback.status === "copied" ? "COPIED" : "FAILED" : "COPY"}</button>
                </div>
              )}

            </div>}
          </section>

          {activeRailAutomations.length > 0 && (
            <section className="railSection">
              <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-[var(--blue-2)]">AUTOMATION</h3>
            <button type="button" onClick={() => changeWorkspaceView("automation")} className="font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-300 hover:text-white">VIEW ALL</button>
              </div>
              <div className="space-y-2.5">
                {activeRailAutomations.slice(0, 3).map((strategy) => {
                  const pending = strategy.proposals.find((proposal) => proposal.status === "AWAITING_APPROVAL" || proposal.status === "PREPARED");
                  const prepared = pending?.status === "PREPARED";
                  const maximum = strategy.maximumExecutions ?? 1;
                  const progress = strategy.kind === "DCA" ? Math.min(100, Math.round((strategy.completedExecutions / maximum) * 100)) : 0;
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => changeWorkspaceView("automation")}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${pending ? "border-emerald-400/35 bg-emerald-400/[0.07] hover:bg-emerald-400/10" : "border-white/10 bg-white/[0.025] hover:bg-white/5"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div><span className="font-mono text-[8px] uppercase tracking-[0.14em] text-emerald-300">{strategy.kind === "DCA" ? "DCA" : "TP / SL"}</span><strong className="mt-0.5 block text-[11px] text-white">{strategy.amount} {strategy.inputSymbol} → {strategy.outputSymbol}</strong></div>
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider ${pending ? "border-emerald-400/30 text-emerald-200" : strategy.status === "PAUSED" ? "border-amber-400/30 text-amber-200" : "border-emerald-400/25 text-emerald-300"}`}>{prepared ? "ACTION READY" : pending && strategy.lastError ? "QUOTE RETRY" : pending ? "ROUTE DUE" : strategy.status}</span>
                      </div>
                      {strategy.kind === "DCA" ? (
                        <div className="mt-2.5">
                          <div className="mb-1.5 flex justify-between font-mono text-[8px] text-[#7f8aa7]"><span>{strategy.completedExecutions} / {strategy.maximumExecutions} cycles</span><span>{strategy.status === "PAUSED" ? "Paused" : pending ? "Due now · review in chat" : formatAutomationCountdown(strategy.nextWakeAt, automationClock)}</span></div>
                          <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" style={{ width: `${progress}%` }} /></div>
                          <p className="mt-1.5 font-mono text-[8px] text-[#7f8aa7]">{prepared ? "Awaiting wallet approval" : pending && strategy.lastError ? "Refreshing a valid route" : pending ? "Route preparation due" : `Next review · ${formatAutomationCountdown(strategy.nextWakeAt, automationClock)}`} · every {Math.round((strategy.intervalSeconds ?? 0) / 60)} minutes</p>
                        </div>
                      ) : (
                        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] text-[#7f8aa7]"><span>TP <strong className="text-white">{strategy.takeProfitPriceUsd ? `$${strategy.takeProfitPriceUsd}` : "Not set"}</strong></span><span>SL <strong className="text-white">{strategy.stopLossPriceUsd ? `$${strategy.stopLossPriceUsd}` : "Not set"}</strong></span></div>
                      )}
                      {pending && <p className="mt-2 border-t border-emerald-400/15 pt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-200">{prepared ? "Open Automation to review proposal" : strategy.lastError || "Preparing a fresh route"}</p>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

        </aside>
      </TradeWorkspaceLayout>
    </div>
  );
}
