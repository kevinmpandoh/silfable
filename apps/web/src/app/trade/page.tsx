"use client";

import React, { useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  Settings,
  Trash2,
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
import {
  createWebVault,
  importWalletIntoVault,
  loadWebVault,
  removeWalletFromVault,
  StoredWebVault,
  verifyWebVaultPassword,
} from "@/lib/cryptoVault";

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

export default function TradePage() {
  const { publicKey, sendTransaction, connected } = useWallet();
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
  const [webVault, setWebVault] = useState<StoredWebVault | null>(null);
  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultConfirm, setVaultConfirm] = useState("");
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [walletSecretInput, setWalletSecretInput] = useState("");
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);

  // IndexedDB Sessions & Messages State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session_default");
  const [sessionFilter, setSessionFilter] = useState<"all" | "agent" | "mission" | "pump">("all");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<{
    title: string;
    mode: "agent" | "mission" | "pump";
    prompt: string;
    walletScope: "connected" | "chat_only";
    pumpScope: "exact_mint" | "watchlist" | "discovery";
    pumpMint: string;
  }>({ title: "", mode: "agent", prompt: "", walletScope: "connected", pumpScope: "exact_mint", pumpMint: "" });
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [nav, setNav] = useState("sessions");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState("Refreshing Mainnet balance...");
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
    async function initWorkspace() {
      try {
        // Load Settings
        const savedSetup = localStorage.getItem("silfable_web_setup_v1");
        if (savedSetup) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSetup) });
          setSetupCompleted(true);
        }
        setWebVault(loadWebVault());

        // Load IndexedDB Sessions
        const storedSessions = await getAllSessions();
        if (storedSessions.length === 0) {
          const initSession: SessionItem = {
            id: "session_default",
            title: "Default Trading Workspace",
            filter: "all",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveSession(initSession);
          setSessions([initSession]);
          setActiveSessionId(initSession.id);

          // Empty session, no welcome message so HomeComposer is shown
          setMessages([]);
        } else {
          setSessions(storedSessions);
          setActiveSessionId(storedSessions[0].id);
          const initialMsgs = await getSessionMessages(storedSessions[0].id);
          setMessages(initialMsgs);
        }
      } catch (err) {
        console.error("Workspace initialization error:", err);
      }
    }

    if (connected && publicKey) {
      initWorkspace();
    }
  }, [connected, publicKey]);

  // Load Messages when Active Session changes
  useEffect(() => {
    async function loadActiveMessages() {
      if (!activeSessionId) return;
      const msgs = await getSessionMessages(activeSessionId);
      setMessages(msgs);
    }
    loadActiveMessages();
  }, [activeSessionId]);

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
      setPortfolioStatus(`${source}${typeof result.slot === "number" ? ` · slot ${result.slot.toLocaleString()}` : ""}`);
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

    await saveSession(newSession);
    const updatedSessions = await getAllSessions();
    setSessions(updatedSessions);
    setActiveSessionId(newId);
    setShowSessionModal(false);
    setSessionDraft({ title: "", mode: "agent", prompt: "", walletScope: "connected", pumpScope: "exact_mint", pumpMint: "" });

    // Empty session, no init message so HomeComposer is shown
    setMessages([]);
    setInput(sessionDraft.prompt.trim());
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (sessions.length <= 1) {
      alert("At least one trading workspace session must remain active.");
      return;
    }
    const target = sessions.find((session) => session.id === id);
    if (!window.confirm(`Delete "${target?.title ?? "this session"}" and all of its messages?`)) {
      return;
    }
    await deleteSession(id);
    const updated = await getAllSessions();
    setSessions(updated);
    if (activeSessionId === id) {
      setActiveSessionId(updated[0].id);
      const msgs = await getSessionMessages(updated[0].id);
      setMessages(msgs);
    }
  }

  async function handleDeleteAllSessions() {
    if (!window.confirm("Delete every web session and its messages? Wallet settings and API configuration will be kept.")) {
      return;
    }

    await deleteAllSessions();
    const now = Date.now();
    const freshSession: SessionItem = {
      id: `session_${now}`,
      title: "New trading workspace",
      filter: "agent",
      createdAt: now,
      updatedAt: now,
    };
    await saveSession(freshSession);
    setSessions([freshSession]);
    setActiveSessionId(freshSession.id);
    setMessages([]);
    setInput("");
    setNav("sessions");
  }

  // --------------------------------------------------------------------------
  // SETTINGS HANDLERS
  // --------------------------------------------------------------------------
  async function handleSaveSettings() {
    try {
      localStorage.setItem("silfable_web_setup_v1", JSON.stringify(settings));
      setSetupCompleted(true);
      setEditingSetup(false);
    } catch {
      alert("Failed to save settings.");
    }
  }

  function openSettings() {
    setSetupStep(6);
    setEditingSetup(true);
  }

  async function handleCreateOrUnlockVault() {
    setVaultMessage(null);
    if (vaultPassword.length < 8) {
      setVaultMessage("Use at least 8 characters for the local web vault password.");
      return;
    }
    if (!webVault) {
      if (vaultPassword !== vaultConfirm) {
        setVaultMessage("The password confirmation does not match.");
        return;
      }
      try {
        const created = await createWebVault(vaultPassword);
        setWebVault(created);
        setVaultUnlocked(true);
        setVaultMessage("Encrypted web vault created and unlocked for this browser session.");
      } catch (error) {
        setVaultMessage(error instanceof Error ? error.message : "The web vault could not be created.");
      }
      return;
    }

    if (await verifyWebVaultPassword(webVault, vaultPassword)) {
      setVaultUnlocked(true);
      setVaultMessage("Web vault unlocked for this browser session.");
    } else {
      setVaultUnlocked(false);
      setVaultMessage("The web vault password is incorrect.");
    }
  }

  async function handleImportWallet() {
    if (!webVault || !vaultUnlocked || !publicKey) {
      setVaultMessage("Unlock the web vault before importing a wallet.");
      return;
    }
    try {
      const next = await importWalletIntoVault(webVault, walletSecretInput, vaultPassword, publicKey.toBase58());
      setWebVault(next);
      setWalletSecretInput("");
      setVaultMessage("Wallet imported. Its secret key remains encrypted in this browser.");
    } catch (error) {
      setVaultMessage(error instanceof Error ? error.message : "The wallet could not be imported.");
    }
  }

  function handleRemoveImportedWallet(walletId: string) {
    if (!webVault || !window.confirm("Remove this encrypted wallet from this browser vault?")) return;
    setWebVault(removeWalletFromVault(webVault, walletId));
    setVaultMessage("Wallet removed from this browser vault.");
  }

  // --------------------------------------------------------------------------
  // CHAT & EXECUTION ENGINE HANDLERS
  // --------------------------------------------------------------------------
  async function handleSendMessage(promptText?: string) {
    const text = promptText || input;
    if (!text.trim() || loading) return;

    const userMsg: WebMessage = {
      id: `user_${Date.now()}`,
      sessionId: activeSessionId,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    await saveMessage(userMsg);
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
      await saveMessage(assistantMsg);

      // Update session timestamp in IndexedDB
      const activeSess = sessions.find((s) => s.id === activeSessionId);
      if (activeSess) {
        const updated = { ...activeSess, updatedAt: Date.now() };
        await saveSession(updated);
        const reloaded = await getAllSessions();
        setSessions(reloaded);
      }
    } catch {
      const errMsg: WebMessage = {
        id: `err_${Date.now()}`,
        sessionId: activeSessionId,
        role: "assistant",
        content: "Failed to connect to AI Trading service. Please check your network and try again.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage(errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteJupiterSwap(proposal: WebProposal, msgId: string) {
    if (!connected || !publicKey) {
      alert("Please connect your Solana wallet (Phantom / Solflare) first!");
      return;
    }

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
            saveMessage(updated);
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
            saveMessage(updated);
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
        webVault={webVault}
        vaultPassword={vaultPassword}
        setVaultPassword={setVaultPassword}
        vaultConfirm={vaultConfirm}
        setVaultConfirm={setVaultConfirm}
        vaultUnlocked={vaultUnlocked}
        walletSecretInput={walletSecretInput}
        setWalletSecretInput={setWalletSecretInput}
        vaultMessage={vaultMessage}
        onCreateOrUnlockVault={handleCreateOrUnlockVault}
        onImportWallet={handleImportWallet}
        onRemoveWallet={handleRemoveImportedWallet}
        onSaveSettings={handleSaveSettings}
        onReturnToWorkspace={() => setEditingSetup(false)}
      />
    );
  }

  if (false && publicKey) {
    return (
      <div className="tradeDesktopShell setupScreenLayout">
        <header className="tradeHeader">
          <div className="tradeBrand">
            <Link href="/" className="brandLink">
              <span className="brandMark">
                <Image src="/logo.png" alt="Silfable Logo" width={20} height={20} className="logoImg" />
              </span>
              <strong>SILFABLE</strong>
            </Link>
            <span className="versionBadge">WORKSPACE SETUP</span>
          </div>
          <div className="headerActions">
            <div className="networkBadge">
              <span className="statusDot" />
              <span>{publicKey!.toBase58().slice(0, 4)}...{publicKey!.toBase58().slice(-4)}</span>
            </div>
            {setupCompleted && (
              <button onClick={() => setEditingSetup(false)} className="modeButton">
                Return to Workspace
              </button>
            )}
          </div>
        </header>

        <div className="setupContainer">
          <div className="setupCard">
            <header>
              <div className="setupIcon">⚙</div>
              <div>
                <h1>INITIALIZE RUNTIME SETTINGS</h1>
                <p>Configure wallet credentials, custom RPC endpoints, API keys, and risk boundaries before entering the workspace.</p>
              </div>
            </header>

            <div className="setupBody">
              {/* Stepper Tabs */}
              <div className="setupTabRow">
                <button onClick={() => setSetupStep(1)} className={`setupTab ${setupStep === 1 ? "active" : ""}`}>
                  1. Wallet
                </button>
                <button onClick={() => setSetupStep(2)} className={`setupTab ${setupStep === 2 ? "active" : ""}`}>
                  2. API Keys
                </button>
                <button onClick={() => setSetupStep(3)} className={`setupTab ${setupStep === 3 ? "active" : ""}`}>
                  3. Provider
                </button>
                <button onClick={() => setSetupStep(4)} className={`setupTab ${setupStep === 4 ? "active" : ""}`}>
                  4. Agent Core
                </button>
                <button onClick={() => setSetupStep(5)} className={`setupTab ${setupStep === 5 ? "active" : ""}`}>
                  5. Risk
                </button>
              </div>

              {/* STEP 1: WALLET & SECRET KEY */}
              {setupStep === 1 && (
                <div className="setupStepContent">
                  <div className="field">
                    <span>Active Wallet Address (Connected via Browser)</span>
                    <input type="text" disabled value={publicKey!.toBase58()} />
                    <small>Primary wallet used for restricted web approvals. Private keys are never imported.</small>
                  </div>

                  <div className="notice info">
                    <span>ⓘ</span>
                    <div>
                      <strong>Browser wallet approval only</strong>
                      <p>Web trading uses your connected Phantom/Solflare wallet. Private keys are never imported into the web app.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: API & RPC INTEGRATIONS */}
              {setupStep === 2 && (
                <div className="setupStepContent">
                  <div className="field">
                    <span>Custom Solana RPC Endpoint URL (Helius, QuickNode, Triton, etc.)</span>
                    <input
                      type="url"
                      value={settings.customRpcUrl}
                      onChange={(e) => setSettings({ ...settings, customRpcUrl: e.target.value })}
                      placeholder="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
                    />
                    <small>Optional. Custom RPC endpoints bypass rate-limiting during Pump.fun scans.</small>
                  </div>

                  <div className="field">
                    <span>Jupiter API Key</span>
                    <input
                      type="password"
                      value={settings.jupiterApiKey}
                      onChange={(e) => setSettings({ ...settings, jupiterApiKey: e.target.value })}
                      placeholder="Jupiter API key (Optional)"
                    />
                    <small>Used for Solana Mainnet quote routing and swap metadata.</small>
                  </div>

                  <div className="field">
                    <span>Tavily Research API Key</span>
                    <input
                      type="password"
                      value={settings.tavilyApiKey}
                      onChange={(e) => setSettings({ ...settings, tavilyApiKey: e.target.value })}
                      placeholder="Tavily API key (Optional)"
                    />
                    <small>Enables read-only financial news research for the AI agent.</small>
                  </div>
                </div>
              )}

              {/* STEP 3: INFERENCE PROVIDER */}
              {setupStep === 3 && (
                <div className="setupStepContent">
                  <div className="fieldGrid">
                    <div className="field">
                      <span>OpenRouter API Key</span>
                      <input
                        type="password"
                        value={settings.openRouterApiKey}
                        onChange={(e) => setSettings({ ...settings, openRouterApiKey: e.target.value })}
                        placeholder="sk-or-..."
                      />
                      <small>Stored in browser local storage for web mode. Desktop uses local vault.</small>
                    </div>
                    <div className="field">
                      <span>AI Model</span>
                      <select
                        value={settings.aiModel}
                        onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                      >
                        <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                        <option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option>
                        <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                        <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: AGENT CORE TUNING */}
              {setupStep === 4 && (
                <div className="setupStepContent">
                  <div className="fieldGrid">
                    <div className="field">
                      <span>Context Budget (Tokens)</span>
                      <input
                        type="number"
                        value={settings.contextBudget}
                        onChange={(e) => setSettings({ ...settings, contextBudget: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <span>Max Output Tokens</span>
                      <input
                        type="number"
                        value={settings.outputLimit}
                        onChange={(e) => setSettings({ ...settings, outputLimit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="fieldGrid">
                    <div className="field">
                      <span>Agent Temperature</span>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => setSettings({ ...settings, temperature: e.target.value })}
                      />
                      <small>Leave around 0.7 for normal planning; lower for deterministic policy explanations.</small>
                    </div>
                    <div className="field">
                      <span>Default Deadline (Minutes)</span>
                      <input
                        type="number"
                        value={settings.defaultDeadlineMinutes}
                        onChange={(e) => setSettings({ ...settings, defaultDeadlineMinutes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: TRANSACTION & PUMP RISK */}
              {setupStep === 5 && (
                <div className="setupStepContent">
                  <div className="fieldGrid">
                    <div className="field">
                      <span>Max Network Fee (Lamports)</span>
                      <input
                        type="number"
                        value={settings.maxNetworkFee}
                        onChange={(e) => setSettings({ ...settings, maxNetworkFee: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <span>Max Slippage Ceiling (BPS)</span>
                      <input
                        type="number"
                        value={settings.maxSlippageBps}
                        onChange={(e) => setSettings({ ...settings, maxSlippageBps: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="fieldGrid">
                    <div className="field">
                      <span>Priority</span>
                      <select
                        value={settings.priority}
                        onChange={(e) => setSettings({ ...settings, priority: e.target.value as WebSetupSettings["priority"] })}
                      >
                        <option value="economy">Economy</option>
                        <option value="standard">Standard</option>
                        <option value="fast">Fast</option>
                      </select>
                    </div>
                    <div className="field">
                      <span>Pump Max Spend (Lamports)</span>
                      <input
                        type="number"
                        value={settings.pumpMaxSpendLamports}
                        onChange={(e) => setSettings({ ...settings, pumpMaxSpendLamports: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="fieldGrid">
                    <div className="field">
                      <span>Pump Take Profit (BPS)</span>
                      <input
                        type="number"
                        value={settings.pumpTakeProfitBps}
                        onChange={(e) => setSettings({ ...settings, pumpTakeProfitBps: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <span>Pump Stop Loss (BPS)</span>
                      <input
                        type="number"
                        value={settings.pumpStopLossBps}
                        onChange={(e) => setSettings({ ...settings, pumpStopLossBps: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <span>Pump Max Open Positions</span>
                    <input
                      type="number"
                      value={settings.pumpMaxOpenPositions}
                      onChange={(e) => setSettings({ ...settings, pumpMaxOpenPositions: e.target.value })}
                    />
                    <small>Web Pump.fun execution is still preview-only; these limits are persisted for parity and future guards.</small>
                  </div>
                </div>
              )}

              <div className="setupActionsRow">
                {setupStep > 1 && (
                  <button onClick={() => setSetupStep(setupStep - 1)} className="railBtn">
                    Back
                  </button>
                )}
                {setupStep < 5 ? (
                  <button onClick={() => setSetupStep(setupStep + 1)} className="primaryButton">
                    Continue to Step {setupStep + 1}
                  </button>
                ) : (
                  <button onClick={handleSaveSettings} className="primaryButton executeButton">
                    ✓ Save & Enter Workspace
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // GATE 3: MAIN TRADING WORKSPACE (EXACT DESKTOP WORKSPACE LAYOUT)
  // --------------------------------------------------------------------------
  return (
    <div className="tradeDesktopShell flex flex-col h-screen overflow-hidden bg-[#070914] text-[#eef2ff]">
      {/* Top Desktop Navigation Bar */}
      <header className="tradeHeader">
        <div className="tradeBrand">
          <Link href="/" className="brandLink">
            <span className="brandMark">
              <Image src="/logo.png" alt="Silfable Logo" width={20} height={20} className="logoImg" />
            </span>
            <strong>SILFABLE</strong>
          </Link>
          <span className="versionBadge">WEB WORKSPACE</span>
        </div>

        {/* Restricted Mode Badge */}
        <div className="modeSwitcher">
          <button className="modeButton active">Restricted Mainnet</button>
          <button className="modeButton" disabled>Wallet approval required</button>
        </div>

        {/* Right Header Status & Wallet */}
        <div className="headerActions">
          <button onClick={openSettings} className="iconBtn" title="Edit Settings">
            <Settings className="size-4" /> <span>Settings</span>
          </button>
          <div className="networkBadge">
            <span className="statusDot" />
            <span>MAINNET</span>
          </div>
          <WalletMultiButton className="walletBtnOverride" />
        </div>
      </header>

      {showSessionModal && (
        <div className="sessionModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="new-session-title">
          <div className="sessionModal">
            <header>
              <div>
                <span className="modalKicker">New session</span>
                <h2 id="new-session-title">Your goal. Your rules.</h2>
                <p>Define how the web AI agent may reason, plan, and use your Mainnet context.</p>
              </div>
              <button className="modalClose" onClick={() => setShowSessionModal(false)} aria-label="Close new session">
                ×
              </button>
            </header>

            <div className="sessionModalBody">
              <section className="modalSection">
                <div className="modalSectionLabel">
                  01 Session name
                  <small>Used in your session history.</small>
                </div>
                <div className="modalFieldStack">
                  <input
                    className="sessionNameInput"
                    value={sessionDraft.title}
                    onChange={(event) => setSessionDraft({ ...sessionDraft, title: event.target.value.slice(0, 80) })}
                    placeholder="Review wallet, plan a swap, or monitor Pump.fun..."
                  />
                  <textarea
                    className="sessionTextArea"
                    value={sessionDraft.prompt}
                    onChange={(event) => setSessionDraft({ ...sessionDraft, prompt: event.target.value.slice(0, 500) })}
                    placeholder="Optional first instruction. It will be placed in the composer after the session is created."
                  />
                </div>
              </section>

              <section className="modalSection">
                <div className="modalSectionLabel">
                  02 Mode
                  <small>Choose the agent lifecycle.</small>
                </div>
                <div className="choiceGrid">
                  {[
                    ["agent", "Agent", "Interactive conversation for analysis, planning, and one task at a time."],
                    ["mission", "Mission", "Goal-driven workflow with explicit limits, checkpoints, and stop conditions."],
                    ["pump", "Pump.fun", "Pump.fun research workspace. Preview only on web until execution guards are complete."],
                  ].map(([value, label, description], index) => (
                    <button
                      key={value}
                      className={`choiceCard ${sessionDraft.mode === value ? "active" : ""}`}
                      onClick={() => setSessionDraft({ ...sessionDraft, mode: value as "agent" | "mission" | "pump" })}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="modalSection">
                <div className="modalSectionLabel">
                  03 Permission
                  <small>Controls mutating operations.</small>
                </div>
                <div className="choiceGrid">
                  <button className="choiceCard active">
                    <span>01</span>
                    <strong>Restricted</strong>
                    <small>Every future transaction requires deterministic checks and wallet approval.</small>
                  </button>
                  <button className="choiceCard" disabled>
                    <span>02 · Locked</span>
                    <strong>Full access</strong>
                    <small>Unavailable on web. No autonomous signing or silent broadcast.</small>
                  </button>
                </div>
              </section>

              {false && (
              <section className="modalSection">
                <div className="modalSectionLabel">
                  04 Wallet scope
                  <small>Locked once session starts.</small>
                </div>
                <div className="choiceGrid">
                  <button
                    className={`choiceCard ${sessionDraft.walletScope === "connected" ? "active" : ""}`}
                    onClick={() => setSessionDraft({ ...sessionDraft, walletScope: "connected" })}
                  >
                    <span>01</span>
                    <strong>Connected wallet</strong>
                    <small>{publicKey!.toBase58().slice(0, 6)}...{publicKey!.toBase58().slice(-6)} may be referenced. Approval still required.</small>
                  </button>
                  <button
                    className={`choiceCard ${sessionDraft.walletScope === "chat_only" ? "active" : ""}`}
                    onClick={() => setSessionDraft({ ...sessionDraft, walletScope: "chat_only" })}
                  >
                    <span>02</span>
                    <strong>No wallet · chat only</strong>
                    <small>Research, planning, and policy explanations with no wallet context.</small>
                  </button>
                </div>
              </section>
              )}

              {sessionDraft.mode === "pump" && (
                <section className="modalSection">
                  <div className="modalSectionLabel">
                    04 Pump.fun scope
                    <small>Web remains preview-only.</small>
                  </div>
                  <div className="modalFieldStack">
                    <div className="choiceGrid">
                      {[
                        ["exact_mint", "Exact mint", "Analyze one token mint only."],
                        ["watchlist", "Watchlist", "Bounded list monitoring; no auto-buy."],
                        ["discovery", "Discovery", "Candidate scanning only; execution locked."],
                      ].map(([value, label, description]) => (
                        <button
                          key={value}
                          className={`choiceCard ${sessionDraft.pumpScope === value ? "active" : ""}`}
                          onClick={() => setSessionDraft({ ...sessionDraft, pumpScope: value as "exact_mint" | "watchlist" | "discovery" })}
                        >
                          <span>PUMP</span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </button>
                      ))}
                    </div>
                    <input
                      className="sessionNameInput"
                      value={sessionDraft.pumpMint}
                      disabled={sessionDraft.pumpScope === "discovery"}
                      onChange={(event) => setSessionDraft({ ...sessionDraft, pumpMint: event.target.value.trim() })}
                      placeholder="Pump.fun mint or comma-separated watchlist mints"
                    />
                  </div>
                </section>
              )}
            </div>

            <footer className="modalFooter">
              <span className="modalFooterNote">Mainnet · restricted · no transaction is authorized</span>
              <div className="flex items-center gap-3">
                <button className="railBtn" onClick={() => setShowSessionModal(false)}>Cancel</button>
                <button className="primaryButton" onClick={handleCreateNewSession}>Create session</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* 3-Column Desktop Workspace Shell */}
      <main className="workspace">
        {/* LEFT RAIL: DESKTOP WORKSPACE SESSIONS & FILTERS */}
        <aside className="leftRail">
          <div className="railBrand">
            <span>WORKSPACES</span>
          </div>

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
                  {sessions.length > 1 && (
                    <span
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="ml-auto text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="size-3" />
                    </span>
                  )}
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
                        <p>Restricted · wallet approval required · updated {new Date(session.updatedAt).toLocaleString()}</p>
                        <button onClick={() => { setActiveSessionId(session.id); setNav("sessions"); }} className="railBtn">Open session</button>
                      </article>
                    ))
                )}
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
