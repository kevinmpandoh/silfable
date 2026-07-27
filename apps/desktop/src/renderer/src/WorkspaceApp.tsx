import { useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "../../assets/logo.png";

import type {
  EmergencyStopStatus,
  LimitOrderCancelSimulation,
  LimitOrderContractPreview,
  LimitOrderExecutionReceipt,
  LimitOrderSimulationPreview,
  MissionContractPreview,
  MissionExecutionReceipt,
  MissionSimulationPreview,
  OpenRouterModelView,
  PortfolioSnapshot,
  PumpExecutionRecord,
  PumpFinalRevalidation,
  PumpRiskSettings,
  PumpSimulationArtifact,
  PumpTokenIntelligence,
  PumpTradeContractPreview,
  RuntimeStatus,
  SessionRecord,
  TransactionSettings,
  WalletActivitySnapshot,
} from "@silfable/contracts";

type SetupState = {
  step: number;
  complete: boolean;
  passwordConfigured: boolean;
  walletSkipped: boolean;
  jupiterConfigured: boolean;
  tavilyConfigured: boolean;
  tuningConfigured: boolean;
  providerConfigured: boolean;
  providerModel: string;
  contextLimit: number;
  outputLimit: number;
  temperature: string;
  subagentMaxConcurrent: number;
  subagentContextLimit: number;
  subagentOutputLimit: string;
  subagentTemperature: string;
  subagentMaxIterations: number;
  subagentTimeoutMs: number;
  maxToolCallsPerTurn: number;
  missionMaxSteps: number;
  retryLimit: number;
  maxNetworkFeeLamports: number;
  maxFeePercent: number;
  defaultSlippageBps: number;
  defaultDeadlineMinutes: number;
  transactionPriority: TransactionSettings["priority"];
};

type SessionMode = SessionRecord["mode"];
type Permission = SessionRecord["permission"];
type SessionWorkspace = NonNullable<SessionRecord["workspace"]>;
type PumpSessionConfig = NonNullable<SessionRecord["pumpConfig"]>;
type SessionFilter = "all" | SessionMode | "pump";
type WalletSummary = { address: string; primary: boolean };
type ChatMessage = SessionRecord["messages"][number];
type SessionItem = SessionRecord;

const STORAGE_KEY = "silfable.mainnet-setup.v2";
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const DEFAULT_SETUP: SetupState = {
  step: 0,
  complete: false,
  passwordConfigured: false,
  walletSkipped: false,
  jupiterConfigured: false,
  tavilyConfigured: false,
  tuningConfigured: false,
  providerConfigured: false,
  providerModel: "",
  contextLimit: 128_000,
  outputLimit: 8_192,
  temperature: "",
  subagentMaxConcurrent: 5,
  subagentContextLimit: 16_384,
  subagentOutputLimit: "",
  subagentTemperature: "",
  subagentMaxIterations: 25,
  subagentTimeoutMs: 300_000,
  maxToolCallsPerTurn: 12,
  missionMaxSteps: 24,
  retryLimit: 2,
  maxNetworkFeeLamports: 200_000,
  maxFeePercent: 5,
  defaultSlippageBps: 50,
  defaultDeadlineMinutes: 30,
  transactionPriority: "standard",
};

const SETUP_STEPS = [
  "Security",
  "Wallets",
  "API keys",
  "Agent core",
  "Provider",
  "Review",
];

export function WorkspaceApp() {
  const [setup, setSetup] = useState<SetupState>(() => readSetup());
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootPassed, setBootPassed] = useState(false);

  useEffect(() => {
    window.silfable
      .getRuntimeStatus()
      .then((value) => {
        setRuntime(value);
        setBootReady(true);
      })
      .catch(() =>
        setBootError("The local runtime did not return a trusted status."),
      );
  }, []);

  function saveSetup(next: SetupState): void {
    setSetup(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  if (!bootPassed) {
    return (
      <BootstrapScreen
        runtime={runtime}
        ready={bootReady}
        error={bootError}
        onContinue={() => {
          if (!setup.complete && setup.step === 0)
            saveSetup({ ...setup, step: 1 });
          setBootPassed(true);
        }}
      />
    );
  }
  if (
    runtime?.masterPassword === "configured" &&
    runtime.keystore === "locked"
  ) {
    return (
      <UnlockScreen
        onUnlocked={async () => {
          setRuntime({ ...runtime, keystore: "unlocked" });
          if (!setup.passwordConfigured)
            saveSetup({
              ...setup,
              passwordConfigured: true,
              step: Math.max(2, setup.step),
            });
        }}
      />
    );
  }
  if (setup.complete && runtime?.masterPassword === "missing") {
    return (
      <main className="setupPage">
        <Brand compact />
        <div className="migrationSecurity">
          <SecurityStep
            runtime={runtime}
            onConfigured={(nextRuntime) => {
              setRuntime(nextRuntime);
              saveSetup({ ...setup, passwordConfigured: true });
            }}
            migration
          />
        </div>
        <CornerFooter />
      </main>
    );
  }
  if (!setup.complete) {
    return (
      <SetupFlow
        setup={setup}
        runtime={runtime}
        save={saveSetup}
        setRuntime={setRuntime}
      />
    );
  }
  return (
    <MainWorkspace
      setup={setup}
      runtime={runtime}
      saveSetup={saveSetup}
      setRuntime={setRuntime}
    />
  );
}

function BootstrapScreen({
  runtime,
  ready,
  error,
  onContinue,
}: {
  runtime: RuntimeStatus | null;
  ready: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const probes = [
    {
      label: "Desktop runtime",
      detail: runtime
        ? `Electron host · ${runtime.appVersion}`
        : "Inspecting application host",
      ok: ready,
    },
    {
      label: "Local database",
      detail: ready
        ? "SQLite opened · schema migrations applied"
        : "Opening encrypted runtime data",
      ok: ready,
    },
    {
      label: "Mainnet RPC",
      detail: runtime
        ? `${runtime.networkHealth} · read-only finalized balance access`
        : "Checking Mainnet connectivity",
      ok: runtime?.networkHealth === "healthy",
    },
    {
      label: "Secure vault",
      detail: runtime
        ? `OS-backed storage · ${runtime.keystore}`
        : "Checking secure storage",
      ok: ready,
    },
  ];
  return (
    <main className="onboardingPage">
      <Brand compact={false} />
      <section className="bootCard">
        <div className="sectionRule">
          <span />
        </div>
        <div className="screenHeading">
          <div>
            <p className="kicker">System check</p>
            <h1>Prepare the local runtime.</h1>
            <p>
              Silfable runs locally and connects only to Mainnet services you
              explicitly configure.
            </p>
          </div>
          <span className="stepCount">BOOTSTRAP</span>
        </div>
        <div className="probeList">
          {probes.map((probe, index) => (
            <div className="probeRow" key={probe.label}>
              <span className="probeIndex">0{index + 1}</span>
              <span className="probeIcon">{probe.ok ? "✓" : "·"}</span>
              <div>
                <strong>{probe.label}</strong>
                <small>{probe.detail}</small>
              </div>
              <StatusPill
                tone={
                  probe.ok
                    ? "success"
                    : runtime && index === 2
                      ? "warning"
                      : "neutral"
                }
              >
                {probe.ok
                  ? "READY"
                  : runtime && index === 2
                    ? "DEGRADED"
                    : "CHECKING"}
              </StatusPill>
            </div>
          ))}
        </div>
        {error && (
          <Notice tone="danger" title="Runtime check failed">
            {error}
          </Notice>
        )}
        <div className="bootActions">
          <button
            className="primaryButton"
            disabled={!ready}
            onClick={onContinue}
          >
            Continue <span>→</span>
          </button>
        </div>
        <p className="safeNote">
          No wallet signing, mission scheduling, or Mainnet execution starts
          during setup.
        </p>
      </section>
      <CornerFooter />
    </main>
  );
}

function SetupFlow({
  setup,
  runtime,
  save,
  setRuntime,
  editing = false,
  onExit,
}: {
  setup: SetupState;
  runtime: RuntimeStatus | null;
  save: (next: SetupState) => void;
  setRuntime: (runtime: RuntimeStatus) => void;
  editing?: boolean;
  onExit?: (() => void) | undefined;
}) {
  const index = Math.max(0, setup.step - 1);
  function next(patch: Partial<SetupState> = {}): void {
    save({
      ...setup,
      ...patch,
      step: editing ? 6 : Math.min(6, setup.step + 1),
    });
  }
  function back(): void {
    save({ ...setup, step: editing ? 6 : Math.max(1, setup.step - 1) });
  }
  function edit(step: number): void {
    save({ ...setup, step });
  }
  const editingLabel = SETUP_STEPS[setup.step - 1] ?? "Setup";
  return (
    <main className="setupPage">
      <Brand compact />
      <SetupStepper current={index} />
      {editing && setup.step !== 6 && (
        <div className="editingBar">
          <span>Editing · {editingLabel}</span>
          <button onClick={() => edit(6)}>← Return to review</button>
        </div>
      )}
      {setup.step === 1 &&
        (runtime?.masterPassword === "configured" ? (
          <ChangePasswordStep
            onContinue={() => next({ passwordConfigured: true })}
          />
        ) : (
          <SecurityStep
            runtime={runtime}
            onConfigured={(nextRuntime) => {
              setRuntime(nextRuntime);
              next({ passwordConfigured: true });
            }}
          />
        ))}
      {setup.step === 2 && (
        <WalletStep
          runtime={runtime}
          setRuntime={setRuntime}
          onBack={back}
          onContinue={(skipped) => next({ walletSkipped: skipped })}
        />
      )}
      {setup.step === 3 && (
        <IntegrationStep
          setup={setup}
          onBack={back}
          onContinue={(values) => next(values)}
        />
      )}
      {setup.step === 4 && (
        <TuningStep
          setup={setup}
          onBack={back}
          onContinue={(values) => next({ ...values, tuningConfigured: true })}
        />
      )}
      {setup.step === 5 && (
        <ProviderStep
          setup={setup}
          onBack={back}
          onContinue={(model) =>
            next({ providerConfigured: true, providerModel: model })
          }
        />
      )}
      {setup.step === 6 && (
        <ReviewStep
          setup={setup}
          runtime={runtime}
          edit={edit}
          onBack={back}
          onFinalize={() => save({ ...setup, complete: true })}
          editing={editing}
          onExit={onExit}
        />
      )}
      <CornerFooter />
    </main>
  );
}

function SetupStepper({ current }: { current: number }) {
  return (
    <nav className="setupStepper" aria-label="Setup progress">
      {SETUP_STEPS.map((label, index) => (
        <div
          className={
            index === current ? "active" : index < current ? "done" : ""
          }
          key={label}
        >
          <span>
            {index < current ? "✓" : String(index + 1).padStart(2, "0")}
          </span>
          <small>{label}</small>
        </div>
      ))}
    </nav>
  );
}

function SecurityStep({
  runtime,
  onConfigured,
  migration = false,
}: {
  runtime: RuntimeStatus | null;
  onConfigured: (runtime: RuntimeStatus) => void;
  migration?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const characterGroups = [
    /[a-z]/u,
    /[A-Z]/u,
    /[0-9]/u,
    /[^a-zA-Z0-9]/u,
  ].filter((pattern) => pattern.test(password)).length;
  const score = Math.min(
    4,
    (password.length >= 8 ? 1 : 0) + Math.min(3, characterGroups),
  );
  const valid =
    password.length >= 8 && characterGroups >= 3 && password === confirm;
  const strengthLabel = !password
    ? "Not entered"
    : valid
      ? "Strong"
      : score < 3
        ? "Weak"
        : "Almost ready";
  async function configure(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.configureMasterPassword({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        password,
        confirmPassword: confirm,
        acknowledgedPasswordLossRisk: true,
      });
      setPassword("");
      setConfirm("");
      onConfigured(
        runtime
          ? {
              ...runtime,
              keystore: response.keystore,
              masterPassword: response.masterPassword,
            }
          : await window.silfable.getRuntimeStatus(),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (
        error instanceof TypeError ||
        /not a function|no handler|channel/u.test(detail)
      )
        setMessage(
          "The desktop runtime is outdated. Quit Silfable completely and reopen it before trying again.",
        );
      else if (/already configured/u.test(detail))
        setMessage(
          "A master password is already configured. Reopen Silfable and use the unlock screen.",
        );
      else if (/encryption|secure storage|basic_text/u.test(detail))
        setMessage(
          "Windows secure storage is unavailable. Restart Windows or check the system credential service, then try again.",
        );
      else
        setMessage(
          "Password could not be saved. Restart Silfable and try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupCard
      icon="⌾"
      title={
        migration ? "Secure your existing setup" : "Protect your local vault"
      }
      subtitle={
        migration
          ? "Create the master password that will be required whenever Silfable opens."
          : "Create the access password used to enter Silfable on this machine."
      }
    >
      {migration && (
        <Notice tone="warning" title="One-time security upgrade">
          The earlier build did not persist a password verifier. Create the
          password once here; your wallets and API configuration remain
          unchanged.
        </Notice>
      )}
      <Notice tone="info" title="Local-first security">
        Secrets remain protected by the operating-system vault. This password is
        never written to setup history or logs.
      </Notice>
      <Field label="Master password">
        <div className="inputWithAction">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <button onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <div className={`strength strength${score}`}>
        <div className="strengthHeader">
          <small>Password strength</small>
          <strong>{strengthLabel}</strong>
        </div>
        <div className="strengthSegments">
          {[1, 2, 3, 4].map((segment) => (
            <span className={segment <= score ? "filled" : ""} key={segment} />
          ))}
        </div>
        <p>
          Minimum 8 characters. Combine at least three: lowercase, uppercase,
          number, or symbol.
        </p>
      </div>
      <Field label="Confirm password">
        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      {confirm && password !== confirm && (
        <p className="fieldError">Passwords do not match.</p>
      )}
      {message && <p className="fieldError">{message}</p>}
      <SetupActions
        step={1}
        onContinue={() => void configure()}
        continueDisabled={!valid || busy}
        continueLabel={
          busy
            ? "Securing vault…"
            : migration
              ? "Save and open workspace"
              : "Save and continue"
        }
      />
    </SetupCard>
  );
}

function UnlockScreen({ onUnlocked }: { onUnlocked: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  async function unlock(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.unlockVault({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        password,
      });
      setPassword("");
      await onUnlocked();
    } catch {
      setPassword("");
      setMessage(
        "Master password is incorrect or the secure vault is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resetVault(): Promise<void> {
    setResetBusy(true);
    setMessage(null);
    try {
      await window.silfable.resetVault({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        confirmation: "SET UP NEW VAULT",
        acknowledgedPermanentAccessLoss: true,
      });
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    } catch (error) {
      if (!(error instanceof Error) || !/cancelled/u.test(error.message))
        setMessage(
          "The new vault was not created. Your current encrypted vault remains unchanged.",
        );
      setResetOpen(false);
      setResetAcknowledged(false);
    } finally {
      setResetBusy(false);
    }
  }
  return (
    <main className="onboardingPage">
      <Brand compact={false} />
      <section className="bootCard unlockCard">
        <div className="sectionRule">
          <span />
        </div>
        <div className="screenHeading">
          <div>
            <p className="kicker">Vault locked</p>
            <h1>Welcome back.</h1>
            <p>Enter the master password configured on this device.</p>
          </div>
          <span className="stepCount">MAINNET</span>
        </div>
        <Field label="Master password">
          <div className="inputWithAction">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && password) void unlock();
              }}
              autoComplete="current-password"
            />
            <button onClick={() => setShow(!show)}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        {message && <p className="fieldError">{message}</p>}
        <div className="bootActions">
          <button
            className="primaryButton"
            disabled={!password || busy}
            onClick={() => void unlock()}
          >
            {busy ? "Unlocking…" : "Unlock workspace"} <span>→</span>
          </button>
        </div>
        <button
          className="forgotVaultButton"
          onClick={() => setResetOpen(true)}
        >
          I forgot my password — set up a new vault
        </button>
        <p className="safeNote">
          Wallet and API secrets remain unavailable until this check succeeds.
        </p>
      </section>
      {resetOpen && (
        <div className="modalBackdrop" role="presentation">
          <section
            className="resetVaultModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-vault-title"
          >
            <p className="kicker">Destructive recovery</p>
            <h2 id="reset-vault-title">Set up a new vault?</h2>
            <p>
              This does not recover or decrypt the current vault. Silfable will
              preserve an encrypted backup, then remove the current wallets, API
              configuration, and saved sessions from the active workspace.
            </p>
            <p>
              On-chain funds can be recovered only from an existing seed phrase
              or private key.
            </p>
            <label className="resetAcknowledgement">
              <input
                type="checkbox"
                checked={resetAcknowledged}
                onChange={(event) => setResetAcknowledged(event.target.checked)}
              />
              <span>
                I understand that access to the current vault cannot be
                recovered without its password.
              </span>
            </label>
            <div className="modalActions">
              <button
                disabled={resetBusy}
                onClick={() => {
                  setResetOpen(false);
                  setResetAcknowledged(false);
                }}
              >
                Cancel
              </button>
              <button
                className="dangerButton"
                disabled={!resetAcknowledged || resetBusy}
                onClick={() => void resetVault()}
              >
                {resetBusy ? "Preparing backup…" : "Set up new vault"}
              </button>
            </div>
          </section>
        </div>
      )}
      <CornerFooter />
    </main>
  );
}

function ChangePasswordStep({ onContinue }: { onContinue: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const newPasswordGroups = [
    /[a-z]/u,
    /[A-Z]/u,
    /[0-9]/u,
    /[^a-zA-Z0-9]/u,
  ].filter((pattern) => pattern.test(newPassword)).length;
  const valid =
    newPassword.length >= 8 &&
    newPasswordGroups >= 3 &&
    newPassword === confirm &&
    currentPassword.length > 0;
  async function change(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.changeMasterPassword({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        currentPassword,
        newPassword,
        confirmPassword: confirm,
        acknowledgedPasswordLossRisk: true,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setMessage("Master password changed successfully.");
    } catch {
      setMessage(
        "Password was not changed. Check the current password, use at least 8 characters, and make sure the new entries match.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupCard
      icon="⌾"
      title="Change master password"
      subtitle="Update the password required when Silfable opens."
    >
      <Notice tone="info" title="Existing secrets remain intact">
        Changing this access password does not replace or export wallet and API
        secrets.
      </Notice>
      <Field label="Current password">
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password">
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      {message && <p className="inlineMessage">{message}</p>}
      <footer className="setupActions">
        <span>Security · Mainnet only</span>
        <div>
          <button onClick={onContinue}>Return to review</button>
          <button
            className="primaryButton"
            disabled={!valid || busy}
            onClick={() => void change()}
          >
            {busy ? "Changing…" : "Change password"}
          </button>
        </div>
      </footer>
    </SetupCard>
  );
}

function WalletStep({
  runtime,
  setRuntime,
  onBack,
  onContinue,
}: {
  runtime: RuntimeStatus | null;
  setRuntime: (runtime: RuntimeStatus) => void;
  onBack: () => void;
  onContinue: (skipped: boolean) => void;
}) {
  const [mode, setMode] = useState<"generate" | "mnemonic" | "private">(
    "generate",
  );
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [wallets, setWallets] = useState<
    Array<{ address: string; primary: boolean }>
  >([]);
  const [evmMnemonic, setEvmMnemonic] = useState("");
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmRecovery, setEvmRecovery] = useState<string | null>(null);
  const [evmMessage, setEvmMessage] = useState<string | null>(null);
  const [walletTab, setWalletTab] = useState<"solana" | "evm">("solana");
  const configured = runtime?.wallet === "configured";
  useEffect(() => {
    if (!configured) return;
    window.silfable
      .listWallets()
      .then((response) => setWallets(response.wallets))
      .catch(() =>
        setMessage("Wallet list could not be opened from the encrypted vault."),
      );
  }, [configured]);
  useEffect(() => {
    window.silfable.getRobinhoodWallet().then((result) => setEvmAddress(result.address)).catch(() => undefined);
  }, []);
  async function onboard(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const base = {
        schemaVersion: 1 as const,
        requestId: crypto.randomUUID(),
        acknowledgedHotWalletRisk: true as const,
      };
      if (mode === "generate") {
        const result = await window.silfable.createWallet(base);
        setRecovery(result.recoveryMnemonic);
        setMessage(
          `Solana address ${shorten(result.address)} created. Mainnet execution requires mission policy, simulation, and final approval.`,
        );
      } else if (mode === "mnemonic") {
        const result = await window.silfable.importWalletMnemonic({
          ...base,
          mnemonic: secret,
        });
        setMessage(`Solana address ${shorten(result.address)} imported.`);
      } else {
        const result = await window.silfable.importWalletPrivateKey({
          ...base,
          privateKey: secret,
        });
        setMessage(`Solana address ${shorten(result.address)} imported.`);
      }
      setSecret("");
      setRuntime(await window.silfable.getRuntimeStatus());
      setWallets((await window.silfable.listWallets()).wallets);
    } catch (error) {
      setSecret("");
      setMessage(
        error instanceof Error
          ? error.message
          : "Wallet operation was rejected safely.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createEvmWallet(): Promise<void> {
    setBusy(true); setEvmMessage(null); setEvmRecovery(null);
    try {
      const result = await window.silfable.createRobinhoodWallet({ schemaVersion: 1, requestId: crypto.randomUUID(), acknowledgedHotWalletRisk: true });
      setEvmAddress(result.address); setEvmRecovery(result.recoveryMnemonic); setEvmMessage("Robinhood Chain EVM wallet created and encrypted locally.");
    } catch { setEvmMessage("EVM wallet could not be created. A wallet may already be configured."); }
    finally { setBusy(false); }
  }
  async function importEvmWallet(): Promise<void> {
    setBusy(true); setEvmMessage(null); setEvmRecovery(null);
    try {
      const result = await window.silfable.importRobinhoodWalletMnemonic({ schemaVersion: 1, requestId: crypto.randomUUID(), mnemonic: evmMnemonic, acknowledgedHotWalletRisk: true });
      setEvmMnemonic(""); setEvmAddress(result.address); setEvmMessage("Robinhood Chain EVM wallet imported and encrypted locally.");
    } catch { setEvmMessage("EVM recovery phrase could not be imported."); }
    finally { setBusy(false); }
  }
  return (
    <SetupCard
      icon="◇"
      title="Set up Mainnet wallets"
      subtitle="Select the wallets a future session may reference. Adding a wallet never authorizes a transaction."
    >
      <Notice tone="warning" title="Execution stays locked">
        Mainnet is the only active network. Restricted approval and
        deterministic policy checks remain mandatory.
      </Notice>
      <div className="chainTabs">
        <button className={walletTab === "solana" ? "active" : ""} onClick={() => setWalletTab("solana")}>◎ Solana</button>
        <button className={walletTab === "evm" ? "active" : ""} onClick={() => setWalletTab("evm")}>◆ EVM · Robinhood Chain</button>
      </div>
      {walletTab === "solana" && <>
      {configured && (
        <div className="configuredReceipt">
          <span>✓</span>
          <div>
            <strong>
              {wallets.length || 1} Solana wallet
              {wallets.length === 1 ? "" : "s"} configured
            </strong>
            <small>
              You can generate or import another wallet below. The first wallet remains primary.
            </small>
          </div>
        </div>
      )}
      {wallets.length > 0 && (
        <div className="walletList">
          {wallets.map((wallet, index) => (
              <div key={wallet.address}>
                <span>0{index + 1}</span>
                <strong>{shorten(wallet.address)}</strong>
                {wallet.primary && (
                  <StatusPill tone="success">Primary</StatusPill>
                )}
                <button onClick={() => void copyWalletAddress(wallet.address)}>
                  Copy
                </button>
              </div>
          ))}
        </div>
      )}
      <div className="segmented">
        <button
          className={mode === "generate" ? "active" : ""}
          onClick={() => setMode("generate")}
        >
          Generate new
        </button>
        <button
          className={mode === "mnemonic" ? "active" : ""}
          onClick={() => setMode("mnemonic")}
        >
          Import phrase
        </button>
        <button
          className={mode === "private" ? "active" : ""}
          onClick={() => setMode("private")}
        >
          Import key
        </button>
      </div>
      {mode !== "generate" && (
        <Field label={mode === "mnemonic" ? "Recovery phrase" : "Private key"}>
          <textarea
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={
              mode === "mnemonic"
                ? "12 or 24 recovery words"
                : "Base58 key or JSON byte array"
            }
          />
        </Field>
      )}
      <button
        className="secondaryButton"
        disabled={busy || (mode !== "generate" && secret.trim().length < 8)}
        onClick={() => void onboard()}
      >
        {busy
          ? "Securing wallet…"
          : configured
            ? mode === "generate"
              ? "Add another wallet"
              : "Import another wallet"
            : mode === "generate"
              ? "Generate wallet"
              : "Import wallet"}
      </button>
      {recovery && (
        <Notice tone="danger" title="Write down this recovery phrase">
          {recovery}
        </Notice>
      )}
      </>}
      {walletTab === "evm" &&
      <section className="advanced transactionGuardSettings">
        <strong>Robinhood Chain EVM wallet</strong>
        <small className="providerHint">Separate from Solana. Creating or importing this wallet never enables a transaction.</small>
        {evmAddress ? (
          <div className="configuredReceipt"><span>âœ“</span><div><strong>EVM wallet configured</strong><small>{evmAddress}</small></div></div>
        ) : (
          <>
            <Field label="Import EVM recovery phrase"><textarea value={evmMnemonic} onChange={(event) => setEvmMnemonic(event.target.value)} rows={3} spellCheck={false} placeholder="12 or 24 recovery words" /></Field>
            <button className="secondaryButton" disabled={busy || evmMnemonic.trim().length < 32} onClick={() => void importEvmWallet()}>{busy ? "Importing…" : "Import EVM wallet"}</button>
            <button className="secondaryButton" disabled={busy} onClick={() => void createEvmWallet()}>{busy ? "Creating…" : "Create new EVM wallet"}</button>
          </>
        )}
        {evmRecovery && <Notice tone="danger" title="Write down this EVM recovery phrase">{evmRecovery}</Notice>}
        {evmMessage && <p className="inlineMessage">{evmMessage}</p>}
      </section>
      }
      {message && <p className="inlineMessage">{message}</p>}
      <SetupActions
        step={2}
        onBack={onBack}
        onContinue={() => onContinue(!configured)}
        secondaryLabel={!configured ? "Continue without wallet" : undefined}
      />
    </SetupCard>
  );
}

function IntegrationStep({
  setup,
  onBack,
  onContinue,
}: {
  setup: SetupState;
  onBack: () => void;
  onContinue: (
    value: Pick<SetupState, "jupiterConfigured" | "tavilyConfigured">,
  ) => void;
}) {
  const [jupiterKey, setJupiterKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [solanaRpcUrl, setSolanaRpcUrl] = useState("");
  const [robinhoodRpcUrl, setRobinhoodRpcUrl] = useState("");
  const [zeroExKey, setZeroExKey] = useState("");
  const [robinhoodWalletAddress, setRobinhoodWalletAddress] = useState<string | null>(null);
  const [robinhoodSellToken, setRobinhoodSellToken] = useState("");
  const [robinhoodBuyToken, setRobinhoodBuyToken] = useState("");
  const [robinhoodSellAmount, setRobinhoodSellAmount] = useState("");
  const [robinhoodQuote, setRobinhoodQuote] = useState<{ sellAmount: string; buyAmount: string; minBuyAmount: string | null; zeroExFeeAmount: string | null; liquidityAvailable: boolean; sellTokenSymbol: string; buyTokenSymbol: string } | null>(null);
  const [robinhoodPreflight, setRobinhoodPreflight] = useState<{ allowanceRequired: boolean; currentAllowance: string; gasLimit: string; maxGasCostWei: string; expiresAt: string; expectedBuyAmount: string; minimumBuyAmount: string } | null>(null);
  const [robinhoodReceipts, setRobinhoodReceipts] = useState<Array<{ id: string; transactionHash: string; kind: "approval" | "swap"; status: "confirmed" | "reverted" | "unknown"; reconciledAt: string }>>([]);
  const [jupiterConfigured, setJupiterConfigured] = useState(
    setup.jupiterConfigured,
  );
  const [tavilyConfigured, setTavilyConfigured] = useState(
    setup.tavilyConfigured,
  );
  const [rpcConfigured, setRpcConfigured] = useState(false);
  const [robinhoodRpcConfigured, setRobinhoodRpcConfigured] = useState(false);
  const [zeroExConfigured, setZeroExConfigured] = useState(false);
  const [robinhoodExecutionMissing, setRobinhoodExecutionMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      window.silfable.getJupiterSettings(),
      window.silfable.getTavilySettings(),
      window.silfable.getSolanaRpcSettings(),
      window.silfable.getRobinhoodSettings(),
      window.silfable.getRobinhoodWallet(),
      window.silfable.listRobinhoodReceipts(),
    ])
      .then(([jupiter, tavily, rpc, robinhood, robinhoodWallet, receipts]) => {
        setJupiterConfigured(jupiter.configured);
        setTavilyConfigured(tavily.configured);
        if (rpc.rpcUrl) {
          setSolanaRpcUrl(rpc.rpcUrl);
          setRpcConfigured(true);
        }
        setRobinhoodRpcConfigured(robinhood.rpcConfigured);
        setZeroExConfigured(robinhood.zeroExConfigured);
        setRobinhoodExecutionMissing(robinhood.executionMissing);
        setRobinhoodWalletAddress(robinhoodWallet.address);
        setRobinhoodReceipts(receipts.receipts);
      })
      .catch(() => undefined);
  }, []);
  async function saveRpc(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveSolanaRpcUrl({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        rpcUrl: solanaRpcUrl.trim() ? solanaRpcUrl.trim() : null,
      });
      setRpcConfigured(Boolean(solanaRpcUrl.trim()));
      setMessage(solanaRpcUrl.trim() ? "Custom Solana RPC URL updated." : "Reset to default Solana public RPC.");
    } catch {
      setMessage("Solana RPC URL could not be saved. Ensure it starts with https://");
    } finally {
      setBusy(false);
    }
  }
  async function saveKey(provider: "jupiter" | "tavily"): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      if (provider === "jupiter") {
        await window.silfable.saveJupiterKey({
          schemaVersion: 1,
          requestId: crypto.randomUUID(),
          apiKey: jupiterKey,
          acknowledgedMainnetMarketData: true,
        });
        setJupiterKey("");
        setJupiterConfigured(true);
      } else {
        await window.silfable.saveTavilyKey({
          schemaVersion: 1,
          requestId: crypto.randomUUID(),
          apiKey: tavilyKey,
          acknowledgedExternalProcessing: true,
        });
        setTavilyKey("");
        setTavilyConfigured(true);
      }
      setMessage(
        `${provider === "jupiter" ? "Jupiter" : "Tavily"} key encrypted in the local vault.`,
      );
    } catch {
      setMessage(
        `${provider === "jupiter" ? "Jupiter" : "Tavily"} key could not be stored. Unlock the vault and try again.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveRobinhoodRpc(testOnly = false): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const request = { schemaVersion: 1 as const, requestId: crypto.randomUUID(), rpcUrl: robinhoodRpcUrl.trim() };
      if (testOnly) {
        const result = await window.silfable.testRobinhoodRpcUrl(request);
        setMessage(`Robinhood RPC verified on chain ID ${result.chainId}.`);
      } else {
        await window.silfable.saveRobinhoodRpcUrl(request);
        setRobinhoodRpcUrl("");
        setRobinhoodRpcConfigured(true);
        setMessage("Robinhood RPC encrypted in the local vault.");
      }
    } catch {
      setMessage("Robinhood RPC could not be verified. Use an HTTPS endpoint serving chain ID 4663.");
    } finally {
      setBusy(false);
    }
  }
  async function saveZeroExKey(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveRobinhoodZeroXKey({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        apiKey: zeroExKey,
        acknowledgedExternalQuoteProvider: true,
      });
      setZeroExKey("");
      setZeroExConfigured(true);
      setMessage("0x API key encrypted in the local vault. Robinhood execution remains disabled until its release gate is complete.");
    } catch {
      setMessage("0x API key could not be stored. Unlock the vault and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function testZeroExKey(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.silfable.testRobinhoodZeroXKey({ schemaVersion: 1, requestId: crypto.randomUUID() });
      setMessage(`0x Swap API verified for Robinhood Chain (${result.chainId}).`);
    } catch {
      setMessage("0x API could not be verified for Robinhood Chain. Check the saved API key and provider status.");
    } finally {
      setBusy(false);
    }
  }
  async function getRobinhoodQuote(): Promise<void> {
    setBusy(true);
    setMessage(null);
    setRobinhoodQuote(null);
    try {
      const result = await window.silfable.getRobinhoodIndicativePrice({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sellToken: robinhoodSellToken.trim(),
        buyToken: robinhoodBuyToken.trim(),
        sellAmount: robinhoodSellAmount.trim(),
        slippageBps: 100,
        acknowledgedReadOnlyQuote: true,
      });
      setRobinhoodQuote(result.quote);
      setMessage("Indicative 0x quote received. It is read-only and cannot be executed.");
    } catch {
      setMessage("Robinhood quote could not be retrieved. Verify the EVM wallet, 0x key, token contracts, amount, and liquidity.");
    } finally {
      setBusy(false);
    }
  }
  async function prepareRobinhoodTrade(): Promise<void> {
    setBusy(true); setMessage(null); setRobinhoodPreflight(null);
    try {
      const result = await window.silfable.prepareRobinhoodTrade({ schemaVersion: 1, requestId: crypto.randomUUID(), sellToken: robinhoodSellToken.trim(), buyToken: robinhoodBuyToken.trim(), sellAmount: robinhoodSellAmount.trim(), slippageBps: 100, acknowledgedReadOnlyQuote: true });
      setRobinhoodPreflight({ ...result.preflight, expectedBuyAmount: result.expectedBuyAmount, minimumBuyAmount: result.minimumBuyAmount });
      setMessage("Trade preflight is ready for review. No approval or swap has been submitted.");
    } catch { setMessage("Robinhood preflight could not be prepared. Check allowance, liquidity, policy, and gas settings."); }
    finally { setBusy(false); }
  }
  async function refreshRobinhoodReceipts(reconcile = false): Promise<void> {
    setBusy(true); setMessage(null);
    try {
      if (reconcile) {
        const result = await window.silfable.reconcileRobinhoodReceipts();
        setMessage(result.reconciled.length === 0 ? "No pending Robinhood receipts required reconciliation." : `${result.reconciled.length} Robinhood receipt(s) reconciled without rebroadcast.`);
      }
      const result = await window.silfable.listRobinhoodReceipts();
      setRobinhoodReceipts(result.receipts);
    } catch { setMessage("Robinhood receipts could not be loaded or reconciled. Check the saved RPC URL."); }
    finally { setBusy(false); }
  }
  return (
    <SetupCard
      icon="⌁"
      title="Connect integrations"
      subtitle="Enable only the external services your sessions need."
    >
      <ProviderCard
        name="Solana RPC Node"
        tag={rpcConfigured ? "Custom RPC" : "Default RPC"}
        description="Custom HTTPS RPC URL for fast, unthrottled Solana Mainnet & Pump.fun scanning."
      >
        <Field label="Custom RPC Endpoint URL (Helius, QuickNode, Triton, etc.)">
          <div className="inputWithAction">
            <input
              type="url"
              value={solanaRpcUrl}
              onChange={(event) => setSolanaRpcUrl(event.target.value)}
              placeholder="https://mainnet.helius-rpc.com/?api-key=..."
            />
            <button
              disabled={busy}
              onClick={() => void saveRpc()}
            >
              {busy ? "Saving" : "Save RPC"}
            </button>
          </div>
        </Field>
        <small className="providerHint">
          Stored locally. Leave blank to use default public RPC. Custom RPC endpoints bypass rate limits during Pump.fun scans.
        </small>
      </ProviderCard>
      <ProviderCard
        name="Jupiter"
        tag={jupiterConfigured ? "Configured" : "Optional"}
        description="Mainnet Solana quotes, swap routes, and portfolio routing metadata."
      >
        <Field label="Jupiter API key">
          <div className="inputWithAction">
            <input
              type="password"
              value={jupiterKey}
              onChange={(event) => setJupiterKey(event.target.value)}
              placeholder={
                jupiterConfigured
                  ? "Replace saved key"
                  : "Enter Jupiter API key"
              }
              autoComplete="new-password"
            />
            <button
              disabled={busy || jupiterKey.trim().length < 8}
              onClick={() => void saveKey("jupiter")}
            >
              {busy ? "Saving" : "Save key"}
            </button>
          </div>
        </Field>
        <small className="providerHint">
          Stored encrypted on this device. Leave blank to keep the current key.
        </small>
      </ProviderCard>
      <ProviderCard
        name="Robinhood Chain"
        tag={robinhoodRpcConfigured && zeroExConfigured ? "Configured · execution locked" : "Optional"}
        description="Personal Robinhood Chain RPC and 0x quote credentials for future manual EVM trading. Saving these credentials never enables trading."
      >
        <Field label="Robinhood Chain HTTPS RPC URL (Alchemy recommended)">
          <div className="inputWithAction">
            <input
              type="url"
              value={robinhoodRpcUrl}
              onChange={(event) => setRobinhoodRpcUrl(event.target.value)}
              placeholder={robinhoodRpcConfigured ? "Replace saved RPC URL" : "https://robinhood-mainnet.g.alchemy.com/v2/..."}
              autoComplete="off"
            />
            <button disabled={busy || !robinhoodRpcUrl.trim()} onClick={() => void saveRobinhoodRpc(true)}>
              {busy ? "Checking" : "Test RPC"}
            </button>
            <button disabled={busy || !robinhoodRpcUrl.trim()} onClick={() => void saveRobinhoodRpc()}>
              Save RPC
            </button>
          </div>
        </Field>
        <Field label="0x API key">
          <div className="inputWithAction">
            <input
              type="password"
              value={zeroExKey}
              onChange={(event) => setZeroExKey(event.target.value)}
              placeholder={zeroExConfigured ? "Replace saved key" : "Enter 0x API key"}
              autoComplete="new-password"
            />
            <button disabled={busy || zeroExKey.trim().length < 8} onClick={() => void saveZeroExKey()}>
              {busy ? "Saving" : "Save key"}
            </button>
            <button disabled={busy || !zeroExConfigured} onClick={() => void testZeroExKey()}>
              {busy ? "Checking" : "Test 0x"}
            </button>
          </div>
        </Field>
        <Field label="Robinhood trade preview (read-only, advanced)">
          <div className="advancedGrid">
            <input value={robinhoodSellToken} onChange={(event) => setRobinhoodSellToken(event.target.value)} placeholder="Sell token contract (advanced: 0x...)" autoComplete="off" />
            <input value={robinhoodBuyToken} onChange={(event) => setRobinhoodBuyToken(event.target.value)} placeholder="Buy token contract (advanced: 0x...)" autoComplete="off" />
            <input inputMode="numeric" value={robinhoodSellAmount} onChange={(event) => setRobinhoodSellAmount(event.target.value)} placeholder="Raw token units (advanced)" />
          </div>
          <button disabled={busy || !robinhoodWalletAddress || !zeroExConfigured || !robinhoodSellToken.trim() || !robinhoodBuyToken.trim() || !robinhoodSellAmount.trim()} onClick={() => void getRobinhoodQuote()}>
            {busy ? "Fetching" : "Get read-only quote"}
          </button>
          <button disabled={busy || !robinhoodWalletAddress || !zeroExConfigured || !robinhoodSellToken.trim() || !robinhoodBuyToken.trim() || !robinhoodSellAmount.trim()} onClick={() => void prepareRobinhoodTrade()}>
            {busy ? "Preparing" : "Prepare trade review"}
          </button>
          {robinhoodQuote && <small className="providerHint">Sell: {robinhoodQuote.sellAmount} {robinhoodQuote.sellTokenSymbol} · Expected buy: {robinhoodQuote.buyAmount} {robinhoodQuote.buyTokenSymbol} · Minimum: {robinhoodQuote.minBuyAmount ?? "unavailable"} · 0x fee: {robinhoodQuote.zeroExFeeAmount ?? "none"} · Liquidity: {robinhoodQuote.liquidityAvailable ? "available" : "not confirmed"}</small>}
          {robinhoodPreflight && <small className="providerHint">Preflight: expected {robinhoodPreflight.expectedBuyAmount} · minimum {robinhoodPreflight.minimumBuyAmount} · allowance {robinhoodPreflight.currentAllowance} · approval {robinhoodPreflight.allowanceRequired ? "required" : "not required"} · gas {robinhoodPreflight.gasLimit} · expires {new Date(robinhoodPreflight.expiresAt).toLocaleTimeString()}</small>}
        </Field>
        <small className="providerHint">
          Credentials are encrypted locally and never shown again. Router and token policy remain release-controlled; no key grants signing or broadcast authority.
        </small>
        <Field label="Robinhood execution receipts">
          <button disabled={busy} onClick={() => void refreshRobinhoodReceipts()}>{busy ? "Loading" : "Refresh receipts"}</button>
          <button disabled={busy || !robinhoodRpcConfigured} onClick={() => void refreshRobinhoodReceipts(true)}>{busy ? "Checking" : "Reconcile pending receipts"}</button>
          {robinhoodReceipts.length === 0 ? <small className="providerHint">No Robinhood transaction receipts are stored on this device.</small> : (
            <small className="providerHint">{robinhoodReceipts.slice(0, 5).map((receipt) => `${receipt.kind} ${receipt.status} · ${receipt.transactionHash.slice(0, 10)}… · ${new Date(receipt.reconciledAt).toLocaleString()}`).join(" | ")}</small>
          )}
        </Field>
        {robinhoodExecutionMissing.length > 0 && (
          <Notice tone="info" title="Manual trading is intentionally locked">
            Remaining release evidence: {robinhoodExecutionMissing.join(", ")}.
          </Notice>
        )}
      </ProviderCard>
      <ProviderCard
        name="Tavily"
        tag={tavilyConfigured ? "Configured" : "Optional"}
        description="Read-only web and finance research for Agent or Mission sessions."
      >
        <Field label="Tavily API key">
          <div className="inputWithAction">
            <input
              type="password"
              value={tavilyKey}
              onChange={(event) => setTavilyKey(event.target.value)}
              placeholder={
                tavilyConfigured ? "Replace saved key" : "Enter Tavily API key"
              }
              autoComplete="new-password"
            />
            <button
              disabled={busy || tavilyKey.trim().length < 8}
              onClick={() => void saveKey("tavily")}
            >
              {busy ? "Saving" : "Save key"}
            </button>
          </div>
        </Field>
        <small className="providerHint">
          The AI may invoke this read-only search tool. Search queries leave
          this device; credentials never enter the prompt.
        </small>
      </ProviderCard>
      {message && <p className="inlineMessage">{message}</p>}
      <SetupActions
        step={3}
        onBack={onBack}
        onContinue={() => onContinue({ jupiterConfigured, tavilyConfigured })}
        secondaryLabel={
          !jupiterConfigured && !tavilyConfigured ? "Skip optional" : undefined
        }
      />
    </SetupCard>
  );
}

type TuningValues = Pick<
  SetupState,
  | "contextLimit"
  | "outputLimit"
  | "temperature"
  | "subagentMaxConcurrent"
  | "subagentContextLimit"
  | "subagentOutputLimit"
  | "subagentTemperature"
  | "subagentMaxIterations"
  | "subagentTimeoutMs"
  | "maxToolCallsPerTurn"
  | "missionMaxSteps"
  | "retryLimit"
  | "maxNetworkFeeLamports"
  | "maxFeePercent"
  | "defaultSlippageBps"
  | "defaultDeadlineMinutes"
  | "transactionPriority"
>;

function TuningStep({
  setup,
  onBack,
  onContinue,
}: {
  setup: SetupState;
  onBack: () => void;
  onContinue: (value: TuningValues) => void;
}) {
  const [contextLimit, setContextLimit] = useState(String(setup.contextLimit));
  const [outputLimit, setOutputLimit] = useState(String(setup.outputLimit));
  const [temperature, setTemperature] = useState(setup.temperature);
  const [subagentMaxConcurrent, setSubagentMaxConcurrent] = useState(
    String(setup.subagentMaxConcurrent),
  );
  const [subagentContextLimit, setSubagentContextLimit] = useState(
    String(setup.subagentContextLimit),
  );
  const [subagentOutputLimit, setSubagentOutputLimit] = useState(
    setup.subagentOutputLimit,
  );
  const [subagentTemperature, setSubagentTemperature] = useState(
    setup.subagentTemperature,
  );
  const [subagentMaxIterations, setSubagentMaxIterations] = useState(
    String(setup.subagentMaxIterations),
  );
  const [subagentTimeoutMs, setSubagentTimeoutMs] = useState(
    String(setup.subagentTimeoutMs),
  );
  const [maxToolCallsPerTurn, setMaxToolCallsPerTurn] = useState(
    String(setup.maxToolCallsPerTurn),
  );
  const [missionMaxSteps, setMissionMaxSteps] = useState(
    String(setup.missionMaxSteps),
  );
  const [retryLimit, setRetryLimit] = useState(String(setup.retryLimit));
  const [maxNetworkFeeLamports, setMaxNetworkFeeLamports] = useState(String(setup.maxNetworkFeeLamports));
  const [maxNetworkFeeUnit, setMaxNetworkFeeUnit] = useState<"lamports" | "sol" | "usd">("lamports");
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);
  const [maxFeePercent, setMaxFeePercent] = useState(String(setup.maxFeePercent));
  const [defaultSlippageBps, setDefaultSlippageBps] = useState(String(setup.defaultSlippageBps));
  const [defaultDeadlineMinutes, setDefaultDeadlineMinutes] = useState(String(setup.defaultDeadlineMinutes));
  const [transactionPriority, setTransactionPriority] = useState<TransactionSettings["priority"]>(setup.transactionPriority);
  const [pumpRisk, setPumpRisk] = useState({
    maxTradingFeeBps: "500",
    maxSlippageBps: "300",
    maxSpendPerTradeLamports: "50000000",
    maxDailySpendLamports: "200000000",
    maxPerTokenExposureLamports: "100000000",
    maxTotalExposureLamports: "500000000",
    maxOpenPositions: "5",
    maxTransactionsPerHour: "10",
    minSolReserveLamports: "20000000",
  });
  const [solanaRpcUrl, setSolanaRpcUrl] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  useEffect(() => {
    window.silfable.getTransactionSettings().then(({ settings }) => {
      setMaxNetworkFeeLamports(String(settings.maxNetworkFeeLamports));
      setMaxFeePercent(String(settings.maxFeePercent));
      setDefaultSlippageBps(String(settings.defaultSlippageBps));
      setDefaultDeadlineMinutes(String(settings.defaultDeadlineMinutes));
      setTransactionPriority(settings.priority);
    }).catch(() => undefined);
    window.silfable.getPumpRiskSettings().then(({ settings }) => {
      setPumpRisk(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])) as typeof pumpRisk);
    }).catch(() => undefined);
    window.silfable.getSolanaRpcSettings().then((res) => {
      setSolanaRpcUrl(res.rpcUrl ?? "");
    }).catch(() => undefined);
    window.silfable.listWallets().then((res) => {
      const first = res.wallets[0];
      if (first) {
        window.silfable.getPortfolio({ schemaVersion: 1, requestId: crypto.randomUUID(), address: first.address }).then((p) => {
          if (p.snapshot.solUsdPrice) setSolPriceUsd(p.snapshot.solUsdPrice);
        }).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, []);
  const context = Number(contextLimit);
  const output = Number(outputLimit);
  const numeric = {
    subagentMaxConcurrent: Number(subagentMaxConcurrent),
    subagentContextLimit: Number(subagentContextLimit),
    subagentMaxIterations: Number(subagentMaxIterations),
    subagentTimeoutMs: Number(subagentTimeoutMs),
    maxToolCallsPerTurn: Number(maxToolCallsPerTurn),
    missionMaxSteps: Number(missionMaxSteps),
    retryLimit: Number(retryLimit),
    maxNetworkFeeLamports: Number(maxNetworkFeeLamports),
    maxFeePercent: Number(maxFeePercent),
    defaultSlippageBps: Number(defaultSlippageBps),
    defaultDeadlineMinutes: Number(defaultDeadlineMinutes),
  };
  const valid =
    Number.isInteger(context) &&
    context >= 1_000 &&
    context <= 2_000_000 &&
    Number.isInteger(output) &&
    output >= 256 &&
    output <= context &&
    (!temperature || (Number(temperature) >= 0 && Number(temperature) <= 2)) &&
    Number.isInteger(numeric.subagentMaxConcurrent) &&
    numeric.subagentMaxConcurrent >= 1 &&
    numeric.subagentMaxConcurrent <= 20 &&
    Number.isInteger(numeric.subagentContextLimit) &&
    numeric.subagentContextLimit >= 1_000 &&
    numeric.subagentContextLimit <= 2_000_000 &&
    (!subagentOutputLimit ||
      (Number.isInteger(Number(subagentOutputLimit)) &&
        Number(subagentOutputLimit) >= 256 &&
        Number(subagentOutputLimit) <= numeric.subagentContextLimit)) &&
    (!subagentTemperature ||
      (Number(subagentTemperature) >= 0 && Number(subagentTemperature) <= 2)) &&
    Number.isInteger(numeric.subagentMaxIterations) &&
    numeric.subagentMaxIterations >= 1 &&
    numeric.subagentMaxIterations <= 200 &&
    Number.isInteger(numeric.subagentTimeoutMs) &&
    numeric.subagentTimeoutMs >= 10_000 &&
    numeric.subagentTimeoutMs <= 1_800_000 &&
    Number.isInteger(numeric.maxToolCallsPerTurn) &&
    numeric.maxToolCallsPerTurn >= 1 &&
    numeric.maxToolCallsPerTurn <= 100 &&
    Number.isInteger(numeric.missionMaxSteps) &&
    numeric.missionMaxSteps >= 1 &&
    numeric.missionMaxSteps <= 500 &&
    Number.isInteger(numeric.retryLimit) &&
    numeric.retryLimit >= 0 &&
    numeric.retryLimit <= 10;
  const transactionValid = Number.isInteger(numeric.maxNetworkFeeLamports) && numeric.maxNetworkFeeLamports >= 5_000 && numeric.maxNetworkFeeLamports <= 10_000_000
    && Number.isFinite(numeric.maxFeePercent) && numeric.maxFeePercent >= 0.1 && numeric.maxFeePercent <= 100
    && Number.isInteger(numeric.defaultSlippageBps) && numeric.defaultSlippageBps >= 0 && numeric.defaultSlippageBps <= 300
    && Number.isInteger(numeric.defaultDeadlineMinutes) && numeric.defaultDeadlineMinutes >= 5 && numeric.defaultDeadlineMinutes <= 43_200;
  const pumpSettings: PumpRiskSettings = {
    maxTradingFeeBps: Number(pumpRisk.maxTradingFeeBps),
    maxSlippageBps: Number(pumpRisk.maxSlippageBps),
    maxSpendPerTradeLamports: pumpRisk.maxSpendPerTradeLamports,
    maxDailySpendLamports: pumpRisk.maxDailySpendLamports,
    maxPerTokenExposureLamports: pumpRisk.maxPerTokenExposureLamports,
    maxTotalExposureLamports: pumpRisk.maxTotalExposureLamports,
    maxOpenPositions: Number(pumpRisk.maxOpenPositions),
    maxTransactionsPerHour: Number(pumpRisk.maxTransactionsPerHour),
    minSolReserveLamports: pumpRisk.minSolReserveLamports,
  };
  const rawLimitsValid = [pumpSettings.maxSpendPerTradeLamports, pumpSettings.maxDailySpendLamports, pumpSettings.maxPerTokenExposureLamports, pumpSettings.maxTotalExposureLamports].every((value) => /^[1-9]\d*$/u.test(value))
    && /^\d+$/u.test(pumpSettings.minSolReserveLamports);
  const pumpRiskValid = Number.isInteger(pumpSettings.maxTradingFeeBps) && pumpSettings.maxTradingFeeBps >= 1 && pumpSettings.maxTradingFeeBps <= 1_000
    && Number.isInteger(pumpSettings.maxSlippageBps) && pumpSettings.maxSlippageBps >= 0 && pumpSettings.maxSlippageBps <= 1_000
    && Number.isInteger(pumpSettings.maxOpenPositions) && pumpSettings.maxOpenPositions >= 1 && pumpSettings.maxOpenPositions <= 100
    && Number.isInteger(pumpSettings.maxTransactionsPerHour) && pumpSettings.maxTransactionsPerHour >= 1 && pumpSettings.maxTransactionsPerHour <= 100
    && rawLimitsValid
    && BigInt(pumpSettings.maxDailySpendLamports) >= BigInt(pumpSettings.maxSpendPerTradeLamports)
    && BigInt(pumpSettings.maxTotalExposureLamports) >= BigInt(pumpSettings.maxPerTokenExposureLamports);
  async function saveAndContinue(): Promise<void> {
    if (!valid || !transactionValid || !pumpRiskValid) return;
    setSaveMessage(null);
    try {
      await window.silfable.saveTransactionSettings({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        settings: {
          maxNetworkFeeLamports: numeric.maxNetworkFeeLamports,
          maxFeePercent: numeric.maxFeePercent,
          defaultSlippageBps: numeric.defaultSlippageBps,
          defaultDeadlineMinutes: numeric.defaultDeadlineMinutes,
          priority: transactionPriority,
        },
      });
      await window.silfable.savePumpRiskSettings({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        settings: pumpSettings,
      });
      await window.silfable.saveSolanaRpcUrl({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        rpcUrl: solanaRpcUrl.trim() ? solanaRpcUrl.trim() : null,
      });
      onContinue({
        contextLimit: context, outputLimit: output, temperature,
        subagentMaxConcurrent: numeric.subagentMaxConcurrent, subagentContextLimit: numeric.subagentContextLimit,
        subagentOutputLimit, subagentTemperature, subagentMaxIterations: numeric.subagentMaxIterations,
        subagentTimeoutMs: numeric.subagentTimeoutMs, maxToolCallsPerTurn: numeric.maxToolCallsPerTurn,
        missionMaxSteps: numeric.missionMaxSteps, retryLimit: numeric.retryLimit,
        maxNetworkFeeLamports: numeric.maxNetworkFeeLamports, maxFeePercent: numeric.maxFeePercent,
        defaultSlippageBps: numeric.defaultSlippageBps, defaultDeadlineMinutes: numeric.defaultDeadlineMinutes,
        transactionPriority,
      });
    } catch { setSaveMessage("Transaction settings could not be saved."); }
  }
  return (
    <SetupCard
      icon="⌘"
      title="Tune the AI agent"
      subtitle="These defaults are snapshotted when a new session starts."
    >
      <Notice tone="info" title="Restricted by default">
        Tool calls, mission steps, and model spending remain bounded
        independently of model output.
      </Notice>
      <div className="advanced transactionGuardSettings">
        <strong>Solana Mainnet RPC Provider</strong>
        <div className="advancedGrid">
          <Field label="Custom RPC Endpoint URL (Helius, QuickNode, Triton, etc.)">
            <input
              type="url"
              value={solanaRpcUrl}
              onChange={(event) => setSolanaRpcUrl(event.target.value)}
              placeholder="https://mainnet.helius-rpc.com/?api-key=..."
            />
            <small>Optional. Custom HTTPS RPC URL for fast, unthrottled Solana Mainnet & Pump.fun scanning.</small>
          </Field>
        </div>
      </div>
      <Field label="Context budget">
        <input
          inputMode="numeric"
          value={contextLimit}
          onChange={(event) => setContextLimit(event.target.value)}
        />
        <small>
          1,000–2,000,000 tokens; revalidated against the selected model.
        </small>
      </Field>
      <Field label="Maximum output tokens">
        <input
          inputMode="numeric"
          value={outputLimit}
          onChange={(event) => setOutputLimit(event.target.value)}
        />
        <small>Must not exceed the context budget.</small>
      </Field>
      <Field label="Temperature">
        <input
          inputMode="decimal"
          value={temperature}
          onChange={(event) => setTemperature(event.target.value)}
          placeholder="Provider default"
        />
        <small>Optional · range 0–2.</small>
      </Field>
      <div className="advanced transactionGuardSettings">
        <strong>Transaction guard</strong>
        <div className="advancedGrid">
          <Field label={`Maximum network fee (${maxNetworkFeeUnit.toUpperCase()})`}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                inputMode={maxNetworkFeeUnit === "lamports" ? "numeric" : "decimal"}
                value={
                  maxNetworkFeeUnit === "lamports"
                    ? maxNetworkFeeLamports
                    : maxNetworkFeeUnit === "sol"
                      ? String(Number(maxNetworkFeeLamports) / 1e9)
                      : solPriceUsd
                        ? String(Number(((Number(maxNetworkFeeLamports) / 1e9) * solPriceUsd).toFixed(4)))
                        : maxNetworkFeeLamports
                }
                onChange={(event) => {
                  const val = event.target.value;
                  if (maxNetworkFeeUnit === "lamports") {
                    setMaxNetworkFeeLamports(val);
                  } else if (maxNetworkFeeUnit === "sol") {
                    const num = parseFloat(val);
                    setMaxNetworkFeeLamports(isNaN(num) ? "" : String(Math.round(num * 1e9)));
                  } else if (maxNetworkFeeUnit === "usd" && solPriceUsd) {
                    const num = parseFloat(val);
                    setMaxNetworkFeeLamports(isNaN(num) ? "" : String(Math.round((num / solPriceUsd) * 1e9)));
                  }
                }}
              />
              <select
                value={maxNetworkFeeUnit}
                onChange={(e) => setMaxNetworkFeeUnit(e.target.value as "lamports" | "sol" | "usd")}
                style={{ padding: "6px 10px", borderRadius: "6px" }}
              >
                <option value="lamports">Lamports</option>
                <option value="sol">SOL</option>
                <option value="usd" disabled={!solPriceUsd}>USD {!solPriceUsd ? "(No Price)" : ""}</option>
              </select>
            </div>
            <small>
              {maxNetworkFeeUnit === "lamports" && "5,000–10,000,000. Execution is blocked above this value."}
              {maxNetworkFeeUnit === "sol" && `Stored as ${Number(maxNetworkFeeLamports).toLocaleString()} lamports (range: 0.000005–0.01 SOL).`}
              {maxNetworkFeeUnit === "usd" && (solPriceUsd ? `Converted at $${solPriceUsd}/SOL (${Number(maxNetworkFeeLamports).toLocaleString()} lamports).` : "Price feed unavailable.")}
            </small>
          </Field>
          <Field label="Maximum fee percentage">
            <input inputMode="decimal" value={maxFeePercent} onChange={(event) => setMaxFeePercent(event.target.value)} />
            <small>Percentage of the proposed input value.</small>
          </Field>
          <Field label="Default slippage (bps)">
            <input inputMode="numeric" value={defaultSlippageBps} onChange={(event) => setDefaultSlippageBps(event.target.value)} />
            <small>Used as the recommended mission default; hard maximum is 300 bps.</small>
          </Field>
          <Field label="Default deadline (minutes)">
            <input inputMode="numeric" value={defaultDeadlineMinutes} onChange={(event) => setDefaultDeadlineMinutes(event.target.value)} />
            <small>Range 5 minutes–30 days.</small>
          </Field>
          <Field label="Priority preference">
            <select value={transactionPriority} onChange={(event) => setTransactionPriority(event.target.value as TransactionSettings["priority"])}>
              <option value="economy">Economy</option><option value="standard">Standard</option><option value="fast">Fast</option>
            </select>
            <small>Preference is applied to Jupiter transaction order construction (Economy / Standard / Fast). Absolute fee guard always wins.</small>
          </Field>
        </div>
      </div>
      <details className="advanced transactionGuardSettings" open>
        <summary>Pump.fun hard risk limits</summary>
        <p className="fieldHint">These local limits override AI output and are checked again before every unsigned simulation.</p>
        <div className="advancedGrid">
          <Field label="Maximum trading fee (bps)"><input inputMode="numeric" value={pumpRisk.maxTradingFeeBps} onChange={(event) => setPumpRisk({ ...pumpRisk, maxTradingFeeBps: event.target.value })} /><small>Protocol plus creator fee ceiling.</small></Field>
          <Field label="Maximum Pump slippage (bps)"><input inputMode="numeric" value={pumpRisk.maxSlippageBps} onChange={(event) => setPumpRisk({ ...pumpRisk, maxSlippageBps: event.target.value })} /><small>A Pump proposal cannot exceed this value.</small></Field>
          <Field label="Spend per trade (lamports)"><input inputMode="numeric" value={pumpRisk.maxSpendPerTradeLamports} onChange={(event) => setPumpRisk({ ...pumpRisk, maxSpendPerTradeLamports: event.target.value })} /></Field>
          <Field label="Spend per day (lamports)"><input inputMode="numeric" value={pumpRisk.maxDailySpendLamports} onChange={(event) => setPumpRisk({ ...pumpRisk, maxDailySpendLamports: event.target.value })} /></Field>
          <Field label="Exposure per token (lamports)"><input inputMode="numeric" value={pumpRisk.maxPerTokenExposureLamports} onChange={(event) => setPumpRisk({ ...pumpRisk, maxPerTokenExposureLamports: event.target.value })} /></Field>
          <Field label="Total Pump exposure (lamports)"><input inputMode="numeric" value={pumpRisk.maxTotalExposureLamports} onChange={(event) => setPumpRisk({ ...pumpRisk, maxTotalExposureLamports: event.target.value })} /></Field>
          <Field label="Maximum open positions"><input inputMode="numeric" value={pumpRisk.maxOpenPositions} onChange={(event) => setPumpRisk({ ...pumpRisk, maxOpenPositions: event.target.value })} /></Field>
          <Field label="Transactions per hour"><input inputMode="numeric" value={pumpRisk.maxTransactionsPerHour} onChange={(event) => setPumpRisk({ ...pumpRisk, maxTransactionsPerHour: event.target.value })} /></Field>
          <Field label="Minimum SOL reserve (lamports)"><input inputMode="numeric" value={pumpRisk.minSolReserveLamports} onChange={(event) => setPumpRisk({ ...pumpRisk, minSolReserveLamports: event.target.value })} /><small>Proposals are blocked if spend plus maximum network fee would cross this floor.</small></Field>
        </div>
        {!pumpRiskValid && <p className="fieldError">Pump limits are invalid. Daily spend must cover one trade and total exposure must cover per-token exposure.</p>}
      </details>
      <details className="advanced">
        <summary>Advanced agent and subagent tuning</summary>
        <div className="advancedGrid">
          <Field label="Concurrent subagents">
            <input
              inputMode="numeric"
              value={subagentMaxConcurrent}
              onChange={(event) => setSubagentMaxConcurrent(event.target.value)}
            />
            <small>Range 1–20.</small>
          </Field>
          <Field label="Subagent context limit">
            <input
              inputMode="numeric"
              value={subagentContextLimit}
              onChange={(event) => setSubagentContextLimit(event.target.value)}
            />
            <small>Range 1,000–2,000,000.</small>
          </Field>
          <Field label="Subagent output tokens">
            <input
              inputMode="numeric"
              value={subagentOutputLimit}
              onChange={(event) => setSubagentOutputLimit(event.target.value)}
              placeholder="Inherit agent output"
            />
            <small>Optional · up to subagent context.</small>
          </Field>
          <Field label="Subagent temperature">
            <input
              inputMode="decimal"
              value={subagentTemperature}
              onChange={(event) => setSubagentTemperature(event.target.value)}
              placeholder="Inherit agent temperature"
            />
            <small>Optional · range 0–2.</small>
          </Field>
          <Field label="Subagent max iterations">
            <input
              inputMode="numeric"
              value={subagentMaxIterations}
              onChange={(event) => setSubagentMaxIterations(event.target.value)}
            />
            <small>Range 1–200.</small>
          </Field>
          <Field label="Subagent timeout (ms)">
            <input
              inputMode="numeric"
              value={subagentTimeoutMs}
              onChange={(event) => setSubagentTimeoutMs(event.target.value)}
            />
            <small>10,000–1,800,000 ms.</small>
          </Field>
          <Field label="Tool calls per turn">
            <input
              inputMode="numeric"
              value={maxToolCallsPerTurn}
              onChange={(event) => setMaxToolCallsPerTurn(event.target.value)}
            />
            <small>Range 1–100.</small>
          </Field>
          <Field label="Mission maximum steps">
            <input
              inputMode="numeric"
              value={missionMaxSteps}
              onChange={(event) => setMissionMaxSteps(event.target.value)}
            />
            <small>Range 1–500.</small>
          </Field>
          <Field label="Non-mutating retry limit">
            <input
              inputMode="numeric"
              value={retryLimit}
              onChange={(event) => setRetryLimit(event.target.value)}
            />
            <small>Mutating actions are never blindly retried.</small>
          </Field>
        </div>
      </details>
      <SetupActions
        step={4}
        onBack={onBack}
        onContinue={() => void saveAndContinue()}
        continueDisabled={!valid || !transactionValid || !pumpRiskValid}
      />
      {saveMessage && <p className="inlineMessage">{saveMessage}</p>}
    </SetupCard>
  );
}

function ProviderStep({
  setup,
  onBack,
  onContinue,
}: {
  setup: SetupState;
  onBack: () => void;
  onContinue: (model: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<OpenRouterModelView[]>([]);
  const [model, setModel] = useState(setup.providerModel);
  const [storedConfigured, setStoredConfigured] = useState(
    setup.providerConfigured,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    window.silfable
      .getAiSettings()
      .then((response) => {
        const saved = response.providers.find(
          (provider) => provider.provider === "openrouter",
        );
        if (!saved?.configured) return;
        setStoredConfigured(true);
        setModel((current) => current || saved.model);
        setMessage(
          "OpenRouter is already configured. Enter a new key only to replace it.",
        );
      })
      .catch(() => undefined);
  }, []);
  async function loadModels(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.previewOpenRouterModels({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        apiKey,
        acknowledgedExternalProcessing: true,
      });
      setModels(response.models);
      setModel(response.models[0]?.id ?? "");
      setMessage(`${response.models.length} compatible models verified.`);
    } catch {
      setMessage(
        "OpenRouter rejected the key or the model catalog is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProvider(): Promise<void> {
    if (storedConfigured && apiKey.trim().length === 0 && model) {
      onContinue(model);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveAiProvider({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: "openrouter",
        apiKey,
        model,
        acknowledgedExternalProcessing: true,
      });
      setStoredConfigured(true);
      setMessage(
        "OpenRouter key encrypted. The key will not be displayed again.",
      );
      onContinue(model);
    } catch {
      setMessage("OpenRouter configuration was not saved.");
    } finally {
      setBusy(false);
    }
  }
  const selected = models.find((item) => item.id === model);
  return (
    <SetupCard
      icon="◈"
      title="Choose the inference provider"
      subtitle="OpenRouter supplies the model; Silfable keeps authority and tool enforcement local."
    >
      <Field label="OpenRouter API key">
        <div className="inputWithAction">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="new-password"
            placeholder={
              storedConfigured ? "Enter a new key to reconfigure" : "sk-or-…"
            }
          />
          <button
            disabled={busy || apiKey.trim().length < 8}
            onClick={() => void loadModels()}
          >
            {busy ? "Checking" : "Verify"}
          </button>
        </div>
      </Field>
      <Field label="Compatible model">
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={models.length === 0}
        >
          {storedConfigured && model ? (
            <option value={model}>{model} · saved</option>
          ) : (
            <option value="">Verify a key to load models</option>
          )}
          {models
            .filter((item) => item.id !== model)
            .map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.contextLength.toLocaleString()} ctx
              </option>
            ))}
        </select>
      </Field>
      {selected && (
        <div className="modelMeta">
          <span>{selected.id}</span>
          <span>{selected.supportsTools ? "Tools" : "No tools"}</span>
          <span>Structured output</span>
          <span>{selected.contextLength.toLocaleString()} context</span>
        </div>
      )}
      <Notice tone="warning" title="External processing">
        Session prompts are sent to OpenRouter after you create a session.
        Wallet keys, API keys, and signing material are never included.
      </Notice>
      {message && <p className="inlineMessage">{message}</p>}
      <SetupActions
        step={5}
        onBack={onBack}
        onContinue={() => void saveProvider()}
        continueDisabled={
          !model || (!storedConfigured && apiKey.trim().length < 8) || busy
        }
        continueLabel={
          storedConfigured && !apiKey ? "Continue with saved" : "Save provider"
        }
      />
    </SetupCard>
  );
}

function ReviewStep({
  setup,
  runtime,
  edit,
  onBack,
  onFinalize,
  editing = false,
  onExit,
}: {
  setup: SetupState;
  runtime: RuntimeStatus | null;
  edit: (step: number) => void;
  onBack: () => void;
  onFinalize: () => void;
  editing?: boolean;
  onExit?: (() => void) | undefined;
}) {
  const rows = [
    {
      title: "Local security",
      state: setup.passwordConfigured ? "Configured" : "Blocked",
      detail: "OS-backed encrypted vault · local access policy",
      step: 1,
      ok: setup.passwordConfigured,
    },
    {
      title: "Wallets",
      state:
        runtime?.wallet === "configured" ? "Configured" : "Optional missing",
      detail:
        runtime?.wallet === "configured"
          ? "Solana wallet registry · restricted Mainnet approval"
          : "No wallet-bound tools",
      step: 2,
      ok: runtime?.wallet === "configured",
    },
    {
      title: "API keys",
      state:
        setup.jupiterConfigured || setup.tavilyConfigured
          ? "Configured"
          : "Optional missing",
      detail: `Jupiter ${setup.jupiterConfigured ? "configured" : "not set"} · Tavily ${setup.tavilyConfigured ? "configured" : "not set"}`,
      step: 3,
      ok: setup.jupiterConfigured || setup.tavilyConfigured,
    },
    {
      title: "Agent core",
      state: "Saved",
      detail: `${setup.contextLimit.toLocaleString()} context · ${setup.outputLimit.toLocaleString()} output · ${setup.subagentMaxConcurrent} subagents`,
      step: 4,
      ok: true,
    },
    {
      title: "Inference",
      state: setup.providerConfigured ? "Configured" : "Blocked",
      detail: setup.providerModel || "OpenRouter is required for Agent/Mission",
      step: 5,
      ok: setup.providerConfigured,
    },
  ];
  return (
    <SetupCard
      icon="✓"
      title={editing ? "Edit infrastructure" : "Review your setup"}
      subtitle={
        editing
          ? "Review current settings and edit only the section you need."
          : "Confirm the capabilities available before entering the Mainnet workspace."
      }
    >
      <div className="reviewList">
        {rows.map((row) => (
          <div className="reviewRow" key={row.title}>
            <span className={row.ok ? "dot ok" : "dot warn"} />
            <div>
              <strong>{row.title}</strong>
              <small>{row.detail}</small>
            </div>
            <StatusPill tone={row.ok ? "success" : "warning"}>
              {row.state}
            </StatusPill>
            <button onClick={() => edit(row.step)}>Edit</button>
          </div>
        ))}
      </div>
      <Notice tone="warning" title="Mainnet safety status">
        Verified reads and restricted Jupiter swaps are available. Every swap
        requires a mission contract, passed simulation, master-password recheck,
        and explicit final confirmation. Autonomous execution, EVM, and Full
        Access remain unavailable.
      </Notice>
      {editing && <EmergencyStopPanel />}
      {editing ? (
        <footer className="setupActions settingsActions">
          <span>Settings · Mainnet only</span>
          <div>
            <button className="primaryButton" onClick={onExit}>
              Back to sessions
            </button>
          </div>
        </footer>
      ) : (
        <SetupActions
          step={6}
          onBack={onBack}
          onContinue={onFinalize}
          continueDisabled={
            !setup.passwordConfigured || !setup.providerConfigured
          }
          continueLabel="Finalize setup"
        />
      )}
    </SetupCard>
  );
}

function MainWorkspace({
  setup,
  runtime,
  saveSetup,
  setRuntime,
}: {
  setup: SetupState;
  runtime: RuntimeStatus | null;
  saveSetup: (next: SetupState) => void;
  setRuntime: (runtime: RuntimeStatus) => void;
}) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [thinkingIds, setThinkingIds] = useState<string[]>([]);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [backgroundLoopEnabled, setBackgroundLoopEnabled] = useState(false);
  const [nav, setNav] = useState<"sessions" | "memory" | "missions">(
    "sessions",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulationApproval, setSimulationApproval] = useState<{
    sessionId: string;
    messageId: string;
    preview: MissionContractPreview;
  } | null>(null);
  const [simulatingMissionIds, setSimulatingMissionIds] = useState<string[]>(
    [],
  );
  const [simulatingPumpIds, setSimulatingPumpIds] = useState<string[]>([]);
  const [revalidatingPumpIds, setRevalidatingPumpIds] = useState<string[]>([]);
  const [pumpExecutionApproval, setPumpExecutionApproval] = useState<{
    sessionId: string;
    messageId: string;
    preview: PumpTradeContractPreview;
    simulation: PumpSimulationArtifact;
    revalidation: PumpFinalRevalidation;
  } | null>(null);
  const [executingPumpIds, setExecutingPumpIds] = useState<string[]>([]);
  const [verifyingPumpExecutionIds, setVerifyingPumpExecutionIds] = useState<string[]>([]);
  const [executionApproval, setExecutionApproval] = useState<{
    sessionId: string;
    messageId: string;
    preview: MissionContractPreview;
    simulation: MissionSimulationPreview;
  } | null>(null);
  const [executingMissionIds, setExecutingMissionIds] = useState<string[]>([]);
  const [verifyingReceiptIds, setVerifyingReceiptIds] = useState<string[]>([]);
  const [limitSimulationApproval, setLimitSimulationApproval] = useState<{
    sessionId: string;
    messageId: string;
    preview: LimitOrderContractPreview;
  } | null>(null);
  const [simulatingLimitIds, setSimulatingLimitIds] = useState<string[]>([]);
  const [limitExecutionApproval, setLimitExecutionApproval] = useState<{
    sessionId: string;
    messageId: string;
    preview: LimitOrderContractPreview;
    simulation: LimitOrderSimulationPreview;
  } | null>(null);
  const [executingLimitIds, setExecutingLimitIds] = useState<string[]>([]);
  const [verifyingLimitExecutionIds, setVerifyingLimitExecutionIds] = useState<
    string[]
  >([]);
  const [verifyingLimitCancelIds, setVerifyingLimitCancelIds] = useState<
    string[]
  >([]);
  const [limitCancelApproval, setLimitCancelApproval] = useState<{
    sessionId: string;
    messageId: string;
    walletAddress: string;
    orderId: string;
  } | null>(null);
  const [limitCancelExecutionApproval, setLimitCancelExecutionApproval] =
    useState<{
      sessionId: string;
      messageId: string;
      walletAddress: string;
      orderId: string;
      simulation: LimitOrderCancelSimulation;
    } | null>(null);
  const [cancellingLimitIds, setCancellingLimitIds] = useState<string[]>([]);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const active = sessions.find((session) => session.id === activeId) ?? null;
  const filteredSessions = sessions.filter((session) =>
    sessionFilter === "all"
      ? true
      : sessionFilter === "pump"
        ? session.workspace === "pump"
        : session.mode === sessionFilter && session.workspace !== "pump",
  );
  const missionPreviews = sessions.flatMap((session) =>
    session.messages.flatMap((message) =>
      message.missionPreview
        ? [
            {
              sessionId: session.id,
              sessionTitle: session.title,
              preview: message.missionPreview,
            },
          ]
        : [],
    ),
  );
  useEffect(() => {
    if (runtime?.keystore !== "unlocked") {
      return;
    }
    let activeRequest = true;
    window.silfable
      .listWallets()
      .then((response) => {
        if (activeRequest) setWallets(response.wallets);
      })
      .catch(() => undefined);
    window.silfable
      .listSessions()
      .then((response) => {
        if (activeRequest) setSessions(response.sessions);
      })
      .catch(() => undefined);
    return () => {
      activeRequest = false;
    };
  }, [runtime?.keystore, runtime?.wallet, walletRefresh]);
  function persistSession(session: SessionItem): Promise<unknown> {
    return window.silfable.upsertSession({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      session,
    });
  }
  function chooseFilter(filter: SessionFilter): void {
    setSessionFilter(filter);
    if (active && filter !== "all") {
      const visible = filter === "pump"
        ? active.workspace === "pump"
        : active.mode === filter && active.workspace !== "pump";
      if (!visible) setActiveId(null);
    }
    setNav("sessions");
  }
  async function requestSession(prompt = ""): Promise<void> {
    setPendingPrompt(prompt);
    try {
      const latestRuntime = await window.silfable.getRuntimeStatus();
      setRuntime(latestRuntime);
      if (latestRuntime.keystore !== "unlocked") return;
      const response = await window.silfable.listWallets();
      setWallets(response.wallets);
      setModalOpen(true);
    } catch {
      // Keep the last trusted wallet list. A concurrent vault lock is handled
      // by the root runtime gate instead of flashing an empty workspace.
    }
  }
  async function createSession(input: {
    title: string;
    mode: SessionMode;
    permission: Permission;
    workspace: SessionWorkspace;
    pumpConfig?: PumpSessionConfig;
    walletAddress: string | null;
    prompt: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const session: SessionItem = {
      id,
      title: input.title,
      mode: input.mode,
      permission: input.permission,
      workspace: input.workspace,
      ...(input.pumpConfig ? { pumpConfig: input.pumpConfig } : {}),
      walletAddress: input.walletAddress,
      startedAt: now,
      usage: { input: 0, output: 0, total: 0, cost: null },
      messages: [],
    };
    setSessions((current) => [session, ...current]);
    setActiveId(id);
    setModalOpen(false);
    setNav("sessions");
    await persistSession(session);
    if (input.prompt.trim()) await sendMessage(session, input.prompt.trim());
  }
  async function sendMessage(target: SessionItem, text: string): Promise<void> {
    if (!text.trim() || thinkingIds.includes(target.id)) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      at: new Date().toISOString(),
    };
    const sessionWithUser = {
      ...target,
      messages: [...target.messages, userMessage],
    };
    setSessions((current) =>
      current.map((item) => {
        if (item.id !== target.id) return item;
        return sessionWithUser;
      }),
    );
    setThinkingIds((current) => [...new Set([...current, target.id])]);
    setDraft("");
    try {
      await persistSession(sessionWithUser);
      const response = await window.silfable.chatWithAi({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: target.id,
        prompt: text,
        mode: target.mode,
        permission: "restricted",
        walletAddress: target.walletAddress,
        acknowledgedExternalProcessing: true,
      });
      const assistant: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: response.text,
        at: new Date().toISOString(),
        toolsUsed: response.toolsUsed,
        ...(response.missionPreview
          ? { missionPreview: response.missionPreview }
          : {}),
        ...(response.pumpTradePreview
          ? { pumpTradePreview: response.pumpTradePreview }
          : {}),
        ...(response.pumpTokenIntelligence
          ? { pumpTokenIntelligence: response.pumpTokenIntelligence }
          : {}),
        ...(response.pumpDiscoverySnapshot
          ? { pumpDiscoverySnapshot: response.pumpDiscoverySnapshot }
          : {}),
        ...(response.limitOrderPreview
          ? { limitOrderPreview: response.limitOrderPreview }
          : {}),
      };
      setAnimatedMessageIds((current) => [...current, assistant.id]);
      setSessions((current) =>
        current.map((item) => {
          if (item.id !== target.id) return item;
          const next = {
            ...item,
            messages: [...item.messages, assistant],
            usage: {
              input: response.usage.inputTokens,
              output: response.usage.outputTokens,
              total: response.usage.totalTokens,
              cost: response.usage.costUsd,
            },
          };
          persistSession(next);
          return next;
        }),
      );
    } catch (error) {
      const assistant: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: inferenceFailureMessage(error),
        at: new Date().toISOString(),
      };
      setAnimatedMessageIds((current) => [...current, assistant.id]);
      setSessions((current) =>
        current.map((item) => {
          if (item.id !== target.id) return item;
          const next = { ...item, messages: [...item.messages, assistant] };
          persistSession(next);
          return next;
        }),
      );
    } finally {
      setThinkingIds((current) => current.filter((id) => id !== target.id));
    }
  }
  async function runSimulation(input: {
    sessionId: string;
    messageId: string;
    preview: MissionContractPreview;
  }): Promise<void> {
    setSimulationApproval(null);
    setSimulatingMissionIds((current) => [
      ...new Set([...current, input.preview.id]),
    ]);
    try {
      const response = await window.silfable.simulateMission({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        missionId: input.preview.id,
        acknowledgedSimulationOnly: true,
      });
      const currentSession = sessions.find(
        (session) => session.id === input.sessionId,
      );
      if (currentSession === undefined)
        throw new Error("Session is unavailable");
      const next = {
        ...currentSession,
        messages: currentSession.messages.map((message) =>
          message.id === input.messageId
            ? { ...message, missionSimulation: response.simulation }
            : message,
        ),
      };
      await persistSession(next);
      setSessions((current) =>
        current.map((session) =>
          session.id === input.sessionId ? next : session,
        ),
      );
    } finally {
      setSimulatingMissionIds((current) =>
        current.filter((id) => id !== input.preview.id),
      );
    }
  }
  async function runPumpSimulation(input: {
    sessionId: string;
    messageId: string;
    preview: PumpTradeContractPreview;
  }): Promise<void> {
    setSimulatingPumpIds((current) => [...new Set([...current, input.preview.id])]);
    try {
      const response = await window.silfable.simulatePumpTrade({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        acknowledgedSimulationOnly: true,
      });
      setSessions((current) => current.map((session) => session.id !== input.sessionId
        ? session
        : {
            ...session,
            messages: session.messages.map((message) => message.id === input.messageId
              ? { ...message, pumpSimulation: response.simulation }
              : message),
          }));
    } finally {
      setSimulatingPumpIds((current) => current.filter((id) => id !== input.preview.id));
    }
  }
  async function runPumpFinalRevalidation(input: {
    sessionId: string;
    messageId: string;
    preview: PumpTradeContractPreview;
  }): Promise<void> {
    setRevalidatingPumpIds((current) => [...new Set([...current, input.preview.id])]);
    try {
      const response = await window.silfable.finalRevalidatePumpTrade({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        acknowledgedNoExecution: true,
      });
      setSessions((current) => current.map((session) => session.id !== input.sessionId
        ? session
        : {
            ...session,
            messages: session.messages.map((message) => message.id === input.messageId
              ? { ...message, pumpSimulation: response.simulation }
              : message),
          }));
    } finally {
      setRevalidatingPumpIds((current) => current.filter((id) => id !== input.preview.id));
    }
  }

  async function runPumpExecution(
    input: NonNullable<typeof pumpExecutionApproval>,
    credentials: { masterPassword: string; confirmation: string },
  ): Promise<void> {
    setExecutingPumpIds((current) => [...new Set([...current, input.preview.id])]);
    try {
      const response = await window.silfable.executePumpTrade({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        masterPassword: credentials.masterPassword,
        confirmation: "EXECUTE PUMP MAINNET",
        acknowledgedIrreversibleExecution: true,
      });
      setSessions((current) => current.map((session) => session.id !== input.sessionId
        ? session
        : {
            ...session,
            messages: session.messages.map((message) => message.id === input.messageId
              ? { ...message, pumpExecution: response.execution }
              : message),
          }));
      setPumpExecutionApproval(null);
      setPortfolioRefresh((current) => current + 1);
    } finally {
      setExecutingPumpIds((current) => current.filter((id) => id !== input.preview.id));
    }
  }

  async function verifyPumpExecution(input: {
    sessionId: string;
    messageId: string;
    preview: PumpTradeContractPreview;
    execution: PumpExecutionRecord;
  }): Promise<void> {
    setVerifyingPumpExecutionIds((current) => [...new Set([...current, input.execution.id])]);
    try {
      const response = await window.silfable.verifyPumpExecution({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        executionId: input.execution.id,
      });
      setSessions((current) => current.map((session) => session.id !== input.sessionId
        ? session
        : {
            ...session,
            messages: session.messages.map((message) => message.id === input.messageId
              ? { ...message, pumpExecution: response.execution }
              : message),
          }));
      if (response.execution.status === "finalized") {
        setPortfolioRefresh((current) => current + 1);
      }
    } finally {
      setVerifyingPumpExecutionIds((current) => current.filter((id) => id !== input.execution.id));
    }
  }

  async function runLimitOrderSimulation(input: {
    sessionId: string;
    messageId: string;
    preview: LimitOrderContractPreview;
  }): Promise<void> {
    setLimitSimulationApproval(null);
    setSimulatingLimitIds((current) => [
      ...new Set([...current, input.preview.id]),
    ]);
    try {
      const response = await window.silfable.simulateLimitOrder({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        acknowledgedVaultRegistration: true,
        acknowledgedSimulationOnly: true,
      });
      const currentSession = sessions.find(
        (session) => session.id === input.sessionId,
      );
      if (!currentSession) throw new Error("Session is unavailable");
      const next = {
        ...currentSession,
        messages: currentSession.messages.map((message) =>
          message.id === input.messageId
            ? { ...message, limitOrderSimulation: response.simulation }
            : message,
        ),
      };
      await persistSession(next);
      setSessions((current) =>
        current.map((session) =>
          session.id === input.sessionId ? next : session,
        ),
      );
    } finally {
      setSimulatingLimitIds((current) =>
        current.filter((id) => id !== input.preview.id),
      );
    }
  }
  async function runLimitOrderExecution(
    input: {
      sessionId: string;
      messageId: string;
      preview: LimitOrderContractPreview;
      simulation: LimitOrderSimulationPreview;
    },
    masterPassword: string,
  ): Promise<void> {
    setExecutingLimitIds((current) => [
      ...new Set([...current, input.preview.id]),
    ]);
    try {
      const response = await window.silfable.executeLimitOrder({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        simulationId: input.simulation.id,
        masterPassword,
        confirmation: "CREATE LIMIT ORDER",
        acknowledgedCustodialVaultDeposit: true,
      });
      const currentSession = sessions.find(
        (session) => session.id === input.sessionId,
      );
      if (!currentSession) throw new Error("Session is unavailable");
      const next = {
        ...currentSession,
        messages: currentSession.messages.map((message) =>
          message.id === input.messageId
            ? { ...message, limitOrderExecution: response.receipt }
            : message,
        ),
      };
      await persistSession(next);
      setSessions((current) =>
        current.map((session) =>
          session.id === input.sessionId ? next : session,
        ),
      );
      setLimitExecutionApproval(null);
      setPortfolioRefresh((value) => value + 1);
    } finally {
      setExecutingLimitIds((current) =>
        current.filter((id) => id !== input.preview.id),
      );
    }
  }
  async function runLimitCancelSimulation(input: {
    sessionId: string;
    messageId: string;
    walletAddress: string;
    orderId: string;
  }): Promise<void> {
    setLimitCancelApproval(null);
    setCancellingLimitIds((current) => [
      ...new Set([...current, input.orderId]),
    ]);
    try {
      const response = await window.silfable.simulateLimitOrderCancel({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        walletAddress: input.walletAddress,
        orderId: input.orderId,
        acknowledgedWithdrawalSimulationOnly: true,
      });
      const currentSession = sessions.find(
        (session) => session.id === input.sessionId,
      );
      if (!currentSession) throw new Error("Session is unavailable");
      const next = {
        ...currentSession,
        messages: currentSession.messages.map((message) =>
          message.id === input.messageId
            ? { ...message, limitOrderCancelSimulation: response.simulation }
            : message,
        ),
      };
      await persistSession(next);
      setSessions((current) =>
        current.map((session) =>
          session.id === input.sessionId ? next : session,
        ),
      );
    } finally {
      setCancellingLimitIds((current) =>
        current.filter((id) => id !== input.orderId),
      );
    }
  }
  async function runLimitCancelExecution(
    input: {
      sessionId: string;
      messageId: string;
      walletAddress: string;
      orderId: string;
      simulation: LimitOrderCancelSimulation;
    },
    masterPassword: string,
  ): Promise<void> {
    setCancellingLimitIds((current) => [
      ...new Set([...current, input.orderId]),
    ]);
    try {
      const response = await window.silfable.executeLimitOrderCancel({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        walletAddress: input.walletAddress,
        orderId: input.orderId,
        simulationId: input.simulation.id,
        masterPassword,
        confirmation: "CANCEL LIMIT ORDER",
        acknowledgedVaultWithdrawal: true,
      });
      const currentSession = sessions.find(
        (session) => session.id === input.sessionId,
      );
      if (!currentSession) throw new Error("Session is unavailable");
      const next = {
        ...currentSession,
        messages: currentSession.messages.map((message) =>
          message.id === input.messageId
            ? { ...message, limitOrderCancelReceipt: response.receipt }
            : message,
        ),
      };
      await persistSession(next);
      setSessions((current) =>
        current.map((session) =>
          session.id === input.sessionId ? next : session,
        ),
      );
      setLimitCancelExecutionApproval(null);
      setPortfolioRefresh((value) => value + 1);
    } finally {
      setCancellingLimitIds((current) =>
        current.filter((id) => id !== input.orderId),
      );
    }
  }
  async function verifyLimitOrderExecution(input: {
    sessionId: string;
    messageId: string;
    preview: LimitOrderContractPreview;
    receipt: LimitOrderExecutionReceipt;
  }): Promise<void> {
    setVerifyingLimitExecutionIds((current) => [
      ...new Set([...current, input.receipt.id]),
    ]);
    try {
      const response = await window.silfable.verifyLimitOrderExecution({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        previewId: input.preview.id,
        receiptId: input.receipt.id,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id !== input.sessionId
            ? session
            : {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === input.messageId
                    ? { ...message, limitOrderExecution: response.receipt }
                    : message,
                ),
              },
        ),
      );
      if (response.receipt.status === "active") {
        setPortfolioRefresh((value) => value + 1);
      }
    } finally {
      setVerifyingLimitExecutionIds((current) =>
        current.filter((id) => id !== input.receipt.id),
      );
    }
  }
  async function verifyLimitOrderCancel(input: {
    sessionId: string;
    messageId: string;
    receipt: NonNullable<
      SessionRecord["messages"][number]["limitOrderCancelReceipt"]
    >;
  }): Promise<void> {
    setVerifyingLimitCancelIds((current) => [
      ...new Set([...current, input.receipt.id]),
    ]);
    try {
      const response = await window.silfable.verifyLimitOrderCancel({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        orderId: input.receipt.orderId,
        receiptId: input.receipt.id,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id !== input.sessionId
            ? session
            : {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === input.messageId
                    ? {
                        ...message,
                        limitOrderCancelReceipt: response.receipt,
                      }
                    : message,
                ),
              },
        ),
      );
      if (response.receipt.status === "cancelled") {
        setPortfolioRefresh((value) => value + 1);
      }
    } finally {
      setVerifyingLimitCancelIds((current) =>
        current.filter((id) => id !== input.receipt.id),
      );
    }
  }
  async function runExecution(
    input: {
      sessionId: string;
      messageId: string;
      preview: MissionContractPreview;
      simulation: MissionSimulationPreview;
    },
    credentials: { masterPassword: string; confirmation: string },
  ): Promise<void> {
    setExecutingMissionIds((current) => [
      ...new Set([...current, input.preview.id]),
    ]);
    try {
      const response = await window.silfable.executeMission({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        missionId: input.preview.id,
        simulationId: input.simulation.id,
        masterPassword: credentials.masterPassword,
        confirmation: "EXECUTE MAINNET",
        acknowledgedIrreversibleMainnetExecution: true,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id !== input.sessionId
            ? session
            : {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === input.messageId
                    ? { ...message, missionExecution: response.receipt }
                    : message,
                ),
              },
        ),
      );
      setExecutionApproval(null);
      setPortfolioRefresh((value) => value + 1);
    } finally {
      setExecutingMissionIds((current) =>
        current.filter((id) => id !== input.preview.id),
      );
    }
  }
  async function verifyExecution(input: {
    sessionId: string;
    messageId: string;
    preview: MissionContractPreview;
    receipt: MissionExecutionReceipt;
  }): Promise<void> {
    setVerifyingReceiptIds((current) => [
      ...new Set([...current, input.receipt.id]),
    ]);
    try {
      const response = await window.silfable.verifyMissionExecution({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        missionId: input.preview.id,
        receiptId: input.receipt.id,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id !== input.sessionId
            ? session
            : {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === input.messageId
                    ? { ...message, missionExecution: response.receipt }
                    : message,
                ),
              },
        ),
      );
      if (response.receipt.status === "confirmed")
        setPortfolioRefresh((value) => value + 1);
    } finally {
      setVerifyingReceiptIds((current) =>
        current.filter((id) => id !== input.receipt.id),
      );
    }
  }
  if (settingsOpen)
    return (
      <SetupFlow
        setup={setup}
        runtime={runtime}
        save={saveSetup}
        setRuntime={setRuntime}
        editing
        onExit={() => {
          saveSetup({ ...setup, step: 6 });
          setSettingsOpen(false);
          setNav("sessions");
          setWalletRefresh((value) => value + 1);
          setPortfolioRefresh((value) => value + 1);
        }}
      />
    );
  return (
    <main className="workspace">
      <aside className="leftRail">
        <div className="railBrand">
          <BrandMark />
          <span>Silfable</span>
        </div>
        <button className="newSession" onClick={() => void requestSession()}>
          ＋ New session
        </button>
        <div className="sessionFilters">
          <button
            className={sessionFilter === "all" ? "active" : ""}
            onClick={() => chooseFilter("all")}
          >
            All
          </button>
          <button
            className={sessionFilter === "agent" ? "active" : ""}
            onClick={() => chooseFilter("agent")}
          >
            Agent
          </button>
          <button
            className={sessionFilter === "mission" ? "active" : ""}
            onClick={() => chooseFilter("mission")}
          >
            Mission
          </button>
          <button
            className={sessionFilter === "pump" ? "active" : ""}
            onClick={() => chooseFilter("pump")}
          >
            Pump
          </button>
        </div>
        <div className="sessionList">
          <p>Sessions</p>
          {filteredSessions.length === 0 ? (
            <div className="emptySessions">
              No {sessionFilter === "all" ? "" : `${sessionFilter} `}sessions
              yet.
            </div>
          ) : (
            filteredSessions.map((session) => (
              <button
                className={session.id === activeId ? "active" : ""}
                onClick={() => {
                  setActiveId(session.id);
                  setNav("sessions");
                }}
                key={session.id}
              >
                <span>
                  {session.workspace === "pump"
                    ? "P"
                    : session.mode === "mission"
                      ? "◎"
                      : "◌"}
                </span>
                <div>
                  <strong>{session.title}</strong>
                  <small>
                    {session.workspace === "pump" ? "pump.fun" : session.mode} ·{" "}
                    {session.permission}
                  </small>
                </div>
              </button>
            ))
          )}
        </div>
        <nav className="bottomNav">
          <button
            className={nav === "memory" ? "active" : ""}
            onClick={() => setNav("memory")}
          >
            ⌘ Memory
          </button>
          <button
            className={nav === "missions" ? "active" : ""}
            onClick={() => setNav("missions")}
          >
            ◎ Missions
          </button>
          <button
            onClick={() => {
              saveSetup({ ...setup, step: 6 });
              setSettingsOpen(true);
            }}
          >
            ⚙ Settings
          </button>
          <div style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <label
              title="Observes configured strategies and creates reviewable proposals only. It cannot sign or broadcast."
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={backgroundLoopEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setBackgroundLoopEnabled(enabled);
                  window.silfable.toggleBackgroundLoop(enabled);
                }}
              />
              Monitor only
            </label>
          </div>
        </nav>
        <div className="runtimeBadge">
          <span /> Mainnet guarded · {runtime ? "ready" : "checking"}
        </div>
      </aside>
      <section className="centerStage">
        {nav === "memory" ? (
          <UtilityView
            eyebrow="Memory"
            title="Local memory is not indexed yet."
            copy="Durable memory indexing is not enabled in this build."
          />
        ) : nav === "missions" ? (
          <MissionsView
            items={missionPreviews}
            onOpen={(sessionId) => {
              setActiveId(sessionId);
              setNav("sessions");
            }}
          />
        ) : active ? (
          <Conversation
            session={active}
            draft={draft}
            setDraft={setDraft}
            onSend={() =>
              draft.trim() && void sendMessage(active, draft.trim())
            }
            thinking={thinkingIds.includes(active.id)}
            animatedMessageIds={animatedMessageIds}
            onAnimationComplete={(id) =>
              setAnimatedMessageIds((current) =>
                current.filter((value) => value !== id),
              )
            }
            simulatingMissionIds={simulatingMissionIds}
            simulatingPumpIds={simulatingPumpIds}
            revalidatingPumpIds={revalidatingPumpIds}
            executingPumpIds={executingPumpIds}
            verifyingPumpExecutionIds={verifyingPumpExecutionIds}
            executingMissionIds={executingMissionIds}
            verifyingReceiptIds={verifyingReceiptIds}
            simulatingLimitIds={simulatingLimitIds}
            executingLimitIds={executingLimitIds}
            cancellingLimitIds={cancellingLimitIds}
            verifyingLimitExecutionIds={verifyingLimitExecutionIds}
            verifyingLimitCancelIds={verifyingLimitCancelIds}
            onRequestLimitSimulation={(messageId, preview) =>
              setLimitSimulationApproval({
                sessionId: active.id,
                messageId,
                preview,
              })
            }
            onRequestLimitExecution={(messageId, preview, simulation) =>
              setLimitExecutionApproval({
                sessionId: active.id,
                messageId,
                preview,
                simulation,
              })
            }
            onRequestLimitCancel={(messageId, walletAddress, orderId) =>
              setLimitCancelApproval({
                sessionId: active.id,
                messageId,
                walletAddress,
                orderId,
              })
            }
            onRequestLimitCancelExecution={(
              messageId,
              walletAddress,
              orderId,
              simulation,
            ) =>
              setLimitCancelExecutionApproval({
                sessionId: active.id,
                messageId,
                walletAddress,
                orderId,
                simulation,
              })
            }
            onVerifyLimitExecution={(messageId, preview, receipt) =>
              void verifyLimitOrderExecution({
                sessionId: active.id,
                messageId,
                preview,
                receipt,
              })
            }
            onVerifyLimitCancel={(messageId, receipt) =>
              void verifyLimitOrderCancel({
                sessionId: active.id,
                messageId,
                receipt,
              })
            }
            onRequestSimulation={(messageId, preview) =>
              setSimulationApproval({
                sessionId: active.id,
                messageId,
                preview,
              })
            }
            onRequestPumpSimulation={(messageId, preview) =>
              void runPumpSimulation({
                sessionId: active.id,
                messageId,
                preview,
              })
            }
            onRequestPumpFinalRevalidation={(messageId, preview) =>
              void runPumpFinalRevalidation({
                sessionId: active.id,
                messageId,
                preview,
              })
            }
            onRequestPumpExecution={(messageId, preview, simulation, revalidation) =>
              setPumpExecutionApproval({
                sessionId: active.id,
                messageId,
                preview,
                simulation,
                revalidation,
              })
            }
            onVerifyPumpExecution={(messageId, preview, execution) =>
              void verifyPumpExecution({
                sessionId: active.id,
                messageId,
                preview,
                execution,
              })
            }
            onRequestExecution={(messageId, preview, simulation) =>
              setExecutionApproval({
                sessionId: active.id,
                messageId,
                preview,
                simulation,
              })
            }
            onVerifyExecution={(messageId, preview, receipt) =>
              void verifyExecution({
                sessionId: active.id,
                messageId,
                preview,
                receipt,
              })
            }
          />
        ) : (
          <HomeComposer
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => {
              if (draft.trim()) void requestSession(draft.trim());
            }}
          />
        )}
      </section>
      <RightRail
        session={active}
        runtime={runtime}
        model={setup.providerModel}
        wallets={wallets}
        refreshToken={portfolioRefresh}
        onAnalyzePump={active?.workspace === "pump"
          ? (mint) => {
              const allowed = active.pumpConfig?.scope === "exact-mint"
                ? active.pumpConfig.tokenMint === mint
                : active.pumpConfig?.scope === "watchlist" && active.pumpConfig.watchlistMints?.includes(mint);
              if (allowed) void sendMessage(active, `Analyze the exact Pump.fun mint ${mint} with a reference buy size of ${active.pumpConfig!.analysisBuyLamports ?? "1000000"} lamports. Use finalized on-chain Pump/PumpSwap evidence, include the reserve-only buy and sell-back path, and do not prepare or execute a transaction.`);
            }
          : undefined}
        onScanPump={active?.workspace === "pump" && active.pumpConfig?.scope === "discovery"
          ? () => void sendMessage(active, `Scan up to 10 recent finalized transactions touching the official Pump program and return at most 5 independently verified candidates using a reference buy size of ${active.pumpConfig!.analysisBuyLamports ?? "1000000"} lamports. Do not rank candidates that fail deterministic research eligibility, and do not prepare or execute a transaction.`)
          : undefined}
      />
      {modalOpen && (
        <SessionModal
          prompt={pendingPrompt}
          wallets={wallets}
          onCancel={() => setModalOpen(false)}
          onCreate={(value) => void createSession(value)}
        />
      )}
      {simulationApproval && (
        <SimulationApprovalModal
          preview={simulationApproval.preview}
          onCancel={() => setSimulationApproval(null)}
          onConfirm={() => void runSimulation(simulationApproval)}
        />
      )}
      {executionApproval && (
        <ExecutionApprovalModal
          preview={executionApproval.preview}
          simulation={executionApproval.simulation}
          onCancel={() => setExecutionApproval(null)}
          onConfirm={(credentials) =>
            runExecution(executionApproval, credentials)
          }
        />
      )}
      {pumpExecutionApproval && (
        <PumpExecutionApprovalModal
          preview={pumpExecutionApproval.preview}
          simulation={pumpExecutionApproval.simulation}
          revalidation={pumpExecutionApproval.revalidation}
          onCancel={() => setPumpExecutionApproval(null)}
          onConfirm={(credentials) =>
            runPumpExecution(pumpExecutionApproval, credentials)
          }
        />
      )}
      {limitSimulationApproval && (
        <LimitOrderSimulationApprovalModal
          preview={limitSimulationApproval.preview}
          onCancel={() => setLimitSimulationApproval(null)}
          onConfirm={() =>
            void runLimitOrderSimulation(limitSimulationApproval)
          }
        />
      )}
      {limitExecutionApproval && (
        <LimitOrderFinalModal
          kind="create"
          preview={limitExecutionApproval.preview}
          onCancel={() => setLimitExecutionApproval(null)}
          onConfirm={(password) =>
            runLimitOrderExecution(limitExecutionApproval, password)
          }
        />
      )}
      {limitCancelApproval && (
        <LimitOrderCancelSimulationModal
          orderId={limitCancelApproval.orderId}
          onCancel={() => setLimitCancelApproval(null)}
          onConfirm={() => void runLimitCancelSimulation(limitCancelApproval)}
        />
      )}
      {limitCancelExecutionApproval && (
        <LimitOrderFinalModal
          kind="cancel"
          orderId={limitCancelExecutionApproval.orderId}
          onCancel={() => setLimitCancelExecutionApproval(null)}
          onConfirm={(password) =>
            runLimitCancelExecution(limitCancelExecutionApproval, password)
          }
        />
      )}
    </main>
  );
}

function HomeComposer({
  draft,
  setDraft,
  onSubmit,
}: {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="homeState">
      <BrandMark large />
      <p className="tagline">Understand. Constrain. Verify.</p>
      <h1>What should Silfable help you do?</h1>
      <Composer
        value={draft}
        setValue={setDraft}
        onSubmit={onSubmit}
        placeholder="Plan a Mainnet task or ask about your portfolio…"
      />
      <div className="suggestions">
        <button
          onClick={() =>
            setDraft(
              "Explain exactly what you can and cannot do in this desktop application.",
            )
          }
        >
          AI capabilities
        </button>
        <button
          onClick={() =>
            setDraft(
              "Review my configured wallet balances and recent finalized activity.",
            )
          }
        >
          Wallet activity
        </button>
        <button
          onClick={() =>
            setDraft(
              "Draft a conservative SOL accumulation mission with explicit limits.",
            )
          }
        >
          Plan a mission
        </button>
        <button
          onClick={() =>
            setDraft("Explain the current Mainnet execution restrictions.")
          }
        >
          Runtime safety
        </button>
      </div>
    </div>
  );
}

function Conversation({
  session,
  draft,
  setDraft,
  onSend,
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
}: {
  session: SessionItem;
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
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
  return (
    <div className="conversation">
      <header>
        <div>
          <span className="liveDot" />{" "}
          {session.workspace === "pump"
            ? "Pump.fun · manual restricted"
            : session.mode === "mission"
              ? "Mission preparing"
              : "Agent active"}
        </div>
        <StatusPill tone="warning">Restricted</StatusPill>
      </header>
      <div className="messages">
        {session.messages.map((message) => (
          <article className={message.role} key={message.id}>
            {message.role === "assistant" && <span className="avatar">S</span>}
            <div>
              <small>
                {message.role === "user" ? "You" : "Silfable"} ·{" "}
                {new Date(message.at).toLocaleTimeString([], {
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
              {message.role === "assistant" && (
                <div className="evidenceTag">
                  {message.pumpExecution
                    ? `Pump Mainnet execution: ${message.pumpExecution.status}`
                    : message.missionExecution
                    ? `Mainnet execution: ${message.missionExecution.status}`
                    : "No execution attempted"}
                  {message.toolsUsed?.length
                    ? ` · evidence: ${message.toolsUsed.join(", ")}`
                    : " · external inference"}
                </div>
              )}
            </div>
          </article>
        ))}
        {thinking && (
          <article className="assistant typingArticle">
            <span className="avatar">S</span>
            <div>
              <small>Silfable · reasoning</small>
              <div
                className="typingIndicator"
                aria-label="Silfable is preparing a response"
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
        <Notice tone="warning" title="Restricted Mainnet session">
          Every mutating action requires a validated contract, passed
          simulation, password recheck, and explicit approval.
        </Notice>
        <Composer
          value={draft}
          setValue={setDraft}
          onSubmit={onSend}
          disabled={thinking}
          placeholder={thinking ? "Silfable is thinking..." : "Type a follow-up or refine the plan…"}
        />
      </div>
    </div>
  );
}

function LimitOrderPreviewCard({
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

function PumpTradePreviewCard({
  preview,
  simulation,
  simulating,
  onSimulate,
}: {
  preview: PumpTradeContractPreview;
  simulation: PumpSimulationArtifact | null;
  simulating: boolean;
  onSimulate: () => void;
}) {
  const passed = preview.checks.filter((item) => item.status === "pass").length;
  return (
    <section className={`missionPreview ${preview.status === "blocked" ? "blocked" : "ready"}`}>
      <header>
        <div><span>Pump.fun trade proposal</span><strong>{preview.goal}</strong></div>
        <StatusPill tone={preview.status === "blocked" ? "danger" : "success"}>{preview.status}</StatusPill>
      </header>
      <dl>
        <div><dt>Side / venue</dt><dd>{preview.side} · {preview.venue}</dd></div>
        <div><dt>Input</dt><dd>{preview.inputAmount} raw</dd></div>
        <div><dt>Minimum output</dt><dd>{preview.minimumOutputAmount} raw</dd></div>
        <div><dt>Policy</dt><dd>{passed}/{preview.checks.length} passed</dd></div>
        <div><dt>Inspector manifest</dt><dd>{preview.inspectionBoundary ? `${preview.inspectionBoundary.instructionName ?? "Unavailable"} · ${preview.inspectionBoundary.accountCount} roles` : "Legacy proposal"}</dd></div>
        <div><dt>Transaction inspected</dt><dd>{preview.inspectionBoundary?.transactionInspected ? "Yes" : "No · builder locked"}</dd></div>
      </dl>
      <div className="missionChecks">
        {preview.checks.map((item) => (
          <div className={item.status} key={item.code}>
            <span>{item.status === "pass" ? "OK" : "BLOCK"}</span><p>{item.message}</p>
          </div>
        ))}
      </div>
      <footer>
        <div><span>Execution locked</span><small>Simulation is unsigned. A fresh final revalidation, master password, and exact manual confirmation are required before one broadcast attempt.</small></div>
        <button
          disabled={preview.status !== "ready-for-review" || preview.venue !== "bonding-curve-active" || simulating}
          onClick={onSimulate}
        >
          {simulating ? "Simulatingâ€¦" : simulation ? "Simulate again" : "Simulate unsigned"}
        </button>
      </footer>
    </section>
  );
}

function PumpSimulationCard({
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

function EmergencyStopPanel() {
  const [status, setStatus] = useState<EmergencyStopStatus | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    window.silfable.getEmergencyStop()
      .then((response) => setStatus(response.status))
      .catch(() => setMessage("Emergency-stop status could not be loaded."));
  }, []);

  async function engage(): Promise<void> {
    if (!acknowledged || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.engageEmergencyStop({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        reason,
        acknowledgedImmediateHalt: true,
      });
      setStatus(response.status);
      setAcknowledged(false);
      setMessage("Emergency stop engaged. New execution and final revalidation requests are blocked.");
    } catch (error) {
      setMessage(friendlyError(error, "Emergency stop could not be engaged."));
    } finally {
      setBusy(false);
    }
  }

  async function release(): Promise<void> {
    if (!acknowledged || password.length === 0 || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.releaseEmergencyStop({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        masterPassword: password,
        acknowledgedResumeRisk: true,
      });
      setStatus(response.status);
      setPassword("");
      setAcknowledged(false);
      setMessage("Emergency stop released. Monitoring remains stopped until explicitly restarted.");
    } catch (error) {
      setMessage(friendlyError(error, "Emergency stop could not be released."));
    } finally {
      setBusy(false);
    }
  }

  const engaged = status?.engaged === true;
  return (
    <section className={`emergencyStopPanel ${engaged ? "engaged" : ""}`}>
      <div>
        <strong>Global emergency stop</strong>
        <StatusPill tone={engaged ? "danger" : "success"}>
          {status === null ? "Loading" : engaged ? "Engaged" : "Ready"}
        </StatusPill>
      </div>
      <p>
        Immediately clears prepared Pump transactions, stops local strategy monitoring,
        and blocks final revalidation and every supported execution handler. Pending
        signatures remain reconciliation-only and are never rebroadcast.
      </p>
      {engaged ? (
        <>
          <small>
            Engaged {status.engagedAt ? new Date(status.engagedAt).toLocaleString() : ""}
            {status.reason ? ` · ${status.reason}` : ""}
          </small>
          <Field label="Master password to release">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </>
      ) : (
        <Field label="Reason (optional)">
          <input
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Manual safety halt"
          />
        </Field>
      )}
      <label className="checkRow">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>
          {engaged
            ? "I understand that releasing this gate allows new manually approved execution requests."
            : "I understand that this immediately invalidates prepared transactions and stops monitoring."}
        </span>
      </label>
      <button
        type="button"
        className={engaged ? "secondaryButton" : "dangerButton"}
        disabled={!acknowledged || busy || (engaged && password.length === 0)}
        onClick={() => void (engaged ? release() : engage())}
      >
        {busy ? "Working…" : engaged ? "Release emergency stop" : "Engage emergency stop"}
      </button>
      {message && <p className="inlineMessage">{message}</p>}
    </section>
  );
}

function PumpExecutionCard({
  execution,
  preview,
  simulation,
  verifying,
  onVerify,
}: {
  execution: PumpExecutionRecord;
  preview: PumpTradeContractPreview;
  simulation: PumpSimulationArtifact | null;
  verifying: boolean;
  onVerify: () => void;
}) {
  const receipt = execution.receipt;
  const expectedOutput = simulation?.quoteEvidence?.expectedOutputAmount ?? preview.minimumOutputAmount;
  const actualSlippageBps = receipt
    ? calculateActualSlippageBps(expectedOutput, receipt.actualOutputAmount)
    : null;
  const walletOutflowLamports = receipt && BigInt(receipt.walletLamportDelta) < 0n
    ? (-BigInt(receipt.walletLamportDelta)).toString()
    : "0";
  const tone = execution.status === "finalized"
    ? "success"
    : execution.status === "failed"
      ? "danger"
      : "warning";
  return (
    <section className={`missionPreview pumpExecutionCard ${execution.status === "finalized" ? "ready" : "blocked"}`}>
      <header>
        <div>
          <span>Pump.fun Mainnet execution</span>
          <strong>{execution.status === "finalized"
            ? "Finalized and independently reconciled"
            : execution.status === "failed"
              ? "Execution failed"
              : "Broadcast verification pending"}</strong>
        </div>
        <StatusPill tone={tone}>{execution.status}</StatusPill>
      </header>
      <dl>
        <div><dt>Side</dt><dd>{execution.side.toUpperCase()}</dd></div>
        <div><dt>Signature</dt><dd>{shorten(execution.signature)}</dd></div>
        <div><dt>Transaction digest</dt><dd>{execution.transactionDigest.slice(0, 16)}...</dd></div>
        <div><dt>Last valid block height</dt><dd>{execution.lastValidBlockHeight.toLocaleString()}</dd></div>
        {receipt && (
          <>
            <div><dt>Actual input</dt><dd>{receipt.actualInputAmount} raw</dd></div>
            <div><dt>Expected output</dt><dd>{expectedOutput} raw</dd></div>
            <div><dt>Actual output</dt><dd>{receipt.actualOutputAmount} raw</dd></div>
            <div><dt>Actual slippage</dt><dd>{actualSlippageBps === null ? "Unavailable" : `${actualSlippageBps} bps`}</dd></div>
            <div><dt>Network fee</dt><dd>{receipt.networkFeeLamports.toLocaleString()} lamports</dd></div>
            <div><dt>Account funding</dt><dd>{receipt.accountCreationFundingLamports.toLocaleString()} lamports</dd></div>
            <div><dt>Total wallet SOL outflow</dt><dd>{walletOutflowLamports} lamports</dd></div>
            <div><dt>Finalized slot</dt><dd>{receipt.slot.toLocaleString()}</dd></div>
          </>
        )}
      </dl>
      {execution.error && <p className="executionError">{execution.error}</p>}
      <footer>
        <div>
          <span>{execution.status === "finalized" ? "Finalized receipt persisted" : "No automatic rebroadcast"}</span>
          <small>
            {execution.status === "finalized"
              ? "Balance and position panels refresh from finalized Mainnet data."
              : "Silfable only checks the locally derived signature."}
          </small>
        </div>
        <div className="receiptActions">
          <button onClick={() => void window.silfable.copyTransactionSignature({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            signature: execution.signature,
          })}>Copy signature</button>
          <button onClick={() => void window.silfable.openTransactionInExplorer({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            signature: execution.signature,
          })}>Open explorer</button>
          {execution.status !== "finalized" && execution.status !== "failed" && (
            <button disabled={verifying} onClick={onVerify}>
              {verifying ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

function calculateActualSlippageBps(expectedOutput: string, actualOutput: string): number | null {
  const expected = BigInt(expectedOutput);
  const actual = BigInt(actualOutput);
  if (expected <= 0n) return null;
  if (actual >= expected) return 0;
  return Number(((expected - actual) * 10_000n) / expected);
}

function MissionPreviewCard({
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

function SimulationResult({
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

function ExecutionResult({
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

function MissionsView({
  items,
  onOpen,
}: {
  items: Array<{
    sessionId: string;
    sessionTitle: string;
    preview: MissionContractPreview;
  }>;
  onOpen: (sessionId: string) => void;
}) {
  if (items.length === 0)
    return (
      <UtilityView
        eyebrow="Missions"
        title="No mission contracts yet."
        copy="Create a Mission session and provide exact token mints, raw amount, slippage limit, deadline, and stop conditions."
      />
    );
  return (
    <div className="missionsView">
      <div>
        <p className="kicker">Missions</p>
        <h1>Contract previews</h1>
        <p>
          Open an eligible session to simulate and explicitly approve a
          restricted Mainnet swap.
        </p>
      </div>
      <div className="missionGrid">
        {items.map((item) => (
          <button key={item.preview.id} onClick={() => onOpen(item.sessionId)}>
            <span>{item.preview.status}</span>
            <strong>{item.preview.goal}</strong>
            <small>
              {item.sessionTitle} ·{" "}
              {new Date(item.preview.createdAt).toLocaleString()}
            </small>
            <em>Open session</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function friendlyError(error: unknown, fallback: string): string {
  const detail = error instanceof Error ? error.message.trim() : "";
  return detail.length > 0 ? detail.slice(0, 240) : fallback;
}

function inferenceFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  const prefix = "The inference request failed safely. No Mainnet action was attempted.";
  if (/status 401|status 403/i.test(detail))
    return `${prefix} OpenRouter rejected the saved API key. Reconfigure it in Settings.`;
  if (/status 402/i.test(detail))
    return `${prefix} The OpenRouter account has insufficient credit or requires payment.`;
  if (/status 429/i.test(detail))
    return `${prefix} OpenRouter rate-limited the request. Wait briefly or choose another compatible model.`;
  if (/timeout|timed out|aborted/i.test(detail))
    return `${prefix} OpenRouter did not respond before the timeout. Check the connection and try again.`;
  if (/no assistant message/i.test(detail))
    return `${prefix} The selected model returned no usable assistant response. Choose another compatible tool-capable model.`;
  if (/status 404|model/i.test(detail))
    return `${prefix} The saved OpenRouter model may no longer be available. Verify the key and select a current compatible model in Settings.`;
  return detail
    ? `${prefix} ${detail.slice(0, 180)}`
    : `${prefix} Verify the OpenRouter configuration in Settings and try again.`;
}

function AnimatedMarkdownMessage({
  message,
  onComplete,
}: {
  message: ChatMessage;
  onComplete: () => void;
}) {
  const [length, setLength] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;

    if (!message.text || message.text.length <= 10) {
      setLength(message.text?.length ?? 0);
      completedRef.current = true;
      onComplete();
      return;
    }

    setLength(0);
    const textLen = message.text.length;
    const increment = Math.max(4, Math.ceil(textLen / 60));

    const timer = window.setInterval(() => {
      setLength((current) => {
        const next = Math.min(textLen, current + increment);
        if (next >= textLen) {
          window.clearInterval(timer);
          if (!completedRef.current) {
            completedRef.current = true;
            queueMicrotask(() => {
              onComplete();
            });
          }
          return textLen;
        }
        return next;
      });
    }, 16);

    return () => {
      window.clearInterval(timer);
    };
  }, [message.id]);

  const isFinished = length >= message.text.length || completedRef.current;

  return (
    <MarkdownMessage
      text={isFinished ? message.text : message.text.slice(0, length)}
      cursor={!isFinished}
    />
  );
}

function MarkdownMessage({
  text,
  cursor = false,
}: {
  text: string;
  cursor?: boolean;
}) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/u.exec(line);
    if (heading) {
      const content = renderInlineMarkdown(heading[2] ?? "");
      blocks.push(
        heading[1]?.length === 1 ? (
          <h2 key={index}>{content}</h2>
        ) : (
          <h3 key={index}>{content}</h3>
        ),
      );
      index += 1;
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/u.exec(line);
    const unordered = /^[-*]\s+(.+)$/u.exec(line);
    if (ordered || unordered) {
      const items: React.ReactNode[] = [];
      const orderedList = Boolean(ordered);
      while (index < lines.length) {
        const match = orderedList
          ? /^\d+\.\s+(.+)$/u.exec(lines[index] ?? "")
          : /^[-*]\s+(.+)$/u.exec(lines[index] ?? "");
        if (!match) break;
        items.push(<li key={index}>{renderInlineMarkdown(match[1] ?? "")}</li>);
        index += 1;
      }
      blocks.push(
        orderedList ? (
          <ol key={`list-${index}`}>{items}</ol>
        ) : (
          <ul key={`list-${index}`}>{items}</ul>
        ),
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{1,4})\s+|^\d+\.\s+|^[-*]\s+/u.test(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`}>{renderInlineMarkdown(paragraph.join(" "))}</p>,
    );
  }
  return (
    <div className={`markdownMessage ${cursor ? "streaming" : ""}`}>
      {blocks}
    </div>
  );
}

function renderInlineMarkdown(value: string): React.ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/gu);
  return parts
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") && part.endsWith("`") ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
}

function SimulationApprovalModal({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: MissionContractPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="simulationApproval"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-approval-title"
      >
        <p className="kicker">Transaction preview</p>
        <h2 id="simulation-approval-title">Run a Mainnet simulation?</h2>
        <p>
          Silfable will refresh policy evidence, request an unsigned Jupiter
          transaction for this wallet, inspect its signer and program scope, and
          call Solana simulation.
        </p>
        <dl>
          <div>
            <dt>Wallet</dt>
            <dd>{shorten(preview.walletAddress)}</dd>
          </div>
          <div>
            <dt>Raw input</dt>
            <dd>{preview.inputAmount}</dd>
          </div>
          <div>
            <dt>Slippage ceiling</dt>
            <dd>{preview.maxSlippageBps} bps</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{new Date(preview.deadlineAt).toLocaleString()}</dd>
          </div>
        </dl>
        <Notice tone="warning" title="Simulation only">
          No private key is loaded, no signature is created, and no transaction
          is broadcast. The unsigned transaction remains in the main process.
        </Notice>
        <footer>
          <button onClick={onCancel}>Cancel</button>
          <button className="primaryButton" onClick={onConfirm}>
            Run simulation
          </button>
        </footer>
      </section>
    </div>
  );
}

function LimitOrderSimulationApprovalModal({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: LimitOrderContractPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="simulationApproval"
        role="dialog"
        aria-modal="true"
        aria-labelledby="limit-simulation-title"
      >
        <p className="kicker">Jupiter Trigger V2</p>
        <h2 id="limit-simulation-title">
          Register vault and simulate deposit?
        </h2>
        <p>
          Silfable will sign Jupiter's authentication message locally, retrieve
          or register the selected wallet's custodial Trigger vault, inspect the
          unsigned deposit transaction, and simulate it on Solana Mainnet.
        </p>
        <dl>
          <div>
            <dt>Wallet</dt>
            <dd>{shorten(preview.walletAddress)}</dd>
          </div>
          <div>
            <dt>Deposit</dt>
            <dd>{preview.inputAmount} raw</dd>
          </div>
          <div>
            <dt>Trigger</dt>
            <dd>
              {preview.triggerCondition} ${preview.triggerPriceUsd}
            </dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>{new Date(preview.expiresAt).toLocaleString()}</dd>
          </div>
        </dl>
        <Notice tone="warning" title="No funds move in this step">
          Vault registration creates external Jupiter account state. The deposit
          remains unsigned and is never broadcast during simulation.
        </Notice>
        <footer>
          <button onClick={onCancel}>Cancel</button>
          <button className="primaryButton" onClick={onConfirm}>
            Register &amp; simulate
          </button>
        </footer>
      </section>
    </div>
  );
}

function LimitOrderCancelSimulationModal({
  orderId,
  onCancel,
  onConfirm,
}: {
  orderId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modalBackdrop" role="presentation">
      <section className="simulationApproval" role="dialog" aria-modal="true">
        <p className="kicker">Cancel limit order</p>
        <h2>Simulate vault withdrawal?</h2>
        <p>
          The current order state will be refreshed, then the unsigned
          withdrawal will be inspected and simulated. No signature or broadcast
          occurs yet.
        </p>
        <dl>
          <div>
            <dt>Order</dt>
            <dd>{orderId}</dd>
          </div>
          <div>
            <dt>Approval expiry</dt>
            <dd>90 seconds</dd>
          </div>
        </dl>
        <Notice tone="warning" title="Simulation only">
          Funds remain in the Trigger vault until you separately authorize
          withdrawal.
        </Notice>
        <footer>
          <button onClick={onCancel}>Cancel</button>
          <button className="primaryButton" onClick={onConfirm}>
            Simulate withdrawal
          </button>
        </footer>
      </section>
    </div>
  );
}

function LimitOrderFinalModal({
  kind,
  preview,
  orderId,
  onCancel,
  onConfirm,
}: {
  kind: "create" | "cancel";
  preview?: LimitOrderContractPreview;
  orderId?: string;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const required =
    kind === "create" ? "CREATE LIMIT ORDER" : "CANCEL LIMIT ORDER";
  const ready = password.length > 0 && phrase === required && acknowledged;
  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Mainnet request failed safely.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="simulationApproval executionApproval"
        role="dialog"
        aria-modal="true"
      >
        <p className="kicker">Final Mainnet authorization</p>
        <h2>
          {kind === "create"
            ? "Deposit real funds into the Trigger vault"
            : "Withdraw remaining funds and cancel"}
        </h2>
        <p>
          {kind === "create"
            ? "The exact deposit transaction that passed simulation will be signed locally and submitted with the limit-order parameters."
            : "The exact withdrawal transaction that passed simulation will be signed locally and submitted."}
        </p>
        <dl>
          {preview && (
            <>
              <div>
                <dt>Wallet</dt>
                <dd>{shorten(preview.walletAddress)}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{preview.inputAmount} raw</dd>
              </div>
              <div>
                <dt>Trigger</dt>
                <dd>
                  {preview.triggerCondition} ${preview.triggerPriceUsd}
                </dd>
              </div>
            </>
          )}
          {orderId && (
            <div>
              <dt>Order</dt>
              <dd>{orderId}</dd>
            </div>
          )}
        </dl>
        <Notice tone="danger" title="Real Mainnet funds">
          If the result is unknown, inspect the receipt and active-order state
          before retrying.
        </Notice>
        <Field label="Master password">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label={`Type ${required}`}>
          <input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
          />
        </Field>
        <label className="ackRow">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I understand this signs and broadcasts a real Mainnet transaction.
          </span>
        </label>
        {error && (
          <Notice tone="danger" title="Request blocked">
            {error}
          </Notice>
        )}
        <footer>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primaryButton"
            disabled={!ready || busy}
            onClick={() => void submit()}
          >
            {busy
              ? "Submitting…"
              : kind === "create"
                ? "Create order"
                : "Cancel & withdraw"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ExecutionApprovalModal({
  preview,
  simulation,
  onCancel,
  onConfirm,
}: {
  preview: MissionContractPreview;
  simulation: MissionSimulationPreview;
  onCancel: () => void;
  onConfirm: (credentials: {
    masterPassword: string;
    confirmation: string;
  }) => Promise<void>;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready =
    masterPassword.length > 0 &&
    confirmation === "EXECUTE MAINNET" &&
    acknowledged;
  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ masterPassword, confirmation });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Mainnet execution was not started.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="simulationApproval executionApproval"
        role="dialog"
        aria-modal="true"
        aria-labelledby="execution-approval-title"
      >
        <p className="kicker">Final Mainnet authorization</p>
        <h2 id="execution-approval-title">This will use real funds</h2>
        <p>
          The exact transaction that passed simulation will be signed locally
          and submitted through Jupiter. This action cannot be undone after
          broadcast.
        </p>
        <dl>
          <div>
            <dt>Wallet</dt>
            <dd>{preview.walletAddress}</dd>
          </div>
          <div>
            <dt>Raw input</dt>
            <dd>{preview.inputAmount}</dd>
          </div>
          <div>
            <dt>Input mint</dt>
            <dd>{preview.inputMint}</dd>
          </div>
          <div>
            <dt>Output mint</dt>
            <dd>{preview.outputMint}</dd>
          </div>
          <div>
            <dt>Expected output</dt>
            <dd>{simulation.expectedOutAmount ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Max slippage</dt>
            <dd>{preview.maxSlippageBps} bps</dd>
          </div>
          <div>
            <dt>Estimated fee</dt>
            <dd>
              {simulation.feeLamports === null
                ? "Unavailable"
                : `${simulation.feeLamports} lamports`}
            </dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{new Date(preview.deadlineAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Approval expiry</dt>
            <dd>90 seconds after simulation</dd>
          </div>
        </dl>
        <Notice tone="danger" title="Irreversible Mainnet transaction">
          Confirm the wallet, amount, token mints, slippage, and deadline. If
          submission status becomes unknown, verify wallet activity before
          trying again.
        </Notice>
        <Field label="Master password">
          <input
            type="password"
            autoComplete="current-password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
          />
        </Field>
        <Field label='Type "EXECUTE MAINNET"'>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <label className="riskCheck">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I authorize this exact simulated transaction to use real Mainnet
            funds.
          </span>
        </label>
        {error && <p className="executionError">{error}</p>}
        <footer>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="dangerButton"
            disabled={!ready || busy}
            onClick={() => void submit()}
          >
            {busy ? "Signing and submitting…" : "Execute real transaction"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function PumpExecutionApprovalModal({
  preview,
  simulation,
  revalidation,
  onCancel,
  onConfirm,
}: {
  preview: PumpTradeContractPreview;
  simulation: PumpSimulationArtifact;
  revalidation: PumpFinalRevalidation;
  onCancel: () => void;
  onConfirm: (credentials: {
    masterPassword: string;
    confirmation: string;
  }) => Promise<void>;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready =
    masterPassword.length > 0 &&
    confirmation === "EXECUTE PUMP MAINNET" &&
    acknowledged;

  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ masterPassword, confirmation });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Pump trade execution was not started."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="simulationApproval executionApproval"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pump-execution-approval-title"
      >
        <p className="kicker">Pump.fun Mainnet boundary</p>
        <h2 id="pump-execution-approval-title">Approve exact Pump trade</h2>
        <p>
          Review the exact wallet, mint, amount, fee evidence, and transaction
          digest. This approval is valid only for the freshly revalidated
          transaction shown below.
        </p>
        <dl>
          <div>
            <dt>Wallet</dt>
            <dd>{preview.walletAddress}</dd>
          </div>
          <div>
            <dt>Side</dt>
            <dd>{preview.side.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Token mint</dt>
            <dd>{preview.tokenMint}</dd>
          </div>
          <div>
            <dt>Raw input</dt>
            <dd>{preview.inputAmount}</dd>
          </div>
          <div>
            <dt>Minimum output floor</dt>
            <dd>{preview.minimumOutputAmount}</dd>
          </div>
          <div>
            <dt>Max slippage</dt>
            <dd>{preview.maxSlippageBps} bps</dd>
          </div>
          <div>
            <dt>Estimated network fee</dt>
            <dd>
              {simulation.networkFeeLamports === null
                ? "Unavailable"
                : `${simulation.networkFeeLamports} lamports`}
            </dd>
          </div>
          <div>
            <dt>Transaction digest</dt>
            <dd><code>{revalidation.finalTransactionDigest.slice(0, 16)}...</code></dd>
          </div>
        </dl>
        <Notice tone="danger" title="Irreversible Mainnet transaction">
          This signs locally and submits a real Mainnet transaction. Silfable
          persists the locally derived signature before the network call and
          never rebroadcasts an unknown result automatically.
        </Notice>
        <Field label="Master password">
          <input
            type="password"
            autoComplete="current-password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
          />
        </Field>
        <Field label='Type "EXECUTE PUMP MAINNET"'>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <label className="riskCheck">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I authorize this exact restricted Pump.fun transaction and
            understand that it uses real Mainnet funds.
          </span>
        </label>
        {error && <p className="executionError">{error}</p>}
        <footer>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="dangerButton"
            disabled={!ready || busy}
            onClick={() => void submit()}
          >
            {busy ? "Signing and submitting…" : "Execute Pump trade"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function SessionModal({
  prompt,
  wallets,
  onCancel,
  onCreate,
}: {
  prompt: string;
  wallets: WalletSummary[];
  onCancel: () => void;
  onCreate: (value: {
    title: string;
    mode: SessionMode;
    permission: Permission;
    workspace: SessionWorkspace;
    pumpConfig?: PumpSessionConfig;
    walletAddress: string | null;
    prompt: string;
  }) => void;
}) {
  const [title, setTitle] = useState(
    prompt.slice(0, 64) || "New Mainnet session",
  );
  const [mode, setMode] = useState<SessionMode>("agent");
  const [permission, setPermission] = useState<Permission>("restricted");
  const [workspace, setWorkspace] = useState<SessionWorkspace>("general");
  const [pumpObjective, setPumpObjective] = useState<PumpSessionConfig["objective"]>("monitor");
  const [pumpScope, setPumpScope] = useState<PumpSessionConfig["scope"]>("exact-mint");
  const [pumpMint, setPumpMint] = useState("");
  const [pumpWatchlistText, setPumpWatchlistText] = useState("");
  const [pumpAnalysisBuyLamports, setPumpAnalysisBuyLamports] = useState("1000000");
  const [walletAddress, setWalletAddress] = useState<string>(
    wallets.find((wallet) => wallet.primary)?.address ?? "",
  );
  useEffect(() => {
    if (!walletAddress)
      setWalletAddress(wallets.find((wallet) => wallet.primary)?.address ?? "");
  }, [wallets, walletAddress]);
  const pumpMintValid = SOLANA_ADDRESS_PATTERN.test(pumpMint.trim());
  const pumpWatchlistMints = [...new Set(pumpWatchlistText
    .split(/[\s,;]+/u)
    .map((mint) => mint.trim())
    .filter(Boolean))];
  const pumpWatchlistValid = pumpWatchlistMints.length >= 1
    && pumpWatchlistMints.length <= 10
    && pumpWatchlistMints.every((mint) => SOLANA_ADDRESS_PATTERN.test(mint));
  const pumpAnalysisAmountValid = /^[1-9]\d*$/u.test(pumpAnalysisBuyLamports)
    && BigInt(pumpAnalysisBuyLamports) >= 10_000n
    && BigInt(pumpAnalysisBuyLamports) <= 10_000_000_000n;
  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="sessionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-session-title"
      >
        <header className="sessionModalHeader">
          <div>
            <p className="kicker">New session</p>
            <h2 id="new-session-title">Your goal. Your rules.</h2>
            <p>
              Define how the AI agent may reason, plan, and use your Mainnet
              context.
            </p>
          </div>
          <button
            className="modalClose"
            aria-label="Close new session"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sessionModalBody">
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>01</span>
              <strong>Workspace</strong>
              <small>Choose the market context for this session.</small>
            </div>
            <div className="choiceGrid">
              <button
                className={workspace === "general" ? "active" : ""}
                onClick={() => {
                  setWorkspace("general");
                  setMode("agent");
                }}
              >
                <span className="choiceNumber">01</span>
                <strong>General agent</strong>
                <small>Wallet analysis, research, and ordinary restricted Mainnet planning.</small>
              </button>
              <button
                className={workspace === "pump" ? "active pumpChoice" : "pumpChoice"}
                onClick={() => {
                  setWorkspace("pump");
                  setMode("mission");
                }}
              >
                <span className="choiceNumber">02</span>
                <strong>Pump.fun agent</strong>
                <small>Exact-mint monitoring, restricted Pump analysis, and manually approved Pump/PumpSwap execution.</small>
              </button>
            </div>
          </section>
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>02</span>
              <strong>Session name</strong>
              <small>Used in your session history.</small>
            </div>
            <div>
              <input
                aria-label="Session name"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Give this session a short name"
              />
              <div className="fieldMeta">
                <span>
                  {prompt
                    ? "The submitted prompt will start this session."
                    : "You can start chatting after creation."}
                </span>
                <span>{title.length} / 80</span>
              </div>
            </div>
          </section>
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>03</span>
              <strong>Mode</strong>
              <small>Choose the agent lifecycle.</small>
            </div>
            <div className="choiceGrid">
              <button
                className={workspace === "pump" ? "unavailableChoice" : mode === "agent" ? "active" : ""}
                disabled={workspace === "pump"}
                onClick={() => setMode("agent")}
              >
                <span className="choiceNumber">01</span>
                <strong>Agent</strong>
                <small>
                  Interactive conversation for analysis, planning, and one task
                  at a time.
                </small>
              </button>
              <button
                className={mode === "mission" ? "active" : ""}
                onClick={() => setMode("mission")}
              >
                <span className="choiceNumber">02</span>
                <strong>Mission</strong>
                <small>
                  {workspace === "pump"
                    ? "Required for a durable Pump.fun token scope and explicit safety boundary."
                    : "Goal-driven workflow with explicit limits, checkpoints, and stop conditions."}
                </small>
              </button>
            </div>
          </section>
          {workspace === "pump" && (
            <section className="sessionConfigSection pumpConfigSection">
              <div className="sectionLegend">
                <span>04</span>
                <strong>Pump.fun scope</strong>
                <small>Choose one exact mint or a read-only list of up to ten mints.</small>
              </div>
              <div className="pumpSessionFields">
                <div className="compactChoiceRow" aria-label="Pump.fun discovery scope">
                  <button className={pumpScope === "exact-mint" ? "active" : ""} type="button" onClick={() => setPumpScope("exact-mint")}>Specific token</button>
                  <button className={pumpScope === "watchlist" ? "active" : ""} type="button" onClick={() => { setPumpScope("watchlist"); setPumpObjective("monitor"); }}>Watchlist</button>
                  <button className={pumpScope === "discovery" ? "active" : ""} type="button" onClick={() => { setPumpScope("discovery"); setPumpObjective("monitor"); }}>Market scanner</button>
                </div>
                {pumpScope === "exact-mint" ? <label>
                  <span>Exact token mint</span>
                  <input
                    aria-label="Pump.fun token mint"
                    value={pumpMint}
                    maxLength={44}
                    onChange={(event) => setPumpMint(event.target.value.trim())}
                    placeholder="Enter the exact Solana mint address"
                  />
                  <small className={pumpMint.length > 0 && !pumpMintValid ? "fieldError" : ""}>
                    {pumpMint.length === 0
                      ? "Required. Symbols and token names are never used as execution identity."
                      : pumpMintValid
                        ? "Valid address format. On-chain Pump/PumpSwap ownership is verified during analysis."
                        : "Enter a valid 32–44 character Solana address."}
                  </small>
                </label> : pumpScope === "watchlist" ? <label>
                  <span>Watchlist exact mints · maximum 10</span>
                  <textarea
                    aria-label="Pump.fun watchlist mints"
                    value={pumpWatchlistText}
                    onChange={(event) => setPumpWatchlistText(event.target.value)}
                    placeholder="One exact Solana mint per line"
                    rows={5}
                  />
                  <small className={pumpWatchlistText.length > 0 && !pumpWatchlistValid ? "fieldError" : ""}>
                    {pumpWatchlistText.length === 0
                      ? "Read-only only. Adding a mint never authorizes a buy."
                      : pumpWatchlistValid
                        ? `${pumpWatchlistMints.length}/10 unique valid mint addresses.`
                        : "Enter 1–10 unique valid Solana mint addresses."}
                  </small>
                </label> : <div className="pumpDiscoveryNotice">
                  <strong>Manual finalized scan</strong>
                  <small>Scans up to 10 recent official Pump program signatures and verifies at most 5 exact candidates. This is incomplete read-only evidence, not a real-time launch feed.</small>
                </div>}
                <label>
                  <span>Reference buy size · lamports</span>
                  <input
                    aria-label="Pump.fun reference buy size in lamports"
                    inputMode="numeric"
                    value={pumpAnalysisBuyLamports}
                    onChange={(event) => setPumpAnalysisBuyLamports(event.target.value.replace(/\D/gu, ""))}
                    placeholder="1000000"
                  />
                  <small className={!pumpAnalysisAmountValid ? "fieldError" : ""}>
                    {pumpAnalysisAmountValid
                      ? `${(Number(pumpAnalysisBuyLamports) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL · analysis only`
                      : "Enter 10,000–10,000,000,000 lamports (0.00001–10 SOL)."}
                  </small>
                </label>
                <div className="compactChoiceRow" aria-label="Pump.fun objective">
                  <button
                    className={pumpObjective === "monitor" ? "active" : ""}
                    type="button"
                    onClick={() => setPumpObjective("monitor")}
                  >
                    Monitor only
                  </button>
                  <button
                    className={pumpObjective === "trade-proposal" ? "active" : ""}
                    type="button"
                    disabled={pumpScope !== "exact-mint"}
                    onClick={() => setPumpObjective("trade-proposal")}
                  >
                    Trade proposal
                  </button>
                </div>
                <div className="pumpBoundaryNote">
                  <strong>Proposal only</strong>
                  <span>Manual restricted signing for a verified Pump active curve or canonical PumpSwap pool is available after final approval; unattended execution remains unavailable.</span>
                </div>
              </div>
            </section>
          )}
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>{workspace === "pump" ? "05" : "04"}</span>
              <strong>Permission</strong>
              <small>Controls mutating operations.</small>
            </div>
            <div className="choiceGrid">
              <button
                className={permission === "restricted" ? "active" : ""}
                onClick={() => setPermission("restricted")}
              >
                <span className="choiceNumber">01</span>
                <strong>Restricted</strong>
                <small>
                  Every future transaction requires deterministic checks and
                  your approval.
                </small>
              </button>
              <button
                className={permission === "full" ? "active" : ""}
                onClick={() => setPermission("full")}
              >
                <span className="choiceNumber">02 · Guarded MVP</span>
                <strong>Full access</strong>
                <small>
                  Prepare broader multi-step proposals. Signing, policy checks,
                  and final transaction approval remain mandatory.
                </small>
              </button>
            </div>
          </section>
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>{workspace === "pump" ? "06" : "05"}</span>
              <strong>Wallet scope</strong>
              <small>Optional and locked for this session.</small>
            </div>
            <div className="walletSelectBlock">
              <label htmlFor="session-wallet">Solana Mainnet wallet</label>
              <select
                id="session-wallet"
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
              >
                <option value="">No wallet · chat only</option>
                {wallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.primary ? "Primary · " : ""}
                    {shorten(wallet.address)}
                  </option>
                ))}
              </select>
              <small>
                {wallets.length === 0
                  ? "No wallet is configured. Add one in Settings → Wallets."
                  : `${wallets.length} encrypted wallet${wallets.length === 1 ? "" : "s"} available on this device.`}
              </small>
            </div>
          </section>
        </div>
        <footer>
          <div className="sessionLockNote">
            <span>●</span>
            <div>
              <strong>Mainnet · Restricted</strong>
              <small>
                {workspace === "pump"
                  ? "Pump.fun analysis and proposals never authorize a transaction."
                  : "No transaction is authorized by creating a session."}
              </small>
            </div>
          </div>
          <div className="modalActions">
            <button onClick={onCancel}>Cancel</button>
            <button
              className="primaryButton"
              disabled={!title.trim() || (workspace === "pump" && (!pumpAnalysisAmountValid || (pumpScope === "exact-mint" ? !pumpMintValid : pumpScope === "watchlist" ? !pumpWatchlistValid : false)))}
              onClick={() =>
                onCreate({
                  title: title.trim(),
                  mode: workspace === "pump" ? "mission" : mode,
                  permission,
                  workspace,
                  ...(workspace === "pump"
                    ? {
                        pumpConfig: {
                          scope: pumpScope,
                          objective: pumpScope === "exact-mint" ? pumpObjective : "monitor",
                          tokenMint: pumpScope === "exact-mint" ? pumpMint.trim() : null,
                          ...(pumpScope === "watchlist" ? { watchlistMints: pumpWatchlistMints } : {}),
                          analysisBuyLamports: pumpAnalysisBuyLamports,
                          lifecycle: "proposal-only",
                        } satisfies PumpSessionConfig,
                      }
                    : {}),
                  walletAddress: walletAddress || null,
                  prompt,
                })
              }
            >
              Create session
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function RightRail({
  session,
  runtime,
  model,
  wallets,
  refreshToken,
  onAnalyzePump,
  onScanPump,
}: {
  session: SessionItem | null;
  runtime: RuntimeStatus | null;
  model: string;
  wallets: WalletSummary[];
  refreshToken: number;
  onAnalyzePump?: ((mint: string) => void) | undefined;
  onScanPump?: (() => void) | undefined;
}) {
  const visibleWallet =
    session?.walletAddress ??
    wallets.find((wallet) => wallet.primary)?.address ??
    null;
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [portfolioState, setPortfolioState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [activity, setActivity] = useState<WalletActivitySnapshot | null>(null);
  const [activityState, setActivityState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [portfolioRetry, setPortfolioRetry] = useState(0);

  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");
  
  const pumpConfig = session?.workspace === "pump" ? session.pumpConfig : undefined;
  const activePosition = activePositions.find(p => p.mintAddress === pumpConfig?.tokenMint);

  useEffect(() => {
    let active = true;
    const fetchPositions = async () => {
      try {
        const result = await window.silfable.getActivePositions();
        if (active) setActivePositions(result.positions);
      } catch (err) {
        console.error("Failed to fetch active positions", err);
      }
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const minimumPortfolioSlot = useMemo(() => session?.messages.reduce((highest, message) => {
    const receipt = message.missionExecution;
    return receipt?.status === "confirmed" && receipt.chainSlot !== null && receipt.chainSlot !== undefined
      ? Math.max(highest, receipt.chainSlot)
      : highest;
  }, 0) ?? 0, [session]);
  useEffect(() => {
    let active = true;
    if (!visibleWallet) {
      setPortfolio(null);
      setPortfolioState("idle");
      return () => {
        active = false;
      };
    }
    setPortfolioState("loading");
    void (async () => {
      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const response = await window.silfable.getPortfolio({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            address: visibleWallet,
          });
          if (!active) return;
          if (response.snapshot.slot >= minimumPortfolioSlot) {
            setPortfolio((current) => current?.address === response.snapshot.address && current.slot > response.snapshot.slot ? current : response.snapshot);
            setPortfolioState("ready");
            return;
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 750));
        }
        if (active) setPortfolioState("error");
      } catch { if (active) setPortfolioState("error"); }
    })();
    return () => {
      active = false;
    };
  }, [visibleWallet, refreshToken, minimumPortfolioSlot, portfolioRetry]);
  useEffect(() => {
    let active = true;
    setActivity(null);
    if (!session || !visibleWallet) {
      setActivityState("idle");
      return () => {
        active = false;
      };
    }
    setActivityState("loading");
    window.silfable
      .getWalletActivity({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        address: visibleWallet,
        limit: 10,
      })
      .then((response) => {
        if (active) {
          setActivity(response.activity);
          setActivityState("ready");
        }
      })
      .catch(() => {
        if (active) setActivityState("error");
      });
    return () => {
      active = false;
    };
  }, [session?.id, visibleWallet, refreshToken]);
  const emptyVerifiedPortfolio =
    portfolio !== null &&
    Number(portfolio.solBalance) === 0 &&
    portfolio.assets.length === 0;
  const portfolioLabel =
    portfolioState === "loading"
      ? "Loading…"
      : portfolioState === "error"
        ? "Unavailable"
        : emptyVerifiedPortfolio
          ? "$0.00"
          : portfolio?.totalUsd === null || portfolio?.totalUsd === undefined
            ? visibleWallet
              ? "Unpriced"
              : "No wallet"
            : portfolio.totalUsd.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
              });
  function copyAddress(address: string): void {
    void copyWalletAddress(address).then(() => {
      setCopiedAddress(address);
      window.setTimeout(
        () =>
          setCopiedAddress((current) => (current === address ? null : current)),
        1600,
      );
    });
  }
  const balanceSummary =
    portfolioState === "loading"
      ? "Reading finalized Mainnet balances…"
      : portfolioState === "error"
        ? "Mainnet RPC could not verify this wallet. Try again later."
        : portfolio
          ? `${portfolio.solBalance} SOL · slot ${portfolio.slot.toLocaleString()} · verified ${new Date(portfolio.verifiedAt).toLocaleTimeString()}`
          : "Select or configure a wallet to load its on-chain balances.";
  const latestPumpPreview = session?.messages
    .slice()
    .reverse()
    .find((message) => message.pumpTradePreview)?.pumpTradePreview;
  const latestPumpIntelligence: PumpTokenIntelligence | undefined = session?.messages
    .slice()
    .reverse()
    .find((message) => message.pumpTokenIntelligence && pumpConfig?.scope === "exact-mint" && message.pumpTokenIntelligence.mint === pumpConfig.tokenMint)?.pumpTokenIntelligence;
  const latestPumpDiscovery = session?.messages
    .slice()
    .reverse()
    .find((message) => message.pumpDiscoverySnapshot)?.pumpDiscoverySnapshot;
  const pumpWatchlistEvidence = new Map<string, PumpTokenIntelligence>();
  for (const message of session?.messages.slice().reverse() ?? []) {
    const evidence = message.pumpTokenIntelligence;
    if (evidence && pumpConfig?.watchlistMints?.includes(evidence.mint) && !pumpWatchlistEvidence.has(evidence.mint)) {
      pumpWatchlistEvidence.set(evidence.mint, evidence);
    }
  }
  const pumpAsset = pumpConfig?.tokenMint
    ? portfolio?.assets.find((asset) => asset.mint === pumpConfig.tokenMint)
    : undefined;
  return (
    <aside className="rightRail">
      <div className="rightTop">
        <span>MAINNET</span>
        <strong>{runtime?.networkHealth ?? "unknown"}</strong>
      </div>
      {pumpConfig && (
        <>
          <RailSection title={pumpConfig.scope === "discovery" ? "Market scanner" : latestPumpPreview ? "Trade preview" : "Token intelligence"}>
            <div className="pumpRailStatus">
              <span>PUMP.FUN</span>
              <strong>{pumpConfig.lifecycle.replace("-", " ")}</strong>
            </div>
            <span className="totalLabel">{pumpConfig.scope === "watchlist" ? "Read-only watchlist" : pumpConfig.scope === "discovery" ? "Recent finalized candidates" : "Exact token mint"}</span>
            <div className="pumpMintLine">
              <strong>{pumpConfig.tokenMint ? shorten(pumpConfig.tokenMint) : pumpConfig.scope === "discovery" ? `${latestPumpDiscovery?.candidates.length ?? 0} verified candidates` : `${pumpConfig.watchlistMints?.length ?? 0} tracked mints`}</strong>
              {pumpConfig.tokenMint && (
                <button onClick={() => copyAddress(pumpConfig.tokenMint!)}>
                  {copiedAddress === pumpConfig.tokenMint ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            {pumpConfig.scope === "discovery" && (
              <div className="pumpWatchlistRail">
                <button className="railRetry" onClick={() => onScanPump?.()}>Scan finalized activity</button>
                {latestPumpDiscovery?.candidates.map((candidate) => {
                  const eligibility = candidate.intelligence.researchEligibility;
                  return (
                    <div key={candidate.mint} className="pumpWatchlistItem">
                      <div>
                        <strong>{shorten(candidate.mint)}</strong>
                        <span className={eligibility?.rankingAllowed ? "safe" : "risk"}>{eligibility?.rankingAllowed ? "Ranking eligible" : "Blocked"}</span>
                      </div>
                      <small>{candidate.intelligence.venue} · slot {candidate.intelligence.slot.toLocaleString()}</small>
                      <small>{candidate.signals.map((signal) => signal.replaceAll("-", " ")).join(" · ")}</small>
                      {eligibility && (
                        <details className="pumpEligibilityDetails">
                          <summary>{eligibility.checks.filter((check) => check.passed).length}/10 deterministic checks</summary>
                          <ul>{eligibility.checks.filter((check) => !check.passed).map((check) => <li key={check.id}>{check.message}</li>)}</ul>
                        </details>
                      )}
                      <div><button onClick={() => copyAddress(candidate.mint)}>{copiedAddress === candidate.mint ? "Copied" : "Copy mint"}</button></div>
                    </div>
                  );
                })}
                {latestPumpDiscovery && latestPumpDiscovery.candidates.length === 0 && <p>No independently verified candidates were found in this bounded scan.</p>}
                <p>{latestPumpDiscovery?.disclosure ?? "Manual scan only. No persistent monitoring, ranking, proposal, signature, or broadcast is started."}</p>
              </div>
            )}
            {pumpConfig.scope === "watchlist" && (
              <div className="pumpWatchlistRail">
                {pumpConfig.watchlistMints?.map((mint) => {
                  const evidence = pumpWatchlistEvidence.get(mint);
                  const eligibility = evidence?.researchEligibility;
                  const stale = eligibility !== undefined
                    && Date.now() - Date.parse(eligibility.evaluatedAt) > eligibility.thresholds.maxEvidenceAgeMs;
                  const blocked = eligibility !== undefined && (eligibility.status === "blocked" || stale);
                  const eligibilityLabel = stale
                    ? "Stale - refresh"
                    : eligibility?.status === "eligible"
                      ? "Ranking eligible"
                      : eligibility?.status === "blocked"
                        ? "Research blocked"
                        : "Awaiting eligibility";
                  return (
                    <div key={mint} className="pumpWatchlistItem">
                      <div>
                        <strong>{shorten(mint)}</strong>
                        <span className={evidence ? (blocked ? "risk" : "safe") : ""}>
                          {evidence ? eligibilityLabel : "Awaiting analysis"}
                        </span>
                      </div>
                      <small>{evidence ? `${evidence.venue} · slot ${evidence.slot.toLocaleString()}` : "No finalized evidence saved"}</small>
                      {eligibility && (
                        <details className="pumpEligibilityDetails">
                          <summary>{eligibility.checks.filter((check) => check.passed).length}/10 deterministic checks</summary>
                          <ul>{eligibility.checks.filter((check) => !check.passed).map((check) => <li key={check.id}>{check.message}</li>)}</ul>
                        </details>
                      )}
                      <div>
                        <button onClick={() => copyAddress(mint)}>{copiedAddress === mint ? "Copied" : "Copy"}</button>
                        <button onClick={() => onAnalyzePump?.(mint)}>{evidence ? "Refresh" : "Analyze"}</button>
                      </div>
                    </div>
                  );
                })}
                <p>Watchlist analysis is read-only. Research eligibility does not authorize a trade proposal, signature, or broadcast.</p>
              </div>
            )}
            <dl className="pumpFacts">
              <div><dt>Scope</dt><dd>{pumpConfig.scope}</dd></div>
              <div><dt>Objective</dt><dd>{pumpConfig.objective.replace("-", " ")}</dd></div>
              <div><dt>Venue</dt><dd>{latestPumpPreview?.venue ?? latestPumpIntelligence?.venue ?? "Awaiting analysis"}</dd></div>
              <div><dt>Status</dt><dd>{latestPumpPreview?.status ?? (latestPumpIntelligence?.accountVerified || latestPumpIntelligence?.pumpSwapPoolVerified ? "Verified read-only" : "Monitor ready")}</dd></div>
            </dl>
            {latestPumpIntelligence && (
              <div className="pumpIntelligence">
                {latestPumpIntelligence.researchEligibility && (
                  <div className={`pumpResearchGate ${latestPumpIntelligence.researchEligibility.status}`}>
                    <div><span>RESEARCH ELIGIBILITY</span><strong>{latestPumpIntelligence.researchEligibility.status}</strong></div>
                    <small>{latestPumpIntelligence.researchEligibility.checks.filter((check) => check.passed).length}/10 checks passed; AI ranking {latestPumpIntelligence.researchEligibility.rankingAllowed ? "allowed" : "blocked"}; execution locked</small>
                    {latestPumpIntelligence.researchEligibility.status === "blocked" && (
                      <ul>{latestPumpIntelligence.researchEligibility.checks.filter((check) => !check.passed).map((check) => <li key={check.id}>{check.message}</li>)}</ul>
                    )}
                  </div>
                )}
                <div className="pumpMetricGrid">
                  <div><span>Spot estimate</span><strong>{formatPumpMetric(latestPumpIntelligence.metrics.spotPriceQuotePerToken, latestPumpIntelligence.metrics.quoteSymbol)}</strong></div>
                  <div><span>Est. market cap</span><strong>{formatPumpMetric(latestPumpIntelligence.metrics.estimatedMarketCapQuote, latestPumpIntelligence.metrics.quoteSymbol)}</strong></div>
                  <div><span>Curve progress</span><strong>{formatPumpPercent(latestPumpIntelligence.metrics.curveProgressPercent)}</strong></div>
                  <div><span>Quote reserves</span><strong>{formatPumpMetric(latestPumpIntelligence.metrics.quoteReservesUi, latestPumpIntelligence.metrics.quoteSymbol)}</strong></div>
                  <div><span>Reference buy impact</span><strong>{formatPumpBps(latestPumpIntelligence.metrics.referenceBuyPriceImpactBps)}</strong></div>
                  <div><span>Top 10 accounts</span><strong>{formatPumpPercent(latestPumpIntelligence.top10ConcentrationPercent)}</strong></div>
                </div>
                <div className="pumpPathEvidence">
                  <div className="pumpPathHeader">
                    <strong>Reference round-trip · {latestPumpIntelligence.metrics.referencePath.venue}</strong>
                    <span>RESERVE ONLY</span>
                  </div>
                  <dl>
                    <div><dt>Buy input</dt><dd>{formatPumpRawAmount(latestPumpIntelligence.metrics.referencePath.buyInputQuoteAmount, 9, "SOL")}</dd></div>
                    <div><dt>Buy output</dt><dd>{formatPumpRawAmount(latestPumpIntelligence.metrics.referencePath.buyOutputTokenAmount, latestPumpIntelligence.decimals, "token")}</dd></div>
                    <div><dt>Buy impact</dt><dd>{formatPumpBps(latestPumpIntelligence.metrics.referencePath.buyPriceImpactBps)}</dd></div>
                    <div><dt>Sell-back input</dt><dd>{formatPumpRawAmount(latestPumpIntelligence.metrics.referencePath.sellInputTokenAmount, latestPumpIntelligence.decimals, "token")}</dd></div>
                    <div><dt>Sell-back output</dt><dd>{formatPumpRawAmount(latestPumpIntelligence.metrics.referencePath.sellOutputQuoteAmount, 9, "SOL")}</dd></div>
                    <div><dt>Sell impact</dt><dd>{formatPumpBps(latestPumpIntelligence.metrics.referencePath.sellPriceImpactBps)}</dd></div>
                    <div><dt>Round-trip loss</dt><dd>{formatPumpBps(latestPumpIntelligence.metrics.referencePath.roundTripLossBps)}</dd></div>
                    <div><dt>Network fee</dt><dd>Needs simulation</dd></div>
                    <div><dt>Rent/account funding</dt><dd>Needs simulation</dd></div>
                  </dl>
                  <p>{latestPumpIntelligence.metrics.referencePath.disclosure}</p>
                </div>
                <div className="pumpRiskRows">
                  <div><span>Mint authority</span><strong className={latestPumpIntelligence.mintAuthority === null ? "safe" : "risk"}>{latestPumpIntelligence.mintAuthority === null ? "Disabled" : "Enabled"}</strong></div>
                  <div><span>Freeze authority</span><strong className={latestPumpIntelligence.freezeAuthority === null ? "safe" : "risk"}>{latestPumpIntelligence.freezeAuthority === null ? "Disabled" : "Enabled"}</strong></div>
                  <div><span>Base fee config</span><strong>{latestPumpIntelligence.metrics.baseProtocolFeeBps === null ? "Unavailable" : `${latestPumpIntelligence.metrics.baseProtocolFeeBps} + ${latestPumpIntelligence.metrics.baseCreatorFeeBps ?? 0} bps`}</strong></div>
                </div>
                <small className="pumpEvidenceTime">Finalized slot {latestPumpIntelligence.slot.toLocaleString()} · {new Date(latestPumpIntelligence.verifiedAt).toLocaleTimeString()}</small>
                <p className="pumpEvidenceNote">{latestPumpIntelligence.metrics.priceImpactNote}</p>
                <p className="pumpEvidenceNote">{latestPumpIntelligence.metrics.feeNote}</p>
                {latestPumpIntelligence.warnings.length > 0 && (
                  <details className="pumpWarnings">
                    <summary>{latestPumpIntelligence.warnings.length} evidence warnings</summary>
                    <ul>{latestPumpIntelligence.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                  </details>
                )}
              </div>
            )}
            {latestPumpPreview ? (
              <div className="pumpPreviewSummary">
                <div><span>Side</span><strong>{latestPumpPreview.side}</strong></div>
                <div><span>Input</span><strong>{latestPumpPreview.inputAmount}</strong></div>
                <div><span>Minimum output</span><strong>{latestPumpPreview.minimumOutputAmount}</strong></div>
                <div><span>Policy</span><strong>{latestPumpPreview.checks.filter((check) => check.status === "pass").length}/{latestPumpPreview.checks.length}</strong></div>
                <div><span>Inspector</span><strong>{latestPumpPreview.inspectionBoundary?.instructionName ?? "Unavailable"}</strong></div>
                <div><span>Transaction</span><strong>{latestPumpPreview.inspectionBoundary?.transactionInspected ? "Inspected" : "Not built"}</strong></div>
              </div>
            ) : pumpConfig.scope === "exact-mint" && !latestPumpIntelligence ? (
              <div className="pumpAnalyzePrompt">
                <p>Run a verified read-only analysis to save reserve, authority, concentration, price, market-cap, and curve evidence here.</p>
                <button className="railRetry" onClick={() => pumpConfig.tokenMint && onAnalyzePump?.(pumpConfig.tokenMint)}>Analyze exact mint</button>
              </div>
            ) : null}
            {pumpConfig.scope === "exact-mint" && latestPumpIntelligence && (
              <button className="railRetry pumpRefreshAnalysis" onClick={() => pumpConfig.tokenMint && onAnalyzePump?.(pumpConfig.tokenMint)}>Refresh finalized evidence</button>
            )}
          </RailSection>
          {pumpConfig.scope === "exact-mint" ? (
            <RailSection title="Position">
              <span className="totalLabel">Selected wallet exposure</span>
              <strong className="portfolioTotal">{pumpAsset?.uiAmount ?? "0"}</strong>
              <small>{pumpAsset ? `Token units at finalized slot ${portfolio?.slot.toLocaleString()}` : "No finalized balance for this mint was found in the selected wallet."}</small>
              
              <div className="pumpControlGrid" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    placeholder="Take-Profit %" 
                    value={tpPercent}
                    onChange={(e) => setTpPercent(e.target.value)}
                    style={{ flex: 1, padding: '4px', background: 'var(--input-bg)', color: 'var(--input-fg)', border: '1px solid var(--border)' }}
                  />
                  <input 
                    type="number" 
                    placeholder="Stop-Loss %" 
                    value={slPercent}
                    onChange={(e) => setSlPercent(e.target.value)}
                    style={{ flex: 1, padding: '4px', background: 'var(--input-bg)', color: 'var(--input-fg)', border: '1px solid var(--border)' }}
                  />
                </div>
                {activePosition ? (
                  <button className="dangerOutline" onClick={() => window.silfable.closePosition(activePosition.id)}>
                    Cancel Automation (Active)
                  </button>
                ) : (
                  <button 
                    disabled={!pumpAsset || Number(pumpAsset.uiAmount) <= 0 || pumpAsset.usdPrice === null}
                    onClick={() => {
                      if (pumpAsset && pumpConfig?.tokenMint && pumpAsset.usdPrice !== null) {
                        const entryPriceUsd = pumpAsset.usdPrice;
                        window.silfable.upsertPosition({
                          id: crypto.randomUUID(),
                          mintAddress: pumpConfig.tokenMint,
                          amount: pumpAsset.amount,
                          entryPrice: entryPriceUsd,
                          takeProfitPrice: tpPercent ? entryPriceUsd * (1 + Number(tpPercent) / 100) : undefined,
                          stopLossPrice: slPercent ? entryPriceUsd * (1 - Number(slPercent) / 100) : undefined
                        });
                        setTpPercent("");
                        setSlPercent("");
                      }
                    }}
                  >
                    Save Exit Proposal Monitor
                  </button>
                )}
              </div>
              <p className="pumpUnavailable" style={{ marginTop: '0.5rem' }}>
                Monitoring runs locally while the vault is unlocked. A trigger creates a proposal; it does not sign or broadcast automatically.
              </p>
              
              {visibleWallet && (
                <div className="walletLine selected">
                  <span>SESSION WALLET</span>
                  <strong>{shorten(visibleWallet)}</strong>
                  <button onClick={() => copyAddress(visibleWallet)}>
                    {copiedAddress === visibleWallet ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </RailSection>
          ) : pumpConfig.scope === "watchlist" ? (
            <RailSection title="Watchlist boundary">
              <dl className="pumpFacts">
                <div><dt>Configured</dt><dd>{pumpConfig.watchlistMints?.length ?? 0}/10</dd></div>
                <div><dt>Analyzed</dt><dd>{pumpWatchlistEvidence.size}</dd></div>
                <div><dt>Trade tools</dt><dd>Unavailable</dd></div>
                <div><dt>Network</dt><dd>Mainnet read-only</dd></div>
              </dl>
              <p className="pumpUnavailable">Select Analyze on a mint to refresh finalized evidence. Moving a candidate into an exact-mint proposal session must remain an explicit user action.</p>
            </RailSection>
          ) : (
            <RailSection title="Scanner boundary">
              <dl className="pumpFacts">
                <div><dt>Signatures</dt><dd>{latestPumpDiscovery?.scannedSignatures ?? 0}/10</dd></div>
                <div><dt>Observed mints</dt><dd>{latestPumpDiscovery?.observedMints ?? 0}</dd></div>
                <div><dt>Decoded events</dt><dd>{latestPumpDiscovery?.decodedEvents ?? 0}</dd></div>
                <div><dt>Verified candidates</dt><dd>{latestPumpDiscovery?.candidates.length ?? 0}/5</dd></div>
                <div><dt>Execution</dt><dd>Locked</dd></div>
              </dl>
              <p className="pumpUnavailable">This manual RPC scan is deliberately incomplete. A production real-time indexer, schedules, automatic watchlist mutation, and autonomous buys remain unavailable.</p>
            </RailSection>
          )}
        </>
      )}
      {!pumpConfig && (
      <RailSection title={session ? "Positions" : "Portfolio"}>
        <span className="totalLabel">
          {session ? "Session wallet value" : "Verified portfolio"}
        </span>
        <strong className="portfolioTotal">{portfolioLabel}</strong>
        <small>{balanceSummary}</small>
        {portfolioState === "error" && (
          <button className="railRetry" onClick={() => setPortfolioRetry((value) => value + 1)}>
            Retry portfolio refresh
          </button>
        )}
        {portfolio && portfolio.assets.length > 0 && (
          <div className="assetList">
            {portfolio.assets.slice(0, 5).map((asset) => (
              <div key={asset.mint}>
                <span>{shorten(asset.mint)}</span>
                <strong>{asset.uiAmount}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="portfolioWallets">
          {session ? (
            visibleWallet ? (
              <div className="walletLine selected">
                <span>◎ SESSION WALLET</span>
                <strong>{shorten(visibleWallet)}</strong>
                <button onClick={() => copyAddress(visibleWallet)}>
                  {copiedAddress === visibleWallet ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <div className="walletLine">
                <span>◎ SOL</span>
                <strong>Chat only</strong>
              </div>
            )
          ) : wallets.length === 0 ? (
            <div className="walletLine">
              <span>◎ SOL</span>
              <strong>Not configured</strong>
            </div>
          ) : (
            wallets.map((wallet) => (
              <div
                className={`walletLine ${wallet.address === visibleWallet ? "selected" : ""}`}
                key={wallet.address}
              >
                <span>◎ {wallet.primary ? "PRIMARY" : "SOL"}</span>
                <strong>{shorten(wallet.address)}</strong>
                <button onClick={() => copyAddress(wallet.address)}>
                  {copiedAddress === wallet.address ? "Copied" : "Copy"}
                </button>
              </div>
            ))
          )}
        </div>
      </RailSection>
      )}
      {session && (
        <RailSection title="Recent activity">
          {activityState === "loading" ? (
            <p>Reading finalized wallet signatures…</p>
          ) : activityState === "error" ? (
            <p>Recent activity could not be verified from Mainnet RPC.</p>
          ) : activity?.entries.length ? (
            <div className="activityList">
              {activity.entries.slice(0, 6).map((entry) => (
                <div key={entry.signature}>
                  <span className={entry.status}>{entry.status}</span>
                  <div>
                    <strong>{shorten(entry.signature)}</strong>
                    <small>
                      {entry.blockTime
                        ? new Date(entry.blockTime).toLocaleString()
                        : `Slot ${entry.slot.toLocaleString()}`}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No finalized activity found for this wallet.</p>
          )}
        </RailSection>
      )}
      <RailSection title="Runtime & cost">
        <div className="runtimeModel">
          ◈ {model || "OpenRouter not configured"}
        </div>
        <dl>
          <div>
            <dt>Input</dt>
            <dd>{session?.usage.input ?? 0}</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>{session?.usage.output ?? 0}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{session?.usage.total ?? 0}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>
              {session?.usage.cost === null || session?.usage.cost === undefined
                ? "—"
                : `$${session.usage.cost.toFixed(6)}`}
            </dd>
          </div>
        </dl>
      </RailSection>
      {session && (
        <RailSection title="Session">
          <dl className="sessionFacts">
            <div>
              <dt>Workspace</dt>
              <dd>{session.workspace === "pump" ? "Pump.fun" : "General"}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{session.mode}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{session.permission}</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{visibleWallet ? shorten(visibleWallet) : "Chat only"}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>
                {new Date(session.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>Locked</dd>
            </div>
          </dl>
        </RailSection>
      )}
    </aside>
  );
}

function SetupCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="setupCard">
      <header>
        <span className="setupIcon">{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="setupBody">{children}</div>
    </section>
  );
}
function SetupActions({
  step,
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Save and continue",
  secondaryLabel,
}: {
  step: number;
  onBack?: (() => void) | undefined;
  onContinue: () => void;
  continueDisabled?: boolean | undefined;
  continueLabel?: string | undefined;
  secondaryLabel?: string | undefined;
}) {
  return (
    <footer className="setupActions">
      <span>Step {step} / 6 · Mainnet only</span>
      <div>
        {onBack && <button onClick={onBack}>Back</button>}
        {secondaryLabel && (
          <button onClick={onContinue}>{secondaryLabel}</button>
        )}
        <button
          className="primaryButton"
          disabled={continueDisabled}
          onClick={onContinue}
        >
          {continueLabel}
        </button>
      </div>
    </footer>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ProviderCard({
  name,
  tag,
  description,
  children,
}: {
  name: string;
  tag: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="providerCard">
      <header>
        <strong>{name}</strong>
        <StatusPill tone={tag === "Configured" ? "success" : "neutral"}>
          {tag}
        </StatusPill>
      </header>
      <p>{description}</p>
      {children}
    </section>
  );
}
function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "warning" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`notice ${tone}`}>
      <span>{tone === "danger" ? "!" : tone === "warning" ? "△" : "i"}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`statusPill ${tone}`}>{children}</span>;
}
function Brand({ compact }: { compact: boolean }) {
  return (
    <div className={`setupBrand ${compact ? "compact" : ""}`}>
      <BrandMark />
      <div>
        <strong>Silfable</strong>
        <small>Mainnet intelligence</small>
      </div>
    </div>
  );
}
function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brandMark ${large ? "large" : ""}`}>
      <img src={logoUrl} alt="Silfable Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }} />
    </span>
  );
}
function CornerFooter() {
  return (
    <div className="cornerFooter">
      <span>Local-first · policy enforced</span>
      <span>MAINNET</span>
    </div>
  );
}
function RailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="railSection">
      <h3>
        <span />
        {title}
      </h3>
      {children}
    </section>
  );
}
function UtilityView({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="utilityView">
      <p className="kicker">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
      {action}
    </div>
  );
}
function Composer({
  value,
  setValue,
  onSubmit,
  disabled = false,
  placeholder,
}: {
  value: string;
  setValue: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <div className={`composer ${disabled ? "disabled" : ""}`}>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (!disabled && event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={1}
      />
      <span>Mode / Chat</span>
      <button disabled={disabled || !value.trim()} onClick={onSubmit}>
        ↑
      </button>
    </div>
  );
}
function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}
function formatPumpMetric(value: number | null, quoteSymbol: "SOL" | "USDC" | "unknown"): string {
  if (value === null) return "Unavailable";
  const formatted = value > 0 && value < 0.0001
    ? value.toExponential(4)
    : new Intl.NumberFormat(undefined, { notation: value >= 1_000 ? "compact" : "standard", maximumFractionDigits: 6 }).format(value);
  return quoteSymbol === "unknown" ? formatted : `${formatted} ${quoteSymbol}`;
}
function formatPumpPercent(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(2)}%`;
}
function formatPumpBps(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(3)} bps`;
}
function formatPumpRawAmount(raw: string | null, decimals: number | null, suffix: string): string {
  if (raw === null || decimals === null) return "Unavailable";
  const numeric = Number(raw) / (10 ** decimals);
  if (!Number.isFinite(numeric)) return `${raw} raw`;
  const formatted = numeric > 0 && numeric < 0.000001
    ? numeric.toExponential(4)
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.min(decimals, 9) }).format(numeric);
  return `${formatted} ${suffix}`;
}
async function copyWalletAddress(address: string): Promise<void> {
  await window.silfable.copyWalletAddress({
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    address,
  });
}
function readSetup(): SetupState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<SetupState> | null;
    return parsed ? { ...DEFAULT_SETUP, ...parsed } : DEFAULT_SETUP;
  } catch {
    return DEFAULT_SETUP;
  }
}
