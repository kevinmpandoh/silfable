import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, powerMonitor, session, shell, Tray } from "electron";
import type { NativeImage } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AiChatRequestSchema,
  AiChatResponseSchema,
  AiPreviewOpenRouterModelsRequestSchema,
  AiPreviewOpenRouterModelsResponseSchema,
  AiProviderMutationResponseSchema,
  AiSaveProviderRequestSchema,
  AiSettingsResponseSchema,
  ClipboardWriteWalletAddressRequestSchema,
  ClipboardWriteWalletAddressResponseSchema,
  ClipboardWriteTransactionSignatureRequestSchema,
  ClipboardWriteTransactionSignatureResponseSchema,
  ExternalOpenTransactionRequestSchema,
  ExternalOpenTransactionResponseSchema,
  IPC_CHANNELS,
  JupiterKeyMutationResponseSchema,
  JupiterSaveKeyRequestSchema,
  JupiterSettingsResponseSchema,
  LimitOrderExecuteRequestSchema,
  LimitOrderExecuteResponseSchema,
  LimitOrderCancelExecuteRequestSchema,
  LimitOrderCancelExecuteResponseSchema,
  LimitOrderCancelSimulateRequestSchema,
  LimitOrderCancelSimulateResponseSchema,
  LimitOrderVerifyExecutionRequestSchema,
  LimitOrderVerifyExecutionResponseSchema,
  LimitOrderVerifyCancelRequestSchema,
  LimitOrderVerifyCancelResponseSchema,
  LimitOrderListRequestSchema,
  LimitOrderListResponseSchema,
  LimitOrderSimulateRequestSchema,
  LimitOrderSimulateResponseSchema,
  MissionSimulateRequestSchema,
  MissionSimulateResponseSchema,
  MissionExecuteRequestSchema,
  MissionExecuteResponseSchema,
  MissionVerifyExecutionRequestSchema,
  MissionVerifyExecutionResponseSchema,
  PortfolioGetRequestSchema,
  PortfolioGetResponseSchema,
  PumpFinalRevalidateRequestSchema,
  PumpFinalRevalidateResponseSchema,
  PumpExecuteRequestSchema,
  PumpSimulateRequestSchema,
  PumpSimulateResponseSchema,
  PumpSimulationArtifactSchema,
  PumpRiskSettingsMutationResponseSchema,
  PumpRiskSettingsResponseSchema,
  PumpRiskSettingsSaveRequestSchema,
  RuntimeStatusSchema,
  SecurityChangePasswordRequestSchema,
  SecurityConfigurePasswordRequestSchema,
  SecurityPasswordMutationResponseSchema,
  SecurityResetVaultRequestSchema,
  SecurityResetVaultResponseSchema,
  SecurityUnlockRequestSchema,
  SessionListResponseSchema,
  SessionUpsertRequestSchema,
  SessionUpsertResponseSchema,
  TavilyKeyMutationResponseSchema,
  TavilySaveKeyRequestSchema,
  TavilySettingsResponseSchema,
  SolanaRpcMutationResponseSchema,
  SolanaRpcSaveUrlRequestSchema,
  SolanaRpcSettingsResponseSchema,
  TransactionSettingsMutationResponseSchema,
  TransactionSettingsResponseSchema,
  TransactionSettingsSaveRequestSchema,
  WalletCreateRequestSchema,
  WalletCreateResponseSchema,
  WalletActivityGetRequestSchema,
  WalletActivityGetResponseSchema,
  WalletImportMnemonicRequestSchema,
  WalletImportPrivateKeyRequestSchema,
  WalletImportResponseSchema,
  WalletListResponseSchema,
} from "@silfable/contracts";

import { previewOpenRouterModels } from "./ai/providers.js";
import { AiService } from "./ai/service.js";
import { MainnetReadService } from "./integrations/read-only.js";
import { JupiterTriggerV2Client } from "./integrations/trigger-v2.js";
import { LimitOrderService } from "./mission/limit-order.js";
import { MissionSimulationService } from "./mission/simulation.js";
import { TransactionSettingsService } from "./mission/transaction-settings.js";
import { AutonomousExecutorService } from "./execution/autonomous-executor.js";
import { DurableBackgroundObservationService } from "./execution/background-loop.js";
import { PositionStrategyManager, type ExitTriggerEvent } from "./execution/strategy-manager.js";
import { MissionProposalService } from "./mission/proposals.js";
import { TokenAllowlistService } from "./mission/token-allowlist.js";
import { ReconciliationService } from "./execution/reconciliation.js";
import { buildAndSimulatePumpV2ProductionTransaction, type PumpV2ProductionSimulationInput } from "./pump/production.js";
import { evaluatePumpTradeEligibility } from "./pump/eligibility.js";
import { evaluatePumpExecutionReadiness } from "./pump/execution-readiness.js";
import { evaluatePumpFinalRevalidation, PumpPreparedExecutionService } from "./pump/prepared-execution.js";
import { EncryptedPumpReceiptService } from "./pump/receipt-store.js";
import { PumpRiskLedgerService } from "./pump/risk-ledger.js";
import { assertPumpProposalWithinRisk, PumpRiskSettingsService } from "./pump/risk-settings.js";
import { PumpMainnetRpc } from "./pump/rpc.js";
import { MasterPasswordService } from "./security/master-password.js";
import { SessionService } from "./sessions/service.js";
import {
  assertTrustedIpcEvent,
  denyPermissionCheck,
  denyPermissionRequest,
  denyWindowOpen,
  HARDENED_WEB_PREFERENCES,
  preventRendererNavigation,
} from "./security/policy.js";
import { RuntimeDatabase, MAINNET_PROFILE_ID } from "./storage/database.js";
import { LocalEncryptedKeystore } from "./storage/keystore.js";
import { WalletOnboardingService } from "./wallet/onboarding.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let keystore: LocalEncryptedKeystore | null = null;
let runtimeDatabase: RuntimeDatabase | null = null;
let observationService: DurableBackgroundObservationService | null = null;

app.enableSandbox();
if (process.platform === "win32") app.setAppUserModelId("ai.silfable.desktop");

function revealMainWindow(): void {
  if (!mainWindow) return;
  if (keystore?.isLocked()) mainWindow.webContents.reload();
  mainWindow.show();
  mainWindow.focus();
}

function getAppIcon(): NativeImage {
  const possiblePaths = [
    fileURLToPath(new URL("../../src/assets/logo-bg.jpeg", import.meta.url)),
    fileURLToPath(new URL("../renderer/assets/logo-bg.jpeg", import.meta.url)),
    join(app.getAppPath(), "src/assets/logo-bg.jpeg"),
    join(app.getAppPath(), "resources/icon.png"),
    join(app.getAppPath(), "resources/icon.ico"),
    join(app.getAppPath(), "build/icon.png"),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return nativeImage.createEmpty();
}

function createMainWindow(): BrowserWindow {
  const appIcon = getAppIcon();
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: "#080b18",
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
      ...HARDENED_WEB_PREFERENCES,
    },
  });
  if (!appIcon.isEmpty()) {
    window.setIcon(appIcon);
  }
  window.webContents.setWindowOpenHandler(denyWindowOpen);
  window.webContents.on("will-navigate", preventRendererNavigation);
  window.webContents.on("will-attach-webview", preventRendererNavigation);
  window.once("ready-to-show", () => window.show());
  window.on("minimize", () => { keystore?.lock(); window.hide(); });
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      keystore?.lock();
      window.hide();
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
  return window;
}

function createTray(): Tray {
  const appIcon = getAppIcon();
  const icon = appIcon.isEmpty() ? nativeImage.createEmpty() : appIcon.resize({ width: 16, height: 16 });
  const appTray = new Tray(icon);
  appTray.setToolTip("Silfable — Mainnet workspace");
  appTray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Silfable", click: revealMainWindow },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  appTray.on("click", revealMainWindow);
  return appTray;
}

function registerIpc(secretStore: LocalEncryptedKeystore, database: RuntimeDatabase, passwords: MasterPasswordService, wallets: WalletOnboardingService, reads: MainnetReadService, ai: AiService, sessions: SessionService, simulations: MissionSimulationService, limitOrders: LimitOrderService, transactionSettings: TransactionSettingsService, pumpRiskSettings: PumpRiskSettingsService, pumpRiskLedger: PumpRiskLedgerService, pumpReceipts: EncryptedPumpReceiptService, pumpRpc: PumpMainnetRpc, preparedPump: PumpPreparedExecutionService, strategyManager: PositionStrategyManager, observationService: DurableBackgroundObservationService): void {
  const requireUnlocked = (): void => { if (secretStore.isLocked()) throw new Error("Vault is locked"); };

  ipcMain.handle(IPC_CHANNELS.runtimeStatus, async (event) => {
    assertTrustedSender(event);
    return RuntimeStatusSchema.parse({
      appVersion: app.getVersion(),
      profile: MAINNET_PROFILE_ID,
      networkHealth: await reads.health(),
      keystore: secretStore.isLocked() ? "locked" : "unlocked",
      masterPassword: passwords.isConfigured() ? "configured" : "missing",
      wallet: database.hasWallet(MAINNET_PROFILE_ID) ? "configured" : "none",
      activeMissionCount: 0,
    });
  });

  ipcMain.handle(IPC_CHANNELS.securityConfigurePassword, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SecurityConfigurePasswordRequestSchema.parse(raw);
    if (passwords.isConfigured()) {
      if (!(await passwords.verify(request.password))) throw new Error("Master password is already configured");
      secretStore.unlock();
      return SecurityPasswordMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, keystore: "unlocked", masterPassword: "configured" });
    }
    secretStore.unlock();
    try {
      await passwords.configure(request.password);
    } catch (error) {
      secretStore.lock();
      throw error;
    }
    return SecurityPasswordMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, keystore: "unlocked", masterPassword: "configured" });
  });

  ipcMain.handle(IPC_CHANNELS.securityUnlock, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SecurityUnlockRequestSchema.parse(raw);
    if (!(await passwords.verify(request.password))) throw new Error("Master password is incorrect");
    secretStore.unlock();
    return SecurityPasswordMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, keystore: "unlocked", masterPassword: "configured" });
  });

  ipcMain.handle(IPC_CHANNELS.securityChangePassword, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SecurityChangePasswordRequestSchema.parse(raw);
    requireUnlocked();
    await passwords.change(request.currentPassword, request.newPassword);
    return SecurityPasswordMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, keystore: "unlocked", masterPassword: "configured" });
  });

  ipcMain.handle(IPC_CHANNELS.securityResetVault, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SecurityResetVaultRequestSchema.parse(raw);
    if (!secretStore.isLocked()) throw new Error("Vault reset is available only from the locked screen");
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Cancel", "Set up new vault"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        title: "Set up a new vault?",
        message: "Set up a new encrypted vault and abandon the current one?",
        detail: "The old encrypted vault and local database will be copied to a backup folder. They cannot be opened without the forgotten password. Active session data and current configuration will be removed from Silfable.",
      })
      : { response: 0 };
    if (result.response !== 1) throw new Error("Vault reset was cancelled");
    const backupDirectory = join(app.getPath("userData"), "vault-backups", new Date().toISOString().replaceAll(":", "-"));
    await database.backupTo(join(backupDirectory, "silfable-mainnet.sqlite3"));
    const backupCreated = await secretStore.backupAndReset(backupDirectory);
    database.resetVaultData();
    return SecurityResetVaultResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, reset: true, backupCreated });
  });

  ipcMain.handle(IPC_CHANNELS.sessionList, async (event) => {
    assertTrustedSender(event);
    // Listing while the window is crossing the lock boundary is expected.
    // Return no decrypted data and avoid surfacing a rejected IPC handler.
    if (secretStore.isLocked())
      return SessionListResponseSchema.parse({ schemaVersion: 1, sessions: [] });
    return SessionListResponseSchema.parse({ schemaVersion: 1, sessions: await sessions.list() });
  });

  ipcMain.handle(IPC_CHANNELS.sessionUpsert, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SessionUpsertRequestSchema.parse(raw);
    requireUnlocked();
    await sessions.upsert(request.session);
    return SessionUpsertResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, saved: true });
  });

  ipcMain.handle(IPC_CHANNELS.clipboardWriteWalletAddress, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = ClipboardWriteWalletAddressRequestSchema.parse(raw);
    requireUnlocked();
    clipboard.writeText(request.address, "clipboard");
    return ClipboardWriteWalletAddressResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, copied: true });
  });

  ipcMain.handle(IPC_CHANNELS.clipboardWriteTransactionSignature, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = ClipboardWriteTransactionSignatureRequestSchema.parse(raw);
    requireUnlocked();
    clipboard.writeText(request.signature, "clipboard");
    return ClipboardWriteTransactionSignatureResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, copied: true });
  });

  ipcMain.handle(IPC_CHANNELS.externalOpenTransaction, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = ExternalOpenTransactionRequestSchema.parse(raw);
    requireUnlocked();
    await shell.openExternal(`https://explorer.solana.com/tx/${request.signature}`, { activate: true });
    return ExternalOpenTransactionResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, opened: true });
  });

  ipcMain.handle(IPC_CHANNELS.walletCreate, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = WalletCreateRequestSchema.parse(raw);
    requireUnlocked();
    return WalletCreateResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...(await wallets.createWallet()) });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportMnemonic, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = WalletImportMnemonicRequestSchema.parse(raw);
    requireUnlocked();
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...(await wallets.importMnemonic(request.mnemonic)) });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportPrivateKey, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = WalletImportPrivateKeyRequestSchema.parse(raw);
    requireUnlocked();
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...(await wallets.importPrivateKey(request.privateKey)) });
  });

  ipcMain.handle(IPC_CHANNELS.walletList, async (event) => {
    assertTrustedSender(event);
    // Fail closed during minimize/reload races without printing an exception.
    if (secretStore.isLocked())
      return WalletListResponseSchema.parse({ schemaVersion: 1, wallets: [] });
    return WalletListResponseSchema.parse({ schemaVersion: 1, wallets: await wallets.listWallets() });
  });

  ipcMain.handle(IPC_CHANNELS.portfolioGet, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = PortfolioGetRequestSchema.parse(raw);
    requireUnlocked();
    return PortfolioGetResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, snapshot: await reads.portfolio(request.address) });
  });

  ipcMain.handle(IPC_CHANNELS.walletActivityGet, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = WalletActivityGetRequestSchema.parse(raw);
    requireUnlocked();
    return WalletActivityGetResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, activity: await reads.activity(request.address, request.limit) });
  });

  ipcMain.handle(IPC_CHANNELS.aiGetSettings, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return AiSettingsResponseSchema.parse({ schemaVersion: 1, providers: await ai.listSettings() });
  });

  ipcMain.handle(IPC_CHANNELS.aiPreviewOpenRouterModels, async (event, raw: unknown) => {
    assertTrustedSender(event);
    requireUnlocked();
    const request = AiPreviewOpenRouterModelsRequestSchema.parse(raw);
    return AiPreviewOpenRouterModelsResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      models: await previewOpenRouterModels(request.apiKey),
    });
  });

  ipcMain.handle(IPC_CHANNELS.aiSaveProvider, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = AiSaveProviderRequestSchema.parse(raw);
    requireUnlocked();
    return AiProviderMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      setting: await ai.saveProvider(request.apiKey, request.model),
    });
  });

  ipcMain.handle(IPC_CHANNELS.aiChat, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = AiChatRequestSchema.parse(raw);
    requireUnlocked();
    const session = await sessions.get(request.sessionId);
    if (session === null || session.mode !== request.mode || session.walletAddress !== request.walletAddress) throw new Error("Session context is unavailable");
    const latest = session.messages.at(-1);
    if (latest?.role !== "user" || latest.text !== request.prompt) throw new Error("Session context is out of date");
    const history = session.messages.slice(0, -1).slice(-20).map((message) => ({ role: message.role, text: message.text.slice(0, 4_000) }));
    const pumpContext = session.workspace === "pump" && session.pumpConfig
      ? `Pump.fun proposal-only workspace; exact token mint ${session.pumpConfig.tokenMint ?? "none"}; watchlist mints ${(session.pumpConfig.watchlistMints ?? []).join(", ") || "none"}; scope ${session.pumpConfig.scope}; objective ${session.pumpConfig.objective}; reference buy analysis amount ${session.pumpConfig.analysisBuyLamports ?? "1000000"} lamports. For exact-mint scope, use only the bound token. For watchlist scope, pump_token_analysis may read only a mint present in that encrypted watchlist. For discovery scope, call pump_recent_candidates only when the user explicitly requests a manual scan; report that coverage is incomplete and never rank a candidate whose typed rankingAllowed field is false. Direct Pump/PumpSwap execution is unavailable.`
      : undefined;
    const pumpScope = session.workspace === "pump" && session.pumpConfig
      ? {
          kind: session.pumpConfig.scope,
          allowedMints: session.pumpConfig.scope === "exact-mint"
            ? [session.pumpConfig.tokenMint!]
            : session.pumpConfig.scope === "watchlist"
              ? session.pumpConfig.watchlistMints ?? []
              : [],
          ...(session.pumpConfig.scope === "discovery"
            ? { discoveryCursor: [...session.messages].reverse().find((message) => message.pumpDiscoverySnapshot)?.pumpDiscoverySnapshot?.cursorSignature ?? null }
            : {}),
        }
      : undefined;
    const result = await ai.chat({
      prompt: request.prompt,
      mode: request.mode,
      walletAddress: request.walletAddress,
      ...(pumpContext ? { sessionContext: pumpContext } : {}),
      ...(pumpScope ? { pumpScope } : {}),
      history,
    });
    return AiChatResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      model: result.model,
      text: result.text,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        costUsd: result.costUsd,
      },
      toolsUsed: result.toolsUsed,
      missionPreview: result.missionPreview,
      pumpTokenIntelligence: result.pumpTokenIntelligence,
      pumpDiscoverySnapshot: result.pumpDiscoverySnapshot,
      pumpTradePreview: result.pumpTradePreview,
      limitOrderPreview: result.limitOrderPreview,
    });
  });

  ipcMain.handle(IPC_CHANNELS.pumpSimulate, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = PumpSimulateRequestSchema.parse(raw);
    requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null || sessionRecord.workspace !== "pump" || sessionRecord.permission !== "restricted" || sessionRecord.walletAddress === null) {
      throw new Error("Restricted Pump session context is unavailable");
    }
    const messageIndex = sessionRecord.messages.findIndex((message) => message.pumpTradePreview?.id === request.previewId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    const preview = message?.pumpTradePreview;
    if (preview === undefined || preview.status !== "ready-for-review" || preview.lifecycle !== "proposal-only") {
      throw new Error("A ready Pump proposal is required for simulation");
    }
    if (preview.walletAddress !== sessionRecord.walletAddress || preview.tokenMint !== sessionRecord.pumpConfig?.tokenMint) {
      throw new Error("Pump proposal does not match the encrypted session scope");
    }
    if (preview.venue !== "bonding-curve-active") {
      throw new Error("Only an active verified Pump bonding curve can use this simulator");
    }
    const settings = transactionSettings.get();
    const pumpRisk = pumpRiskSettings.get();
    const usage = await pumpRiskLedger.usageFor(preview.tokenMint);
    const balance = await pumpRpc.getBalanceAndContext(preview.walletAddress, { commitment: "finalized" });
    const riskEvidence = assertPumpProposalWithinRisk({
      side: preview.side,
      inputAmount: preview.inputAmount,
      maxSlippageBps: preview.maxSlippageBps,
      walletSolLamports: balance.value,
      maxNetworkFeeLamports: settings.maxNetworkFeeLamports,
      settings: pumpRisk,
      usage,
    });
    const buildInput: PumpV2ProductionSimulationInput = {
      side: preview.side,
      walletAddress: preview.walletAddress,
      tokenMint: preview.tokenMint,
      inputAmount: preview.inputAmount,
      minimumOutputAmount: preview.minimumOutputAmount,
      maxTotalFeeBps: pumpRisk.maxTradingFeeBps,
      maxSlippageBps: preview.maxSlippageBps,
      maxNetworkFeeLamports: settings.maxNetworkFeeLamports,
      maxFeePercent: settings.maxFeePercent,
    };
    const build = await buildAndSimulatePumpV2ProductionTransaction(pumpRpc, buildInput);
    const eligibilityEvidence = evaluatePumpTradeEligibility({
      side: preview.side,
      tokenMint: preview.tokenMint,
      inputAmount: preview.inputAmount,
      state: build.stateEvidence,
      fee: build.feePreview,
      quote: build.executableQuote,
      risk: riskEvidence,
      simulation: build.simulation,
    });
    const simulationEvidence = PumpSimulationArtifactSchema.parse({ ...build.simulation, riskEvidence, eligibilityEvidence });
    const executionReadiness = evaluatePumpExecutionReadiness({
      sessionWalletAddress: sessionRecord.walletAddress,
      sessionTokenMint: sessionRecord.pumpConfig!.tokenMint!,
      preview,
      simulation: simulationEvidence,
    });
    const simulation = PumpSimulationArtifactSchema.parse({ ...simulationEvidence, executionReadiness });
    if (executionReadiness.status === "ready-for-final-approval") {
      preparedPump.prepare({ sessionId: sessionRecord.id, preview, production: build, simulation, buildInput });
    }
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex
      ? { ...entry, pumpSimulation: simulation }
      : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return PumpSimulateResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      simulation,
    });
  });

  ipcMain.handle(IPC_CHANNELS.pumpFinalRevalidate, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = PumpFinalRevalidateRequestSchema.parse(raw);
    requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null || sessionRecord.workspace !== "pump" || sessionRecord.permission !== "restricted" || sessionRecord.walletAddress === null) {
      throw new Error("Restricted Pump session context is unavailable");
    }
    const messageIndex = sessionRecord.messages.findIndex((message) => message.pumpTradePreview?.id === request.previewId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    const preview = message?.pumpTradePreview;
    const initialSimulation = message?.pumpSimulation;
    if (preview === undefined || initialSimulation?.executionReadiness?.status !== "ready-for-final-approval") {
      throw new Error("A passed Pump unsigned simulation is required before final revalidation");
    }
    if (preview.walletAddress !== sessionRecord.walletAddress || preview.tokenMint !== sessionRecord.pumpConfig?.tokenMint) {
      throw new Error("Pump proposal does not match the encrypted session scope");
    }
    const prepared = preparedPump.consume({ sessionId: sessionRecord.id, preview });
    const settings = transactionSettings.get();
    const pumpRisk = pumpRiskSettings.get();
    const usage = await pumpRiskLedger.usageFor(preview.tokenMint);
    const balance = await pumpRpc.getBalanceAndContext(preview.walletAddress, { commitment: "finalized" });
    const riskEvidence = assertPumpProposalWithinRisk({
      side: preview.side,
      inputAmount: preview.inputAmount,
      maxSlippageBps: preview.maxSlippageBps,
      walletSolLamports: balance.value,
      maxNetworkFeeLamports: settings.maxNetworkFeeLamports,
      settings: pumpRisk,
      usage,
    });
    const build = await buildAndSimulatePumpV2ProductionTransaction(pumpRpc, prepared.input);
    const eligibilityEvidence = evaluatePumpTradeEligibility({
      side: preview.side,
      tokenMint: preview.tokenMint,
      inputAmount: preview.inputAmount,
      state: build.stateEvidence,
      fee: build.feePreview,
      quote: build.executableQuote,
      risk: riskEvidence,
      simulation: build.simulation,
    });
    const freshSimulation = PumpSimulationArtifactSchema.parse({ ...build.simulation, riskEvidence, eligibilityEvidence });
    const finalRevalidation = evaluatePumpFinalRevalidation({ prepared, preview, production: build, simulation: freshSimulation, risk: riskEvidence });
    const simulation = PumpSimulationArtifactSchema.parse({ ...freshSimulation, executionReadiness: initialSimulation.executionReadiness, finalRevalidation });
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex ? { ...entry, pumpSimulation: simulation } : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return PumpFinalRevalidateResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, simulation });
  });

  ipcMain.handle(IPC_CHANNELS.pumpExecute, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = PumpExecuteRequestSchema.parse(raw);
    requireUnlocked();
    void request;
    throw new Error("Pump.fun Mainnet execution is not enabled yet. Use proposal, unsigned simulation, and final revalidation only.");
  });

  ipcMain.handle(IPC_CHANNELS.pumpRiskSettingsGet, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return PumpRiskSettingsResponseSchema.parse({ schemaVersion: 1, settings: pumpRiskSettings.get() });
  });

  ipcMain.handle(IPC_CHANNELS.pumpRiskSettingsSave, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = PumpRiskSettingsSaveRequestSchema.parse(raw);
    requireUnlocked();
    return PumpRiskSettingsMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, settings: pumpRiskSettings.save(request.settings) });
  });

  ipcMain.handle(IPC_CHANNELS.missionSimulate, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = MissionSimulateRequestSchema.parse(raw);
    requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    const mission = sessionRecord?.messages.find((message) => message.missionPreview?.id === request.missionId)?.missionPreview;
    if (!mission) throw new Error("Mission contract is unavailable in encrypted session history");
    const simulation = await simulations.simulate(mission);
    return MissionSimulateResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, simulation });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderSimulate, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = LimitOrderSimulateRequestSchema.parse(raw);
    requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    const preview = sessionRecord?.messages.find((message) => message.limitOrderPreview?.id === request.previewId)?.limitOrderPreview;
    if (!preview) throw new Error("Limit-order contract is unavailable in encrypted session history");
    const simulation = await limitOrders.simulate(preview);
    return LimitOrderSimulateResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, simulation });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderExecute, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = LimitOrderExecuteRequestSchema.parse(raw);
    requireUnlocked();
    if (!(await passwords.verify(request.masterPassword))) throw new Error("Master password is incorrect");
    const sessionRecord = await sessions.get(request.sessionId);
    if (!sessionRecord) throw new Error("Session is unavailable");
    const message = sessionRecord.messages.find((candidate) => candidate.limitOrderPreview?.id === request.previewId);
    if (!message?.limitOrderPreview || message.limitOrderSimulation?.id !== request.simulationId || message.limitOrderSimulation.status !== "passed") throw new Error("A matching passed limit-order simulation is required");
    if (message.limitOrderExecution !== undefined) throw new Error("This limit order has already been submitted");
    const receipt = await limitOrders.execute(message.limitOrderPreview, request.simulationId);
    return LimitOrderExecuteResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderList, async (event, raw: unknown) => {
    assertTrustedSender(event); const request = LimitOrderListRequestSchema.parse(raw); requireUnlocked();
    const registered = (await wallets.listWallets()).some((wallet) => wallet.address === request.walletAddress);
    if (!registered) throw new Error("Wallet is unavailable in the encrypted local vault");
    return LimitOrderListResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, orders: await limitOrders.list(request.walletAddress, request.state) });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderCancelSimulate, async (event, raw: unknown) => {
    assertTrustedSender(event); const request = LimitOrderCancelSimulateRequestSchema.parse(raw); requireUnlocked();
    const simulation = await limitOrders.simulateCancel(request.walletAddress, request.orderId);
    return LimitOrderCancelSimulateResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, simulation });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderCancelExecute, async (event, raw: unknown) => {
    assertTrustedSender(event); const request = LimitOrderCancelExecuteRequestSchema.parse(raw); requireUnlocked();
    if (!(await passwords.verify(request.masterPassword))) throw new Error("Master password is incorrect");
    const receipt = await limitOrders.executeCancel(request.walletAddress, request.orderId, request.simulationId);
    return LimitOrderCancelExecuteResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderVerifyExecution, async (event, raw: unknown) => {
    assertTrustedSender(event); const request = LimitOrderVerifyExecutionRequestSchema.parse(raw); requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null) throw new Error("Encrypted session context is unavailable");
    const messageIndex = sessionRecord.messages.findIndex((message) => message.limitOrderPreview?.id === request.previewId && message.limitOrderExecution?.id === request.receiptId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    if (message?.limitOrderExecution === undefined) throw new Error("Execution receipt is unavailable in encrypted session history");
    const receipt = await limitOrders.verifyExecutionReceipt(message.limitOrderExecution);
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex ? { ...entry, limitOrderExecution: receipt } : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return LimitOrderVerifyExecutionResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.limitOrderVerifyCancel, async (event, raw: unknown) => {
    assertTrustedSender(event); const request = LimitOrderVerifyCancelRequestSchema.parse(raw); requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null) throw new Error("Encrypted session context is unavailable");
    const messageIndex = sessionRecord.messages.findIndex((message) => message.limitOrderCancelReceipt?.orderId === request.orderId && message.limitOrderCancelReceipt?.id === request.receiptId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    if (message?.limitOrderCancelReceipt === undefined) throw new Error("Cancellation receipt is unavailable in encrypted session history");
    const receipt = await limitOrders.verifyCancelReceipt(message.limitOrderCancelReceipt);
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex ? { ...entry, limitOrderCancelReceipt: receipt } : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return LimitOrderVerifyCancelResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.missionExecute, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = MissionExecuteRequestSchema.parse(raw);
    requireUnlocked();
    if (!(await passwords.verify(request.masterPassword))) throw new Error("Master password is incorrect");
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null || sessionRecord.permission !== "restricted") throw new Error("Restricted session context is unavailable");
    const messageIndex = sessionRecord.messages.findIndex((message) => message.missionPreview?.id === request.missionId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    const mission = message?.missionPreview;
    if (!mission || message?.missionSimulation?.id !== request.simulationId || message.missionSimulation.status !== "passed") throw new Error("A matching passed simulation is required");
    if (message.missionExecution !== undefined) throw new Error("This mission transaction has already been submitted");
    const receipt = await simulations.execute(mission, request.simulationId);
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex ? { ...entry, missionExecution: receipt } : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return MissionExecuteResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.missionVerifyExecution, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = MissionVerifyExecutionRequestSchema.parse(raw);
    requireUnlocked();
    const sessionRecord = await sessions.get(request.sessionId);
    if (sessionRecord === null) throw new Error("Encrypted session context is unavailable");
    const messageIndex = sessionRecord.messages.findIndex((message) => message.missionPreview?.id === request.missionId && message.missionExecution?.id === request.receiptId);
    const message = messageIndex < 0 ? undefined : sessionRecord.messages[messageIndex];
    if (message?.missionExecution === undefined) throw new Error("Execution receipt is unavailable in encrypted session history");
    const receipt = await simulations.verifyReceipt(message.missionExecution);
    const messages = sessionRecord.messages.map((entry, index) => index === messageIndex ? { ...entry, missionExecution: receipt } : entry);
    await sessions.upsert({ ...sessionRecord, messages });
    return MissionVerifyExecutionResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, receipt });
  });

  ipcMain.handle(IPC_CHANNELS.transactionSettingsGet, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return TransactionSettingsResponseSchema.parse({ schemaVersion: 1, settings: transactionSettings.get() });
  });

  ipcMain.handle(IPC_CHANNELS.transactionSettingsSave, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = TransactionSettingsSaveRequestSchema.parse(raw);
    requireUnlocked();
    return TransactionSettingsMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, settings: transactionSettings.save(request.settings) });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterGetSettings, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return JupiterSettingsResponseSchema.parse({ schemaVersion: 1, configured: (await secretStore.getSecret("jupiter-api-key")) !== null });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterSaveKey, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = JupiterSaveKeyRequestSchema.parse(raw);
    requireUnlocked();
    await secretStore.setSecret("jupiter-api-key", request.apiKey);
    return JupiterKeyMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, configured: true });
  });

  ipcMain.handle(IPC_CHANNELS.tavilyGetSettings, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return TavilySettingsResponseSchema.parse({ schemaVersion: 1, configured: (await secretStore.getSecret("tavily-api-key")) !== null });
  });

  ipcMain.handle(IPC_CHANNELS.tavilySaveKey, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = TavilySaveKeyRequestSchema.parse(raw);
    requireUnlocked();
    await secretStore.setSecret("tavily-api-key", request.apiKey);
    return TavilyKeyMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, configured: true });
  });

  ipcMain.handle(IPC_CHANNELS.solanaRpcGetSettings, async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    const stored = database.getSetting("solana_rpc_url") as string | null;
    return SolanaRpcSettingsResponseSchema.parse({ schemaVersion: 1, rpcUrl: stored ?? null });
  });

  ipcMain.handle(IPC_CHANNELS.solanaRpcSaveUrl, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const request = SolanaRpcSaveUrlRequestSchema.parse(raw);
    requireUnlocked();
    if (request.rpcUrl) {
      database.setSetting("solana_rpc_url", request.rpcUrl);
    } else {
      database.deleteSetting("solana_rpc_url");
    }
    const nextUrl = request.rpcUrl ?? undefined;
    reads.updateRpcUrl(nextUrl);
    pumpRpc.updateRpcUrl(nextUrl);
    return SolanaRpcMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, rpcUrl: request.rpcUrl });
  });

  ipcMain.handle("strategy:getPositions", async (event) => {
    assertTrustedSender(event);
    requireUnlocked();
    return { positions: strategyManager.getActivePositions() };
  });

  ipcMain.handle("strategy:upsertPosition", async (event, config) => {
    assertTrustedSender(event);
    requireUnlocked();
    strategyManager.registerPosition(config);
    return { success: true };
  });

  ipcMain.handle("strategy:closePosition", async (event, id) => {
    assertTrustedSender(event);
    requireUnlocked();
    strategyManager.closePosition(id);
    return { success: true };
  });

  ipcMain.handle("runtime:toggleBackgroundLoop", async (event, enabled) => {
    assertTrustedSender(event);
    requireUnlocked();
    if (enabled) {
      observationService?.startObservationLoop(async (mints) => {
        const pricePoints = await reads.prices(mints);
        const map = new Map<string, number>();
        for (const [mint, pp] of pricePoints) {
          map.set(mint, pp.usdPrice);
        }
        return map;
      });
    } else {
      observationService?.stopObservationLoop();
    }
    return { success: true };
  });
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  assertTrustedIpcEvent(event, mainWindow?.webContents ?? null);
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(denyPermissionCheck);
  session.defaultSession.setPermissionRequestHandler(denyPermissionRequest);
  keystore = new LocalEncryptedKeystore(join(app.getPath("userData"), "keystore", "secrets.v1.json"));
  runtimeDatabase = await RuntimeDatabase.open(join(app.getPath("userData"), "data", "silfable-mainnet.sqlite3"));
  const initialCustomRpc = (runtimeDatabase.getSetting("solana_rpc_url") as string | null) ?? undefined;
  const passwords = new MasterPasswordService(runtimeDatabase);
  const wallets = new WalletOnboardingService(keystore, runtimeDatabase);
  const rpcConfig = initialCustomRpc === undefined ? {} : { rpcUrl: initialCustomRpc };
  const reads = new MainnetReadService({ secrets: keystore, wallets, ...rpcConfig });
  const ai = new AiService({ keystore, settings: runtimeDatabase, readService: reads });
  const sessions = new SessionService(runtimeDatabase, keystore);
  const transactionSettings = new TransactionSettingsService(runtimeDatabase);
  const pumpRiskSettings = new PumpRiskSettingsService(runtimeDatabase);
  const pumpRiskLedger = new PumpRiskLedgerService(runtimeDatabase, keystore);
  const pumpReceipts = new EncryptedPumpReceiptService(runtimeDatabase, keystore, pumpRiskLedger);
  const simulations = new MissionSimulationService(reads, wallets, transactionSettings);
  const trigger = new JupiterTriggerV2Client({ secrets: keystore, wallets });
  const limitOrders = new LimitOrderService({ reads, wallets, trigger });
  const pumpRpc = new PumpMainnetRpc(rpcConfig);
  const preparedPump = new PumpPreparedExecutionService();

  const strategyManager = new PositionStrategyManager(runtimeDatabase);
  observationService = new DurableBackgroundObservationService(strategyManager, 15000);
  
  const autonomousExecutor = new AutonomousExecutorService({
    strategyManager,
    pumpRpc,
    transactionSettings,
    pumpRiskSettings,
    pumpRiskLedger,
    keystore,
    receiptStore: pumpReceipts,
    wallets,
  });

  observationService.on("auto_execution_triggered", (event: ExitTriggerEvent) => {
    autonomousExecutor.executeTrigger(event).catch(console.error);
  });

  const missionProposals = new MissionProposalService(reads, observationService);
  const tokenAllowlist = new TokenAllowlistService(runtimeDatabase, reads);

  // P3.5 Durable order reconciliation
  const reconciliation = new ReconciliationService(sessions, limitOrders);
  reconciliation.reconcilePendingOrders().catch(() => {});

  observationService.startObservationLoop(async (mints) => {
    const pricePoints = await reads.prices(mints);
    const map = new Map<string, number>();
    for (const [mint, pp] of pricePoints) {
      map.set(mint, pp.usdPrice);
    }
    return map;
  });

  registerIpc(keystore, runtimeDatabase, passwords, wallets, reads, ai, sessions, simulations, limitOrders, transactionSettings, pumpRiskSettings, pumpRiskLedger, pumpReceipts, pumpRpc, preparedPump, strategyManager, observationService);
  mainWindow = createMainWindow();
  tray = createTray();
  powerMonitor.on("suspend", () => { preparedPump.clear(); keystore?.lock(); observationService?.stopObservationLoop(); });
  powerMonitor.on("resume", () => {
    observationService?.startObservationLoop(async (mints) => {
      const pricePoints = await reads.prices(mints);
      const map = new Map<string, number>();
      for (const [mint, pp] of pricePoints) {
        map.set(mint, pp.usdPrice);
      }
      return map;
    });
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
}).catch(() => app.exit(1));

app.on("before-quit", () => {
  isQuitting = true;
  observationService?.stopObservationLoop();
  keystore?.lock();
  runtimeDatabase?.close();
  runtimeDatabase = null;
  tray?.destroy();
  tray = null;
});
