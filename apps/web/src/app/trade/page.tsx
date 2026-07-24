"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  Cpu,
  Settings,
  ShieldAlert,
  Trash2,
  Zap,
} from "lucide-react";
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
import { WebSetupWizard } from "@/components/trade/WebSetupWizard";
import { CloudWorkerSetupModal } from "@/components/trade/CloudWorkerSetupModal";
import { WebNewSessionModal } from "@/components/trade/WebNewSessionModal";

// Dynamically import WalletMultiButton to prevent SSR hydration errors
const WalletMultiButton = dynamic<React.HTMLAttributes<HTMLButtonElement>>(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
  jupiterApiKey: string;
  tavilyApiKey: string;
  openRouterApiKey: string;
  aiModel: string;
  contextBudget: string;
  outputLimit: string;
  temperature: string;
  maxNetworkFee: string;
  maxSlippageBps: string;
  defaultDeadlineMinutes: string;
  priority: "economy" | "standard" | "fast";
  pumpMaxSpendLamports: string;
  pumpTakeProfitBps: string;
  pumpStopLossBps: string;
  pumpMaxOpenPositions: string;
}

const DEFAULT_SETTINGS: WebSetupSettings = {
  customRpcUrl: "",
  jupiterApiKey: "",
  tavilyApiKey: "",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  contextBudget: "128000",
  outputLimit: "8192",
  temperature: "0.7",
  maxNetworkFee: "5000000",
  maxSlippageBps: "100",
  defaultDeadlineMinutes: "30",
  priority: "standard",
  pumpMaxSpendLamports: "1000000",
  pumpTakeProfitBps: "1000",
  pumpStopLossBps: "500",
  pumpMaxOpenPositions: "3",
};

function setupStorageKey(walletAddress: string): string {
  return `silfable_web_setup_v1:${walletAddress}`;
}

export default function TradePage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const activeWalletAddressRef = useRef<string | null>(walletAddress);
  activeWalletAddressRef.current = walletAddress;
  const { connection } = useConnection();
  const router = useRouter();

  // Redirect to /connect if wallet is not connected
  useEffect(() => {
    if (!connected || !publicKey) {
      router.replace("/connect");
    }
  }, [connected, publicKey, router]);

  // Workspace Mode: restricted Mainnet parity with the desktop app.
  const mode = "restricted";

  // Setup Flow State
  const [setupCompleted, setSetupCompleted] = useState<boolean>(false);
  const [editingSetup, setEditingSetup] = useState<boolean>(false);
  const [settings, setSettings] = useState<WebSetupSettings>(DEFAULT_SETTINGS);
  const [setupStep, setSetupStep] = useState<number>(1);

  // IndexedDB Sessions & Messages State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "agent" | "mission" | "pump">("all");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<{
    title: string;
    mode: "agent" | "mission" | "pump";
    prompt: string;
    pumpScope: "exact_mint" | "watchlist" | "discovery";
    pumpMint: string;
  }>({ title: "", mode: "agent", prompt: "", pumpScope: "exact_mint", pumpMint: "" });
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [nav, setNav] = useState("sessions");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState("Refreshing Mainnet balance...");

  // Cloud Worker 24/7 State
  const [showCloudWorkerModal, setShowCloudWorkerModal] = useState(false);
  const [cloudSessionState, setCloudSessionState] = useState<{
    active: boolean;
    session: any | null;
  }>({ active: false, session: null });

  // Poll Cloud Worker Session Status every 5 seconds when wallet is connected
  useEffect(() => {
    if (!walletAddress) return;
    let timer: NodeJS.Timeout;

    async function checkCloudStatus() {
      try {
        const res = await fetch(`/api/agent/session/status?walletAddress=${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          setCloudSessionState({ active: data.active, session: data.session });
        }
      } catch (err) {
        console.error("Failed to fetch cloud worker status:", err);
      }
    }

    void checkCloudStatus();
    timer = setInterval(() => {
      void checkCloudStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, [walletAddress]);

  async function handleKillCloudSession() {
    if (!walletAddress || !cloudSessionState.session?.id) return;
    if (!window.confirm("Are you sure you want to stop the 24/7 Cloud Worker agent?")) return;

    try {
      await fetch("/api/agent/session/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: cloudSessionState.session.id }),
      });
      setCloudSessionState({ active: false, session: null });
    } catch (err) {
      alert("Failed to stop cloud session.");
    }
  }

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

  // --------------------------------------------------------------------------
  // INITIALIZATION: Load Setup & Sessions
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      if (!walletAddress) return;
      try {
        setSetupCompleted(false);
        setEditingSetup(false);
        setSettings(DEFAULT_SETTINGS);
        setSetupStep(1);
        setSessions([]);
        setMessages([]);
        setActiveSessionId("");
        setLoading(false);
        setTxStatus(null);

        // Load Settings
        const savedSetup = localStorage.getItem(setupStorageKey(walletAddress));
        if (savedSetup) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSetup) });
          setSetupCompleted(true);
        }

        // Load IndexedDB Sessions
        const storedSessions = await getAllSessions(walletAddress);
        if (cancelled) return;
        const legacyPlaceholder = storedSessions.length === 1
          && ["Default Trading Workspace", "New trading workspace"].includes(storedSessions[0].title);
        if (legacyPlaceholder) {
          const placeholderMessages = await getSessionMessages(walletAddress, storedSessions[0].id);
          if (cancelled) return;
          if (placeholderMessages.length === 0) {
            await deleteSession(walletAddress, storedSessions[0].id);
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
          setActiveSessionId(storedSessions[0].id);
          const initialMsgs = await getSessionMessages(walletAddress, storedSessions[0].id);
          if (cancelled) return;
          setMessages(initialMsgs);
        }
      } catch (err) {
        console.error("Workspace initialization error:", err);
      }
    }

    if (connected && walletAddress) {
      void initWorkspace();
    }

    return () => {
      cancelled = true;
    };
  }, [connected, walletAddress]);

  // Load Messages when Active Session changes
  useEffect(() => {
    let cancelled = false;

    async function loadActiveMessages() {
      if (!walletAddress || !activeSessionId) return;
      const msgs = await getSessionMessages(walletAddress, activeSessionId);
      if (!cancelled) setMessages(msgs);
    }
    void loadActiveMessages();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, walletAddress]);

  // Fetch the single connected Mainnet wallet through the configured RPC.
  const fetchWalletBalance = useCallback(async () => {
    if (!publicKey) return;
    setPortfolioStatus("Refreshing Mainnet balance...");
    try {
      const response = await fetch("/api/solana/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          customRpcUrl: settings.customRpcUrl.trim() || undefined,
        }),
      });
      const result = await response.json() as { sol?: unknown; slot?: unknown; source?: unknown; error?: unknown };
      if (!response.ok || typeof result.sol !== "number") {
        throw new Error(typeof result.error === "string" ? result.error : "Saldo Mainnet tidak dapat dimuat.");
      }
      setWalletBalance(result.sol);
      const source = result.source === "custom" ? "Custom RPC" : "Default Mainnet RPC";
      setPortfolioStatus(`${source}${typeof result.slot === "number" ? ` - slot ${result.slot.toLocaleString()}` : ""}`);
    } catch (error) {
      setWalletBalance(null);
      setPortfolioStatus(error instanceof Error ? error.message : "Saldo Mainnet tidak dapat dimuat.");
    }
  }, [publicKey, settings.customRpcUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWalletBalance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchWalletBalance]);

  // --------------------------------------------------------------------------
  // SESSION HANDLERS (IndexedDB CRUD)
  // --------------------------------------------------------------------------
  async function handleCreateNewSession() {
    if (!walletAddress) return;
    const newId = `session_${Date.now()}`;
    const now = Date.now();
    const fallbackTitle =
      sessionDraft.mode === "pump"
        ? "Pump.fun research session"
        : sessionDraft.mode === "mission"
          ? "Mainnet mission session"
          : "Agent chat session";
    const newSession: SessionItem = {
      id: newId,
      title: sessionDraft.title.trim() || fallbackTitle,
      filter: sessionDraft.mode,
      createdAt: now,
      updatedAt: now,
    };

    await saveSession(walletAddress, newSession);
    const updatedSessions = await getAllSessions(walletAddress);
    setSessions(updatedSessions);
    setActiveSessionId(newId);
    setShowSessionModal(false);
    setSessionDraft({ title: "", mode: "agent", prompt: "", pumpScope: "exact_mint", pumpMint: "" });

    // Empty session, no init message so HomeComposer is shown
    setMessages([]);
    setInput(sessionDraft.prompt.trim());
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    if (!walletAddress) return;
    e.stopPropagation();
    const target = sessions.find((session) => session.id === id);
    if (!window.confirm(`Delete "${target?.title ?? "this session"}" and all of its messages?`)) {
      return;
    }
    await deleteSession(walletAddress, id);
    const updated = await getAllSessions(walletAddress);
    setSessions(updated);
    if (activeSessionId === id) {
      const nextSession = updated[0];
      setActiveSessionId(nextSession?.id ?? "");
      setMessages(nextSession ? await getSessionMessages(walletAddress, nextSession.id) : []);
    }
  }

  async function handleDeleteAllSessions() {
    if (!walletAddress) return;
    if (!window.confirm("Delete every web session and its messages? Wallet settings and API configuration will be kept.")) {
      return;
    }

    await deleteAllSessions(walletAddress);
    setSessions([]);
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setNav("sessions");
  }

  // --------------------------------------------------------------------------
  // SETTINGS HANDLERS
  // --------------------------------------------------------------------------
  function persistSettings() {
    if (!walletAddress) return;
    try {
      localStorage.setItem(setupStorageKey(walletAddress), JSON.stringify(settings));
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

  // --------------------------------------------------------------------------
  // CHAT & EXECUTION ENGINE HANDLERS
  // --------------------------------------------------------------------------
  async function handleSendMessage(promptText?: string) {
    const text = promptText || input;
    if (!walletAddress || !activeSessionId || !text.trim() || loading) return;
    const requestWalletAddress = walletAddress;

    const userMsg: WebMessage = {
      id: `user_${Date.now()}`,
      sessionId: activeSessionId,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    await saveMessage(walletAddress, userMsg);
    if (!promptText) setInput("");
    setLoading(true);

    try {
      const activeSession = sessions.find((session) => session.id === activeSessionId);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          mode,
          sessionMode: activeSession?.filter === "mission" || activeSession?.filter === "pump" ? "mission" : "agent",
          walletAddress: publicKey?.toBase58() ?? null,
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

      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage(walletAddress, assistantMsg);

      // Update session timestamp in IndexedDB
      const activeSess = sessions.find((s) => s.id === activeSessionId);
      if (activeSess) {
        const updated = { ...activeSess, updatedAt: Date.now() };
        await saveSession(walletAddress, updated);
        const reloaded = await getAllSessions(walletAddress);
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
      await saveMessage(walletAddress, errMsg);
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
    const activeWalletAddress = walletAddress;

    if (!proposal.quoteResponse) {
      setTxStatus("Swap quote is missing. Ask the AI to refresh the proposal first.");
      return;
    }

    setTxStatus("Preparing Jupiter swap transaction. No broadcast until wallet approval.");

    try {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.proposal
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
      const signature = await sendTransaction(transaction, connection);
      setTxStatus(`Mainnet swap submitted. Signature: ${signature.slice(0, 12)}...`);
      await connection.confirmTransaction(signature, "confirmed");
      await fetchWalletBalance();

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.proposal) {
            const updated = { ...m, proposal: { ...m.proposal, status: "signed" as const } };
            void saveMessage(activeWalletAddress, updated);
            return updated;
          }
          return m;
        })
      );
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTxStatus(`Swap cancelled or failed safely: ${message}`);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.proposal) {
            const updated = { ...m, proposal: { ...m.proposal, status: "failed" as const } };
            void saveMessage(activeWalletAddress, updated);
            return updated;
          }
          return m;
        })
      );
    }
  }

  // Loading Gate while checking Wallet Connection
  if (!connected || !publicKey) {
    return (
      <div className="tradeDesktopShell gateScreenLayout">
        <div className="flex items-center justify-center min-h-screen text-slate-400 font-mono text-sm">
          Redirecting to wallet onboarding...
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // GATE 2: SETUP / SETTINGS STEPPER GATE (FIRST TIME OR EDITING)
  // --------------------------------------------------------------------------
  if (!setupCompleted || editingSetup) {
    return (
      <WebSetupWizard
        publicAddress={publicKey.toBase58()}
        setupCompleted={setupCompleted}
        editingSetup={editingSetup}
        setupStep={setupStep}
        setSetupStep={setSetupStep}
        settings={settings}
        setSettings={setSettings}
        onPersistSettings={persistSettings}
        onSaveSettings={handleSaveSettings}
        onReturnToWorkspace={() => setEditingSetup(false)}
      />
    );
  }

  return (
    <div className="layout">
      <WebNewSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onCreateRestrictedSession={async ({ title, workspace, mode }) => {
          if (!walletAddress) return;
          const filterType = workspace === "pump" ? "pump" : mode;
          const draftSession: SessionItem = {
            id: "",
            title,
            filter: filterType,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const saved = await saveSession(walletAddress, draftSession);
          if (saved) {
            setSessions((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
            setActiveSessionId(saved.id);
          }
        }}
        onSelectFullAccess={() => {
          setShowCloudWorkerModal(true);
        }}
      />

      <CloudWorkerSetupModal
        walletAddress={publicKey.toBase58()}
        isOpen={showCloudWorkerModal}
        onClose={() => setShowCloudWorkerModal(false)}
        onSessionStarted={(sessionId, agentPubKey) => {
          setActiveSessionId(sessionId);
          setNav("sessions");
        }}
      />

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

          <button onClick={() => setShowSessionModal(true)} className="newSession">
            + NEW SESSION
          </button>

          {/* Session Filters */}
          <div className="sessionFilters">
            {(["all", "agent", "mission", "pump"] as const).map((filter) => (
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
              .filter((s) => sessionFilter === "all" || s.filter === sessionFilter)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={activeSessionId === s.id ? "active" : ""}
                >
                  <div>
                    <strong>{s.title}</strong>
                    <small>{new Date(s.updatedAt).toLocaleTimeString()}</small>
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
            <button className={nav === "memory" ? "active" : ""} onClick={() => setNav("memory")}>
              Memory
            </button>
            <button className={nav === "missions" ? "active" : ""} onClick={() => setNav("missions")}>
              Missions
            </button>
            <button onClick={openSettings}>
              Settings
            </button>
          </nav>

          <div className="runtimeBadge">
            <span /> MAINNET GUARDED - READY
          </div>
        </aside>

        {/* CENTER STAGE: CONVERSATION CHAT FEED & COMPOSER */}
        <section className="centerStage">
          {nav === "memory" ? (
            <div className="workspacePanel">
              <header>
                <span className="modalKicker">Memory</span>
                <h1>Durable lessons stay reviewable.</h1>
                <p>Web memory is local-first. Future agent runs may reference approved lessons, but no secret or private key is stored here.</p>
              </header>
              <div className="panelGrid">
                <article className="panelCard">
                  <span>01</span>
                  <strong>Approved lessons</strong>
                  <p>No durable lessons saved yet. When the AI proposes a reusable rule, it will appear here for approval.</p>
                </article>
                <article className="panelCard">
                  <span>02</span>
                  <strong>Trading constraints</strong>
                  <p>Restricted Mainnet, wallet approval required, max slippage {settings.maxSlippageBps} bps, max network fee {settings.maxNetworkFee} lamports.</p>
                </article>
                <article className="panelCard">
                  <span>03</span>
                  <strong>Research notes</strong>
                  <p>Tavily-backed research is available only when the API key is configured in Settings.</p>
                </article>
              </div>
            </div>
          ) : nav === "missions" ? (
            <div className="workspacePanel">
              <header>
                <span className="modalKicker">Missions</span>
                <h1>Every mission has limits.</h1>
                <p>Sessions created as Mission or Pump.fun are listed here with their current restricted posture.</p>
              </header>
              <div className="panelList">
                {sessions.filter((session) => session.filter === "mission" || session.filter === "pump").length === 0 ? (
                  <article className="panelCard">
                    <span>EMPTY</span>
                    <strong>No mission sessions yet</strong>
                    <p>Create a new Mission or Pump.fun session to track goals, stop conditions, and future receipts.</p>
                  </article>
                ) : (
                  sessions
                    .filter((session) => session.filter === "mission" || session.filter === "pump")
                    .map((session) => (
                      <article key={session.id} className="panelCard">
                        <span>{session.filter}</span>
                        <strong>{session.title}</strong>
                        <p>Restricted - wallet approval required - updated {new Date(session.updatedAt).toLocaleString()}</p>
                        <button onClick={() => { setActiveSessionId(session.id); setNav("sessions"); }} className="railBtn">Open session</button>
                      </article>
                    ))
                )}
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="homeState flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="brandMark large mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3157ff]/50 bg-[rgba(49,87,255,0.1)]">
                <Image src="/logo.png" alt="Silfable Logo" width={32} height={32} className="h-8 w-8 object-contain" />
              </span>
              <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.22em] text-[#3157ff]">
                Your workspace is empty
              </p>
              <h1 className="mb-5 font-serif text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Create a session to begin.
              </h1>
              <p className="mb-8 max-w-lg text-sm leading-6 text-[#7f8aa7]">
                Sessions keep each conversation, mission, and execution plan organized under this wallet.
              </p>
              <button type="button" onClick={() => setShowSessionModal(true)} className="newSession max-w-64 px-8">
                + NEW SESSION
              </button>
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
                <span>MODE / RESTRICTED MAINNET</span>
                <span>RESTRICTED POSTURE</span>
              </header>

              {/* Messages Feed */}
              <div className="messages">
                {/* Banner Status Notifications */}
                <div className="notice info mb-4">
                  <span>ⓘ</span>
                  <div>
                    <strong>Restricted Mainnet Active</strong>
                    <p>AI can prepare quotes and unsigned transactions. Your connected wallet must approve every broadcast.</p>
                  </div>
                </div>

                {txStatus && (
                  <div className="notice success mb-4">
                    <span>✓</span>
                    <div>
                      <strong>Status Update</strong>
                      <p>{txStatus}</p>
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
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
                      {msg.proposal && msg.proposal.type === "jupiter_swap" ? (
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
                          onExecute={() => setTxStatus("Limit order web execution is not enabled yet.")}
                        />
                      ) : msg.proposal ? (
                        <PumpTradePreviewCard
                          proposal={msg.proposal}
                          status={msg.proposal.status}
                          onExecuteOptionA={() => setTxStatus("Pump.fun web execution is not enabled yet.")}
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
              <span className="text-[8px] tracking-[0.16em] uppercase text-[#7f8aa7]">VERIFIED PORTFOLIO</span>
              <div className="text-[28px] font-bold mt-1 text-white">
                {walletBalance === null ? "—" : walletBalance.toFixed(6)} SOL
              </div>
              <div className="text-[8px] text-[#7f8aa7] mt-1">{portfolioStatus}</div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-[rgb(148,163,184,0.16)] bg-transparent hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2 font-mono text-[9px] text-[#eef2ff]">
                  <span className="text-[#7f8aa7]">PRIMARY</span> {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => void fetchWalletBalance()} className="text-[8px] text-[#7ba2ff] tracking-[0.1em] uppercase hover:text-white">REFRESH</button>
                  <button onClick={() => navigator.clipboard.writeText(publicKey.toBase58())} className="text-[8px] text-[#7ba2ff] tracking-[0.1em] uppercase hover:text-white">COPY</button>
                </div>
              </div>

            </div>
          </section>

          <section className="railSection">
            <h3 className="mb-4 text-[9px] tracking-[0.2em] text-[#7ba2ff] uppercase flex items-center gap-2"><span className="w-5 h-px bg-[#7ba2ff]" />RUNTIME & COST</h3>
            <div className="text-[10px] font-mono text-white flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${runtimeUsage.totalTokens > 0 ? "bg-[#00df86]" : "bg-white opacity-50"}`} />
              {runtimeUsage.model}
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
