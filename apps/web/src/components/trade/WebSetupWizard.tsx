"use client";

import Image from "next/image";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type { StoredWebVault } from "@/lib/cryptoVault";
import type { WebSetupSettings } from "@/app/trade/page";

interface WebSetupWizardProps {
  publicAddress: string;
  setupCompleted: boolean;
  editingSetup: boolean;
  setupStep: number;
  setSetupStep: Dispatch<SetStateAction<number>>;
  settings: WebSetupSettings;
  setSettings: Dispatch<SetStateAction<WebSetupSettings>>;
  webVault: StoredWebVault | null;
  vaultPassword: string;
  setVaultPassword: Dispatch<SetStateAction<string>>;
  vaultConfirm: string;
  setVaultConfirm: Dispatch<SetStateAction<string>>;
  vaultUnlocked: boolean;
  walletSecretInput: string;
  setWalletSecretInput: Dispatch<SetStateAction<string>>;
  vaultMessage: string | null;
  onCreateOrUnlockVault: () => void;
  onImportWallet: () => void;
  onRemoveWallet: (walletId: string) => void;
  onSaveSettings: () => void;
  onReturnToWorkspace: () => void;
}

const steps = ["Security", "Wallets", "API Keys", "Agent Core", "Provider", "Review"];

export function WebSetupWizard(props: WebSetupWizardProps) {
  const {
    publicAddress,
    setupCompleted,
    editingSetup,
    setupStep,
    setSetupStep,
    settings,
    setSettings,
    webVault,
    vaultPassword,
    setVaultPassword,
    vaultConfirm,
    setVaultConfirm,
    vaultUnlocked,
    walletSecretInput,
    setWalletSecretInput,
    vaultMessage,
    onCreateOrUnlockVault,
    onImportWallet,
    onRemoveWallet,
    onSaveSettings,
    onReturnToWorkspace,
  } = props;

  function continueFromStep() {
    setSetupStep(editingSetup ? 6 : Math.min(6, setupStep + 1));
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
          <span className="versionBadge">WEB SETUP</span>
        </div>
        <div className="headerActions">
          <div className="networkBadge">
            <span className="statusDot" />
            <span>MAINNET · {publicAddress.slice(0, 4)}...{publicAddress.slice(-4)}</span>
          </div>
          {setupCompleted && (
            <button type="button" onClick={onReturnToWorkspace} className="modeButton">
              Return to Sessions
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
                className={`setupProgressItem ${setupStep === step ? "active" : ""} ${setupStep > step ? "complete" : ""}`}
                onClick={() => setSetupStep(step)}
              >
                <span>{setupStep > step ? "✓" : String(step).padStart(2, "0")}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {editingSetup && setupStep !== 6 && (
          <div className="editingBar">
            <span>EDITING · {steps[setupStep - 1]?.toUpperCase()}</span>
            <button type="button" onClick={() => setSetupStep(6)}>← Return to Review</button>
          </div>
        )}

        <section className="setupCard">
          <header>
            <div className="setupIcon">{setupStep === 6 ? "✓" : String(setupStep).padStart(2, "0")}</div>
            <div>
              <h1>{setupStep === 6 ? "REVIEW YOUR WEB WORKSPACE" : `${steps[setupStep - 1]?.toUpperCase()} CONFIGURATION`}</h1>
              <p>
                {setupStep === 6
                  ? "Review the current configuration and edit only the section you need."
                  : "Mainnet only. Restricted approvals and explicit user confirmation remain mandatory."}
              </p>
            </div>
          </header>

          <div className="setupBody">
            {setupStep === 1 && (
              <div className="setupStepContent">
                <div className={`notice ${webVault ? "success" : "info"}`}>
                  <span>{webVault ? "✓" : "i"}</span>
                  <div>
                    <strong>{webVault ? "Encrypted web vault found" : "Create an encrypted web vault"}</strong>
                    <p>
                      {webVault
                        ? "Enter its password to unlock wallet management for this browser session."
                        : "This password encrypts imported wallet keys locally and cannot be recovered by Silfable."}
                    </p>
                  </div>
                </div>
                <div className="field">
                  <span>Web vault password</span>
                  <input
                    type="password"
                    value={vaultPassword}
                    onChange={(event) => setVaultPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                {!webVault && (
                  <div className="field">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={vaultConfirm}
                      onChange={(event) => setVaultConfirm(event.target.value)}
                      placeholder="Repeat the vault password"
                      autoComplete="new-password"
                    />
                  </div>
                )}
                <button type="button" className="primaryButton" onClick={onCreateOrUnlockVault}>
                  {webVault ? "Unlock Web Vault" : "Create Web Vault"}
                </button>
                {vaultMessage && <p className="setupFeedback">{vaultMessage}</p>}
                <p className="securityBoundary">
                  Browser encryption is weaker than the desktop OS-backed vault because scripts from this web origin share the browser runtime.
                </p>
              </div>
            )}

            {setupStep === 2 && (
              <div className="setupStepContent">
                <div className="field">
                  <span>Connected browser wallet</span>
                  <input type="text" disabled value={publicAddress} />
                  <small>Jupiter execution continues to request approval from this wallet extension.</small>
                </div>

                <div className="walletRegistry">
                  <div className="walletRegistryHeader">
                    <div>
                      <strong>Primary Mainnet wallet signer</strong>
                      <small>{webVault?.wallets.length ? "Secret key encrypted locally" : "Secret key not imported"}</small>
                    </div>
                    <span className={`setupStatus ${vaultUnlocked ? "ok" : "warn"}`}>
                      {vaultUnlocked ? "UNLOCKED" : "LOCKED"}
                    </span>
                  </div>
                  {webVault?.wallets.map((wallet) => (
                    <div className="walletRegistryRow" key={wallet.id}>
                      <div>
                        <strong>{wallet.label}</strong>
                        <code>{wallet.address}</code>
                      </div>
                      <button type="button" className="dangerTextButton" onClick={() => onRemoveWallet(wallet.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {!webVault?.wallets.length && <p className="emptyRegistry">No encrypted wallet has been imported.</p>}
                </div>

                <div className="field">
                  <span>Secret key for {publicAddress.slice(0, 6)}...{publicAddress.slice(-6)}</span>
                  <input
                    type="password"
                    value={walletSecretInput}
                    onChange={(event) => setWalletSecretInput(event.target.value)}
                    placeholder="Base58 or [12,34,...]"
                    disabled={!vaultUnlocked || Boolean(webVault?.wallets.length)}
                    autoComplete="off"
                  />
                  <small>The derived address must match the wallet currently connected in Phantom or Solflare.</small>
                </div>
                <button type="button" className="railBtn" disabled={!vaultUnlocked || !walletSecretInput.trim() || Boolean(webVault?.wallets.length)} onClick={onImportWallet}>
                  Import and Encrypt Wallet
                </button>
                <div className="notice warning">
                  <span>!</span>
                  <div>
                    <strong>Imported keys do not enable automatic trading</strong>
                    <p>Pump.fun web remains preview-only. Imported keys are not sent to APIs and are not used for broadcast.</p>
                  </div>
                </div>
                {vaultMessage && <p className="setupFeedback">{vaultMessage}</p>}
              </div>
            )}

            {setupStep === 3 && (
              <div className="setupStepContent">
                <div className="field">
                  <span>Custom Solana RPC Endpoint</span>
                  <input
                    type="url"
                    value={settings.customRpcUrl}
                    onChange={(event) => setSettings({ ...settings, customRpcUrl: event.target.value })}
                    placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                  />
                </div>
                <div className="fieldGrid">
                  <div className="field">
                    <span>Jupiter API Key</span>
                    <input
                      type="password"
                      value={settings.jupiterApiKey}
                      onChange={(event) => setSettings({ ...settings, jupiterApiKey: event.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="field">
                    <span>Tavily API Key</span>
                    <input
                      type="password"
                      value={settings.tavilyApiKey}
                      onChange={(event) => setSettings({ ...settings, tavilyApiKey: event.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="setupStepContent">
                <div className="fieldGrid">
                  <NumberField label="Context Budget" value={settings.contextBudget} onChange={(value) => setSettings({ ...settings, contextBudget: value })} />
                  <NumberField label="Max Output Tokens" value={settings.outputLimit} onChange={(value) => setSettings({ ...settings, outputLimit: value })} />
                  <NumberField label="Temperature" value={settings.temperature} step="0.1" onChange={(value) => setSettings({ ...settings, temperature: value })} />
                  <NumberField label="Default Deadline (Minutes)" value={settings.defaultDeadlineMinutes} onChange={(value) => setSettings({ ...settings, defaultDeadlineMinutes: value })} />
                  <NumberField label="Max Network Fee (Lamports)" value={settings.maxNetworkFee} onChange={(value) => setSettings({ ...settings, maxNetworkFee: value })} />
                  <NumberField label="Max Slippage (BPS)" value={settings.maxSlippageBps} onChange={(value) => setSettings({ ...settings, maxSlippageBps: value })} />
                </div>
                <div className="fieldGrid">
                  <div className="field">
                    <span>Priority</span>
                    <select
                      value={settings.priority}
                      onChange={(event) => setSettings({ ...settings, priority: event.target.value as WebSetupSettings["priority"] })}
                    >
                      <option value="economy">Economy</option>
                      <option value="standard">Standard</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>
                  <NumberField label="Pump Max Spend (Lamports)" value={settings.pumpMaxSpendLamports} onChange={(value) => setSettings({ ...settings, pumpMaxSpendLamports: value })} />
                  <NumberField label="Pump Take Profit (BPS)" value={settings.pumpTakeProfitBps} onChange={(value) => setSettings({ ...settings, pumpTakeProfitBps: value })} />
                  <NumberField label="Pump Stop Loss (BPS)" value={settings.pumpStopLossBps} onChange={(value) => setSettings({ ...settings, pumpStopLossBps: value })} />
                  <NumberField label="Pump Max Open Positions" value={settings.pumpMaxOpenPositions} onChange={(value) => setSettings({ ...settings, pumpMaxOpenPositions: value })} />
                </div>
                <small className="securityBoundary">Pump.fun web execution is preview-only; these values are retained for future policy guards.</small>
              </div>
            )}

            {setupStep === 5 && (
              <div className="setupStepContent">
                <div className="fieldGrid">
                  <div className="field">
                    <span>OpenRouter API Key</span>
                    <input
                      type="password"
                      value={settings.openRouterApiKey}
                      onChange={(event) => setSettings({ ...settings, openRouterApiKey: event.target.value })}
                      placeholder="sk-or-..."
                    />
                  </div>
                  <div className="field">
                    <span>AI Model</span>
                    <select value={settings.aiModel} onChange={(event) => setSettings({ ...settings, aiModel: event.target.value })}>
                      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                      <option value="openai/gpt-4.1-mini">openai/gpt-4.1-mini</option>
                      <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                      <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {setupStep === 6 && (
              <div className="reviewList">
                <ReviewRow
                  title="Local security"
                  detail={webVault ? `Encrypted browser vault · ${vaultUnlocked ? "unlocked" : "locked"}` : "Web vault has not been created"}
                  status={webVault ? "CONFIGURED" : "REQUIRED"}
                  ok={Boolean(webVault)}
                  onEdit={() => setSetupStep(1)}
                />
                <ReviewRow
                  title="Wallets"
                  detail={webVault?.wallets.length ? "Connected wallet and encrypted signer address match" : "Connected wallet · signer secret not imported"}
                  status="CONFIGURED"
                  ok
                  onEdit={() => setSetupStep(2)}
                />
                <ReviewRow
                  title="API keys"
                  detail={`Jupiter ${settings.jupiterApiKey ? "configured" : "not set"} · Tavily ${settings.tavilyApiKey ? "configured" : "not set"}`}
                  status={settings.jupiterApiKey || settings.tavilyApiKey ? "PARTIAL" : "OPTIONAL"}
                  ok
                  onEdit={() => setSetupStep(3)}
                />
                <ReviewRow
                  title="Agent core"
                  detail={`${settings.contextBudget} context · ${settings.outputLimit} output · ${settings.priority} priority`}
                  status="SAVED"
                  ok
                  onEdit={() => setSetupStep(4)}
                />
                <ReviewRow
                  title="Inference provider"
                  detail={settings.openRouterApiKey ? settings.aiModel : "OpenRouter is not configured"}
                  status={settings.openRouterApiKey ? "CONFIGURED" : "REQUIRED FOR AI"}
                  ok={Boolean(settings.openRouterApiKey)}
                  onEdit={() => setSetupStep(5)}
                />
                <div className="notice warning">
                  <span>!</span>
                  <div>
                    <strong>Mainnet safety boundary</strong>
                    <p>Jupiter swaps require wallet approval. Pump.fun web remains preview-only; autonomous signing and Full Access are unavailable.</p>
                  </div>
                </div>
              </div>
            )}

            <footer className="setupActionsRow">
              {setupStep > 1 && setupStep < 6 && (
                <button type="button" onClick={() => setSetupStep(setupStep - 1)} className="railBtn">Back</button>
              )}
              {setupStep === 1 && !webVault ? null : setupStep < 6 ? (
                <button type="button" onClick={continueFromStep} className="primaryButton">
                  {editingSetup ? "Save & Return to Review" : `Continue to Step ${setupStep + 1}`}
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

function NumberField(props: { label: string; value: string; step?: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <span>{props.label}</span>
      <input type="number" step={props.step} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function ReviewRow(props: { title: string; detail: string; status: string; ok: boolean; onEdit: () => void }) {
  return (
    <div className="reviewRow">
      <span className={`reviewDot ${props.ok ? "ok" : "warn"}`} />
      <div className="reviewCopy">
        <strong>{props.title}</strong>
        <small>{props.detail}</small>
      </div>
      <span className={`setupStatus ${props.ok ? "ok" : "warn"}`}>{props.status}</span>
      <button type="button" className="reviewEdit" onClick={props.onEdit}>Edit</button>
    </div>
  );
}
