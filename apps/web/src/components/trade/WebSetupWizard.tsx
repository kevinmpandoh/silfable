import { useState } from "react";
import { Connection } from "@solana/web3.js";
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

const steps = ["Network", "Agent", "Provider", "Review"];
const reviewStep = steps.length;

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
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});

  const activeStep = Math.min(Math.max(setupStep, 1), reviewStep);
  const isReview = activeStep === reviewStep;

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
      setVerifyResult((previous) => ({ ...previous, rpc: { ok: true, message: "Saved. Using the default public RPC." } }));
      return;
    }

    setVerifying("rpc");
    setVerifyResult((previous) => ({ ...previous, rpc: undefined }));
    try {
      const connection = new Connection(url, "confirmed");
      const blockhash = await connection.getLatestBlockhash("confirmed");
      if (!blockhash.blockhash) throw new Error("RPC returned an empty blockhash.");
      saveInline();
      setVerifyResult((previous) => ({ ...previous, rpc: { ok: true, message: "RPC verified and saved." } }));
    } catch (error) {
      setVerifyResult((previous) => ({ ...previous, rpc: { ok: false, message: errorMessage(error, "Could not query this RPC endpoint.") } }));
    } finally {
      setVerifying(null);
    }
  }

  function saveJupiter() {
    saveInline();
    setVerifyResult((previous) => ({
      ...previous,
      jupiter: { ok: true, message: settings.jupiterApiKey.trim() ? "Jupiter key saved." : "Saved. Public Jupiter access will be used." },
    }));
  }

  function saveOpenRouter() {
    if (!settings.openRouterApiKey.trim()) {
      setVerifyResult((previous) => ({ ...previous, openrouter: { ok: false, message: "An OpenRouter key is required for AI responses." } }));
      return;
    }
    saveInline();
    setVerifyResult((previous) => ({ ...previous, openrouter: { ok: true, message: "OpenRouter key saved." } }));
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
            <span className="brandMark"><Image src="/logo.png" alt="Silfable Logo" width={20} height={20} className="logoImg" /></span>
            <strong>SILFABLE</strong>
          </Link>
          <span className="versionBadge">{editingSetup ? "WEB SETTINGS" : "WEB SETUP"}</span>
        </div>
        <div className="headerActions">
          <div className="networkBadge"><span className="statusDot" /><span>MAINNET · {shortAddress(publicAddress)}</span></div>
          {setupCompleted && <button type="button" onClick={onReturnToWorkspace} className="modeButton">Back to Sessions</button>}
        </div>
      </header>

      <main className="setupContainer">
        <nav className="setupProgress" aria-label="Setup progress">
          {steps.map((label, index) => {
            const step = index + 1;
            return <button type="button" key={label} className={`setupProgressItem ${activeStep === step ? "active" : ""} ${activeStep > step ? "complete" : ""}`} disabled aria-current={activeStep === step ? "step" : undefined}><span>{activeStep > step ? "OK" : String(step).padStart(2, "0")}</span>{label}</button>;
          })}
        </nav>

        {editingSetup && !isReview && <div className="editingBar"><span>EDITING · {steps[activeStep - 1]?.toUpperCase()}</span><button type="button" onClick={() => setSetupStep(reviewStep)}>Return to Review</button></div>}

        <section className="setupCard">
          <header>
            <div className="setupIcon">{isReview ? "OK" : String(activeStep).padStart(2, "0")}</div>
            <div>
              <h1>{isReview ? (editingSetup ? "EDIT WEB SETTINGS" : "REVIEW WEB WORKSPACE") : `${steps[activeStep - 1]?.toUpperCase()} CONFIGURATION`}</h1>
              <p>{isReview ? "Review the settings used by this browser wallet." : "Web uses the connected browser wallet only. Every Mainnet transaction is approved in that wallet."}</p>
            </div>
          </header>

          <div className="setupBody">
            {activeStep === 1 && <div className="setupStepContent">
              <IntegrationCard title="Solana RPC" badge="OPTIONAL" ok={Boolean(settings.customRpcUrl)}>
                <p>Use a custom HTTPS RPC only when the default endpoint is slow or rate limited.</p>
                <div className="field"><span>Custom RPC endpoint URL</span><div className="inlineInputAction"><input type="url" value={settings.customRpcUrl} onChange={(event) => updateSettings({ customRpcUrl: event.target.value })} placeholder="https://mainnet.helius-rpc.com/?api-key=..." /><button type="button" onClick={verifyAndSaveRpc} disabled={verifying === "rpc"}>{verifying === "rpc" ? "VERIFYING..." : "VERIFY & SAVE"}</button></div><Result value={verifyResult.rpc} /><small>Leave blank to use the default public RPC.</small></div>
              </IntegrationCard>
              <IntegrationCard title="Jupiter routing" badge={settings.jupiterApiKey ? "CONFIGURED" : "DEFAULT"} ok={Boolean(settings.jupiterApiKey)}>
                <p>Used for Solana swap quotes and transaction preparation. A key is optional.</p>
                <div className="field"><span>Jupiter API key</span><div className="inlineInputAction"><input type="password" value={settings.jupiterApiKey} onChange={(event) => updateSettings({ jupiterApiKey: event.target.value })} placeholder={settings.jupiterApiKey ? "Replace saved key" : "Optional Jupiter API key"} autoComplete="off" /><button type="button" onClick={saveJupiter}>SAVE</button></div><Result value={verifyResult.jupiter} /><small>The key is stored only in this browser.</small></div>
              </IntegrationCard>
            </div>}

            {activeStep === 2 && <div className="setupStepContent">
              <div className="notice info"><span>i</span><div><strong>Restricted Mainnet policy</strong><p>The AI can prepare a swap or bridge, but the connected wallet must show and approve the final transaction.</p></div></div>
              <div className="fieldGrid">
                <NumberField label="Max output tokens" value={settings.outputLimit} onChange={(value) => updateSettings({ outputLimit: value })} />
                <NumberField label="Temperature" value={settings.temperature} step="0.1" onChange={(value) => updateSettings({ temperature: value })} />
                <NumberField label="Max slippage (BPS)" value={settings.maxSlippageBps} onChange={(value) => updateSettings({ maxSlippageBps: value })} />
              </div>
              <small className="securityBoundary">These values affect AI responses and swap quotes only; they never grant signing access.</small>
            </div>}

            {activeStep === 3 && <div className="setupStepContent">
              <IntegrationCard title="OpenRouter" badge={settings.openRouterApiKey ? "CONFIGURED" : "REQUIRED FOR AI"} ok={Boolean(settings.openRouterApiKey)}>
                <p>Inference provider for the web AI agent.</p>
                <div className="fieldGrid">
                  <div className="field"><span>OpenRouter API key</span><div className="inlineInputAction"><input type="password" value={settings.openRouterApiKey} onChange={(event) => updateSettings({ openRouterApiKey: event.target.value })} placeholder={settings.openRouterApiKey ? "Replace saved key" : "sk-or-..."} autoComplete="off" /><button type="button" onClick={saveOpenRouter}>SAVE</button></div><Result value={verifyResult.openrouter} /></div>
                  <div className="field"><span>AI model</span><select value={settings.aiModel} onChange={(event) => updateSettings({ aiModel: event.target.value })}><option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option><option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option><option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option><option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option></select></div>
                </div>
              </IntegrationCard>
            </div>}

            {isReview && <div className="reviewList">
              <ReviewRow title="Connected wallet" detail={`${shortAddress(publicAddress)} · browser wallet only. Disconnect or switch your wallet extension to use another address.`} status="CONNECTED" ok />
              <ReviewRow title="Network" detail={`RPC ${settings.customRpcUrl ? "custom" : "default"} · Jupiter ${settings.jupiterApiKey ? "configured" : "public access"}`} status={settings.customRpcUrl || settings.jupiterApiKey ? "CONFIGURED" : "DEFAULTS"} ok onEdit={() => setSetupStep(1)} />
              <ReviewRow title="Agent" detail={`${settings.outputLimit} max output · temperature ${settings.temperature} · slippage ${settings.maxSlippageBps} bps`} status="SAVED" ok onEdit={() => setSetupStep(2)} />
              <ReviewRow title="Inference provider" detail={settings.openRouterApiKey ? settings.aiModel : "OpenRouter is not configured"} status={settings.openRouterApiKey ? "CONFIGURED" : "REQUIRED FOR AI"} ok={Boolean(settings.openRouterApiKey)} onEdit={() => setSetupStep(3)} />
              <div className="notice warning"><span>!</span><div><strong>Mainnet safety status</strong><p>Jupiter swaps and Solana-to-EVM bridges require a final approval in the connected wallet. Web never creates or imports a wallet.</p></div></div>
            </div>}

            <footer className="setupActionsRow">
              {activeStep > 1 && activeStep < reviewStep && !editingSetup && <button type="button" onClick={() => setSetupStep(activeStep - 1)} className="railBtn">Back</button>}
              {activeStep < reviewStep ? <button type="button" onClick={continueFromStep} className="primaryButton">{editingSetup ? "Save and Return to Review" : `Continue to Step ${activeStep + 1}`}</button> : <button type="button" onClick={onSaveSettings} className="primaryButton">{setupCompleted ? "Back to Sessions" : "Finalize Setup"}</button>}
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

function IntegrationCard(props: { title: string; badge: string; ok?: boolean; children: ReactNode }) {
  return <section className="integrationCard"><div className="integrationCardHeader"><h2>{props.title}</h2><span className={`setupStatus ${props.ok ? "ok" : ""}`}>{props.badge}</span></div>{props.children}</section>;
}

function NumberField(props: { label: string; value: string; step?: string; onChange: (value: string) => void }) {
  return <div className="field"><span>{props.label}</span><input type="number" step={props.step} value={props.value} onChange={(event) => props.onChange(event.target.value)} /></div>;
}

function Result(props: { value: { ok: boolean; message: string } | undefined }) {
  if (!props.value) return null;
  return <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: "600", color: props.value.ok ? "#4ade80" : "#f87171" }}>{props.value.message}</div>;
}

function ReviewRow(props: { title: string; detail: string; status: string; ok: boolean; onEdit?: () => void }) {
  return <div className="reviewRow"><span className={`reviewDot ${props.ok ? "ok" : "warn"}`} /><div className="reviewCopy"><strong>{props.title}</strong><small>{props.detail}</small></div><span className={`setupStatus ${props.ok ? "ok" : "warn"}`}>{props.status}</span>{props.onEdit && <button type="button" className="reviewEdit" onClick={props.onEdit}>Edit</button>}</div>;
}

function shortAddress(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
