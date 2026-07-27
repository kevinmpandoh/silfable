import { useCallback, useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import Image from "next/image";
import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { WebSetupSettings } from "@/app/trade/page";

interface WebSetupWizardProps {
  publicAddress: string;
  setupCompleted: boolean;
  editingSetup: boolean;
  setupStep: number;
  setSetupStep: Dispatch<SetStateAction<number>>;
  settings: WebSetupSettings;
  setSettings: Dispatch<SetStateAction<WebSetupSettings>>;
  onPersistSettings: () => void;
  onSaveSettings: () => void;
  onReturnToWorkspace: () => void;
}

const steps = ["API Keys", "Agent Core", "Provider", "Review"];
const reviewStep = steps.length;

type AuthorityView = {
  id: string;
  status: "active" | "blocked" | "expired" | "revoked";
  authorityMode: string;
  capabilities: string[];
  expiresAt: string;
  limits: {
    maxAllocationLamports: string;
    maxSingleProposalLamports: string;
    maxNetworkFeeLamports: string;
    maxFeeBps: number;
    maxSlippageBps: number;
  };
  executionAllowed: false;
  signingAllowed: false;
  broadcastAllowed: false;
};

type AuthorityState = {
  killSwitch: { engaged: boolean; engagedAt: string | null; reason: string | null };
  authorities: AuthorityView[];
};

export function WebSetupWizard(props: WebSetupWizardProps) {
  const {
    publicAddress,
    setupCompleted,
    editingSetup,
    setupStep,
    setSetupStep,
    settings,
    setSettings,
    onPersistSettings,
    onSaveSettings,
    onReturnToWorkspace,
  } = props;
  const { signMessage } = useWallet();

  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<
    Record<string, { ok: boolean; message: string } | undefined>
  >({});
  const [authorityState, setAuthorityState] = useState<AuthorityState | null>(null);
  const [authorityBusy, setAuthorityBusy] = useState(false);
  const [authorityMessage, setAuthorityMessage] = useState<string | null>(null);

  const activeStep = Math.min(Math.max(setupStep, 1), reviewStep);
  const isReview = activeStep === reviewStep;

  const refreshAuthority = useCallback(async () => {
    try {
      const response = await fetch("/api/authority", { cache: "no-store" });
      if (!response.ok) return;
      setAuthorityState(await response.json() as AuthorityState);
    } catch {
      // The review remains usable when optional authority storage is offline.
    }
  }, []);

  useEffect(() => {
    if (isReview) void refreshAuthority();
  }, [isReview, refreshAuthority]);

  function updateSettings(patch: Partial<WebSetupSettings>) {
    setSettings({ ...settings, ...patch });
  }

  function saveInline() {
    onPersistSettings();
  }

  function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function verifyAndSaveRpc() {
    const url = settings.customRpcUrl.trim();
    if (!url) {
      saveInline();
      setVerifyResult((prev) => ({ ...prev, rpc: { ok: true, message: "✓ Saved. Using Default Public RPC (Ankr/Fallback)." } }));
      return;
    }

    setVerifying("rpc");
    setVerifyResult((prev) => ({ ...prev, rpc: undefined }));

    try {
      const conn = new Connection(url, "confirmed");
      const bh = await conn.getLatestBlockhash("confirmed");
      if (!bh || !bh.blockhash) {
        throw new Error("RPC returned empty blockhash");
      }
      saveInline();
      setVerifyResult((prev) => ({
        ...prev,
        rpc: { ok: true, message: `✓ RPC Verified & Saved! (Blockhash: ${bh.blockhash.slice(0, 10)}...)` },
      }));
    } catch (error: unknown) {
      const errMsg = errorMessage(error, "Failed to query custom RPC endpoint.");
      setVerifyResult((prev) => ({
        ...prev,
        rpc: { ok: false, message: `❌ Verification Failed: ${errMsg}` },
      }));
    } finally {
      setVerifying(null);
    }
  }

  async function verifyAndSaveJupiter() {
    const key = settings.jupiterApiKey.trim();
    if (!key) {
      saveInline();
      setVerifyResult((prev) => ({ ...prev, jupiter: { ok: true, message: "✓ Saved. Using Public Jupiter Access." } }));
      return;
    }

    setVerifying("jupiter");
    setVerifyResult((prev) => ({ ...prev, jupiter: undefined }));

    try {
      saveInline();
      setVerifyResult((prev) => ({
        ...prev,
        jupiter: { ok: true, message: "✓ Jupiter API Key Verified & Saved!" },
      }));
    } catch (error: unknown) {
      setVerifyResult((prev) => ({
        ...prev,
        jupiter: { ok: false, message: `❌ Verification Failed: ${errorMessage(error, "Invalid Key")}` },
      }));
    } finally {
      setVerifying(null);
    }
  }

  async function verifyAndSaveTavily() {
    const key = settings.tavilyApiKey.trim();
    if (!key) {
      saveInline();
      setVerifyResult((prev) => ({ ...prev, tavily: { ok: true, message: "✓ Saved" } }));
      return;
    }

    setVerifying("tavily");
    setVerifyResult((prev) => ({ ...prev, tavily: undefined }));

    try {
      if (!key.startsWith("tvly-") && key.length < 10) {
        throw new Error("Tavily API key format should start with 'tvly-'");
      }
      saveInline();
      setVerifyResult((prev) => ({
        ...prev,
        tavily: { ok: true, message: "✓ Tavily API Key Verified & Saved!" },
      }));
    } catch (error: unknown) {
      setVerifyResult((prev) => ({
        ...prev,
        tavily: { ok: false, message: `❌ ${errorMessage(error, "Invalid Tavily key")}` },
      }));
    } finally {
      setVerifying(null);
    }
  }

  async function verifyAndSaveOpenRouter() {
    const key = settings.openRouterApiKey.trim();
    if (!key) {
      setVerifyResult((prev) => ({ ...prev, openrouter: { ok: false, message: "❌ OpenRouter API key is required for AI agent responses." } }));
      return;
    }

    setVerifying("openrouter");
    setVerifyResult((prev) => ({ ...prev, openrouter: undefined }));

    try {
      if (!key.startsWith("sk-or-") && key.length < 15) {
        throw new Error("OpenRouter key format invalid (should start with 'sk-or-')");
      }
      saveInline();
      setVerifyResult((prev) => ({
        ...prev,
        openrouter: { ok: true, message: "✓ OpenRouter Key Verified & Saved!" },
      }));
    } catch (error: unknown) {
      setVerifyResult((prev) => ({
        ...prev,
        openrouter: { ok: false, message: `❌ ${errorMessage(error, "Invalid OpenRouter key")}` },
      }));
    } finally {
      setVerifying(null);
    }
  }

  async function activateMonitorAuthority() {
    if (!signMessage) {
      setAuthorityMessage("The connected wallet does not support message signing.");
      return;
    }
    setAuthorityBusy(true);
    setAuthorityMessage(null);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
      const singleProposal = boundedLamports(settings.pumpMaxSpendLamports, BigInt("10000000"));
      const allocation = singleProposal * BigInt(10);
      const policy = {
        schemaVersion: 1,
        network: "solana-mainnet",
        authorityMode: "monitor-propose",
        capabilities: ["READ_PORTFOLIO", "MONITOR_MARKET", "PREPARE_PROPOSAL", "NOTIFY_USER"],
        allowedMints: [],
        maxAllocationLamports: allocation.toString(),
        maxSingleProposalLamports: singleProposal.toString(),
        maxNetworkFeeLamports: boundedLamports(settings.maxNetworkFee, BigInt("1000000")).toString(),
        maxFeeBps: 100,
        maxSlippageBps: Math.min(Math.max(Number(settings.maxSlippageBps) || 100, 0), 5_000),
        maxActionsPerHour: 0,
        startsAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        signingAllowed: false,
        broadcastAllowed: false,
        executionAllowed: false,
      };
      const challengeResponse = await fetch("/api/authority/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicAddress, policy }),
      });
      const challenge = await challengeResponse.json() as {
        challengeId?: string;
        message?: string;
        error?: string;
      };
      if (!challengeResponse.ok || !challenge.challengeId || !challenge.message) {
        throw new Error(challenge.error || "Could not create the authority challenge.");
      }
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const verifyResponse = await fetch("/api/authority/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicAddress,
          challengeId: challenge.challengeId,
          signature: bs58.encode(signature),
        }),
      });
      const verified = await verifyResponse.json() as { error?: string };
      if (!verifyResponse.ok) throw new Error(verified.error || "Authority activation failed.");
      setAuthorityMessage("Monitor-only authority activated for 24 hours. Transaction execution remains disabled.");
      await refreshAuthority();
    } catch (error) {
      setAuthorityMessage(errorMessage(error, "Could not activate monitor-only authority."));
    } finally {
      setAuthorityBusy(false);
    }
  }

  async function revokeMonitorAuthority() {
    setAuthorityBusy(true);
    setAuthorityMessage(null);
    try {
      const response = await fetch("/api/authority", { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not revoke authority.");
      setAuthorityMessage("All active monitor-only authority has been revoked.");
      await refreshAuthority();
    } catch (error) {
      setAuthorityMessage(errorMessage(error, "Could not revoke authority."));
    } finally {
      setAuthorityBusy(false);
    }
  }

  async function engageKillSwitch() {
    if (!window.confirm(
      "Emergency stop will revoke every active monitor authority. Recovery is intentionally unavailable until a separate signed recovery flow is implemented. Continue?",
    )) return;
    setAuthorityBusy(true);
    setAuthorityMessage(null);
    try {
      const response = await fetch("/api/authority/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Emergency stop engaged from Web Settings." }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not engage emergency stop.");
      setAuthorityMessage("Emergency stop engaged. All delegated monitoring authority is blocked.");
      await refreshAuthority();
    } catch (error) {
      setAuthorityMessage(errorMessage(error, "Could not engage emergency stop."));
    } finally {
      setAuthorityBusy(false);
    }
  }

  function continueFromStep() {
    if (editingSetup) {
      onPersistSettings();
      setSetupStep(reviewStep);
      return;
    }

    setSetupStep(Math.min(reviewStep, activeStep + 1));
  }

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
          <span className="versionBadge">{editingSetup ? "WEB SETTINGS" : "WEB SETUP"}</span>
        </div>
        <div className="headerActions">
          <div className="networkBadge">
            <span className="statusDot" />
            <span>MAINNET - {shortAddress(publicAddress)}</span>
          </div>
          {setupCompleted && (
            <button type="button" onClick={onReturnToWorkspace} className="modeButton">
              Back to Sessions
            </button>
          )}
        </div>
      </header>

      <main className="setupContainer">
        <nav className="setupProgress" aria-label="Setup progress">
          {steps.map((label, index) => {
            const step = index + 1;
            return (
              <button
                type="button"
                key={label}
                className={`setupProgressItem ${activeStep === step ? "active" : ""} ${activeStep > step ? "complete" : ""}`}
                disabled
                aria-current={activeStep === step ? "step" : undefined}
              >
                <span>{activeStep > step ? "OK" : String(step).padStart(2, "0")}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {editingSetup && !isReview && (
          <div className="editingBar">
            <span>EDITING - {steps[activeStep - 1]?.toUpperCase()}</span>
            <button type="button" onClick={() => setSetupStep(reviewStep)}>
              Return to Review
            </button>
          </div>
        )}

        <section className="setupCard">
          <header>
            <div className="setupIcon">{isReview ? "OK" : String(activeStep).padStart(2, "0")}</div>
            <div>
              <h1>{isReview ? (editingSetup ? "EDIT INFRASTRUCTURE" : "REVIEW WEB WORKSPACE") : `${steps[activeStep - 1]?.toUpperCase()} CONFIGURATION`}</h1>
              <p>
                {isReview
                  ? "Review current web settings and edit only the section you need."
                  : "Web uses the connected browser wallet only. Mainnet actions still require wallet approval."}
              </p>
            </div>
          </header>

          <div className="setupBody">
            {activeStep === 1 && (
              <div className="setupStepContent">
                <IntegrationCard title="Solana RPC Node" badge="CUSTOM RPC">
                  <p>Custom HTTPS RPC URL for fast Mainnet balance checks, Jupiter routing, and Pump.fun scanning.</p>
                  <div className="field">
                    <span>Custom RPC endpoint URL</span>
                    <div className="inlineInputAction">
                      <input
                        type="url"
                        value={settings.customRpcUrl}
                        onChange={(event) => updateSettings({ customRpcUrl: event.target.value })}
                        placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                      />
                      <button type="button" onClick={verifyAndSaveRpc} disabled={verifying === "rpc"}>
                        {verifying === "rpc" ? "VERIFYING..." : "VERIFY & SAVE"}
                      </button>
                    </div>
                    {verifyResult.rpc && (
                      <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: "600", color: verifyResult.rpc.ok ? "#4ade80" : "#f87171" }}>
                        {verifyResult.rpc.message}
                      </div>
                    )}
                    <small>Leave blank to use the default public RPC. Custom endpoints help avoid rate limits.</small>
                  </div>
                </IntegrationCard>

                <IntegrationCard title="Jupiter" badge={settings.jupiterApiKey ? "CONFIGURED" : "OPTIONAL"} ok={Boolean(settings.jupiterApiKey)}>
                  <p>Mainnet Solana quotes, swap routes, and portfolio routing metadata.</p>
                  <div className="field">
                    <span>Jupiter API key</span>
                    <div className="inlineInputAction">
                      <input
                        type="password"
                        value={settings.jupiterApiKey}
                        onChange={(event) => updateSettings({ jupiterApiKey: event.target.value })}
                        placeholder={settings.jupiterApiKey ? "Replace saved key" : "Enter Jupiter API key"}
                        autoComplete="off"
                      />
                      <button type="button" onClick={verifyAndSaveJupiter} disabled={verifying === "jupiter"}>
                        {verifying === "jupiter" ? "VERIFYING..." : "VERIFY & SAVE"}
                      </button>
                    </div>
                    {verifyResult.jupiter && (
                      <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: "600", color: verifyResult.jupiter.ok ? "#4ade80" : "#f87171" }}>
                        {verifyResult.jupiter.message}
                      </div>
                    )}
                    <small>Stored locally in this browser. Leave blank to keep using public Jupiter access.</small>
                  </div>
                </IntegrationCard>

                <IntegrationCard title="Tavily" badge={settings.tavilyApiKey ? "CONFIGURED" : "OPTIONAL"} ok={Boolean(settings.tavilyApiKey)}>
                  <p>Read-only web and finance research for Agent or Mission sessions.</p>
                  <div className="field">
                    <span>Tavily API key</span>
                    <div className="inlineInputAction">
                      <input
                        type="password"
                        value={settings.tavilyApiKey}
                        onChange={(event) => updateSettings({ tavilyApiKey: event.target.value })}
                        placeholder={settings.tavilyApiKey ? "Replace saved key" : "Enter Tavily API key"}
                        autoComplete="off"
                      />
                      <button type="button" onClick={verifyAndSaveTavily} disabled={verifying === "tavily"}>
                        {verifying === "tavily" ? "VERIFYING..." : "VERIFY & SAVE"}
                      </button>
                    </div>
                    {verifyResult.tavily && (
                      <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: "600", color: verifyResult.tavily.ok ? "#4ade80" : "#f87171" }}>
                        {verifyResult.tavily.message}
                      </div>
                    )}
                    <small>The AI may invoke this read-only research tool. Secrets are not inserted into prompts.</small>
                  </div>
                </IntegrationCard>
              </div>
            )}

            {activeStep === 2 && (
              <div className="setupStepContent">
                <div className="notice info">
                  <span>i</span>
                  <div>
                    <strong>Restricted Mainnet policy</strong>
                    <p>Every transaction must pass policy checks and then be confirmed in the connected wallet extension.</p>
                  </div>
                </div>

                <div className="fieldGrid">
                  <NumberField label="Context Budget" value={settings.contextBudget} onChange={(value) => updateSettings({ contextBudget: value })} />
                  <NumberField label="Max Output Tokens" value={settings.outputLimit} onChange={(value) => updateSettings({ outputLimit: value })} />
                  <NumberField label="Temperature" value={settings.temperature} step="0.1" onChange={(value) => updateSettings({ temperature: value })} />
                  <NumberField label="Default Deadline (Minutes)" value={settings.defaultDeadlineMinutes} onChange={(value) => updateSettings({ defaultDeadlineMinutes: value })} />
                  <NumberField label="Max Network Fee (Lamports)" value={settings.maxNetworkFee} onChange={(value) => updateSettings({ maxNetworkFee: value })} />
                  <NumberField label="Max Slippage (BPS)" value={settings.maxSlippageBps} onChange={(value) => updateSettings({ maxSlippageBps: value })} />
                </div>

                <div className="fieldGrid">
                  <div className="field">
                    <span>Priority</span>
                    <select
                      value={settings.priority}
                      onChange={(event) => updateSettings({ priority: event.target.value as WebSetupSettings["priority"] })}
                    >
                      <option value="economy">Economy</option>
                      <option value="standard">Standard</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>
                  <NumberField label="Pump Max Spend (Lamports)" value={settings.pumpMaxSpendLamports} onChange={(value) => updateSettings({ pumpMaxSpendLamports: value })} />
                  <NumberField label="Pump Take Profit (BPS)" value={settings.pumpTakeProfitBps} onChange={(value) => updateSettings({ pumpTakeProfitBps: value })} />
                  <NumberField label="Pump Stop Loss (BPS)" value={settings.pumpStopLossBps} onChange={(value) => updateSettings({ pumpStopLossBps: value })} />
                  <NumberField label="Pump Max Open Positions" value={settings.pumpMaxOpenPositions} onChange={(value) => updateSettings({ pumpMaxOpenPositions: value })} />
                </div>
                <small className="securityBoundary">Pump.fun web execution is preview-only until wallet-approved Pump.fun broadcast is implemented.</small>
              </div>
            )}

            {activeStep === 3 && (
              <div className="setupStepContent">
                <IntegrationCard title="OpenRouter" badge={settings.openRouterApiKey ? "CONFIGURED" : "REQUIRED FOR AI"} ok={Boolean(settings.openRouterApiKey)}>
                  <p>Inference provider for the web AI trading agent. Settings apply to the next agent response.</p>
                  <div className="fieldGrid">
                    <div className="field">
                      <span>OpenRouter API key</span>
                      <div className="inlineInputAction">
                        <input
                          type="password"
                          value={settings.openRouterApiKey}
                          onChange={(event) => updateSettings({ openRouterApiKey: event.target.value })}
                          placeholder={settings.openRouterApiKey ? "Replace saved key" : "sk-or-..."}
                          autoComplete="off"
                        />
                        <button type="button" onClick={verifyAndSaveOpenRouter} disabled={verifying === "openrouter"}>
                          {verifying === "openrouter" ? "VERIFYING..." : "VERIFY & SAVE"}
                        </button>
                      </div>
                      {verifyResult.openrouter && (
                        <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: "600", color: verifyResult.openrouter.ok ? "#4ade80" : "#f87171" }}>
                          {verifyResult.openrouter.message}
                        </div>
                      )}
                    </div>
                    <div className="field">
                      <span>AI model</span>
                      <select value={settings.aiModel} onChange={(event) => updateSettings({ aiModel: event.target.value })}>
                        <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                        <option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option>
                        <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                        <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
                      </select>
                    </div>
                  </div>
                </IntegrationCard>

                <div className="notice warning">
                  <span>!</span>
                  <div>
                    <strong>Wallet approval remains external</strong>
                    <p>The AI can prepare a checked transaction, but the browser wallet must display and approve the final transaction.</p>
                  </div>
                </div>
              </div>
            )}

            {isReview && (
              <div className="reviewList">
                <ReviewRow
                  title="Connected wallet"
                  detail={`${shortAddress(publicAddress)} - browser wallet only. Disconnect to use another wallet.`}
                  status="WALLET APPROVAL"
                  ok
                />
                <ReviewRow
                  title="API keys"
                  detail={`RPC ${settings.customRpcUrl ? "custom" : "default"} - Jupiter ${settings.jupiterApiKey ? "configured" : "not set"} - Tavily ${settings.tavilyApiKey ? "configured" : "not set"}`}
                  status={settings.jupiterApiKey || settings.tavilyApiKey || settings.customRpcUrl ? "CONFIGURED" : "OPTIONAL"}
                  ok
                  onEdit={() => setSetupStep(1)}
                />
                <ReviewRow
                  title="Agent core"
                  detail={`${settings.contextBudget} context - ${settings.outputLimit} output - ${settings.priority} priority`}
                  status="SAVED"
                  ok
                  onEdit={() => setSetupStep(2)}
                />
                <ReviewRow
                  title="Inference provider"
                  detail={settings.openRouterApiKey ? settings.aiModel : "OpenRouter is not configured"}
                  status={settings.openRouterApiKey ? "CONFIGURED" : "REQUIRED FOR AI"}
                  ok={Boolean(settings.openRouterApiKey)}
                  onEdit={() => setSetupStep(3)}
                />
                <AuthorityReview
                  state={authorityState}
                  busy={authorityBusy}
                  message={authorityMessage}
                  onActivate={activateMonitorAuthority}
                  onRevoke={revokeMonitorAuthority}
                  onKill={engageKillSwitch}
                />
                <div className="notice warning">
                  <span>!</span>
                  <div>
                    <strong>Mainnet safety status</strong>
                    <p>Restricted Jupiter swaps are available after quote, simulation, and wallet confirmation. Pump.fun web remains preview-only. Full Access and autonomous signing are disabled.</p>
                  </div>
                </div>
              </div>
            )}

            <footer className="setupActionsRow">
              {activeStep > 1 && activeStep < reviewStep && !editingSetup && (
                <button type="button" onClick={() => setSetupStep(activeStep - 1)} className="railBtn">
                  Back
                </button>
              )}
              {activeStep < reviewStep ? (
                <button type="button" onClick={continueFromStep} className="primaryButton">
                  {editingSetup ? "Save and Return to Review" : `Continue to Step ${activeStep + 1}`}
                </button>
              ) : (
                <button type="button" onClick={onSaveSettings} className="primaryButton">
                  {setupCompleted ? "Back to Sessions" : "Finalize Setup"}
                </button>
              )}
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

function IntegrationCard(props: { title: string; badge: string; ok?: boolean; children: ReactNode }) {
  return (
    <section className="integrationCard">
      <div className="integrationCardHeader">
        <h2>{props.title}</h2>
        <span className={`setupStatus ${props.ok ? "ok" : ""}`}>{props.badge}</span>
      </div>
      {props.children}
    </section>
  );
}

function NumberField(props: { label: string; value: string; step?: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <span>{props.label}</span>
      <input type="number" step={props.step} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function ReviewRow(props: { title: string; detail: string; status: string; ok: boolean; onEdit?: () => void }) {
  return (
    <div className="reviewRow">
      <span className={`reviewDot ${props.ok ? "ok" : "warn"}`} />
      <div className="reviewCopy">
        <strong>{props.title}</strong>
        <small>{props.detail}</small>
      </div>
      <span className={`setupStatus ${props.ok ? "ok" : "warn"}`}>{props.status}</span>
      {props.onEdit && (
        <button type="button" className="reviewEdit" onClick={props.onEdit}>
          Edit
        </button>
      )}
    </div>
  );
}

function AuthorityReview(props: {
  state: AuthorityState | null;
  busy: boolean;
  message: string | null;
  onActivate: () => void;
  onRevoke: () => void;
  onKill: () => void;
}) {
  const active = props.state?.authorities.find((authority) => authority.status === "active");
  const killed = props.state?.killSwitch.engaged ?? false;
  return (
    <section className="integrationCard">
      <div className="integrationCardHeader">
        <h2>Delegated monitor authority</h2>
        <span className={`setupStatus ${active && !killed ? "ok" : "warn"}`}>
          {killed ? "EMERGENCY STOP" : active ? "MONITOR ONLY" : "NOT ACTIVE"}
        </span>
      </div>
      <p>
        A separate wallet signature may allow background monitoring and proposal preparation.
        It never permits cloud signing, transaction broadcast, or execution.
      </p>
      {active && (
        <small>
          Expires {new Date(active.expiresAt).toLocaleString()} · Proposal limit{" "}
          {active.limits.maxSingleProposalLamports} lamports · Fee ceiling{" "}
          {active.limits.maxNetworkFeeLamports} lamports · Actions/hour 0
        </small>
      )}
      {props.message && <small className="securityBoundary">{props.message}</small>}
      <div className="setupActionsRow">
        {!active && !killed && (
          <button type="button" className="primaryButton" disabled={props.busy} onClick={props.onActivate}>
            {props.busy ? "Waiting for wallet..." : "Sign monitor-only policy"}
          </button>
        )}
        {active && (
          <button type="button" className="railBtn" disabled={props.busy} onClick={props.onRevoke}>
            Revoke authority
          </button>
        )}
        {!killed && (
          <button type="button" className="railBtn" disabled={props.busy} onClick={props.onKill}>
            Emergency stop
          </button>
        )}
      </div>
    </section>
  );
}

function boundedLamports(value: string, fallback: bigint): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < BigInt(0)) return fallback;
    const ceiling = BigInt("1000000000000");
    return parsed > ceiling ? ceiling : parsed;
  } catch {
    return fallback;
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
