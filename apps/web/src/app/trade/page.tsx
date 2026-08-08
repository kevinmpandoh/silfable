/* eslint-disable */
// @ts-nocheck
/* eslint-disable */
"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Trash2 } from "lucide-react";
import Link from "next/link";
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
import { LimitOrderPreviewCard } from "@/components/cards/LimitOrderPreviewCard";
import { JupiterSwapPreviewCard } from "@/components/cards/JupiterSwapPreviewCard";
import { EvmSwapPreviewCard } from "@/components/cards/EvmSwapPreviewCard";
import { WebSetupWizard } from "@/components/trade/WebSetupWizard";
import { WebNewSessionModal, type LinkedWebWallet } from "@/components/trade/WebNewSessionModal";
import { WebMissionsView } from "@/components/trade/WebMissionsView";
import { getWebEvmChain } from "@/lib/evm-chains";
import { switchToRobinhoodChain } from "@/lib/evm-browser-wallet";

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

function renderMessageContent(content: string) {
  return content.split(/\n+/u).filter(Boolean).map((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      return <h3 key={`${trimmed}-${index}`}>{trimmed.replace(/^###\s+/u, "")}</h3>;
    }
    if (trimmed.startsWith("## ")) {
      return <h2 key={`${trimmed}-${index}`}>{trimmed.replace(/^##\s+/u, "")}</h2>;
    }
    if (/^[-*]\s+/u.test(trimmed)) {
      return <p key={`${trimmed}-${index}`} className="messageBullet">{trimmed.replace(/^[-*]\s+/u, "• ")}</p>;
    }
    if (/^\d+\.\s+/u.test(trimmed)) {
      return <p key={`${trimmed}-${index}`} className="messageBullet">{trimmed}</p>;
    }
    return <p key={`${trimmed}-${index}`}>{trimmed}</p>;
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

export interface WebSetupSettings {
  customRpcUrl: string;
  evmRpcUrl: string;
  jupiterApiKey: string;
  uniswapApiKey: string;
  openRouterApiKey: string;
  aiModel: string;
  outputLimit: string;
  temperature: string;
  maxSlippageBps: string;
}

const DEFAULT_SETTINGS: WebSetupSettings = {
  customRpcUrl: "",
  evmRpcUrl: "",
  jupiterApiKey: "",
  uniswapApiKey: "",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  outputLimit: "8192",
  temperature: "0.7",
  maxSlippageBps: "100",
};

const WEB_MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "openai/gpt-4o-mini": 128_000,
  "openai/gpt-4.1-mini": 1_000_000,
  "anthropic/claude-3.5-sonnet": 200_000,
  "google/gemini-2.0-flash-001": 1_000_000,
};

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function setupStorageKey(walletAddress: string): string {
  return `silfable_web_setup_v1:${walletAddress}`;
}

function setupSecretStorageKey(walletAddress: string): string {
  return `silfable_web_setup_secrets_v1:${walletAddress}`;
}

export default function TradePage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const activeWalletAddressRef = useRef<string | null>(walletAddress);
  const { connection } = useConnection();
  const router = useRouter();

  useEffect(() => {
    activeWalletAddressRef.current = walletAddress;
  }, [walletAddress]);

  // Workspace Mode: restricted Mainnet parity with the desktop app.
  const mode = "restricted";

  // Setup Flow State
  const [setupCompleted, setSetupCompleted] = useState<boolean>(false);
  const [editingSetup, setEditingSetup] = useState<boolean>(false);
  const [authenticatedWallet, setAuthenticatedWallet] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [settings, setSettings] = useState<WebSetupSettings>(DEFAULT_SETTINGS);
  const [setupStep, setSetupStep] = useState<number>(1);

  // IndexedDB Sessions & Messages State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "agent" | "mission">("all");
  const [workspaceView, setWorkspaceView] = useState<"chat" | "missions">("chat");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSessionMode, setNewSessionMode] = useState<"agent" | "mission">("agent");
  const [sessionModalKey, setSessionModalKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | "all" | null>(null);
  const [deletingSessions, setDeletingSessions] = useState(false);
  const [pendingSessionPrompt, setPendingSessionPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const portfolioRequestRef = useRef(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWebWallet[]>([]);
  const [activeEvmAddress, setActiveEvmAddress] = useState<string | null>(null);
  const [activeEvmChainId, setActiveEvmChainId] = useState<number | null>(null);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [portfolioAssets, setPortfolioAssets] = useState<{ symbol: string; amount: number; valueUsd: number }[]>([]);
  const [portfolioTotalUsd, setPortfolioTotalUsd] = useState<number | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState("Refreshing Mainnet balance...");
  const accountWalletAddress = authenticatedWallet ?? walletAddress;
  useEffect(() => {
    activeWalletAddressRef.current = accountWalletAddress;
  }, [accountWalletAddress]);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeMessageCount = messages.reduce((count, message) => count + (message.sessionId === activeSessionId ? 1 : 0), 0);
  const expectedEvmChain = activeSession?.chainKey ? getWebEvmChain(activeSession.chainKey) : null;
  const evmWalletMatchesSession = activeSession?.workspace !== "evm"
    || (activeEvmAddress?.toLowerCase() === activeSession.sessionWalletAddress?.toLowerCase()
      && activeEvmChainId === expectedEvmChain?.chainId);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const refresh = async () => {
      try {
        const [accounts, chainIdHex] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);
        setActiveEvmAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
        setActiveEvmChainId(typeof chainIdHex === "string" ? Number.parseInt(chainIdHex, 16) : null);
      } catch {
        setActiveEvmAddress(null);
        setActiveEvmChainId(null);
      }
    };
    const onChange = () => void refresh();
    void refresh();
    provider.on?.("accountsChanged", onChange);
    provider.on?.("chainChanged", onChange);
    return () => {
      provider.removeListener?.("accountsChanged", onChange);
      provider.removeListener?.("chainChanged", onChange);
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
        router.replace("/connect?next=/trade");
      })
      .catch(() => {
        if (!cancelled) router.replace("/connect?next=/trade");
      }).finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const runtimeUsage = messages.reduce(
    (total, message) => {
      if (!message.usage) return total;
      total.inputTokens += message.usage.inputTokens;
      total.outputTokens += message.usage.outputTokens;
      total.totalTokens += message.usage.totalTokens;
      if (message.usage.costUsd !== null) {
        total.costUsd += message.usage.costUsd;
        total.hasCost = true;
      }
      total.model = message.usage.model || total.model;
      return total;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, hasCost: false, model: settings.aiModel },
  );
  const lastTurnUsage = [...messages].reverse().find((message) => message.usage)?.usage ?? null;
  const providerContextLimit = WEB_MODEL_CONTEXT_LIMITS[runtimeUsage.model] ?? 128_000;
  const lastTurnContextTokens = lastTurnUsage?.inputTokens ?? 0;
  const contextUsagePercent = Math.min(100, Math.round((lastTurnContextTokens / providerContextLimit) * 100));

  // --------------------------------------------------------------------------
  // INITIALIZATION: Load Setup & Sessions
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      if (!accountWalletAddress) return;
      try {
        setSetupCompleted(false);
        setEditingSetup(false);
        setSettings(DEFAULT_SETTINGS);
        setSetupStep(1);
        setSessions([]);
        setMessages([]);
        setActiveSessionId("");
        setLoading(false);

        // Load Settings
        const savedSetup = localStorage.getItem(setupStorageKey(accountWalletAddress));
        const sessionSecrets = sessionStorage.getItem(setupSecretStorageKey(accountWalletAddress));
        if (savedSetup) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSetup), ...(sessionSecrets ? JSON.parse(sessionSecrets) : {}) });
          setSetupCompleted(true);
        }

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
            setMessages([]);
            return;
          }
        }
        if (storedSessions.length === 0) {
          setSessions([]);
          setActiveSessionId("");
          setMessages([]);
        } else {
          setSessions(storedSessions);
          setMessages([]);
          setActiveSessionId(storedSessions[0].id);
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
    setMessages([]);

    async function loadActiveMessages() {
      if (!accountWalletAddress || !activeSessionId) return;
      const targetId = activeSessionId;
      const msgs = await getSessionMessages(accountWalletAddress, targetId);
      if (!cancelled) {
        setMessages(msgs.filter((m) => m.sessionId === targetId));
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

async function queryEvmRpc(rpcUrl: string, method: string, params: unknown[]) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null) as { result?: string; error?: { message?: string } } | null;
    if (!response.ok || json?.error || typeof json?.result !== "string") throw new Error(json?.error?.message || `RPC error status ${response.status}`);
    return json.result;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw new Error("Robinhood RPC timed out. Configure a custom provider RPC in Settings → Network.");
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
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
  sellToken: "USDG" | "ETH";
  amountIn: string;
  transaction: { from: string; to: string; data: string; value: string };
}) {
  const balanceOfData = `0x70a08231000000000000000000000000${input.walletAddress.replace(/^0x/i, "").toLowerCase()}`;
  const [nativeBalance, gasLimit, gasPrice, usdgBalance] = await Promise.all([
    queryEvmRpc(input.rpcUrl, "eth_getBalance", [input.walletAddress, "latest"]),
    queryEvmRpc(input.rpcUrl, "eth_estimateGas", [{ from: input.transaction.from, to: input.transaction.to, data: input.transaction.data, value: input.transaction.value }]),
    queryEvmRpc(input.rpcUrl, "eth_gasPrice", []),
    input.sellToken === "USDG"
      ? queryEvmRpc(input.rpcUrl, "eth_call", [{ to: ROBINHOOD_USDG_ADDRESS, data: balanceOfData }, "latest"])
      : Promise.resolve("0x0"),
  ]);
  const nativeRequired = BigInt(input.transaction.value) + BigInt(gasLimit) * BigInt(gasPrice);
  if (BigInt(nativeBalance) < nativeRequired) {
    throw new Error(`Insufficient ETH for this swap and network fee. Required about ${formatEvmUnits(nativeRequired, 18)} ETH, available ${formatEvmUnits(BigInt(nativeBalance), 18)} ETH.`);
  }
  if (input.sellToken === "USDG" && BigInt(usdgBalance) < BigInt(input.amountIn)) {
    throw new Error(`Insufficient USDG. Swap requires ${formatEvmUnits(BigInt(input.amountIn), 6)} USDG, available ${formatEvmUnits(BigInt(usdgBalance), 6)} USDG.`);
  }
}

  // Fetch the single connected Mainnet wallet through the configured RPC.
  const fetchWalletBalance = useCallback(async () => {
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const requestId = ++portfolioRequestRef.current;
    setPortfolioStatus("Refreshing Mainnet balance...");
    setWalletBalance(null);
    setPortfolioAssets([]);
    setPortfolioTotalUsd(null);
    try {
      if (activeSession?.workspace === "evm") {
        const address = activeSession.sessionWalletAddress || activeEvmAddress;
        if (!address) throw new Error("No EVM wallet connected to this session.");
        const rpcUrl = settings.evmRpcUrl.trim() || DEFAULT_ROBINHOOD_RPC;
        const balanceOfData = `0x70a08231000000000000000000000000${address.replace(/^0x/i, "").toLowerCase()}`;

        const [nativeHex, usdgHex, blockHex] = await Promise.all([
          queryEvmRpc(rpcUrl, "eth_getBalance", [address, "latest"]),
          queryEvmRpc(rpcUrl, "eth_call", [{ to: ROBINHOOD_USDG_ADDRESS, data: balanceOfData }, "latest"]),
          queryEvmRpc(rpcUrl, "eth_blockNumber", []),
        ]);

        const ethAmount = typeof nativeHex === "string" ? Number(BigInt(nativeHex)) / 1e18 : 0;
        const usdgAmount = typeof usdgHex === "string" ? Number(BigInt(usdgHex)) / 1e6 : 0;

        if (requestId !== portfolioRequestRef.current) return;

        setWalletBalance(ethAmount);
        setPortfolioAssets([
          { symbol: "ETH", amount: ethAmount, valueUsd: 0 },
          ...(usdgAmount > 0 ? [{ symbol: "USDG", amount: usdgAmount, valueUsd: usdgAmount }] : []),
        ]);
        setPortfolioTotalUsd(usdgAmount > 0 ? usdgAmount : null);
        const block = typeof blockHex === "string" ? Number.parseInt(blockHex, 16) : null;
        const rpcLabel = settings.evmRpcUrl.trim() ? "Custom Robinhood RPC" : "Robinhood RPC";
        setPortfolioStatus(`${rpcLabel}${Number.isFinite(block) ? ` · block #${block}` : ""}`);
        return;
      }

      if (!publicKey) return;
      const response = await fetch("/api/solana/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          customRpcUrl: settings.customRpcUrl.trim() || undefined,
        }),
      });
      const result = await response.json() as { sol?: number; assets?: any[]; totalUsd?: number; slot?: number; source?: string; error?: string };
      if (!response.ok || typeof result.sol !== "number") {
        throw new Error(typeof result.error === "string" ? result.error : "Saldo Mainnet tidak dapat dimuat.");
      }
      if (requestId !== portfolioRequestRef.current) return;
      setWalletBalance(result.sol);
      setPortfolioAssets(result.assets ?? []);
      setPortfolioTotalUsd(typeof result.totalUsd === "number" ? result.totalUsd : null);
      const source = result.source === "custom" ? "Custom RPC" : "Default Mainnet RPC";
      setPortfolioStatus(`${source}${typeof result.slot === "number" ? ` - slot ${result.slot.toLocaleString()}` : ""}`);
    } catch (error) {
      if (requestId !== portfolioRequestRef.current) return;
      setWalletBalance(null);
      setPortfolioAssets([]);
      setPortfolioTotalUsd(null);
      setPortfolioStatus(error instanceof Error ? error.message : "Saldo Mainnet tidak dapat dimuat.");
    }
  }, [activeSessionId, sessions, activeEvmAddress, publicKey, settings.evmRpcUrl, settings.customRpcUrl]);

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
        setMessages([]);
        setInput("");
      } else {
        await deleteSession(accountWalletAddress, target.id);
        const updated = await getAllSessions(accountWalletAddress);
        setSessions(updated);
        if (activeSessionId === target.id) {
          const nextSession = updated[0];
          setMessages([]);
          setActiveSessionId(nextSession?.id ?? "");
        }
      }
      setDeleteTarget(null);
    } finally {
      setDeletingSessions(false);
    }
  }

  // --------------------------------------------------------------------------
  // SETTINGS HANDLERS
  // --------------------------------------------------------------------------
  function persistSettings() {
    if (!accountWalletAddress) return;
    try {
      localStorage.setItem(setupStorageKey(accountWalletAddress), JSON.stringify(settings));
      sessionStorage.setItem(setupSecretStorageKey(accountWalletAddress), JSON.stringify({ openRouterApiKey: settings.openRouterApiKey, jupiterApiKey: settings.jupiterApiKey, uniswapApiKey: settings.uniswapApiKey }));
      setSetupCompleted(true);
    } catch {
      alert("Failed to save settings.");
    }
  }

  function handleSaveSettings() {
    persistSettings();
    setEditingSetup(false);
  }

  function openSettings() {
    setSetupStep(4);
    setEditingSetup(true);
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

    setMessages((prev) => [...prev.filter((m) => m.sessionId === activeSessionId), userMsg]);
    await saveMessage(accountWalletAddress, userMsg);
    if (!promptText) setInput("");
    setLoading(true);

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
          settings,
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
        usage: parseWebUsage(data.usage, settings.aiModel),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev.filter((m) => m.sessionId === activeSessionId), assistantMsg]);
      await saveMessage(accountWalletAddress, assistantMsg);

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

  async function handleExecuteJupiterSwap(proposal: WebProposal, msgId: string) {
    if (!connected || !publicKey || !walletAddress) {
      alert("Please connect your Solana wallet (Phantom / Solflare) first!");
      return;
    }
    if (activeSession?.workspace !== "solana") {
      alert("Jupiter Solana swap hanya dapat dijalankan dari session Solana yang terikat.");
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
          jupiterApiKey: settings.jupiterApiKey || undefined,
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
            const updatedM = { ...m, proposal: { ...m.proposal, status: "submitted" as const } };
            void saveMessage(activeWalletAddress, updatedM);
            return updatedM;
          }
          return m;
        }),
      );

      const receipt = await connection.confirmTransaction(signature, "confirmed");
      if (receipt.value.err) {
        chainRejected = true;
        throw new Error(`Solana rejected the swap: ${JSON.stringify(receipt.value.err)}`);
      }
      setMessages((prev) => prev.map((message) => {
        if ((message.id === msgId || message.proposal?.id === proposal.id) && message.proposal) {
          const updated = { ...message, proposal: { ...message.proposal, status: "confirmed" as const } };
          void saveMessage(activeWalletAddress, updated);
          return updated;
        }
        return message;
      }));

      const successMsg: WebMessage = {
        id: `sys_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: `Mainnet swap confirmed on Solana.\n\n[View verified transaction on Solana Explorer](https://solscan.io/tx/${signature})`,
        createdAt: Date.now(),
      };
      
      setMessages((prev) => [...prev.filter((m) => m.sessionId === activeSessionId), successMsg]);
      await saveMessage(activeWalletAddress, successMsg);

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
            const updatedM = { ...m, proposal: { ...m.proposal, status: submittedSignature ? (chainRejected ? "reverted" as const : "unknown" as const) : "failed" as const } };
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
      alert("Robinhood EVM swap hanya dapat disiapkan dari session Robinhood yang terikat.");
      return;
    }
    const sessionWallet = activeSession.sessionWalletAddress;
    if (!sessionWallet || !evmWalletMatchesSession) {
      alert("Hubungkan wallet EVM yang sama dengan session ini dan pindahkan ke Robinhood Chain terlebih dahulu.");
      return;
    }
    if (!proposal.sellToken || !proposal.buyToken || !proposal.sellAmount) return;
    setBridgeBusy(true);
    let submittedEvmHash: string | null = null;
    try {
      if (proposal.quoteResponse && proposal.buyAmount) {
        await switchToRobinhoodChain(settings.evmRpcUrl);
        const walletProvider = window.ethereum;
        if (!walletProvider) throw new Error("EVM wallet extension is not available.");
        const [latestBlock, gasPrice] = await Promise.all([
          walletProvider.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
          walletProvider.request({ method: "eth_gasPrice" }),
        ]);
        if (!latestBlock || typeof gasPrice !== "string" || !/^0x[0-9a-f]+$/iu.test(gasPrice)) {
          throw new Error("Wallet RPC could not retrieve Robinhood block and gas data.");
        }
        setMessages((previous) => previous.map((message) => (message.id === msgId && message.proposal ? { ...message, proposal: { ...message.proposal, status: "signing" as const } } : message)));
        const buildResponse = await fetch("/api/evm/uniswap/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: sessionWallet, apiKey: settings.uniswapApiKey, quote: proposal.quoteResponse, tokenIn: proposal.sellToken === "USDG" ? "0x5fc5360d0400a0fd4f2af552add042d716f1d168" : "0x0000000000000000000000000000000000000000", amountIn: proposal.inputAmount }) });
        const built = await buildResponse.json();
        if (!buildResponse.ok) throw new Error(built.error || "Uniswap could not build the wallet transaction.");
        const provider = window.ethereum;
        if (!provider) throw new Error("EVM wallet extension is not available.");
        const transactionForPreflight = built.approvalRequired === true ? built.approval : built.transaction;
        if (!transactionForPreflight) throw new Error("Uniswap did not return a wallet transaction for balance verification.");
        await assertEvmSwapFunds({
          rpcUrl: settings.evmRpcUrl.trim() || DEFAULT_ROBINHOOD_RPC,
          walletAddress: sessionWallet,
          sellToken: proposal.sellToken,
          amountIn: proposal.inputAmount,
          transaction: transactionForPreflight,
        });
        const sendAndConfirm = async (transaction: { from: string; to: string; data: string; value: string }) => {
          const hash = await provider.request({ method: "eth_sendTransaction", params: [transaction] });
          if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/iu.test(hash)) throw new Error("Wallet did not return a valid transaction hash.");
          submittedEvmHash = hash;
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
          const info: WebMessage = { id: `sys_${Date.now()}`, sessionId: activeSessionId, role: "assistant", content: `USDG allowance confirmed. Click **PREPARE WALLET REVIEW** once more to build and sign the swap transaction.\n\n[Open approval in Robinhood Explorer](https://robinhoodchain.blockscout.com/tx/${approvalHash})`, createdAt: Date.now() };
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
        void fetchWalletBalance();
        return;
      }
      const response = await fetch("/api/evm/uniswap/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: sessionWallet, apiKey: settings.uniswapApiKey, sellToken: proposal.sellToken, buyToken: proposal.buyToken, amount: proposal.sellAmount, slippageBps: settings.maxSlippageBps }) });
      const rawResponse = await response.text();
      let quote: { quote?: unknown; outputAmount?: unknown; error?: unknown; amountIn?: unknown; minimumOutputAmount?: unknown; expiresAt?: unknown };
      try {
        quote = JSON.parse(rawResponse) as typeof quote;
      } catch {
        throw new Error(`Robinhood quote endpoint returned HTTP ${response.status}, not JSON: ${rawResponse.slice(0, 180)}`);
      }
      if (!response.ok || !quote.quote || typeof quote.outputAmount !== "string") throw new Error(typeof quote.error === "string" ? quote.error : "Uniswap did not return a valid Robinhood quote.");
      setMessages((previous) => previous.map((message) => {
        if ((message.id === msgId || message.proposal?.id === proposal.id) && message.proposal) {
          const updated = { ...message, proposal: { ...message.proposal, quoteResponse: quote.quote, inputAmount: quote.amountIn, buyAmount: quote.outputAmount, minimumBuyAmount: quote.minimumOutputAmount, quoteExpiresAt: quote.expiresAt, status: "ready_for_user_signature" as const } };
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
      const message = wasCancelled
        ? "Wallet approval cancelled. No transaction was signed or broadcast."
        : rawMessage.includes("RPC endpoint returned too many errors") || rawMessage.includes("eth_getBlockByNumber")
        ? "RPC Robinhood di wallet extension sedang gagal atau rate-limited. Tidak ada transaksi yang disiarkan. Buka MetaMask/Rabby → Settings → Networks → Robinhood Chain, lalu ganti RPC URL dengan endpoint custom yang sudah Anda verifikasi di Settings → Network Silfable. Setelah itu reload halaman dan buat quote baru."
        : rawMessage;
      if (submittedEvmHash) {
        setMessages((previous) => previous.map((entry) => (entry.id === msgId && entry.proposal ? { ...entry, proposal: { ...entry.proposal, status: "unknown" as const } } : entry)));
      } else {
        setMessages((previous) => previous.map((entry) => (entry.id === msgId && entry.proposal && entry.proposal.status === "signing" ? { ...entry, proposal: { ...entry.proposal, status: "ready_for_user_signature" as const } } : entry)));
      }
      const failure: WebMessage = { id: `sys_${Date.now()}`, sessionId: activeSessionId, role: "assistant", content: submittedEvmHash ? `Swap was submitted, but confirmation is unknown. Do not submit it again until you inspect the transaction.\n\n${message}\n\n[Open transaction in Robinhood Explorer](https://robinhoodchain.blockscout.com/tx/${submittedEvmHash})` : message, createdAt: Date.now() };
      setMessages((previous) => [...previous.filter((item) => item.sessionId === activeSessionId), failure]);
      await saveMessage(walletAddress, failure);
    } finally {
      setBridgeBusy(false);
    }
  }

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
        <div className="flex items-center justify-center min-h-screen text-slate-400 font-mono text-sm">
          Verifying wallet authentication...
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // GATE 2: SETUP / SETTINGS STEPPER GATE (FIRST TIME OR EDITING)
  // --------------------------------------------------------------------------
  async function handleSignOut() {
    if (!window.confirm("Sign out of Silfable Web? Your active session cookie will be cleared.")) return;
    await fetch("/api/auth/wallet/session", { method: "DELETE" });
    router.replace("/connect");
  }

  if (!setupCompleted || editingSetup) {
    return (
      <WebSetupWizard
        publicAddress={accountWalletAddress ?? ""}
        setupCompleted={setupCompleted}
        editingSetup={editingSetup}
        setupStep={setupStep}
        setSetupStep={setSetupStep}
        settings={settings}
        setSettings={setSettings}
        onPersistSettings={persistSettings}
        onSaveSettings={handleSaveSettings}
        onReturnToWorkspace={handleSaveSettings}
      />
    );
  }

  return (
    <div className="layout">
      <WebNewSessionModal
        key={sessionModalKey}
        isOpen={showSessionModal}
        defaultMode={newSessionMode}
        customEvmRpcUrl={settings.evmRpcUrl}
        walletAddress={accountWalletAddress ?? ""}
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
            setActiveSessionId(saved.id);
            setWorkspaceView("chat");
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
              <div className="deleteSessionWarning" style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", gap: "10px", alignItems: "start", padding: "14px", border: "1px solid rgba(255, 95, 109, 0.38)", borderRadius: "10px", color: "#f5bbc1", background: "rgba(255, 95, 109, 0.08)", fontSize: "12px" }}><span>!</span><p style={{ margin: 0 }}>{deleteTarget === "all" ? "All sessions, messages, and local session history will be permanently removed. Wallet connections and API settings will remain unchanged." : "All messages and history associated with this session will be permanently removed."}</p></div>
            </div>
            <footer className="modalFooterActions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", margin: 0, padding: "16px 26px 22px", borderTop: "1px solid rgba(123, 162, 255, 0.18)" }}>
              <button type="button" className="railBtn" style={{ minWidth: "96px", padding: "10px 15px" }} onClick={() => setDeleteTarget(null)} disabled={deletingSessions}>Cancel</button>
              <button type="button" className="dangerButton" style={{ minWidth: "148px", padding: "10px 15px", border: "1px solid rgba(255, 95, 109, 0.82)", borderRadius: "20px", color: "#fff", background: "rgba(235, 66, 81, 0.92)", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: deletingSessions ? "wait" : "pointer" }} onClick={() => void confirmDeleteSessions()} disabled={deletingSessions}>{deletingSessions ? "Deleting..." : deleteTarget === "all" ? "Delete all sessions" : "Delete session"}</button>
            </footer>
          </section>
        </div>
      )}

      {/* 3-Column Desktop Workspace Shell */}
      <main className="workspace">
        {/* LEFT RAIL: DESKTOP WORKSPACE SESSIONS & FILTERS */}
        <aside className="leftRail">
          <Link href="/" className="railBrand" title="Return to Landing Page">
            <div className="railBrandLogo">
              <Image src="/logo.png" alt="Silfable Logo" width={26} height={26} className="h-6 w-6 object-contain" />
            </div>
            <span className="railBrandTitle">SILFABLE</span>
          </Link>

          <button onClick={() => openNewSession()} className="newSession">
            + NEW SESSION
          </button>

          {/* Session Filters */}
          <div className="sessionFilters">
            {(["all", "agent", "mission"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSessionFilter(filter)}
                className={sessionFilter === filter ? "active" : ""}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Session List */}
          <div className="sessionList">
            <div className="sessionListHeader">
              <p>SESSIONS</p>
              <button
                type="button"
                onClick={() => void handleDeleteAllSessions()}
                disabled={sessions.length === 0}
                title="Delete all sessions and messages"
              >
                <Trash2 className="size-3" />
                Clear all
              </button>
            </div>
            {sessions
              .filter((s) => sessionFilter === "all" || s.filter === sessionFilter || (sessionFilter === "mission" && s.filter === "pump"))
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setWorkspaceView("chat");
                  }}
                  className={activeSessionId === s.id ? "active" : ""}
                >
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.workspace === "evm" ? `${getWebEvmChain(s.chainKey ?? "")?.name ?? "EVM"} · ${shortWallet(s.sessionWalletAddress)}` : s.workspace === "bridge" ? `Bridge → ${getWebEvmChain(s.chainKey ?? "")?.name ?? "EVM"}` : `Solana · ${new Date(s.updatedAt).toLocaleTimeString()}`}</small>
                  </div>
                  <span
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="ml-auto p-1 text-slate-500 hover:text-rose-400"
                    role="button"
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 className="size-3" />
                  </span>
                </button>
              ))}
          </div>

          <nav className="bottomNav">
            <button className={workspaceView === "missions" ? "active" : ""} onClick={() => setWorkspaceView("missions")}>Missions</button>
            <button onClick={openSettings}>Settings</button>
            <button onClick={() => void handleSignOut()}>Sign out</button>
          </nav>

          <div className="runtimeBadge">
            <span /> MAINNET GUARDED - READY
          </div>
        </aside>

        {/* CENTER STAGE: CONVERSATION CHAT FEED & COMPOSER */}
        <section className="centerStage">
          {workspaceView === "missions" ? (
            <WebMissionsView
              sessions={sessions.filter((session) => session.filter === "mission" || session.filter === "pump")}
              onCreateMission={() => openNewSession("", "mission")}
              onOpenSession={(sessionId) => {
                setActiveSessionId(sessionId);
                setWorkspaceView("chat");
              }}
            />
          ) : sessions.length === 0 ? (
            <div className="homeState flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="brandMark large mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3157ff]/50 bg-[rgba(49,87,255,0.1)]">
                <Image src="/logo.png" alt="Silfable Logo" width={32} height={32} className="h-8 w-8 object-contain" />
              </span>
              <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.22em] text-[#3157ff]">
                Understand. Constrain. Verify.
              </p>
              <h1 className="mb-5 font-serif text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                What should Silfable help you do?
              </h1>
              <p className="mb-8 max-w-lg text-sm leading-6 text-[#7f8aa7]">
                Start with a prompt. Silfable will create a restricted session for this connected wallet.
              </p>
              <div className="composer mx-auto max-w-[680px] w-full mb-6 relative">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      openNewSession(input);
                    }
                  }}
                  placeholder="Plan a Mainnet task or ask about your portfolio..."
                  rows={1}
                />
                <span>NEW SESSION</span>
                <button disabled={!input.trim()} onClick={() => openNewSession(input)}>↑</button>
              </div>
              <div className="suggestions flex flex-wrap justify-center gap-3">
                <button onClick={() => openNewSession("Review my configured wallet balances and recent finalized activity.")}>WALLET ACTIVITY</button>
                <button onClick={() => openNewSession("Plan a conservative Solana swap with explicit limits.")}>PLAN A SWAP</button>
                <button onClick={() => openNewSession("Review this Pump.fun mint and prepare a restricted analysis preview.")}>PUMP.FUN ANALYSIS</button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="homeState flex flex-col justify-center items-center h-full px-6 text-center">
              <span className="brandMark large mb-4 block w-14 h-14 border border-[#3157ff]/50 rounded-2xl bg-[rgba(49,87,255,0.1)] flex items-center justify-center">
                <Image src="/logo.png" alt="Silfable Logo" width={32} height={32} className="h-8 w-8 object-contain" />
              </span>
              <p className="tagline text-[9px] tracking-[0.22em] uppercase text-[#3157ff] font-mono mb-4">Understand. Constrain. Verify.</p>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-10 tracking-tight leading-tight">What should Silfable help you <br/>do?</h1>
              
              <div className="composer mx-auto max-w-[680px] w-full mb-6 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Plan a Mainnet task or ask about your portfolio..."
                  rows={1}
                />
                <span>MODE / CHAT</span>
                <button disabled={!input.trim() || loading} onClick={() => handleSendMessage()}>↑</button>
              </div>

              <div className="suggestions flex flex-wrap justify-center gap-3">
                <button onClick={() => handleSendMessage("Explain exactly what you can and cannot do in this application.")}>AI CAPABILITIES</button>
                <button onClick={() => handleSendMessage("Review my configured wallet balances and recent finalized activity.")}>WALLET ACTIVITY</button>
                <button onClick={() => handleSendMessage("Draft a conservative SOL accumulation mission with explicit limits.")}>PLAN A MISSION</button>
                <button onClick={() => handleSendMessage("Explain the current Mainnet execution restrictions.")}>RUNTIME SAFETY</button>
              </div>
            </div>
          ) : (
            <div className="conversation">
              <header>
                <span>MODE / {(activeSession?.workspace ?? "solana").toUpperCase()} · {activeSession?.chainKey ? getWebEvmChain(activeSession.chainKey)?.name.toUpperCase() : "MAINNET"}</span>
                <span>RESTRICTED POSTURE</span>
              </header>

              {/* Messages Feed */}
              <div className="messages" ref={messagesViewportRef}>

                {messages
                  .filter((msg) => msg.sessionId === activeSessionId)
                  .map((msg) => (
                  <article key={msg.id} className={msg.role}>
                    {msg.role === "assistant" && <div className="avatar shrink-0">S</div>}
                    <div>
                      <small className="text-[8px] tracking-[0.1em] text-[#7f8aa7] uppercase mb-1.5 block">
                        {msg.role === "user" ? "USER" : "SILFABLE AGENT"}
                      </small>
                      <div className="markdownMessage">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Desktop-Migrated Proposal Cards */}
                      {msg.proposal && msg.proposal.type === "evm_swap" ? (
                        <EvmSwapPreviewCard proposal={msg.proposal} busy={bridgeBusy} onPrepare={() => handlePrepareEvmSwap(msg.proposal!, msg.id)} />
                      ) : msg.proposal && msg.proposal.type === "jupiter_swap" ? (
                        <JupiterSwapPreviewCard
                          proposal={msg.proposal}
                          status={msg.proposal.status}
                          onExecute={() => handleExecuteJupiterSwap(msg.proposal!, msg.id)}
                          maxSlippageBps={settings.maxSlippageBps}
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
                          maxSlippageBps={settings.maxSlippageBps}
                        />
                      ) : null}
                    </div>
                  </article>
                ))}

                {loading && (
                  <div className="typingIndicator">
                    <span /><span /><span />
                  </div>
                )}
              </div>

              {/* Quick Suggestions Chips & Composer */}
              <div className="conversationComposer">
                {activeSession?.workspace === "bridge" && (
                  <SolanaBridgePanel
                    onPrepare={handlePrepareSolanaBridge}
                    busy={bridgeBusy}
                    boundDestination={activeSession.chainKey as SolanaBridgeRequest["destination"]}
                  />
                )}
                {activeSession?.workspace === "evm" && (
                  <div className={`evmReleaseNotice ${evmWalletMatchesSession ? "" : "evmWalletMismatch"}`}>
                    <strong>{getWebEvmChain(activeSession.chainKey ?? "")?.name ?? "EVM"} · {shortWallet(activeSession.sessionWalletAddress)}</strong>
                    <span>{evmWalletMatchesSession
                      ? "Wallet ownership is verified and the browser account/chain match this session. USDG ↔ ETH quote preparation is available through Uniswap after its API key is configured; wallet broadcast remains gated pending transaction-pipeline validation."
                      : `Execution locked: switch the browser wallet to ${shortWallet(activeSession.sessionWalletAddress)} on ${expectedEvmChain?.name ?? "the bound chain"}.`}</span>
                  </div>
                )}
                <div className="suggestions">
                  <button
                    onClick={() =>
                      handleSendMessage(
                        "Swap 0.001 SOL to USDC on Mainnet with restricted wallet approval."
                      )
                    }
                  >
                    0.001 SOL to USDC
                  </button>
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
                    placeholder="Enter your AI trading instruction... e.g. Swap 0.001 SOL to USDC"
                    rows={1}
                  />
                  <span>MODE / CHAT</span>
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
            <h3 className="mb-4 text-[9px] tracking-[0.2em] text-[#7ba2ff] uppercase flex items-center gap-2"><span className="w-5 h-px bg-[#7ba2ff]" />PORTFOLIO</h3>
            <div className="mb-4">
              <span className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7]">{activeSession?.workspace === "evm" ? "ROBINHOOD PORTFOLIO" : "SOLANA PORTFOLIO"}</span>
              <div className="text-[28px] font-bold mt-1 text-white">
                {portfolioTotalUsd !== null && portfolioTotalUsd > 0
                  ? `$${portfolioTotalUsd.toFixed(2)}`
                  : walletBalance === null
                    ? "—"
                    : `${walletBalance.toFixed(6)} ${activeSession?.workspace === "evm" ? "ETH" : "SOL"}`}
              </div>
              <div className="text-[8px] text-[#7f8aa7] mt-1 mb-3">{portfolioStatus}</div>
              {portfolioAssets.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {portfolioAssets.slice(0, 5).map((asset, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-white/5 px-2 py-1.5 rounded">
                      <span className="text-[#eef2ff] font-medium">{asset.symbol}</span>
                      <div className="text-right">
                        <span className="text-white block">{asset.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        {asset.valueUsd > 0 && <span className="text-[#7ba2ff] text-[8px]">${asset.valueUsd.toFixed(2)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-[rgb(148,163,184,0.16)] bg-transparent hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2 font-mono text-[9px] text-[#eef2ff]">
                  <span className="text-[#7f8aa7]">PRIMARY</span> {shortWallet(accountWalletAddress ?? undefined)}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => void fetchWalletBalance()} className="text-[8px] text-[#7ba2ff] tracking-[0.1em] uppercase hover:text-white">REFRESH</button>
                  <button onClick={() => accountWalletAddress && navigator.clipboard.writeText(accountWalletAddress)} className="text-[8px] text-[#7ba2ff] tracking-[0.1em] uppercase hover:text-white">COPY</button>
                </div>
              </div>

              {activeSession?.workspace === "evm" && activeSession.sessionWalletAddress && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5">
                  <div className="flex items-center gap-2 font-mono text-[9px] text-[#eef2ff]"><span className="text-cyan-300">SESSION EVM</span> {shortWallet(activeSession.sessionWalletAddress)}</div>
                  <button onClick={() => navigator.clipboard.writeText(activeSession.sessionWalletAddress!)} className="text-[8px] text-[#7ba2ff] tracking-[0.1em] uppercase hover:text-white">COPY</button>
                </div>
              )}

            </div>
          </section>

          <section className="railSection">
            <h3 className="mb-4 text-[9px] tracking-[0.2em] text-[#7ba2ff] uppercase flex items-center gap-2"><span className="w-5 h-px bg-[#7ba2ff]" />RUNTIME & COST</h3>
            <div className="text-[10px] font-mono text-white flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${runtimeUsage.totalTokens > 0 ? "bg-[#00df86]" : "bg-white opacity-50"}`} />
              {runtimeUsage.model}
            </div>
            
            <div className="mb-4 border-b border-[rgb(148,163,184,0.16)] pb-4" title="Input tokens reported by the provider for the most recent AI request.">
              <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#7f8aa7]">
                <span>Context · last turn</span>
                <span className="text-[#eef2ff]">{formatTokenCount(lastTurnContextTokens)} / {formatTokenCount(providerContextLimit)} · {contextUsagePercent}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.12]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#5366e9] to-[#16b7d6] transition-[width] duration-200" style={{ width: `${contextUsagePercent}%` }} />
              </div>
              <p className="mt-2 font-mono text-[8px] text-[#7f8aa7]">Output cap: {formatTokenCount(Number(settings.outputLimit) || 0)} tokens</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7] mb-1">INPUT</div>
                <div className="text-[11px] font-mono font-semibold">{runtimeUsage.inputTokens.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7] mb-1">OUTPUT</div>
                <div className="text-[11px] font-mono font-semibold">{runtimeUsage.outputTokens.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7] mb-1">TOTAL</div>
                <div className="text-[11px] font-mono font-semibold">{runtimeUsage.totalTokens.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7] mb-1">COST</div>
                <div className="text-[11px] font-mono font-semibold">
                  {runtimeUsage.hasCost ? `$${runtimeUsage.costUsd.toFixed(6)}` : "—"}
                </div>
              </div>
            </div>
            {runtimeUsage.totalTokens === 0 && (
              <p className="mt-4 text-[8px] leading-relaxed text-[#7f8aa7]">
                No OpenRouter usage recorded for this session. Deterministic quote and portfolio requests do not consume AI tokens.
              </p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
