import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUp,
  Bot,
  Brain,
  CirclePlus,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import logoUrl from "../../assets/logo.png";
import { Button, Modal } from "./components/ui";
import { AutomationPanel } from "./components/ui/AutomationPanel";

import type {
  BridgePreflightEvidence,
  BridgeProposal,
  BridgeReceipt,
  BridgeDestinationChain,
  EmergencyStopStatus,
  EvmBridgeContract,
  EvmBridgePreflight,
  EvmBridgeQuote,
  EvmBridgeReceipt,
  EvmChainKey,
  EvmPortfolioSnapshot,
  EvmSessionExecutionReceipt,
  EvmSwapPreflightEvidence,
  EvmSwapProposal,
  LimitOrderCancelSimulation,
  LimitOrderContractPreview,
  LimitOrderExecutionReceipt,
  LimitOrderSimulationPreview,
  LegacyPumpLaunchMetadataPackage,
  MissionContractPreview,
  MissionExecutionReceipt,
  MissionSimulationPreview,
  OpenRouterModelView,
  PortfolioSnapshot,
  PumpExecutionRecord,
  PumpFinalRevalidation,
  PumpLaunchDraft,
  PumpLaunchDraftInput,
  PumpLaunchMetadata,
  PumpLaunchPreflight,
  PumpLaunchFinalRevalidation,
  PumpLaunchExecutionRecord,
  PumpRiskSettings,
  PumpSimulationArtifact,
  PumpTokenIntelligence,
  PumpTradeContractPreview,
  RuntimeStatus,
  SessionRecord,
  TransactionSettings,
  WalletActivitySnapshot,
} from "@silfable/contracts";
import {
  BRIDGE_ARBITRUM_CHAIN_ID,
  BRIDGE_ARBITRUM_USDC_ADDRESS,
  BRIDGE_AVALANCHE_CHAIN_ID,
  BRIDGE_AVALANCHE_USDC_ADDRESS,
  BRIDGE_BASE_CHAIN_ID,
  BRIDGE_BASE_USDC_ADDRESS,
  BRIDGE_ETHEREUM_CHAIN_ID,
  BRIDGE_ETHEREUM_USDC_ADDRESS,
  BRIDGE_OPTIMISM_CHAIN_ID,
  BRIDGE_OPTIMISM_USDC_ADDRESS,
  BRIDGE_POLYGON_CHAIN_ID,
  BRIDGE_POLYGON_USDC_ADDRESS,
  BRIDGE_ROBINHOOD_CHAIN_ID,
  BRIDGE_ROBINHOOD_USDG_ADDRESS,
  BRIDGE_SOLANA_CHAIN_ID,
  BRIDGE_SOLANA_USDC_MINT,
} from "@silfable/contracts";

const BRIDGE_DESTINATIONS: Record<BridgeDestinationChain, {
  label: string;
  chainId: BridgeProposal["contract"]["destinationChainId"];
  assetAddress: string;
  symbol: "USDC" | "USDG";
  confirmation: "BRIDGE USDC TO BASE" | "BRIDGE USDC TO ARBITRUM" | "BRIDGE USDC TO ETHEREUM" | "BRIDGE USDC TO OPTIMISM" | "BRIDGE USDC TO POLYGON" | "BRIDGE USDC TO AVALANCHE" | "BRIDGE USDC TO ROBINHOOD";
}> = {
  base: { label: "Base", chainId: BRIDGE_BASE_CHAIN_ID, assetAddress: BRIDGE_BASE_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO BASE" },
  arbitrum: { label: "Arbitrum", chainId: BRIDGE_ARBITRUM_CHAIN_ID, assetAddress: BRIDGE_ARBITRUM_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO ARBITRUM" },
  ethereum: { label: "Ethereum", chainId: BRIDGE_ETHEREUM_CHAIN_ID, assetAddress: BRIDGE_ETHEREUM_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO ETHEREUM" },
  optimism: { label: "Optimism", chainId: BRIDGE_OPTIMISM_CHAIN_ID, assetAddress: BRIDGE_OPTIMISM_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO OPTIMISM" },
  polygon: { label: "Polygon", chainId: BRIDGE_POLYGON_CHAIN_ID, assetAddress: BRIDGE_POLYGON_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO POLYGON" },
  avalanche: { label: "Avalanche", chainId: BRIDGE_AVALANCHE_CHAIN_ID, assetAddress: BRIDGE_AVALANCHE_USDC_ADDRESS, symbol: "USDC", confirmation: "BRIDGE USDC TO AVALANCHE" },
  robinhood: { label: "Robinhood", chainId: BRIDGE_ROBINHOOD_CHAIN_ID, assetAddress: BRIDGE_ROBINHOOD_USDG_ADDRESS, symbol: "USDG", confirmation: "BRIDGE USDC TO ROBINHOOD" },
};

const CONTROLLED_BRIDGE_ACCEPTANCE_CONFIRMATION = "RUN CONTROLLED BRIDGE ACCEPTANCE" as const;

function isControlledBridgeAcceptance(proposal: BridgeProposal): boolean {
  return (proposal.quote.provider === "relay" || proposal.quote.provider === "debridge-dln")
    && BigInt(proposal.contract.amountIn) <= 10_000_000n
    && proposal.contract.maximumTotalFeeUsd <= 10.0
    && proposal.quote.fee.totalFeeUsd <= 10.0
    && BigInt(proposal.contract.minimumDestinationAmount) > 0n;
}

type EvmBridgeChainKey = Exclude<EvmChainKey, "bsc">;

const EVM_BRIDGE_ASSETS: Record<EvmBridgeChainKey, {
  label: string;
  chainId: number;
  address: `0x${string}`;
  symbol: "USDC" | "USDG";
}> = {
  ethereum: { label: "Ethereum", chainId: BRIDGE_ETHEREUM_CHAIN_ID, address: BRIDGE_ETHEREUM_USDC_ADDRESS, symbol: "USDC" },
  base: { label: "Base", chainId: BRIDGE_BASE_CHAIN_ID, address: BRIDGE_BASE_USDC_ADDRESS, symbol: "USDC" },
  arbitrum: { label: "Arbitrum", chainId: BRIDGE_ARBITRUM_CHAIN_ID, address: BRIDGE_ARBITRUM_USDC_ADDRESS, symbol: "USDC" },
  optimism: { label: "Optimism", chainId: BRIDGE_OPTIMISM_CHAIN_ID, address: BRIDGE_OPTIMISM_USDC_ADDRESS, symbol: "USDC" },
  polygon: { label: "Polygon", chainId: BRIDGE_POLYGON_CHAIN_ID, address: BRIDGE_POLYGON_USDC_ADDRESS, symbol: "USDC" },
  avalanche: { label: "Avalanche", chainId: BRIDGE_AVALANCHE_CHAIN_ID, address: BRIDGE_AVALANCHE_USDC_ADDRESS, symbol: "USDC" },
  robinhood: { label: "Robinhood Chain", chainId: BRIDGE_ROBINHOOD_CHAIN_ID, address: BRIDGE_ROBINHOOD_USDG_ADDRESS, symbol: "USDG" },
};

const EVM_PORTFOLIO_CHAINS: ReadonlyArray<{
  key: EvmChainKey;
  label: string;
  token?: { address: `0x${string}`; symbol: "USDC" | "USDG"; decimals: 6 };
}> = [
  { key: "robinhood", label: "Robinhood", token: { address: BRIDGE_ROBINHOOD_USDG_ADDRESS, symbol: "USDG", decimals: 6 } },
  { key: "ethereum", label: "Ethereum", token: { address: BRIDGE_ETHEREUM_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "base", label: "Base", token: { address: BRIDGE_BASE_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "arbitrum", label: "Arbitrum", token: { address: BRIDGE_ARBITRUM_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "optimism", label: "Optimism", token: { address: BRIDGE_OPTIMISM_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "polygon", label: "Polygon", token: { address: BRIDGE_POLYGON_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "avalanche", label: "Avalanche", token: { address: BRIDGE_AVALANCHE_USDC_ADDRESS, symbol: "USDC", decimals: 6 } },
  { key: "bsc", label: "BNB Chain" },
];

function bridgeDestination(chainId: BridgeProposal["contract"]["destinationChainId"]) {
  return Object.values(BRIDGE_DESTINATIONS).find((candidate) => candidate.chainId === chainId) ?? BRIDGE_DESTINATIONS.base;
}

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
  maxSlippageBps: number;
  defaultDeadlineMinutes: number;
  transactionPriority: TransactionSettings["priority"];
};

type SessionMode = SessionRecord["mode"];
type Permission = SessionRecord["permission"];
type SessionWorkspace = NonNullable<SessionRecord["workspace"]>;
type PumpSessionConfig = NonNullable<SessionRecord["pumpConfig"]>;
type SessionWalletScope = NonNullable<SessionRecord["walletScope"]>;
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
  maxSlippageBps: 300,
  defaultDeadlineMinutes: 30,
  transactionPriority: "standard",
};

const SETUP_STEPS = [
  "Security",
  "Wallets",
  "Integrations",
  "Agent core",
  "Provider",
  "Review",
];

function sessionIntentLabel(session: SessionRecord): string {
  if (session.workspace === "pump") return "Legacy Pump pilot";
  if (session.walletScope === "solana") return "Solana workspace";
  if (session.walletScope === "evm") return "EVM workspace";
  switch (session.intent) {
    case "token-launch": return "Token launch";
    case "solana-swap": return "Solana swap";
    case "evm-swap": return "EVM swap";
    case "bridge": return "Bridge";
    case "research": return "Research";
    default: return session.mode === "mission" ? "Mission" : "Agent";
  }
}

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
  const [evmPrivateKey, setEvmPrivateKey] = useState("");
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmWallets, setEvmWallets] = useState<Array<{ address: string; primary: boolean }>>([]);
  const [evmRecovery, setEvmRecovery] = useState<string | null>(null);
  const [evmMessage, setEvmMessage] = useState<string | null>(null);
  const [evmMode, setEvmMode] = useState<"generate" | "mnemonic" | "private">("generate");
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
    window.silfable.getEvmWallets().then((result: any) => {
      setEvmAddress(result.address);
      setEvmWallets(result.wallets);
    }).catch(() => undefined);
  }, []);
  async function refreshEvmWallets(): Promise<void> {
    const result = await window.silfable.getEvmWallets();

    setEvmAddress(result.address);
    setEvmWallets(result.wallets);
  }
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
      await refreshEvmWallets(); setEvmRecovery(result.recoveryMnemonic); setEvmMessage("Robinhood Chain EVM wallet created and encrypted locally.");
    } catch { setEvmMessage("EVM wallet could not be created. Check the vault and wallet limit."); }
    finally { setBusy(false); }
  }
  async function importEvmWallet(): Promise<void> {
    setBusy(true); setEvmMessage(null); setEvmRecovery(null);
    try {
      await window.silfable.importRobinhoodWalletMnemonic({ schemaVersion: 1, requestId: crypto.randomUUID(), mnemonic: evmMnemonic, acknowledgedHotWalletRisk: true });
      setEvmMnemonic(""); await refreshEvmWallets(); setEvmMessage("Robinhood Chain EVM wallet imported and encrypted locally.");
    } catch { setEvmMessage("EVM recovery phrase could not be imported."); }
    finally { setBusy(false); }
  }
 async function importEvmPrivateKey(): Promise<void> {
    setBusy(true); setEvmMessage(null); setEvmRecovery(null);
    try {
      await window.silfable.importRobinhoodWalletPrivateKey({ schemaVersion: 1, requestId: crypto.randomUUID(), privateKey: evmPrivateKey, acknowledgedHotWalletRisk: true });
      setEvmPrivateKey(""); await refreshEvmWallets(); setEvmMessage("EVM private key imported and encrypted locally.");
    } catch { setEvmMessage("EVM private key could not be imported. Use a 32-byte hexadecimal key."); }
    finally { setBusy(false); }
  }
  async function clearAllWallets(family: "solana" | "evm"): Promise<void> {
    const label = family === "solana" ? "Solana" : "EVM";
    if (!window.confirm(`Remove every ${label} wallet from this encrypted vault? Sessions will remain, but they will no longer have a registered wallet.`)) return;
    setBusy(true);
    try {
      if (family === "solana") {
        const result = await window.silfable.clearWallets({ schemaVersion: 1, requestId: crypto.randomUUID(), confirmation: "CLEAR ALL SOLANA WALLETS" });
        setWallets([]);
        setRecovery(null);
        setMessage(`${result.removed} Solana wallet(s) removed from this device.`);
        setRuntime(await window.silfable.getRuntimeStatus());
      } else {
        const result = await window.silfable.clearEvmWallets({ schemaVersion: 1, requestId: crypto.randomUUID(), confirmation: "CLEAR ALL EVM WALLETS" });
        setEvmAddress(null);
        setEvmWallets([]);
        setEvmRecovery(null);
        setEvmMessage(`${result.removed} EVM wallet(s) removed from this device.`);
      }
    } catch {
     const fallback = `${label} wallets could not be removed. Unlock the vault and try again.`;
      family === "solana" ? setMessage(fallback) : setEvmMessage(fallback);
    } finally {
      setBusy(false);
    }
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
        <div>
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
          <button className="secondaryButton dangerButton" disabled={busy} onClick={() => void clearAllWallets("solana")}>Clear all Solana wallets</button>
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
        disabled={busy || wallets.length >= 3 || (mode !== "generate" && secret.trim().length < 8)}
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
{walletTab === "evm" && <section className="advanced transactionGuardSettings">
        <strong>Robinhood Chain EVM wallets</strong>
        <small className="providerHint">Maximum 3 wallets. Creating or importing never authorizes a transaction.</small>
        {evmWallets.length > 0 && <><div className="walletList">{evmWallets.map((wallet, index) => <div key={wallet.address}><span>0{index + 1}</span><strong>{shorten(wallet.address)}</strong>{wallet.primary && <StatusPill tone="success">Primary</StatusPill>}<button onClick={() => void copyWalletAddress(wallet.address)}>Copy</button></div>)}</div><button className="secondaryButton dangerButton" disabled={busy} onClick={() => void clearAllWallets("evm")}>Clear all EVM wallets</button></>}
        <div className="segmented"><button className={evmMode === "generate" ? "active" : ""} onClick={() => setEvmMode("generate")}>Generate new</button><button className={evmMode === "mnemonic" ? "active" : ""} onClick={() => setEvmMode("mnemonic")}>Import phrase</button><button className={evmMode === "private" ? "active" : ""} onClick={() => setEvmMode("private")}>Import key</button></div>
        {evmMode === "mnemonic" && <Field label="EVM recovery phrase"><textarea value={evmMnemonic} onChange={(event) => setEvmMnemonic(event.target.value)} rows={3} spellCheck={false} placeholder="12 or 24 recovery words" /></Field>}
        {evmMode === "private" && <Field label="EVM private key"><textarea value={evmPrivateKey} onChange={(event) => setEvmPrivateKey(event.target.value)} rows={3} spellCheck={false} placeholder="0x followed by 64 hexadecimal characters" /></Field>}
        <button className="secondaryButton" disabled={busy || evmWallets.length >= 3 || (evmMode === "mnemonic" && evmMnemonic.trim().length < 32) || (evmMode === "private" && evmPrivateKey.trim().length < 64)} onClick={() => void (evmMode === "generate" ? createEvmWallet() : evmMode === "mnemonic" ? importEvmWallet() : importEvmPrivateKey())}>{busy ? "Securing…" : evmMode === "generate" ? "Generate EVM wallet" : evmMode === "mnemonic" ? "Import EVM phrase" : "Import EVM private key"}</button>
        {evmRecovery && <Notice tone="danger" title="Write down this EVM recovery phrase">{evmRecovery}</Notice>}
        {evmMessage && <p className="inlineMessage">{evmMessage}</p>}
      </section>}
       {false && walletTab === "evm" &&
      <section className="advanced transactionGuardSettings">
        <strong>Robinhood Chain EVM wallet</strong>
        <small className="providerHint">Maximum 3 wallets. Separate from Solana; adding one never authorizes a transaction.</small>
        {evmWallets.length > 0 && <div className="walletList">{evmWallets.map((wallet, index) => <div key={wallet.address}><span>0{index + 1}</span><strong>{shorten(wallet.address)}</strong>{wallet.primary && <StatusPill tone="success">Primary</StatusPill>}<button onClick={() => void copyWalletAddress(wallet.address)}>Copy</button></div>)}</div>}
        {evmAddress ? (
          <div className="configuredReceipt"><span>âœ“</span><div><strong>EVM wallet configured</strong><small>{evmAddress}</small></div></div>
        ) : (
          <>
            <Field label="Import EVM recovery phrase"><textarea value={evmMnemonic} onChange={(event) => setEvmMnemonic(event.target.value)} rows={3} spellCheck={false} placeholder="12 or 24 recovery words" /></Field>
            <button className="secondaryButton" disabled={busy || evmMnemonic.trim().length < 32} onClick={() => void importEvmWallet()}>{busy ? "Importing…" : "Import EVM wallet"}</button>
            <button className="secondaryButton" disabled={busy} onClick={() => void createEvmWallet()}>{busy ? "Creating…" : "Create new EVM wallet"}</button>
          </>
        )}
        {evmAddress && <>
          <Field label="Import another EVM recovery phrase"><textarea value={evmMnemonic} onChange={(event) => setEvmMnemonic(event.target.value)} rows={3} spellCheck={false} placeholder="12 or 24 recovery words" /></Field>
          <button className="secondaryButton" disabled={busy || evmMnemonic.trim().length < 32} onClick={() => void importEvmWallet()}>{busy ? "Importing…" : "Import another EVM wallet"}</button>
          <button className="secondaryButton" disabled={busy} onClick={() => void createEvmWallet()}>{busy ? "Creating…" : "Generate another EVM wallet"}</button>
        </>}
         <Field label="Import EVM private key"><textarea value={evmPrivateKey} onChange={(event) => setEvmPrivateKey(event.target.value)} rows={3} spellCheck={false} placeholder="0x followed by 64 hexadecimal characters" /></Field>
        <button className="secondaryButton" disabled={busy || evmPrivateKey.trim().length < 64} onClick={() => void importEvmPrivateKey()}>{busy ? "Importing…" : "Import EVM private key"}</button>
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
    value: Pick<SetupState, "jupiterConfigured">,
  ) => void;
}) {
  const [jupiterKey, setJupiterKey] = useState("");
  const [jupiterConfigured, setJupiterConfigured] = useState(
    setup.jupiterConfigured,
  );
  const [uniswapKey, setUniswapKey] = useState("");
  const [uniswapConfigured, setUniswapConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    window.silfable
      .getJupiterSettings()
      .then((jupiter) => {
        setJupiterConfigured(jupiter.configured);
      })
      .catch(() => undefined);
    window.silfable
      .getUniswapSettings()
      .then((uniswap) => setUniswapConfigured(uniswap.configured))
      .catch(() => undefined);
  }, []);
  async function saveKey(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveJupiterKey({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        apiKey: jupiterKey,
        acknowledgedMainnetMarketData: true,
      });
      setJupiterKey("");
      setJupiterConfigured(true);
      setMessage("Jupiter key encrypted in the local vault.");
    } catch {
      setMessage("Jupiter key could not be stored. Unlock the vault and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function saveUniswapKey(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveUniswapKey({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        apiKey: uniswapKey,
        acknowledgedExternalQuoteProvider: true,
      });
      await window.silfable.testUniswapKey({ schemaVersion: 1, requestId: crypto.randomUUID() });
      setUniswapKey("");
      setUniswapConfigured(true);
      setMessage("Uniswap API key verified and encrypted in the local vault.");
    } catch (error) {
      setMessage(error instanceof Error ? `Uniswap key could not be verified: ${error.message}` : "Uniswap key could not be verified. Unlock the vault and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupCard
      icon="⌁"
      title="Connect integrations"
      subtitle="Enable only the external services your sessions need."
    >
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
              onClick={() => void saveKey()}
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
        name="Uniswap · Robinhood Chain"
        tag={uniswapConfigured ? "Configured" : "Required for Robinhood swaps"}
        description="Official Uniswap Trading API with Classic routes only and the pinned Universal Router 2.1.1."
      >
        <Field label="Uniswap API key">
          <div className="inputWithAction">
            <input
              type="password"
              value={uniswapKey}
              onChange={(event) => setUniswapKey(event.target.value)}
              placeholder={uniswapConfigured ? "Replace saved key" : "Enter Uniswap API key"}
              autoComplete="new-password"
            />
            <button
              disabled={busy || uniswapKey.trim().length < 8}
              onClick={() => void saveUniswapKey()}
            >
              {busy ? "Saving" : "Save & test"}
            </button>
          </div>
        </Field>
        <small className="providerHint">
          Required only for Robinhood Chain EVM swaps. It is encrypted locally and never sent to the AI model.
        </small>
      </ProviderCard>
      {message && <p className="inlineMessage">{message}</p>}
      <SetupActions
        step={3}
        onBack={onBack}
        onContinue={() => onContinue({ jupiterConfigured })}
        secondaryLabel={!jupiterConfigured ? "Skip optional" : undefined}
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
  | "maxSlippageBps"
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
  const [maxSlippageBps, setMaxSlippageBps] = useState(String(setup.maxSlippageBps));
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  useEffect(() => {
    window.silfable.getTransactionSettings().then(({ settings }) => {
      setMaxNetworkFeeLamports(String(settings.maxNetworkFeeLamports));
      setMaxFeePercent(String(settings.maxFeePercent));
      setDefaultSlippageBps(String(settings.defaultSlippageBps));
      setMaxSlippageBps(String(settings.maxSlippageBps));
      setDefaultDeadlineMinutes(String(settings.defaultDeadlineMinutes));
      setTransactionPriority(settings.priority);
    }).catch(() => undefined);
    window.silfable.getPumpRiskSettings().then(({ settings }) => {
      setPumpRisk(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])) as typeof pumpRisk);
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
    maxSlippageBps: Number(maxSlippageBps),
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
    && Number.isInteger(numeric.maxSlippageBps) && numeric.maxSlippageBps >= numeric.defaultSlippageBps && numeric.maxSlippageBps <= 300
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
          maxSlippageBps: numeric.maxSlippageBps,
          defaultDeadlineMinutes: numeric.defaultDeadlineMinutes,
          priority: transactionPriority,
        },
      });
      await window.silfable.savePumpRiskSettings({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        settings: pumpSettings,
      });
      onContinue({
        contextLimit: context, outputLimit: output, temperature,
        subagentMaxConcurrent: numeric.subagentMaxConcurrent, subagentContextLimit: numeric.subagentContextLimit,
        subagentOutputLimit, subagentTemperature, subagentMaxIterations: numeric.subagentMaxIterations,
        subagentTimeoutMs: numeric.subagentTimeoutMs, maxToolCallsPerTurn: numeric.maxToolCallsPerTurn,
        missionMaxSteps: numeric.missionMaxSteps, retryLimit: numeric.retryLimit,
        maxNetworkFeeLamports: numeric.maxNetworkFeeLamports, maxFeePercent: numeric.maxFeePercent,
        defaultSlippageBps: numeric.defaultSlippageBps, maxSlippageBps: numeric.maxSlippageBps, defaultDeadlineMinutes: numeric.defaultDeadlineMinutes,
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
            <small>Used as the recommended mission default.</small>
          </Field>
          <Field label="Maximum slippage (bps)">
            <input inputMode="numeric" value={maxSlippageBps} onChange={(event) => setMaxSlippageBps(event.target.value)} />
            <small>Hard ceiling for AI drafts, simulations, Pump proposals, and limit orders. Must be at least the default and no more than 300 bps.</small>
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
      title: "Trading integrations",
      state: setup.jupiterConfigured ? "Configured" : "Optional missing",
      detail: `Jupiter ${setup.jupiterConfigured ? "configured" : "not set"} · EVM routing uses chain defaults`,
      step: 3,
      ok: setup.jupiterConfigured,
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
        and explicit final confirmation. A restricted Robinhood Chain EVM
        execution path is available only after its independent release gate is
        satisfied. Autonomous execution and Full Access remain unavailable.
      </Notice>
      {editing && (
        <details className="advanced">
          <summary>Advanced safety · Emergency stop</summary>
          <p>
            Use only when a prepared transaction or local strategy must be halted immediately.
            Normal sessions do not require this control.
          </p>
          <div className="advancedSafetyPanel">
            <EmergencyStopPanel />
          </div>
        </details>
      )}
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
  const [sessionsState, setSessionsState] = useState<"loading" | "ready" | "error">("loading");
  const [sessionToDelete, setSessionToDelete] = useState<SessionItem | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);

  const [evmWallets, setEvmWallets] = useState<WalletSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [thinkingIds, setThinkingIds] = useState<string[]>([]);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [nav, setNav] = useState<"sessions" | "missions" | "automation">(
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
  const [evmExecutionApproval, setEvmExecutionApproval] = useState<{
    sessionId: string;
    messageId: string;
    proposal: EvmSwapProposal;
    preflight: EvmSwapPreflightEvidence;
    action: "approval" | "swap";
  } | null>(null);
  const [preparingEvmIds, setPreparingEvmIds] = useState<string[]>([]);
  const [executingEvmIds, setExecutingEvmIds] = useState<string[]>([]);
  const [evmExecutionEnabled, setEvmExecutionEnabled] = useState(false);
  const [evmExecutionMissing, setEvmExecutionMissing] = useState<string[]>([]);
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
 const [preparingBridgeIds, setPreparingBridgeIds] = useState<string[]>([]);
  const [reconcilingBridgeIds, setReconcilingBridgeIds] = useState<string[]>([]);
  const [bridgeExecutionApproval, setBridgeExecutionApproval] = useState<{
    sessionId: string;
    proposal: BridgeProposal;
    preflight: BridgePreflightEvidence;
  } | null>(null);
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
      .getEvmWallets()
      .then((response: any) => {
        if (activeRequest) setEvmWallets(response.wallets);
      })
      .catch(() => undefined);
    window.silfable
      .getEvmSettings()
      .then((response: any) => {
        if (activeRequest) {
          setEvmExecutionEnabled(response.executionEnabled);
          setEvmExecutionMissing(response.executionMissing);
        }
      })
      .catch(() => undefined);


    window.silfable
      .listSessions()
      .then((response) => {
        if (activeRequest) {
          setSessions(response.sessions);
          setSessionsState("ready");
        }
      })
      .catch(() => {
        if (activeRequest) setSessionsState("error");
      });
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
  async function refreshEncryptedSessions(preferredId?: string): Promise<void> {
    setSessionsState("loading");
    try {
      const response = await window.silfable.listSessions();
      setSessions(response.sessions);
      setSessionsState("ready");
      if (preferredId && response.sessions.some((session) => session.id === preferredId)) {
        setActiveId(preferredId);
      }
    } catch (error) {
      setSessionsState("error");
      throw error;
    }
  }
  async function prepareBridge(
    target: SessionItem,
    input: { destinationChain: BridgeDestinationChain; destinationRecipient: string; amountIn: string; minimumDestinationAmount: string; maximumTotalFeeUsd: number },
  ): Promise<void> {
    if (target.walletScope !== "solana" || target.walletAddress === null) {
      throw new Error("A Solana wallet-scoped session is required.");
    }
    const contractId = crypto.randomUUID();
    setPreparingBridgeIds((current) => [...current, contractId]);
    try {
      const createdAt = new Date();
      const destination = BRIDGE_DESTINATIONS[input.destinationChain];
      await window.silfable.prepareBridge({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: target.id,
        acknowledgedQuoteOnly: true,
        contract: {
          id: contractId,
          provider: "auto",
          sourceChainId: BRIDGE_SOLANA_CHAIN_ID,
          destinationChainId: destination.chainId,
          sourceAsset: { address: BRIDGE_SOLANA_USDC_MINT, symbol: "USDC", decimals: 6 },
          destinationAsset: { address: destination.assetAddress, symbol: destination.symbol, decimals: 6 },
          sourceWallet: target.walletAddress,
          destinationRecipient: input.destinationRecipient,
          amountIn: input.amountIn,
          minimumDestinationAmount: input.minimumDestinationAmount,
          maximumTotalFeeUsd: input.maximumTotalFeeUsd,
          deadline: new Date(createdAt.getTime() + 30 * 60_000).toISOString(),
          timeoutSeconds: 3_600,
          refundPolicy: "provider-cancel-only",
          createdAt: createdAt.toISOString(),
        },
      });
      await refreshEncryptedSessions(target.id);
    } finally {
      setPreparingBridgeIds((current) => current.filter((id) => id !== contractId));
    }
  }
   async function executeBridge(
    input: NonNullable<typeof bridgeExecutionApproval>,
    masterPassword: string,
  ): Promise<void> {
    await window.silfable.executeBridge({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: input.sessionId,
      contractId: input.proposal.contract.id,
      preflightId: input.preflight.id,
      masterPassword,
      confirmation: isControlledBridgeAcceptance(input.proposal)
        ? CONTROLLED_BRIDGE_ACCEPTANCE_CONFIRMATION
        : bridgeDestination(input.proposal.contract.destinationChainId).confirmation,
      acknowledgedOneAttemptBroadcast: true,
    });
    setBridgeExecutionApproval(null);
    await refreshEncryptedSessions(input.sessionId);
    setPortfolioRefresh((current) => current + 1);
  }
  async function reconcileBridge(target: SessionItem, receipt: BridgeReceipt): Promise<void> {
    setReconcilingBridgeIds((current) => [...new Set([...current, receipt.id])]);
    try {
      await window.silfable.reconcileBridge({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: target.id,
        receiptId: receipt.id,
      });
      await refreshEncryptedSessions(target.id);
      setPortfolioRefresh((current) => current + 1);
    } finally {
      setReconcilingBridgeIds((current) => current.filter((id) => id !== receipt.id));
    }
  }

  const activeSessionRef = useRef(active);
  useEffect(() => {
    activeSessionRef.current = active;
  }, [active]);
  
  const reconcileBridgeRef = useRef(reconcileBridge);
  useEffect(() => {
    reconcileBridgeRef.current = reconcileBridge;
  }, [reconcileBridge]);

  const reconcilingBridgeIdsRef = useRef(reconcilingBridgeIds);
  useEffect(() => {
    reconcilingBridgeIdsRef.current = reconcilingBridgeIds;
  }, [reconcilingBridgeIds]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentActive = activeSessionRef.current;
      if (!currentActive) return;

      const pendingReceipts = currentActive.history
        .map((item) => item.payload)
        .filter((p): p is BridgeReceipt => p.type === "bridge-receipt")
         .filter((receipt) =>
          [
            "source-submitted",
            "broadcast-unknown",
            "relay-pending",
            "refund-pending",
            "relay-fulfilled-unverified",
          ].includes(receipt.state),
        );

      for (const receipt of pendingReceipts) {
        if (!reconcilingBridgeIdsRef.current.includes(receipt.id)) {
          void reconcileBridgeRef.current(currentActive, receipt);
        }
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);
   async function confirmDeleteSession(): Promise<void> {
    if (!sessionToDelete) return;
    setDeletingSession(true);
    try {
      await window.silfable.deleteSession(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (activeId === sessionToDelete.id) {
        setActiveId(null);
      }
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setDeletingSession(false);
    }
  }
  function chooseFilter(filter: SessionFilter): void {
    setSessionFilter(filter);
    if (active && filter !== "all") {
      const visible = active.mode === filter && active.workspace !== "pump";
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
      const [solanaResponse, evmResponse] = await Promise.all([
        window.silfable.listWallets(),
        window.silfable.getRobinhoodWallet().catch(() => null),
      ]);
      setWallets(solanaResponse.wallets);
      if (evmResponse) setEvmWallets(evmResponse.wallets);
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
    walletScope?: SessionWalletScope;
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
      ...(input.walletScope ? { walletScope: input.walletScope } : {}),
      ...(input.walletScope === "evm" ? { evmChainKey: "robinhood" as const } : {}),
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
        ...(response.evmSwapProposal
          ? { evmSwapProposal: response.evmSwapProposal }
          : {}),
        ...(response.bridgeProposal && response.bridgePreflight
          ? {
              bridgeProposal: response.bridgeProposal,
              bridgePreflight: response.bridgePreflight,
            }
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
  async function prepareEvmSwap(input: {
    sessionId: string;
    messageId: string;
    proposal: EvmSwapProposal;
  }): Promise<void> {
    setPreparingEvmIds((current) => [...new Set([...current, input.proposal.id])]);
    try {
      const chainKey = input.proposal.chainKey;
      if (!chainKey) throw new Error("This EVM quote has no locked chain scope.");
      const result = await window.silfable.prepareEvmKyberSwap({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: input.sessionId,
        chainKey,
        quoteId: input.proposal.quoteId,
        walletAddress: input.proposal.walletAddress,
        slippageBps: input.proposal.slippageBps,
        acknowledgedSimulationOnly: true,
      });
      const preflight: EvmSwapPreflightEvidence = {
        ...result.preflight,
        maxGasCostWei: result.preflight.maximumNetworkFeeWei,
        expectedBuyAmount: result.preflight.expectedAmountOut,
        minimumBuyAmount: result.preflight.minimumAmountOut,
      };
 setSessions((current) =>
        current.map((session) => {
          if (session.id !== input.sessionId) return session;
          const next = {
            ...session,
            messages: session.messages.map((message) =>
              message.id === input.messageId
                ? { ...message, evmSwapPreflight: preflight }
                : message,
            ),
          };
          void persistSession(next);
          return next;
        }),
      );
    } catch (cause) {
      const errMsg = cause instanceof Error ? cause.message : "The EVM trade review could not be prepared safely. Verify the saved RPC, 0x key, official token contracts, liquidity, allowance, and gas policy.";
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== input.sessionId) return session;
          const next = {
            ...session,
            messages: session.messages.map((message) => {
              if (message.id !== input.messageId) return message;
              if (message.text.includes(errMsg)) return message;
              return {
                ...message,
                text: `${message.text.slice(0, 11_400)}\n\n${errMsg}`.slice(0, 12_000),
              };
            }),
          };
          void persistSession(next);
          return next;
        }),
      );
    } finally {
      setPreparingEvmIds((current) => current.filter((id) => id !== input.proposal.id));
    }
  }
  async function executeEvmAction(
    approval: NonNullable<typeof evmExecutionApproval>,
    credentials: { masterPassword: string; confirmation: string },
  ): Promise<void> {
    const expectedConfirmation = approval.action === "approval"
      ? "APPROVE EVM MAINNET"
      : "EXECUTE EVM MAINNET SWAP";
    if (credentials.confirmation.trim().toUpperCase() !== expectedConfirmation) return;
    setEvmExecutionApproval(null);
    setExecutingEvmIds((current) => [...new Set([...current, approval.proposal.id])]);
    try {
      const base = {
        schemaVersion: 1 as const,
        requestId: crypto.randomUUID(),
        sessionId: approval.sessionId,
        chainKey: approval.proposal.chainKey,
        walletAddress: approval.proposal.walletAddress,
        preflightId: approval.preflight.id,
        action: approval.action,
        masterPassword: credentials.masterPassword,
        confirmation: expectedConfirmation as "APPROVE EVM MAINNET" | "EXECUTE EVM MAINNET SWAP",
        acknowledgedIrreversible: true as const,
      };
      const result = await window.silfable.executeEvmKyberSwap(base);
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== approval.sessionId) return session;
          const next = {
            ...session,
            messages: session.messages.map((message) => {
              if (message.id !== approval.messageId) return message;
              const { evmSwapPreflight: _consumed, ...rest } = message;
              return {
                ...rest,
                evmExecutionReceipts: [
                  ...(message.evmExecutionReceipts ?? []),
                  result.receipt,
                ].slice(-4),
              };
            }),
          };
          void persistSession(next);
          return next;
        }),
      );
    } catch {
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== approval.sessionId) return session;
          const next = {
            ...session,
            messages: session.messages.map((message) =>
              message.id === approval.messageId
                ? {
                    ...message,
                    text: `${message.text.slice(0, 11_400)}\n\nThe ${approval.action} was not submitted. No success is assumed. Verify the release gate, password, preflight expiry, emergency stop, and gas policy.`.slice(0, 12_000),
                  }
                : message,
            ),
          };
          void persistSession(next);
          return next;
        }),
      );
    } finally {
    setExecutingEvmIds((current) => current.filter((id) => id !== approval.proposal.id));
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
  async function createPumpLaunchDraft(
    target: SessionItem,
    input: PumpLaunchDraftInput,
  ): Promise<void> {
    const response = await window.silfable.createPumpLaunchDraft({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      input,
    });
    const current = sessions.find((item) => item.id === target.id);
    if (current === undefined) throw new Error("Session is unavailable");
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      at: new Date().toISOString(),
      text: "Token Launch draft prepared for review. No metadata was uploaded and no Pump.fun transaction was created, signed, or broadcast.",
      pumpLaunchDraft: response.draft,
    };
    const next = { ...current, messages: [...current.messages, message] };
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    await persistSession(next);
  }
  async function openPumpLaunchOfficialCreate(
    target: SessionItem,
    draft: PumpLaunchDraft,
  ): Promise<void> {
    await window.silfable.openPumpLaunchOfficialCreate({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      draftId: draft.id,
    });
  }
  async function preflightPumpLaunch(target: SessionItem, launchDraft: PumpLaunchDraft): Promise<void> {
    const response = await window.silfable.preflightPumpLaunch({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      draftId: launchDraft.id,
      acknowledgedNoExecution: true,
    });
    const current = sessions.find((item) => item.id === target.id);
    if (current === undefined) throw new Error("Session is unavailable");
    const next = {
      ...current,
      messages: current.messages.map((message) => message.pumpLaunchDraft?.id === launchDraft.id
        ? { ...message, pumpLaunchPreflight: response.preflight }
        : message),
    };
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    await persistSession(next);
  }
  async function finalRevalidatePumpLaunch(
    target: SessionItem,
    launchDraft: PumpLaunchDraft,
    preflight: PumpLaunchPreflight,
  ): Promise<void> {
    const response = await window.silfable.finalRevalidatePumpLaunch({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      draftId: launchDraft.id,
      preflightId: preflight.id,
      acknowledgedNoExecution: true,
    });
    const current = sessions.find((item) => item.id === target.id);
    if (current === undefined) throw new Error("Session is unavailable");
    const next = {
      ...current,
      messages: current.messages.map((message) => message.pumpLaunchDraft?.id === launchDraft.id
        ? { ...message, pumpLaunchFinalRevalidation: response.revalidation }
        : message),
    };
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    await persistSession(next);
  }
  async function executePumpLaunch(
    target: SessionItem,
    launchDraft: PumpLaunchDraft,
    preflight: PumpLaunchPreflight,
    revalidation: PumpLaunchFinalRevalidation,
    credentials: { masterPassword: string },
  ): Promise<void> {
    const response = await window.silfable.executePumpLaunch({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      draftId: launchDraft.id,
      preflightId: preflight.id,
      revalidationId: revalidation.id,
      masterPassword: credentials.masterPassword,
      confirmation: "LAUNCH TOKEN MAINNET",
      acknowledgedIrreversibleLaunch: true,
    });
    const current = sessions.find((item) => item.id === target.id);
    if (current === undefined) throw new Error("Session is unavailable");
    const next = {
      ...current,
      messages: current.messages.map((message) => message.pumpLaunchDraft?.id === launchDraft.id
        ? { ...message, pumpLaunchExecution: response.execution }
        : message),
    };
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    await persistSession(next);
    setPortfolioRefresh((value) => value + 1);
  }
  async function verifyPumpLaunchExecution(
    target: SessionItem,
    launchDraft: PumpLaunchDraft,
    execution: PumpLaunchExecutionRecord,
  ): Promise<void> {
    const response = await window.silfable.verifyPumpLaunchExecution({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      sessionId: target.id,
      draftId: launchDraft.id,
      executionId: execution.id,
    });
    const current = sessions.find((item) => item.id === target.id);
    if (current === undefined) throw new Error("Session is unavailable");
    const next = {
      ...current,
      messages: current.messages.map((message) => message.pumpLaunchDraft?.id === launchDraft.id
        ? { ...message, pumpLaunchExecution: response.execution }
        : message),
    };
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    await persistSession(next);
    if (response.execution.status === "finalized") {
      setPortfolioRefresh((value) => value + 1);
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
        sessionId: input.sessionId,
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
        <button
          className="railBrand"
          type="button"
          aria-label="Return to Silfable home"
          title="Return to home"
          onClick={() => {
            setActiveId(null);
            setNav("sessions");
          }}
        >
          <BrandMark />
          <span>Silfable</span>
        </button>
        <Button
          className="newSession"
          size="lg"
          fullWidth
          icon={<CirclePlus className="size-4" />}
          onClick={() => void requestSession()}
        >
          New session
        </Button>
        <div className="sessionFilters">
          <Button
            variant="ghost"
            size="sm"
            className={sessionFilter === "all" ? "active" : ""}
            onClick={() => chooseFilter("all")}
          >
            All
          </Button>
           <Button
            variant="ghost"
            size="sm"
            className={sessionFilter === "agent" ? "active" : ""}
            onClick={() => chooseFilter("agent")}
          >
            Agent
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={sessionFilter === "mission" ? "active" : ""}
            onClick={() => chooseFilter("mission")}
          >
            Mission
          </Button>
        </div>
        <div className="sessionList">
          <p>Sessions</p>
          {sessionsState === "error" ? (
            <div className="emptySessions sessionLoadError" role="status">
              <strong>Session history is unavailable</strong>
              <span>Your encrypted records were not deleted.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshEncryptedSessions().catch(() => undefined)}
              >
                Retry
              </Button>
            </div>
            ) : sessionsState === "loading" ? (
            <div className="emptySessions">Loading encrypted sessions…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="emptySessions">
              No {sessionFilter === "all" ? "" : `${sessionFilter} `}sessions
              yet.
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                className="sessionItemWrapper"
                key={session.id}
              >
                <button
                  className={`sessionButton ${session.id === activeId ? "active" : ""}`}
                  onClick={() => {
                    setActiveId(session.id);
                    setNav("sessions");
                  }}
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
                      {sessionIntentLabel(session)} ·{" "}
                      {session.permission}
                    </small>
                  </div>
                </button>
                <button
                  className="deleteSessionButton"
                  title="Delete session"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(session);
                  }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <nav className="bottomNav">
          <Button
            variant="ghost"
            icon={<Target className="size-4" />}
            className={nav === "missions" ? "active" : ""}
            onClick={() => setNav("missions")}
          >
            Missions
          </Button>
          <Button
            variant="ghost"
            icon={<Bot className="size-4" />}
            className={nav === "automation" ? "active" : ""}
            onClick={() => setNav("automation")}
          >
            Automation
          </Button>
          <Button
            variant="ghost"
            icon={<Settings className="size-4" />}
            onClick={() => {
              saveSetup({ ...setup, step: 6 });
              setSettingsOpen(true);
            }}
          >
            Settings
          </Button>
        </nav>
        <div className="runtimeBadge">
          <span /> Mainnet guarded · {runtime ? "ready" : "checking"}
        </div>
      </aside>
     <section className="centerStage">
        {nav === "automation" ? (
          <AutomationPanel sessionId={active?.id} onReloadSessions={() => refreshEncryptedSessions(active?.id)} />
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
            onCreatePumpLaunchDraft={(input) => createPumpLaunchDraft(active, input)}
            onOpenPumpLaunchOfficialCreate={(launchDraft) => openPumpLaunchOfficialCreate(active, launchDraft)}
            onPreflightPumpLaunch={(launchDraft) => preflightPumpLaunch(active, launchDraft)}
            onFinalRevalidatePumpLaunch={(launchDraft, preflight) => finalRevalidatePumpLaunch(active, launchDraft, preflight)}
            onExecutePumpLaunch={(launchDraft, preflight, revalidation, credentials) => executePumpLaunch(active, launchDraft, preflight, revalidation, credentials)}
            onVerifyPumpLaunchExecution={(launchDraft, execution) => verifyPumpLaunchExecution(active, launchDraft, execution)}
            onPrepareBridge={(input) => prepareBridge(active, input)}
            preparingBridge={preparingBridgeIds.length > 0}
            reconcilingBridgeIds={reconcilingBridgeIds}
            onRequestBridgeExecution={(proposal, preflight) => setBridgeExecutionApproval({
              sessionId: active.id,
              proposal,
              preflight,
            })}
            onReconcileBridge={(receipt) => void reconcileBridge(active, receipt)}
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
            preparingEvmIds={preparingEvmIds}
            executingEvmIds={executingEvmIds}
            evmExecutionEnabled={evmExecutionEnabled}
            evmExecutionMissing={evmExecutionMissing}
            onPrepareEvmSwap={(messageId, proposal) =>
              void prepareEvmSwap({
                sessionId: active.id,
                messageId,
                proposal,
              })
            }
            onRequestEvmExecution={(messageId, proposal, preflight) =>
              setEvmExecutionApproval({
                sessionId: active.id,
                messageId,
                proposal,
                preflight,
                action: preflight.allowanceRequired ? "approval" : "swap",
              })
            }
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
        contextLimit={setup.contextLimit}
        outputLimit={setup.outputLimit}
        wallets={wallets}
        evmWallets={evmWallets}
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
        onReloadSessions={() => refreshEncryptedSessions(active?.id)}
      />
     {modalOpen && (
        <SessionModal
          prompt={pendingPrompt}
          wallets={wallets}
          evmWallets={evmWallets}
          onCancel={() => setModalOpen(false)}
          onCreate={(value) => void createSession(value)}
        />
      )}
       {sessionToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setSessionToDelete(null)}
          title="Delete session"
        >
          <div className="deleteSessionModalContent">
            <p>
              Are you sure you want to delete <strong>"{sessionToDelete.title}"</strong>?
            </p>
            <p className="deleteSessionWarning">
              All messages and history associated with this session will be permanently removed.
            </p>
            <div className="modalFooterActions">
              <Button
                variant="ghost"
                onClick={() => setSessionToDelete(null)}
                disabled={deletingSession}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deletingSession}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await confirmDeleteSession();
                }}
              >
                Delete session
              </Button>
            </div>
          </div>
        </Modal>
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
      {evmExecutionApproval && (
        <EvmExecutionApprovalModal
          action={evmExecutionApproval.action}
          proposal={evmExecutionApproval.proposal}
          preflight={evmExecutionApproval.preflight}
          onCancel={() => setEvmExecutionApproval(null)}
          onConfirm={(credentials) =>
            executeEvmAction(evmExecutionApproval, credentials)
          }
        />
      )}
       {bridgeExecutionApproval && (
        <BridgeExecutionApprovalModal
          proposal={bridgeExecutionApproval.proposal}
          preflight={bridgeExecutionApproval.preflight}
          onCancel={() => setBridgeExecutionApproval(null)}
          onConfirm={(password) => executeBridge(bridgeExecutionApproval, password)}
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
        <Button variant="outline" size="sm" icon={<Activity className="size-3.5" />}
          onClick={() =>
            setDraft(
              "Explain exactly what you can and cannot do in this desktop application.",
            )
          }
        >
          AI capabilities
        </Button>
        <Button variant="outline" size="sm" icon={<Brain className="size-3.5" />}
          onClick={() =>
            setDraft(
              "Review my configured wallet balances and recent finalized activity.",
            )
          }
        >
          Wallet activity
        </Button>
         <Button variant="outline" size="sm" icon={<Target className="size-3.5" />}
          onClick={() =>
            setDraft(
              "Draft a conservative SOL accumulation mission with explicit limits.",
            )
          }
        >
          Plan a mission
        </Button>
        <Button variant="outline" size="sm" icon={<ShieldCheck className="size-3.5" />}
          onClick={() =>
            setDraft("Explain the current Mainnet execution restrictions.")
          }
        >
          Runtime safety
        </Button>
      </div>
    </div>
  );
}

function Conversation({
  session,
  draft,
  setDraft,
  onSend,
  onCreatePumpLaunchDraft,
  onOpenPumpLaunchOfficialCreate,
  onPreflightPumpLaunch,
  onFinalRevalidatePumpLaunch,
  onExecutePumpLaunch,
  onVerifyPumpLaunchExecution,
  onPrepareBridge,
  preparingBridge,
  reconcilingBridgeIds,
  onRequestBridgeExecution,
  onReconcileBridge,
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
  onPrepareEvmSwap,
  onRequestEvmExecution,
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
  onCreatePumpLaunchDraft: (input: PumpLaunchDraftInput) => Promise<void>;
  onOpenPumpLaunchOfficialCreate: (draft: PumpLaunchDraft) => Promise<void>;
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
  onPrepareEvmSwap: (messageId: string, proposal: EvmSwapProposal) => void;
  onRequestEvmExecution: (
    messageId: string,
    proposal: EvmSwapProposal,
    preflight: EvmSwapPreflightEvidence,
  ) => void;
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
     <div className={`conversation${session.walletScope === "solana" && session.walletAddress !== null ? " conversationWithLaunch" : ""}`}>
      <header>
        <div>
          <span className="liveDot" />{" "}
          {session.workspace === "pump"
            ? "Pump.fun · manual restricted"
            : session.walletScope === "solana"
              ? session.mode === "mission"
                ? "Solana workspace · mission"
                : "Solana workspace · agent"
              : session.walletScope === "evm"
                ? session.mode === "mission"
                  ? "EVM workspace · restricted mission"
                  : "EVM workspace · restricted agent"
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
        <StatusPill tone="warning">Restricted</StatusPill>
      </header>
        {session.walletScope === "solana" && session.walletAddress !== null && (
        <div className="conversationLaunchBar">
          <PumpLaunchDraftForm
            creatorWallet={session.walletAddress}
            onCreate={onCreatePumpLaunchDraft}
          />
        </div>
      )}
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
              {message.evmSwapProposal && (
                <EvmSwapProposalCard
                  proposal={message.evmSwapProposal}
                  preflight={message.evmSwapPreflight ?? null}
                  receipts={message.evmExecutionReceipts ?? []}
                  preparing={preparingEvmIds.includes(message.evmSwapProposal.id)}
                  executing={executingEvmIds.includes(message.evmSwapProposal.id)}
                  executionEnabled={evmExecutionEnabled}
                  executionMissing={evmExecutionMissing}
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
                onOpenOfficialCreate={onOpenPumpLaunchOfficialCreate}
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
              {message.role === "assistant" && (
                <div className="evidenceTag">
                  {message.pumpExecution
                    ? `Pump Mainnet execution: ${message.pumpExecution.status}`
                    : message.evmExecutionReceipts?.length
                      ? `EVM Mainnet execution: ${message.evmExecutionReceipts.at(-1)!.kind} ${message.evmExecutionReceipts.at(-1)!.status}`
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
        {session.walletScope === "solana" && session.walletAddress !== null && (
          <>
            {session.mode === "mission" && (
              <BridgePreparationForm busy={preparingBridge} onPrepare={onPrepareBridge} />
            )}
          </>
        )}
        {session.walletScope === "evm" && session.walletAddress !== null && session.evmChainKey && session.evmChainKey !== "bsc" && (
          <EvmBridgeWorkspace
            sessionId={session.id}
            sourceChainKey={session.evmChainKey}
            sourceWallet={session.walletAddress}
          />
        )}
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

type EvmBridgeDestinationSelection = "solana" | EvmBridgeChainKey;

function EvmBridgeWorkspace({
  sessionId,
  sourceChainKey,
  sourceWallet,
}: {
  sessionId: string;
  sourceChainKey: EvmBridgeChainKey;
  sourceWallet: string;
}) {
  const source = EVM_BRIDGE_ASSETS[sourceChainKey];
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<EvmBridgeDestinationSelection>("solana");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [minimum, setMinimum] = useState("0.90");
  const [maximumTotalFeeUsd, setMaximumTotalFeeUsd] = useState("3.00");
  const [maximumNetworkFeeWei, setMaximumNetworkFeeWei] = useState("10000000000000000");
  const [prepared, setPrepared] = useState<{ quote: EvmBridgeQuote; preflight: EvmBridgePreflight } | null>(null);
  const [receipt, setReceipt] = useState<EvmBridgeReceipt | null>(null);
  const [approval, setApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void window.silfable.listEvmBridgeReceipts().then((response) => {
      if (!live) return;
      const latest = response.receipts
        .filter((item) => item.sourceWallet.toLowerCase() === sourceWallet.toLowerCase())
        .sort((a, b) => Date.parse(b.reconciledAt) - Date.parse(a.reconciledAt))[0] ?? null;
      setReceipt(latest);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [sourceWallet]);

 function toRaw(value: string): string | null {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(value)) return null;
    const [whole = "0", fraction = ""] = value.split(".");
    const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    return raw > 0n ? raw.toString() : null;
  }

  async function prepare(): Promise<void> {
    const amountIn = toRaw(amount);
    const minimumDestinationAmount = toRaw(minimum);
    const maximumFee = Number(maximumTotalFeeUsd);
    if (amountIn === null || minimumDestinationAmount === null || BigInt(minimumDestinationAmount) > BigInt(amountIn)) {
      setError("Enter valid six-decimal stablecoin amounts; the minimum output cannot exceed the source amount.");
      return;
    }
    if (!/^\d+$/u.test(maximumNetworkFeeWei) || BigInt(maximumNetworkFeeWei) === 0n) {
      setError("Maximum source network fee must be a positive raw wei amount.");
      return;
    }
    if (!Number.isFinite(maximumFee) || maximumFee <= 0 || maximumFee > 1_000) {
      setError("Maximum provider fee must be between $0 and $1,000.");
      return;
    }
    const recipientValid = destination === "solana"
      ? SOLANA_ADDRESS_PATTERN.test(recipient)
      : /^0x[a-fA-F0-9]{40}$/u.test(recipient);
    if (!recipientValid) {
      setError(destination === "solana" ? "Enter the exact destination Solana address." : "Enter the exact destination EVM address.");
      return;
    }
    const now = new Date();
    const destinationAsset = destination === "solana" ? null : EVM_BRIDGE_ASSETS[destination];
    const contract: EvmBridgeContract = {
      id: crypto.randomUUID(), provider: "relay",
      sourceChainId: source.chainId as EvmBridgeContract["sourceChainId"],
      sourceChainKey, sourceAssetAddress: source.address, sourceAssetSymbol: source.symbol,
      sourceAssetDecimals: 6, sourceWallet,
      destination: destination === "solana"
       ? {
            kind: "solana", chainId: BRIDGE_SOLANA_CHAIN_ID, chainKey: "solana",
            assetAddress: BRIDGE_SOLANA_USDC_MINT, assetSymbol: "USDC", assetDecimals: 6,
            recipient,
          }
        : {
            kind: "evm", chainId: destinationAsset!.chainId as Extract<EvmBridgeContract["destination"], { kind: "evm" }>["chainId"],
            chainKey: destination, assetAddress: destinationAsset!.address,
            assetSymbol: destinationAsset!.symbol, assetDecimals: 6, recipient,
          },
      amountIn, minimumDestinationAmount, maximumNetworkFeeWei,
      maximumTotalFeeUsd: maximumFee, slippageBps: 50,
      deadline: new Date(now.getTime() + 20 * 60_000).toISOString(),
      timeoutSeconds: 3_600, refundPolicy: "relay-origin-refund", createdAt: now.toISOString(),
    };
    setBusy(true);
    setError(null);
    setPrepared(null);
    try {
      const result = await window.silfable.prepareEvmBridge({
        schemaVersion: 1, requestId: crypto.randomUUID(), sessionId, contract,
        acknowledgedSimulationOnly: true,
      });
      setPrepared({ quote: result.quote, preflight: result.preflight });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The EVM bridge review was blocked safely.");
    } finally {
      setBusy(false);
    }
  }

   async function execute(credentials: { masterPassword: string; confirmation: string }): Promise<void> {
    if (prepared === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.silfable.executeEvmBridge({
        schemaVersion: 1, requestId: crypto.randomUUID(), sessionId,
        preflightId: prepared.preflight.id, action: prepared.preflight.action,
        masterPassword: credentials.masterPassword,
        confirmation: credentials.confirmation as "APPROVE BRIDGE TOKEN" | "EXECUTE EVM BRIDGE MAINNET",
        acknowledgedIrreversible: true,
      });
      setReceipt(result.receipt);
      setPrepared(null);
      setApproval(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The EVM bridge source transaction was not submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(): Promise<void> {
    if (receipt === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.silfable.reconcileEvmBridge({
        schemaVersion: 1, requestId: crypto.randomUUID(), receiptId: receipt.id,
      });
      setReceipt(result.receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cross-chain settlement could not be verified yet.");
    } finally {
      setBusy(false);
    }
  }

  return null;
}

function BridgePreparationForm({
  busy,
  onPrepare,
}: {
  busy: boolean;
  onPrepare: (input: {
    destinationChain: BridgeDestinationChain;
    destinationRecipient: string;
    amountIn: string;
    minimumDestinationAmount: string;
    maximumTotalFeeUsd: number;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [destinationChain, setDestinationChain] = useState<BridgeDestinationChain>("base");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1.00");
  // Small cross-chain transfers can have a meaningful fixed relayer cost. This is
  // deliberately a quote-discovery floor only; execution still needs its own review.
  const [minimum, setMinimum] = useState("0.50");
  const [maxFee, setMaxFee] = useState("0.25");
  const [error, setError] = useState<string | null>(null);
  function toRaw(value: string): string | null {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(value)) return null;
    const [whole, fraction = ""] = value.split(".");
    const raw = BigInt(whole ?? "0") * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    return raw > 0n ? raw.toString() : null;
  }
  async function submit(): Promise<void> {
    const amountIn = toRaw(amount);
    const minimumDestinationAmount = toRaw(minimum);
    const maximumTotalFeeUsd = Number(maxFee);
    if (!/^0x[a-fA-F0-9]{40}$/u.test(recipient)) {
      setError(`Enter the exact ${BRIDGE_DESTINATIONS[destinationChain].label} recipient address (0x + 40 hexadecimal characters).`);
      return;
    }
     if (amountIn === null || minimumDestinationAmount === null || BigInt(minimumDestinationAmount) > BigInt(amountIn)) {
      setError("Enter valid USDC amounts; the minimum destination amount cannot exceed the source amount.");
      return;
    }
    if (!Number.isFinite(maximumTotalFeeUsd) || maximumTotalFeeUsd <= 0 || maximumTotalFeeUsd > 1_000) {
      setError("Enter a positive maximum total fee in USD.");
      return;
    }
    setError(null);
    try {
      await onPrepare({ destinationChain, destinationRecipient: recipient, amountIn, minimumDestinationAmount, maximumTotalFeeUsd });
      setOpen(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Bridge preflight failed safely.";
      if (/route output is below the contract minimum|quote is below the minimum destination amount/iu.test(message)) {
        const destinationSymbol = BRIDGE_DESTINATIONS[destinationChain].symbol;
        const quote = /provider quote:\s*(\d+)\s*raw (?:USDC|USDG)/iu.exec(message)?.[1];
        const floor = /requested minimum:\s*(\d+)\s*raw (?:USDC|USDG)/iu.exec(message)?.[1];
        const quoteText = quote === undefined ? "" : ` Provider quote: ${(Number(quote) / 1_000_000).toFixed(6)} ${destinationSymbol}.`;
        const floorText = floor === undefined ? "" : ` Your floor: ${(Number(floor) / 1_000_000).toFixed(6)} ${destinationSymbol}.`;
        setError(
          `The quoted route would deliver less than your Minimum on ${BRIDGE_DESTINATIONS[destinationChain].label} floor.${quoteText}${floorText} No transaction was created, signed, or broadcast. Lower the floor only if that quoted output is acceptable, or increase the source amount and request a fresh quote.`,
        );
      } else if (/total fee.*maximum|fee.*exceed/iu.test(message)) {
        const estimated = /estimated total:\s*\$([\d.]+)/iu.exec(message)?.[1];
        const maximum = /maximum:\s*\$([\d.]+)/iu.exec(message)?.[1];
        const estimateText = estimated === undefined ? "" : ` Provider estimate: $${estimated}.`;
        const maximumText = maximum === undefined ? "" : ` Your limit: $${maximum}.`;
        setError(
          `The quoted provider cost exceeds your Maximum total fee limit.${estimateText}${maximumText} No transaction was created, signed, or broadcast. Review the quoted cost before changing the limit.`,
        );
      } else if (/USDC balance does not cover the bridge amount/iu.test(message)) {
        const available = /available:\s*(\d+)\s*raw USDC/iu.exec(message)?.[1];
        const requested = /requested:\s*(\d+)\s*raw USDC/iu.exec(message)?.[1];
        const availableText = available === undefined ? "" : ` Available: ${(Number(available) / 1_000_000).toFixed(6)} USDC.`;
        const requestedText = requested === undefined ? "" : ` Requested: ${(Number(requested) / 1_000_000).toFixed(6)} USDC.`;
        setError(
          `The finalized source-wallet USDC balance is insufficient.${availableText}${requestedText} No quote, signature, or broadcast was attempted.`,
        );
      } else {
        setError(message);
      }
    }
  }
  return null;
}

function BridgeProposalCard({
  proposal,
  preflight,
  receipt,
  reconciling,
  onExecute,
  onReconcile,
}: {
  proposal: BridgeProposal;
  preflight: BridgePreflightEvidence;
  receipt: BridgeReceipt | null;
  reconciling: boolean;
  onExecute: () => void;
  onReconcile?: () => void;
}) {
  const formatAsset = (raw: string, symbol: "USDC" | "USDG") => `${(Number(raw) / 1_000_000).toFixed(6)} ${symbol}`;
  const destination = bridgeDestination(proposal.contract.destinationChainId);
  const providerLabel = proposal.quote.provider === "relay" ? "Relay" : "deBridge DLN";
  const terminal = receipt?.state === "destination-confirmed" || receipt?.state === "refunded" || receipt?.state === "source-failed" || receipt?.state === "destination-failed";
  return (
    <section className="bridgeProposalCard">
      <header><div><span className="kicker">Bridge contract · {providerLabel}</span><h3>Solana USDC → {destination.label} {destination.symbol}</h3></div><StatusPill tone={receipt?.state === "destination-confirmed" ? "success" : "warning"}>{receipt?.state ?? "simulated"}</StatusPill></header>
      <dl className="bridgeEvidenceGrid">
        <div><dt>Source wallet</dt><dd>{shorten(proposal.contract.sourceWallet)}</dd></div>
        <div><dt>{destination.label} recipient</dt><dd>{shorten(proposal.contract.destinationRecipient)}</dd></div>
        <div><dt>Source amount</dt><dd>{formatAsset(proposal.contract.amountIn, "USDC")}</dd></div>
        <div><dt>Expected on {destination.label}</dt><dd>{formatAsset(proposal.quote.estimatedDestinationAmount, destination.symbol)}</dd></div>
        <div><dt>Minimum on {destination.label}</dt><dd>{formatAsset(proposal.contract.minimumDestinationAmount, destination.symbol)}</dd></div>
        <div><dt>Total provider fee</dt><dd>${proposal.quote.fee.totalFeeUsd.toFixed(4)}</dd></div>
        <div><dt>Solana network fee</dt><dd>{preflight.sourceNetworkFeeLamports.toLocaleString()} lamports</dd></div>
        <div><dt>Quote expiry</dt><dd>{new Date(preflight.expiresAt).toLocaleTimeString()}</dd></div>
      </dl>
      <p className="bridgeSafetyCopy">Order <code>{proposal.quote.orderId}</code> · {preflight.programIds.length} allowlisted Solana programs · unsigned simulation passed.</p>
      {receipt && <div className="bridgeReceiptPanel">
        <strong>Encrypted cross-chain receipt</strong>
        <span>Source signature: {shorten(receipt.sourceSignature)}</span>
        <span>Provider: {receipt.providerStatus ?? "pending"}</span>
        <span>Destination tx: {receipt.destinationTransactionHash ? shorten(receipt.destinationTransactionHash) : receipt.state === "relay-fulfilled-unverified" ? "not supplied by provider" : "pending"}</span>
        <span>Actual destination: {receipt.actualDestinationAmount === null ? "pending" : formatAsset(receipt.actualDestinationAmount, destination.symbol)}</span>
        {receipt.lastError && <span className="executionError">{receipt.lastError}</span>}
        <div className="receiptActions" style={{ marginTop: "8px" }}>
          <button onClick={() => void window.silfable.copyTransactionSignature({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            signature: receipt.sourceSignature,
          })}>Copy signature</button>
          <button onClick={() => void window.silfable.openTransactionInExplorer({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            signature: receipt.sourceSignature,
          })}>Open Solana Explorer</button>
        </div>
      </div>}
      <footer>
        {!receipt && <button className="dangerButton" onClick={onExecute}>Final Mainnet approval</button>}
        {receipt && !terminal && onReconcile && <button disabled={reconciling} onClick={onReconcile}>{reconciling ? `Checking source, relay & ${destination.label}…` : "Reconcile cross-chain status"}</button>}
      </footer>
    </section>
  );
}

function formatEvmTokenAmount(rawAmount: string | null | undefined, symbol: string): string {
  if (!rawAmount || rawAmount === "Unavailable") return "Unavailable";
  try {
    const bi = BigInt(rawAmount);
    const isEth = symbol === "ETH" || symbol === "WETH";
    const decimals = isEth ? 18 : 6;
    const val = Number(bi) / (10 ** decimals);
    if (val === 0 && bi > 0n) return `${bi} wei`;
    return `${val.toLocaleString("en-US", { maximumFractionDigits: isEth ? 8 : 4 })} ${symbol}`;
  } catch {
    return `${rawAmount} ${symbol}`;
  }
}

function formatWeiToGweiOrEth(weiAmount: string | null | undefined): string {
  if (!weiAmount) return "0 wei";
  try {
    const bi = BigInt(weiAmount);
    const ethVal = Number(bi) / 1e18;
    if (ethVal >= 0.0001) return `${ethVal.toFixed(6)} ETH`;
    const gweiVal = Number(bi) / 1e9;
    return `${gweiVal.toFixed(2)} Gwei (${weiAmount} wei)`;
  } catch {
    return `${weiAmount} wei`;
  }
}

function EvmSwapProposalCard({
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

function PumpLaunchDraftForm({
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

function PumpLaunchDraftCard({
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
  const hasProposal = Boolean(
    message.missionPreview ||
    message.evmSwapProposal ||
    message.bridgeProposal ||
    message.pumpTradePreview ||
    message.limitOrderPreview
  );

  const [isFinished, setIsFinished] = useState(hasProposal);
  const [length, setLength] = useState(hasProposal ? (message.text?.length ?? 0) : 0);
  const completedRef = useRef(hasProposal);

  useEffect(() => {
    if (hasProposal || completedRef.current) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }

    if (!message.text || message.text.length <= 10) {
      setIsFinished(true);
      setLength(message.text?.length ?? 0);
      completedRef.current = true;
      onComplete();
      return;
    }
    
    setLength(0);
    const textLen = message.text.length;
    const increment = Math.max(10, Math.ceil(textLen / 20));

    const timer = window.setInterval(() => {
      setLength((current) => {
        const next = Math.min(textLen, current + increment);
        if (next >= textLen) {
          window.clearInterval(timer);
          return textLen;
        }
        return next;
      });
    }, 40);

    return () => {
      window.clearInterval(timer);
    };
  }, [message.id, hasProposal]);

  useEffect(() => {
    if (length >= (message.text?.length ?? 0) && !completedRef.current) {
      completedRef.current = true;
      setIsFinished(true);
      onComplete();
    }
  }, [length, message.text, onComplete]);

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

function EvmBridgeExecutionApprovalModal({
 preflight,
  quote,
  onCancel,
  onConfirm,
}: {
  preflight: EvmBridgePreflight;
  quote: EvmBridgeQuote;
  onCancel: () => void;
  onConfirm: (credentials: { masterPassword: string; confirmation: string }) => Promise<void>;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const required = preflight.action === "approval" ? "APPROVE BRIDGE TOKEN" : "EXECUTE EVM BRIDGE MAINNET";
  const ready = masterPassword.length >= 8 && confirmation === required && acknowledged;
  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try { await onConfirm({ masterPassword, confirmation }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The EVM Bridge transaction was blocked."); }
    finally { setBusy(false); }
  }
   return (
    <div className="modalBackdrop" role="presentation">
      <section className="simulationApproval executionApproval" role="dialog" aria-modal="true" aria-labelledby="evm-bridge-approval-title">
        <p className="kicker">Final EVM Bridge Mainnet authorization</p>
        <h2 id="evm-bridge-approval-title">{preflight.action === "approval" ? "Approve the exact bridge token scope?" : "Submit this exact cross-chain deposit?"}</h2>
        <p>{preflight.action === "approval" ? "This approval is a separate EVM transaction and does not move funds across chains. After confirmation, request a fresh quote for the deposit." : "This signs and broadcasts one source-chain deposit. Destination settlement remains asynchronous and must be reconciled independently."}</p>
        <dl>
          <div><dt>Source wallet</dt><dd>{preflight.walletAddress}</dd></div>
          <div><dt>Action</dt><dd>{preflight.action}</dd></div>
          <div><dt>Raw input</dt><dd>{quote.amountIn}</dd></div>
          <div><dt>Minimum destination</dt><dd>{quote.minimumDestinationAmount}</dd></div>
          <div><dt>Provider fee</dt><dd>${quote.totalFeeUsd.toFixed(4)}</dd></div>
          <div><dt>Maximum gas</dt><dd>{preflight.maximumNetworkFeeWei} wei</dd></div>
          <div><dt>Digest</dt><dd>{preflight.transactionDigest.slice(0, 24)}…</dd></div>
          <div><dt>Expires</dt><dd>{new Date(preflight.expiresAt).toLocaleString()}</dd></div>
        </dl>
        <Notice tone="danger" title={preflight.action === "approval" ? "Real token approval" : "Irreversible source broadcast"}>
          Verify the source chain, wallet, recipient, amount, minimum output, and fee limits. Never retry an unknown broadcast without reconciling the stored hash.
        </Notice>
        <Field label="Master password"><input type="password" autoComplete="current-password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} /></Field>
        <Field label={`Type "${required}"`}><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
        <label className="riskCheck"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I authorize this exact EVM Mainnet action and understand its cross-chain risks.</span></label>
        {error && <p className="executionError">{error}</p>}
        <footer><button disabled={busy} onClick={onCancel}>Cancel</button><button className="dangerButton" disabled={!ready || busy} onClick={() => void submit()}>{busy ? "Signing and submitting once…" : preflight.action === "approval" ? "Approve exact scope" : "Submit bridge deposit"}</button></footer>
           </section>
    </div>
  );
}

function EvmExecutionApprovalModal({
  action,
  proposal,
  preflight,
  onCancel,
  onConfirm,
}: {
  action: "approval" | "swap";
  proposal: EvmSwapProposal;
  preflight: EvmSwapPreflightEvidence;
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
  const expectedConfirmation = action === "approval"
    ? "APPROVE EVM MAINNET"
    : "EXECUTE EVM MAINNET SWAP";
  const isPasswordEntered = masterPassword.trim().length > 0;
  const isConfirmationMatched = confirmation.trim().toUpperCase() === expectedConfirmation.toUpperCase();
  const ready = isPasswordEntered && isConfirmationMatched && acknowledged;
  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ masterPassword, confirmation: expectedConfirmation });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The EVM ${action} was not submitted.`,
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
        aria-labelledby="evm-execution-approval-title"
      >
        <p className="kicker">Final EVM Mainnet authorization</p>
        <h2 id="evm-execution-approval-title">
          {action === "approval" ? "Approve this exact token amount" : "Execute this exact EVM swap"}
        </h2>
        <p>
          {action === "approval"
            ? "This is a separate ERC-20 approval transaction. A confirmed approval does not execute the swap; a fresh trade review is required afterward."
             : `The exact ${proposal.quote.provider === "uniswap" ? "Uniswap" : "KyberSwap"} transaction will be signed locally and submitted once. An unknown broadcast must be reconciled before any retry.`}
        </p>
        <dl>
          <div><dt>Wallet</dt><dd>{shorten(proposal.walletAddress)}</dd></div>
          <div><dt>Pair</dt><dd>{proposal.quote.sellTokenSymbol} → {proposal.quote.buyTokenSymbol}</dd></div>
          <div><dt>Sell amount</dt><dd>{formatEvmTokenAmount(proposal.quote.sellAmount, proposal.quote.sellTokenSymbol)}</dd></div>
          <div><dt>Expected output</dt><dd>{formatEvmTokenAmount(preflight.expectedBuyAmount, proposal.quote.buyTokenSymbol)}</dd></div>
          <div><dt>Minimum output</dt><dd>{formatEvmTokenAmount(preflight.minimumBuyAmount, proposal.quote.buyTokenSymbol)}</dd></div>
          <div><dt>Maximum gas</dt><dd>{formatWeiToGweiOrEth(preflight.maxGasCostWei)}</dd></div>
          <div><dt>Preflight expiry</dt><dd>{new Date(preflight.expiresAt).toLocaleTimeString()}</dd></div>
        </dl>
        <Notice tone="danger" title="Irreversible Mainnet transaction">
          Verify the wallet, exact token contracts, amount, minimum output,
          and gas ceiling before continuing.
        </Notice>
        <Field label="Master password">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter your master password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
          />
        </Field>
        <Field label={`Type "${expectedConfirmation}"`}>
          <input
            placeholder={`Type: ${expectedConfirmation}`}
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
        </label>

        {error && <p className="executionError">{error}</p>}
        <footer style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: "10px 20px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              color: "#cbd5e1",
              fontSize: "13px",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void submit()}
            style={{
              padding: "11px 24px",
              background: ready && !busy
                ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                : "rgba(30, 41, 59, 0.7)",
              border: ready && !busy
                ? "1px solid #60a5fa"
                : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: ready && !busy ? "#ffffff" : "rgba(255, 255, 255, 0.35)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.03em",
              cursor: ready && !busy ? "pointer" : "not-allowed",
              boxShadow: ready && !busy ? "0 4px 14px rgba(37, 99, 235, 0.4)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {busy
              ? "Signing and submitting…"
              : action === "approval"
                ? "Approve Exact Amount"
                : "Execute Real Swap"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function BridgeExecutionApprovalModal({
  proposal,
  preflight,
  onCancel,
  onConfirm,
}: {
  proposal: BridgeProposal;
  preflight: BridgePreflightEvidence;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destination = bridgeDestination(proposal.contract.destinationChainId);
  const controlledAcceptance = isControlledBridgeAcceptance(proposal);
  const confirmationPhrase = controlledAcceptance
    ? CONTROLLED_BRIDGE_ACCEPTANCE_CONFIRMATION
    : destination.confirmation;
  const ready = masterPassword.length > 0 && confirmation === confirmationPhrase && acknowledged;
  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try { await onConfirm(masterPassword); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Bridge execution was not started."); }
    finally { setBusy(false); }
  }
   return (
    <div className="modalBackdrop" role="presentation">
      <section className="simulationApproval executionApproval" role="dialog" aria-modal="true" aria-labelledby="bridge-approval-title">
        <p className="kicker">{controlledAcceptance ? "Controlled Bridge Acceptance" : "Final cross-chain Mainnet authorization"}</p>
        <h2 id="bridge-approval-title">{controlledAcceptance ? "Run the 1 USDC Robinhood acceptance test?" : `Bridge real USDC to ${destination.label}?`}</h2>
          <p>The exact {proposal.quote.provider === "relay" ? "Relay" : "deBridge"} source transaction that passed simulation will be signed locally and submitted once. Settlement on {destination.label} is asynchronous.</p>
        <dl>
          <div><dt>Source</dt><dd>Solana USDC</dd></div>
            <div><dt>Destination</dt><dd>{destination.label} {destination.symbol}</dd></div>
          <div><dt>Source wallet</dt><dd>{proposal.contract.sourceWallet}</dd></div>
          <div><dt>{destination.label} recipient</dt><dd>{proposal.contract.destinationRecipient}</dd></div>
          <div><dt>Raw source amount</dt><dd>{proposal.contract.amountIn}</dd></div>
          <div><dt>Minimum destination</dt><dd>{proposal.contract.minimumDestinationAmount}</dd></div>
          <div><dt>Provider order</dt><dd>{shorten(proposal.quote.orderId)}</dd></div>
          <div><dt>Solana network fee</dt><dd>{preflight.sourceNetworkFeeLamports} lamports</dd></div>
          <div><dt>Approval expiry</dt><dd>{new Date(preflight.expiresAt).toLocaleString()}</dd></div>
        </dl>
        <Notice tone="danger" title={controlledAcceptance ? "Canary only: this does not unlock production bridge execution" : "One-attempt irreversible source broadcast"}>
          A timeout or unknown response must be reconciled by the stored signature and provider order. Never submit this route again automatically.
        </Notice>
        <Field label="Master password"><input type="password" autoComplete="current-password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} /></Field>
           <Field label={`Type "${confirmationPhrase}"`}><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
        <label className="riskCheck"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I authorize this exact source transaction and its cross-chain settlement risks.</span></label>
        {error && <p className="executionError">{error}</p>}
        <footer><button disabled={busy} onClick={onCancel}>Cancel</button><button className="dangerButton" disabled={!ready || busy} onClick={() => void submit()}>{busy ? "Signing and submitting once…" : controlledAcceptance ? "Broadcast controlled acceptance" : "Bridge real USDC"}</button></footer>
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
  evmWallets,
  onCancel,
  onCreate,
}: {
  prompt: string;
  wallets: WalletSummary[];
  evmWallets: WalletSummary[];
  onCancel: () => void;
  onCreate: (value: {
    title: string;
    mode: SessionMode;
    permission: Permission;
    workspace: SessionWorkspace;
    walletScope?: SessionWalletScope;
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
  const [walletScope, setWalletScope] = useState<SessionWalletScope>("solana");
  const [pumpObjective, setPumpObjective] = useState<PumpSessionConfig["objective"]>("monitor");
  const [pumpScope, setPumpScope] = useState<PumpSessionConfig["scope"]>("exact-mint");
  const [pumpMint, setPumpMint] = useState("");
  const [pumpWatchlistText, setPumpWatchlistText] = useState("");
  const [pumpAnalysisBuyLamports, setPumpAnalysisBuyLamports] = useState("1000000");
  const [walletAddress, setWalletAddress] = useState<string>(
    wallets.find((wallet) => wallet.primary)?.address ?? "",
  );
  const scopedWallets = walletScope === "evm" ? evmWallets : wallets;
  useEffect(() => {
    if (!scopedWallets.some((wallet) => wallet.address === walletAddress)) {
      setWalletAddress(
        scopedWallets.find((wallet) => wallet.primary)?.address ??
          scopedWallets[0]?.address ??
          "",
      );
    }
  }, [scopedWallets, walletAddress]);
  function selectWalletScope(scope: SessionWalletScope): void {
    setWalletScope(scope);
    setWorkspace("general");
    const nextWallets = scope === "evm" ? evmWallets : wallets;
    setWalletAddress(
      nextWallets.find((wallet) => wallet.primary)?.address ??
        nextWallets[0]?.address ??
        "",
    );
  }
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
              <span>02</span>
              <strong>Wallet network</strong>
              <small>The selected wallet determines the actions available inside this session.</small>
            </div>
            <div className="choiceGrid">
              <button
                className={walletScope === "solana" ? "active" : ""}
                onClick={() => selectWalletScope("solana")}
              >
                <span className="choiceNumber">01</span>
                <strong>Solana Mainnet wallet</strong>
                 <small>Available inside the session: Jupiter swap, Pump.fun Token Launch planning, Solana-to-EVM bridge planning, and research.</small>
              </button>
              <button
                className={
                  evmWallets.length === 0
                    ? "unavailableChoice"
                    : walletScope === "evm"
                      ? "active"
                      : ""
                }
                disabled={evmWallets.length === 0}
                onClick={() => selectWalletScope("evm")}
              >
                <span className="choiceNumber">02</span>
                <strong>Robinhood Chain EVM wallet</strong>
                <small>
                  {evmWallets.length === 0
                    ? "Configure an encrypted EVM wallet in Settings first."
                    : "Restricted Uniswap-routed swap review on Robinhood Chain. Every approval and execution remains behind deterministic checks and explicit final confirmation."}
                </small>
              </button>
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
                className={mode === "agent" ? "active" : ""}
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
                  Goal-driven workflow with explicit limits, checkpoints, and stop conditions.
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
                className="unavailableChoice"
                disabled
                onClick={() => setPermission("full")}
              >
                <span className="choiceNumber">02 · Guarded MVP</span>
                <strong>Full access</strong>
                <small>
                  Not available for new sessions. Full Access never bypasses
                  signing, policy checks, or final transaction approval.
                </small>
              </button>
            </div>
          </section>
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>{workspace === "pump" ? "06" : "05"}</span>
              <strong>Wallet</strong>
              <small>Locked for this session after it is created.</small>
            </div>
            <div className="walletSelectBlock">
              <label htmlFor="session-wallet">
                {walletScope === "evm"
                  ? "Robinhood Chain EVM wallet"
                  : "Solana Mainnet wallet"}
              </label>
              <select
                id="session-wallet"
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
              >
                <option value="">No wallet · chat only</option>
                {scopedWallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.primary ? "Primary · " : ""}
                    {shorten(wallet.address)}
                  </option>
                ))}
              </select>
              <small>
                {scopedWallets.length === 0
                  ? `No ${walletScope === "evm" ? "EVM" : "Solana"} wallet is configured. Add one in Settings → Wallets.`
                  : `${scopedWallets.length} encrypted ${walletScope === "evm" ? "EVM" : "Solana"} wallet${scopedWallets.length === 1 ? "" : "s"} available on this device.`}
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
              disabled={!title.trim()}
              onClick={() =>
                onCreate({
                  title: title.trim(),
                  mode,
                  permission: "restricted",
                  workspace: "general",
                  walletScope,
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
  contextLimit,
  outputLimit,
  wallets,
  evmWallets,
  refreshToken,
  onAnalyzePump,
  onScanPump,
  onReloadSessions,
}: {
  session: SessionItem | null;
  runtime: RuntimeStatus | null;
  model: string;
  contextLimit: number;
  outputLimit: number;
  wallets: WalletSummary[];
  evmWallets: WalletSummary[];
  refreshToken: number;
  onAnalyzePump?: ((mint: string) => void) | undefined;
  onScanPump?: (() => void) | undefined;
  onReloadSessions?: (() => Promise<void>) | undefined;
}) {
  const isEvmSession = session?.walletScope === "evm";
  const visibleWallet =
    session?.walletAddress ??
    (session ? null : wallets.find((wallet) => wallet.primary)?.address) ??
    null;
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [activity, setActivity] = useState<WalletActivitySnapshot | null>(null);
  const [activityState, setActivityState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");

  const [automationStrategies, setAutomationStrategies] = useState<any[]>([]);
  const [automationProposals, setAutomationProposals] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchAutomation = useCallback(async () => {
    try {
      if ((window as any).silfable?.listAutomationStrategies) {
        const res = await (window as any).silfable.listAutomationStrategies();
        setAutomationStrategies(res.strategies || []);
        setAutomationProposals(res.proposals || []);
      }
    } catch (err) {
      console.error("Failed to load automation in RightRail:", err);
    }
  }, []);

  useEffect(() => {
    fetchAutomation();
    const interval = setInterval(fetchAutomation, 4000);
    return () => clearInterval(interval);
  }, [fetchAutomation]);

  const handleApproveProposal = async (proposalId: string) => {
    try {
      setActionLoadingId(proposalId);
      if ((window as any).silfable?.setAutomationStatus) {
        await (window as any).silfable.setAutomationStatus({
          schemaVersion: 1,
          requestId: crypto.randomUUID(),
          id: proposalId,
          sessionId: session?.id,
          action: "APPROVE_PROPOSAL",
        });
        await fetchAutomation();
        if (onReloadSessions) {
          await onReloadSessions();
        }
      }
    } catch (err) {
      console.error("Failed to approve proposal:", err);
    } finally {
      setActionLoadingId(null);
    }
  };
  
  const pumpConfig = session?.workspace === "pump" ? session.pumpConfig : undefined;
  const activePosition = activePositions.find(p => p.mintAddress === pumpConfig?.tokenMint);
  const lastTurnInputTokens = session?.usage.input ?? 0;
  const safeContextLimit = Math.max(contextLimit, 1);
  const contextPercent = Math.min(100, Math.round((lastTurnInputTokens / safeContextLimit) * 100));

  useEffect(() => {
    if (runtime?.keystore !== "unlocked") return;
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
  }, [runtime?.keystore]);


  const minimumPortfolioSlot = useMemo(() => session?.messages.reduce((highest, message) => {
    const receipt = message.missionExecution;
    return receipt?.status === "confirmed" && receipt.chainSlot !== null && receipt.chainSlot !== undefined
      ? Math.max(highest, receipt.chainSlot)
      : highest;
  }, 0) ?? 0, [session]);
  useEffect(() => {
    let active = true;
    if (!visibleWallet || isEvmSession || !pumpConfig) {
      setPortfolio(null);
      return () => {
        active = false;
      };
    }
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
            return;
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 750));
        }
      } catch { /* Pump position evidence remains unavailable until the next refresh. */ }
    })();
    return () => {
      active = false;
    };
  }, [visibleWallet, isEvmSession, pumpConfig, refreshToken, minimumPortfolioSlot]);
  useEffect(() => {
    let active = true;
    setActivity(null);
    if (!session || !visibleWallet || isEvmSession) {
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
  }, [session?.id, visibleWallet, isEvmSession, refreshToken]);
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
                  <Button variant="ghost" size="sm" onClick={() => copyAddress(visibleWallet)}>
                    {copiedAddress === visibleWallet ? "Copied" : "Copy"}
                  </Button>
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
        <UnifiedPortfolioRail
          session={session}
          runtime={runtime}
          solanaWallets={wallets}
          evmWallets={evmWallets}
          refreshToken={refreshToken}
          copiedAddress={copiedAddress}
          onCopyAddress={copyAddress}
        />
      )}
      {session && !isEvmSession && (
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
          <div className="runtimeContext" title="Input tokens reported by the provider for the most recent AI request.">
            <div>
              <span>Context · last turn</span>
              <strong>{formatRuntimeTokens(lastTurnInputTokens)} / {formatRuntimeTokens(safeContextLimit)} · {contextPercent}%</strong>
            </div>
            <div className="runtimeContextTrack" aria-label={`Last-turn context usage: ${contextPercent}%`}>
              <span style={{ width: `${contextPercent}%` }} />
            </div>
            <small>Output cap: {formatRuntimeTokens(outputLimit)} tokens</small>
          </div>
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
      {automationStrategies.filter((s) => s.status !== "CANCELLED" && s.status !== "EXPIRED").length > 0 && (
        <RailSection title="Active Automation">
          <div className="activeAutomationsRail space-y-2 text-xs">
            {automationStrategies
              .filter((s) => s.status !== "CANCELLED" && s.status !== "EXPIRED")
              .map((strat) => {
                const matchingProp = automationProposals.find(
                  (p) => p.strategyId === strat.id && p.status === "AWAITING_APPROVAL",
                );
                const nextWake = strat.nextWakeAt ? Date.parse(strat.nextWakeAt) - Date.now() : null;
                const countdown =
                  nextWake && nextWake > 0
                    ? `${Math.floor(nextWake / 60000)}m ${Math.floor((nextWake % 60000) / 1000)}s`
                    : "Evaluating now...";

                const formatOrderAmount = (rawAmount?: string, inputMint?: string) => {
                  if (!rawAmount) return "-";
                  const num = Number(rawAmount);
                  if (isNaN(num)) return rawAmount;
                  if (inputMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" || (!inputMint && num >= 1000)) {
                    const formatted = (num / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
                    return `${formatted} USDC`;
                  }
                  return `${num.toLocaleString()} raw units`;
                };

                const KNOWN: Record<string, string> = {
                  "So11111111111111111111111111111111111111112": "SOL",
                  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
                  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
                };

                const inSym = KNOWN[strat.inputMint] || shorten(strat.inputMint);
                const outSym = KNOWN[strat.outputMint] || shorten(strat.outputMint);

                return (
                  <div key={strat.id} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-cyan-300">
                      <span>{strat.kind} · {inSym} ➔ {outSym}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${strat.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {strat.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Progress: {strat.completedExecutions ?? 0}/{strat.maximumExecutions ?? "-"}</span>
                      <span className="font-mono text-cyan-300 font-medium">{formatOrderAmount(strat.orderAmountRaw, strat.inputMint)}</span>
                    </div>
                    {strat.status === "ACTIVE" && strat.nextWakeAt && (
                      <div className="flex justify-between text-[11px] text-cyan-400 font-mono">
                        <span>⏱ Next run:</span>
                        <span>{countdown}</span>
                      </div>
                    )}
                    {matchingProp && (
                      <button
                        className="w-full mt-2 py-1.5 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
                        disabled={actionLoadingId === matchingProp.id}
                        onClick={() => handleApproveProposal(matchingProp.id)}
                      >
                        Approve Swap ({formatOrderAmount(matchingProp.inputAmountRaw, matchingProp.inputMint)})
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </RailSection>
      )}
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

type SolanaPortfolioView = { wallet: WalletSummary; snapshot: PortfolioSnapshot };
type EvmPortfolioView = { wallet: WalletSummary; snapshot: EvmPortfolioSnapshot };
type PortfolioLoadState = "idle" | "loading" | "ready" | "partial" | "error";
type PortfolioFamilyFilter = "all" | "solana" | "evm";

async function settleTaskPool<T>(tasks: ReadonlyArray<() => Promise<T>>, concurrency: number): Promise<Array<PromiseSettledResult<T>>> {
  const results = new Array<PromiseSettledResult<T>>(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      if (!task) continue;
      try {
        results[index] = { status: "fulfilled", value: await task() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function formatRuntimeTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function UnifiedPortfolioRail({
  session,
  runtime,
  solanaWallets,
  evmWallets,
  refreshToken,
  copiedAddress,
  onCopyAddress,
}: {
  session: SessionItem | null;
  runtime: RuntimeStatus | null;
  solanaWallets: WalletSummary[];
  evmWallets: WalletSummary[];
  refreshToken: number;
  copiedAddress: string | null;
  onCopyAddress: (address: string) => void;
}) {
  const [solanaViews, setSolanaViews] = useState<SolanaPortfolioView[]>([]);
  const [evmViews, setEvmViews] = useState<EvmPortfolioView[]>([]);
  const [solanaState, setSolanaState] = useState<PortfolioLoadState>("idle");
  const [evmState, setEvmState] = useState<PortfolioLoadState>("idle");
  const [evmFailureChains, setEvmFailureChains] = useState<EvmChainKey[]>([]);
  const [walletFilter, setWalletFilter] = useState<PortfolioFamilyFilter>("all");
  const [chainFilter, setChainFilter] = useState<"all" | EvmChainKey>("all");
  const [retry, setRetry] = useState(0);
  const [costBasisSummary, setCostBasisSummary] = useState<any | null>(null);

  const sessionScope = session?.walletScope;
  const sessionWallet = session?.walletAddress ?? null;
  const solanaTargets = useMemo<WalletSummary[]>(() => {
    if (session) return sessionScope === "solana" && sessionWallet
      ? [{ address: sessionWallet, primary: true }]
      : [];
    return solanaWallets;
  }, [session?.id, sessionScope, sessionWallet, solanaWallets]);
  const evmTargets = useMemo<WalletSummary[]>(() => {
    if (session) return sessionScope === "evm" && sessionWallet
      ? [{ address: sessionWallet, primary: true }]
      : [];
    return evmWallets;
  }, [session?.id, sessionScope, sessionWallet, evmWallets]);

   useEffect(() => {
    setWalletFilter("all");
    setChainFilter(session?.walletScope === "evm" && session.evmChainKey
      ? session.evmChainKey
      : "all");
  }, [session?.id, session?.walletScope, session?.evmChainKey]);

  useEffect(() => {
    let active = true;
    setSolanaViews([]);
    if (runtime?.keystore !== "unlocked" || solanaTargets.length === 0) {
      setSolanaState("idle");
      return () => { active = false; };
    }
    setSolanaState("loading");
    const tasks = solanaTargets.map((wallet) => async () => ({
      wallet,
      snapshot: (await window.silfable.getPortfolio({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        address: wallet.address,
      })).snapshot,
    }));
    void settleTaskPool(tasks, 1).then((results) => {
      if (!active) return;
      const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setSolanaViews(fulfilled);
      setSolanaState(fulfilled.length === 0 ? "error" : fulfilled.length === results.length ? "ready" : "partial");
    });
    return () => { active = false; };
  }, [runtime?.keystore, solanaTargets, refreshToken, retry]);

  useEffect(() => {
    let active = true;
    setEvmViews([]);
    setEvmFailureChains([]);
    if (runtime?.keystore !== "unlocked" || evmTargets.length === 0) {
      setEvmState("idle");
      return () => { active = false; };
    }
     setEvmState("loading");
    const requests = evmTargets.flatMap((wallet) => EVM_PORTFOLIO_CHAINS.map((chain) => ({ wallet, chain })));
    const tasks = requests.map(({ wallet, chain }) => async () => ({
      wallet,
      snapshot: (await window.silfable.getEvmPortfolio({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        chainKey: chain.key,
        address: wallet.address,
        tokens: chain.token ? [chain.token] : [],
      })).snapshot,
    }));
    void settleTaskPool(tasks, 3).then((results) => {
      if (!active) return;
      const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failedChains = results.flatMap((result, index) => result.status === "rejected" && requests[index]
        ? [requests[index].chain.key]
        : []);
      setEvmViews(fulfilled);
      setEvmFailureChains([...new Set(failedChains)]);
      setEvmState(fulfilled.length === 0 ? "error" : fulfilled.length === results.length ? "ready" : "partial");
    });
    return () => { active = false; };
  }, [runtime?.keystore, evmTargets, refreshToken, retry]);

  useEffect(() => {
    let active = true;
    if (runtime?.keystore !== "unlocked" || solanaTargets.length === 0) {
      setCostBasisSummary(null);
      return;
    }
    if (typeof window.silfable.getPortfolioCostBasis !== "function") {
      setCostBasisSummary(null);
      return;
    }
    window.silfable.getPortfolioCostBasis({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      address: solanaTargets[0].address,
    }).then((res) => {
      if (active) setCostBasisSummary(res.summary);
    }).catch((err) => {
      console.warn("Failed to fetch cost basis summary", err);
    });
    return () => { active = false; };
  }, [runtime?.keystore, solanaTargets, refreshToken, retry]);

  const selectedSolana = solanaViews.filter(() => walletFilter === "all" || walletFilter === "solana");
  const selectedEvm = evmViews.filter((entry) =>
    (walletFilter === "all" || walletFilter === "evm")
    && (chainFilter === "all" || entry.snapshot.chainKey === chainFilter));
  const hasPositiveRawAmount = (amount: string): boolean => {
    try {
      return BigInt(amount) > 0n;
    } catch {
      return false;
    }
  };
  const visibleSolana = selectedSolana.filter((entry) =>
    Number(entry.snapshot.solBalance) > 0
    || entry.snapshot.assets.some((asset) => Number(asset.uiAmount) > 0));
  const visibleEvm = selectedEvm.filter((entry) =>
    hasPositiveRawAmount(entry.snapshot.nativeRawAmount)
    || entry.snapshot.assets.some((asset) => hasPositiveRawAmount(asset.rawAmount)));
  const hasVisibleAssets = visibleSolana.length + visibleEvm.length > 0;
  const knownTotals = [
     ...selectedSolana.map((entry) => entry.snapshot.totalUsd),
    ...selectedEvm.map((entry) => entry.snapshot.totalUsd ?? null),
  ].filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const totalUsd = knownTotals.length > 0 ? knownTotals.reduce((sum, value) => sum + value, 0) : null;
  const includesSolana = session ? sessionScope === "solana" : walletFilter !== "evm";
  const includesEvm = session ? sessionScope === "evm" : walletFilter !== "solana";
  const loading = (includesSolana && solanaState === "loading") || (includesEvm && evmState === "loading");
  const failed = (includesSolana && (solanaState === "error" || solanaState === "partial"))
    || (includesEvm && (evmState === "error" || evmState === "partial"))
    || selectedEvm.some((entry) => entry.snapshot.valuationStatus === "partial");
  const robinhoodRpcUnavailable = chainFilter === "robinhood" && evmFailureChains.includes("robinhood");
  const configuredCount = session
    ? (sessionWallet ? 1 : 0)
    : (includesSolana ? solanaWallets.length : 0) + (includesEvm ? evmWallets.length : 0);
  const hasEvmSelection = sessionScope === "evm" || walletFilter === "evm";
  const totalLabel = !hasVisibleAssets
    ? "$0.00"
    : loading
    ? "Loading…"
    : totalUsd === null ? "Unpriced" : formatPortfolioUsd(totalUsd);

  return (
    <RailSection title={session ? "Position" : "Portfolio"}>
      <div className="portfolioHeadingRow">
        <span className="totalLabel">{session
          ? "Session wallet assets"
          : walletFilter === "solana" ? "Solana wallets" : walletFilter === "evm" ? "EVM wallets" : "All configured wallets"}</span>
        <small>{configuredCount} {configuredCount === 1 ? "wallet" : "wallets"}</small>
      </div>
      <strong className="portfolioTotal">{configuredCount === 0 ? "$0.00" : totalLabel}</strong>
      <small>
        {session
          ? "Read-only balances for the wallet bound to this session."
          : "Combined verified balances across Solana and supported EVM chains."}
      </small>

      {costBasisSummary && (
        <div className="portfolioPnlSummary flex items-center justify-between text-xs mt-2.5 p-2 bg-slate-900/60 rounded border border-slate-800/80">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Unrealized PnL</span>
            <span className={costBasisSummary.unrealizedPnlUsd !== null && costBasisSummary.unrealizedPnlUsd !== undefined && costBasisSummary.unrealizedPnlUsd >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {costBasisSummary.unrealizedPnlUsd !== null && costBasisSummary.unrealizedPnlUsd !== undefined
                ? `${costBasisSummary.unrealizedPnlUsd >= 0 ? "+" : ""}$${costBasisSummary.unrealizedPnlUsd.toFixed(2)}`
                : "—"}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Realized PnL</span>
            <span className={costBasisSummary.realizedPnlUsd !== null && costBasisSummary.realizedPnlUsd !== undefined && costBasisSummary.realizedPnlUsd >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {costBasisSummary.realizedPnlUsd !== null && costBasisSummary.realizedPnlUsd !== undefined
                ? `${costBasisSummary.realizedPnlUsd >= 0 ? "+" : ""}$${costBasisSummary.realizedPnlUsd.toFixed(2)}`
                : "$0.00"}
            </span>
          </div>
        </div>
      )}
      
      {!session && configuredCount > 1 && (
        <div className="portfolioScopeTabs" aria-label="Portfolio wallet scope">
          <button className={walletFilter === "all" ? "active" : ""} onClick={() => { setWalletFilter("all"); setChainFilter("all"); }}>All</button>
          <button className={walletFilter === "solana" ? "active" : ""} disabled={solanaWallets.length === 0} onClick={() => { setWalletFilter("solana"); setChainFilter("all"); }}>Solana</button>
          <button className={walletFilter === "evm" ? "active" : ""} disabled={evmWallets.length === 0} onClick={() => { setWalletFilter("evm"); setChainFilter("all"); }}>EVM</button>
        </div>
      )}

      {hasEvmSelection && (
        <div className="portfolioChainTabs" aria-label="EVM chain scope">
          <button className={chainFilter === "all" ? "active" : ""} onClick={() => setChainFilter("all")}>All</button>
          {EVM_PORTFOLIO_CHAINS.map((chain) => (
            <button key={chain.key} className={chainFilter === chain.key ? "active" : ""} onClick={() => setChainFilter(chain.key)}>{chain.label}</button>
          ))}
        </div>
      )}

      {(failed || (configuredCount > 0 && !loading && selectedSolana.length + selectedEvm.length === 0)) && (
        <div className="portfolioReadWarning">
          <span>{robinhoodRpcUnavailable
            ? "Robinhood Chain RPC did not respond. Add a custom provider endpoint in Settings → Connect integrations."
            : "Some network balances could not be verified."}</span>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button>
        </div>
      )}

      <div className="portfolioAssetGroups">
        {visibleSolana.map((entry) => (
          <div className="portfolioAssetGroup" key={`solana:${entry.wallet.address}`}>
            <div className="portfolioGroupTitle"><span>SOLANA</span><strong>{formatPortfolioUsd(entry.snapshot.totalUsd)}</strong></div>
            <PortfolioAssetRow symbol="SOL" amount={entry.snapshot.solBalance} usdValue={portfolioAssetUsd(entry.snapshot.solBalance, entry.snapshot.solUsdPrice)} />
            {entry.snapshot.assets.slice(0, 8).map((asset) => {
              const knownMints: Record<string, string> = {
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
                "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
                "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
                "So11111111111111111111111111111111111111112": "SOL",
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
              };
              const resolvedSymbol = knownMints[asset.mint] || shorten(asset.mint);
              const assetPnl = costBasisSummary?.assets?.find(
                (a: any) => a.assetId?.toLowerCase() === asset.mint.toLowerCase()
              )?.unrealizedPnlUsd;
              return (
                <PortfolioAssetRow key={asset.mint} symbol={resolvedSymbol} amount={asset.uiAmount} usdValue={asset.usdValue} pnl={assetPnl} />
              );
            })}
          </div>
        ))}
        {visibleEvm.map((entry) => (
          <div className="portfolioAssetGroup" key={`${entry.wallet.address}:${entry.snapshot.chainKey}`}>
            <div className="portfolioGroupTitle"><span>{entry.snapshot.chainName.toUpperCase()}</span><strong>{formatPortfolioUsd(entry.snapshot.totalUsd ?? null)}</strong></div>
            <PortfolioAssetRow symbol={entry.snapshot.nativeSymbol} amount={entry.snapshot.nativeUiAmount} usdValue={entry.snapshot.nativeUsdValue ?? null} />
            {entry.snapshot.assets.filter((asset) => BigInt(asset.rawAmount) > 0n).map((asset) => (
              <PortfolioAssetRow key={asset.address} symbol={asset.symbol} amount={asset.uiAmount} usdValue={asset.usdValue ?? null} />
            ))}
          </div>
        ))}
        {!loading && !hasVisibleAssets && configuredCount > 0 && (
          <p className="portfolioEmpty">No non-zero assets are available for this selection.</p>
        )}
      </div>

      <div className="portfolioWallets">
        {(session
          ? [...solanaTargets.map((wallet) => ({ ...wallet, family: "SOL" })), ...evmTargets.map((wallet) => ({ ...wallet, family: "EVM" }))]
          : [
            ...(walletFilter !== "evm" ? solanaWallets.map((wallet) => ({ ...wallet, family: "SOL" })) : []),
            ...(walletFilter !== "solana" ? evmWallets.map((wallet) => ({ ...wallet, family: "EVM" })) : []),
          ]
        ).map((wallet) => (
          <div className="walletLine" key={`${wallet.family}:${wallet.address}`}>
            <span>{wallet.family} {wallet.primary ? "PRIMARY" : "WALLET"}</span>
            <strong>{shorten(wallet.address)}</strong>
            <Button variant="ghost" size="sm" onClick={() => onCopyAddress(wallet.address)}>{copiedAddress === wallet.address ? "Copied" : "Copy"}</Button>
          </div>
        ))}
      </div>
       <p className="portfolioBoundary">Balances are read-only. EVM token discovery is limited to native assets and release-pinned USDC/USDG contracts.</p>
    </RailSection>
  );
}

function PortfolioAssetRow({ symbol, amount, usdValue, pnl }: { symbol: string; amount: string; usdValue: number | null; pnl?: number | null }) {
  return (
    <div className="portfolioAssetRow">
      <span>{symbol}</span>
      <strong>{formatPortfolioAmount(amount)}</strong>
      <div>
        <em>{formatPortfolioUsd(usdValue)}</em>
        {pnl !== undefined && pnl !== null && (
          <span className={`portfolioAssetPnl ${pnl >= 0 ? "positive" : "negative"}`}>
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatPortfolioUsd(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Unpriced"
    : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function portfolioAssetUsd(amount: string, price: number | null): number | null {
  const numericAmount = Number(amount);
  if (numericAmount === 0) return 0;
  if (!Number.isFinite(numericAmount) || price === null) return null;
  const value = numericAmount * price;
  return Number.isFinite(value) ? value : null;
}

function formatPortfolioAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric > 0 && numeric < 0.000001) return numeric.toExponential(4);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 6 });
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeComposer = (element: HTMLTextAreaElement): void => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  };

  useEffect(() => {
    if (textareaRef.current) resizeComposer(textareaRef.current);
  }, [value]);

  return (
  <div className={`composer ${disabled ? "disabled" : ""}`}>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          resizeComposer(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (!disabled && event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={1}
      />
      <Button
        className="composerSubmit"
        size="sm"
        icon={<ArrowUp className="size-4" />}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        onClick={onSubmit}
      >
        <span className="sr-only">Send</span>
      </Button>
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

function AutomationSetupDcaCard({
  setup,
  onApprove,
}: {
  setup: import("@silfable/contracts").AutomationSetupDcaRequest;
  onApprove: (payload: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const approve = async () => {
    setBusy(true);
    try {
      await onApprove({ type: "DCA", payload: setup });
      setApproved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tradePreviewCard">
      <header className="previewHeader">
        <span className="venueBadge">?? Automation</span>
        <strong>DCA Strategy Setup</strong>
      </header>
      <div className="previewBody">
        <div className="orderRow">
          <span>Target Token</span>
          <span className="font-mono">{setup.outputMint.slice(0,6)}...{setup.outputMint.slice(-4)}</span>
        </div>
        <div className="orderRow">
          <span>Amount per Execution (USDC)</span>
          <span>{Number(setup.orderAmountRaw) / 1000000}</span>
        </div>
        <div className="orderRow">
          <span>Total Executions</span>
          <span>{setup.maximumExecutions}</span>
        </div>
        <div className="orderRow">
          <span>Interval</span>
          <span>{setup.intervalSeconds / 60} Minutes</span>
        </div>
      </div>
      <footer className="previewFooter">
        {approved ? (
          <span className="text-green-400 font-bold" style={{color:"#4ade80"}}>? Approved & Active</span>
        ) : (
          <button className="executeButton" disabled={busy} onClick={approve}>
            {busy ? "Approving..." : "Confirm & Setup"}
          </button>
        )}
      </footer>
    </div>
  );
}

function AutomationSetupExitCard({
  setup,
  onApprove,
}: {
  setup: import("@silfable/contracts").AutomationSetupExitRequest;
  onApprove: (payload: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const approve = async () => {
    setBusy(true);
    try {
      await onApprove({ type: "EXIT", payload: setup });
      setApproved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tradePreviewCard">
      <header className="previewHeader">
        <span className="venueBadge">??? Automation</span>
        <strong>Take Profit / Stop Loss Setup</strong>
      </header>
      <div className="previewBody">
        <div className="orderRow">
          <span>Asset</span>
          <span className="font-mono">{setup.inputMint.slice(0,6)}...{setup.inputMint.slice(-4)}</span>
        </div>
        <div className="orderRow">
          <span>Entry Price (USD)</span>
          <span>${setup.entryPriceUsd}</span>
        </div>
        {setup.takeProfitPriceUsd && (
          <div className="orderRow">
            <span style={{color:"#4ade80"}}>Take Profit (USD)</span>
            <span style={{color:"#4ade80", fontWeight: "bold"}}>${setup.takeProfitPriceUsd}</span>
          </div>
        )}
        {setup.stopLossPriceUsd && (
          <div className="orderRow">
            <span style={{color:"#f87171"}}>Stop Loss (USD)</span>
            <span style={{color:"#f87171", fontWeight: "bold"}}>${setup.stopLossPriceUsd}</span>
          </div>
        )}
      </div>
      <footer className="previewFooter">
        {approved ? (
          <span className="text-green-400 font-bold" style={{color:"#4ade80"}}>? Approved & Active</span>
        ) : (
          <button className="executeButton" disabled={busy} onClick={approve}>
            {busy ? "Approving..." : "Confirm & Setup"}
          </button>
        )}
      </footer>
    </div>
  );
}


