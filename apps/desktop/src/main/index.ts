import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, powerMonitor, session, Tray } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AiDeleteProviderRequestSchema,
  AiDraftDcaRequestSchema,
  AiDraftDcaResponseSchema,
  AiProviderMutationResponseSchema,
  AiSaveProviderRequestSchema,
  AiSettingsResponseSchema,
  DcaSimulationRequestSchema,
  DcaSimulationResponseSchema,
  DevnetAirdropRequestSchema,
  DevnetAirdropResponseSchema,
  IPC_CHANNELS,
  MissionAuthorizeRequestSchema,
  MissionAuditRequestSchema,
  MissionAuditResponseSchema,
  MissionCommandRequestSchema,
  MissionListResponseSchema,
  MissionMutationResponseSchema,
  MissionSaveDraftRequestSchema,
  RuntimeStatusSchema,
  WalletCreateRequestSchema,
  WalletCreateResponseSchema,
  WalletLockResponseSchema,
  WalletImportMnemonicRequestSchema,
  WalletImportPrivateKeyRequestSchema,
  WalletImportResponseSchema,
  WalletBalanceRequestSchema,
  WalletBalanceResponseSchema,
  WalletUnlockRequestSchema,
  WalletUnlockResponseSchema,
} from "@silfable/contracts";
import { simulateDcaCycle } from "@silfable/core";

import { LocalEncryptedKeystore } from "./storage/keystore.js";
import { RuntimeDatabase } from "./storage/database.js";
import { LocalDataCipher } from "./storage/encryption.js";
import { WalletOnboardingService } from "./wallet/onboarding.js";
import {
  DevnetWalletRpcService,
  NetworkHealthMonitor,
  SolanaDevnetRpc,
} from "./rpc/devnet.js";
import {
  MissionService,
  MissionSimulationScheduler,
  type MissionRuntimeEvent,
} from "./mission/service.js";
import { AiDraftService } from "./ai/service.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let keystore: LocalEncryptedKeystore | null = null;
let runtimeDatabase: RuntimeDatabase | null = null;
let networkMonitor: NetworkHealthMonitor | null = null;
let missionScheduler: MissionSimulationScheduler | null = null;

app.enableSandbox();

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#050505",
    show: false,
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/index.mjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());
  window.on("minimize", () => {
    window.hide();
  });
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
  }

  return window;
}

function createTray(): Tray {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#2563eb"/><path d="M9 22V10h3l8 8v-8h3v12h-3l-8-8v8H9Z" fill="#fafafa"/></svg>`;
  const icon = nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`)
    .resize({ width: 16, height: 16 });
  const appTray = new Tray(icon);

  appTray.setToolTip("Silfable — Devnet Simulation");
  appTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Silfable",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  appTray.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  return appTray;
}

function registerIpc(
  secretStore: LocalEncryptedKeystore,
  database: RuntimeDatabase,
  healthMonitor: NetworkHealthMonitor,
  walletRpc: DevnetWalletRpcService,
  missions: MissionService,
  ai: AiDraftService,
): void {
  const walletOnboarding = new WalletOnboardingService(secretStore, database);

  ipcMain.handle(IPC_CHANNELS.runtimeStatus, (event) => {
    assertTrustedSender(event.sender);

    return RuntimeStatusSchema.parse({
      appVersion: app.getVersion(),
      profile: "devnet-simulation",
      networkHealth: healthMonitor.getSnapshot().health,
      keystore: secretStore.isLocked() ? "locked" : "unlocked",
      wallet: database.hasWallet("devnet-simulation") ? "configured" : "none",
      activeMissionCount: database.countRunningMissions(),
    });
  });

  ipcMain.handle(IPC_CHANNELS.simulateDca, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = DcaSimulationRequestSchema.parse(untrustedRequest);
    return DcaSimulationResponseSchema.parse(simulateDcaCycle(request));
  });

  ipcMain.handle(IPC_CHANNELS.walletUnlock, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletUnlockRequestSchema.parse(untrustedRequest);
    secretStore.unlock();
    missionScheduler?.start();
    return WalletUnlockResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      keystore: "unlocked",
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletLock, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletUnlockRequestSchema.parse(untrustedRequest);
    const halted = database.haltAllRunningMissions("explicit-lock", new Date().toISOString());
    secretStore.lock();
    for (const missionId of halted) notifyMissionEvent({ missionId, type: "halted", detail: "explicit-lock" });
    return WalletLockResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      keystore: "locked",
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletCreate, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletCreateRequestSchema.parse(untrustedRequest);
    return WalletCreateResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      ...(await walletOnboarding.createWallet()),
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportMnemonic, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletImportMnemonicRequestSchema.parse(untrustedRequest);
    const result = await walletOnboarding.importMnemonic(request.mnemonic);
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...result });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportPrivateKey, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletImportPrivateKeyRequestSchema.parse(untrustedRequest);
    const result = await walletOnboarding.importPrivateKey(request.privateKey);
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...result });
  });

  ipcMain.handle(IPC_CHANNELS.walletBalance, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = WalletBalanceRequestSchema.parse(untrustedRequest);
    const result = await walletRpc.getBalance();
    return WalletBalanceResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      ...result,
      commitment: "confirmed",
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetAirdrop, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = DevnetAirdropRequestSchema.parse(untrustedRequest);
    const result = await walletRpc.requestOneSolAirdrop();
    return DevnetAirdropResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      ...result,
      requestedLamportsAtomic: "1000000000",
    });
  });

  ipcMain.handle(IPC_CHANNELS.missionList, async (event) => {
    assertTrustedSender(event.sender);
    return MissionListResponseSchema.parse({ schemaVersion: 1, missions: await missions.list() });
  });

  ipcMain.handle(IPC_CHANNELS.missionSaveDraft, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = MissionSaveDraftRequestSchema.parse(untrustedRequest);
    const mission = await missions.saveDraft({
      plan: request.plan,
      ...(request.expectedRevision === undefined ? {} : { expectedRevision: request.expectedRevision }),
    });
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionAuthorize, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = MissionAuthorizeRequestSchema.parse(untrustedRequest);
    const mission = await missions.authorize(request);
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionStart, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = MissionCommandRequestSchema.parse(untrustedRequest);
    const mission = await missions.start(request.missionId, request.expectedRevision);
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionHalt, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = MissionCommandRequestSchema.parse(untrustedRequest);
    const mission = await missions.halt(request.missionId, request.expectedRevision);
    notifyMissionEvent({ missionId: mission.id, type: "halted", detail: "manual" });
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionAudit, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = MissionAuditRequestSchema.parse(untrustedRequest);
    return MissionAuditResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      missionId: request.missionId,
      cycles: await missions.getAudit(request.missionId),
    });
  });

  ipcMain.handle(IPC_CHANNELS.aiGetSettings, async (event) => {
    assertTrustedSender(event.sender);
    return AiSettingsResponseSchema.parse({ schemaVersion: 1, providers: await ai.listSettings() });
  });

  ipcMain.handle(IPC_CHANNELS.aiSaveProvider, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = AiSaveProviderRequestSchema.parse(untrustedRequest);
    const setting = await ai.saveProvider(request.provider, request.apiKey, request.model);
    return AiProviderMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, setting });
  });

  ipcMain.handle(IPC_CHANNELS.aiDeleteProvider, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = AiDeleteProviderRequestSchema.parse(untrustedRequest);
    const setting = await ai.deleteProvider(request.provider);
    return AiProviderMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, setting });
  });

  ipcMain.handle(IPC_CHANNELS.aiDraftDca, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event.sender);
    const request = AiDraftDcaRequestSchema.parse(untrustedRequest);
    const result = await ai.draftDca(request.provider, request.prompt);
    return AiDraftDcaResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      provider: request.provider,
      model: result.model,
      intent: result.intent,
      executionAttempted: false,
    });
  });
}

function assertTrustedSender(sender: Electron.WebContents): void {
  if (mainWindow === null || sender !== mainWindow.webContents) throw new Error("Rejected IPC sender");
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  keystore = new LocalEncryptedKeystore(join(app.getPath("userData"), "keystore", "secrets.v1.json"));
  runtimeDatabase = await RuntimeDatabase.open(join(app.getPath("userData"), "data", "silfable.sqlite3"));
  const devnetRpc = new SolanaDevnetRpc();
  networkMonitor = new NetworkHealthMonitor(devnetRpc);
  const walletOnboarding = new WalletOnboardingService(keystore, runtimeDatabase);
  const walletRpc = new DevnetWalletRpcService({
    rpc: devnetRpc,
    health: networkMonitor,
    getWalletAddress: () => walletOnboarding.getWalletAddress(),
  });
  const dataCipher = new LocalDataCipher(keystore);
  const missions = new MissionService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
    health: networkMonitor,
  });
  const ai = new AiDraftService({ keystore, settings: runtimeDatabase });
  missionScheduler = new MissionSimulationScheduler({
    database: runtimeDatabase,
    missions,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    walletRpc,
    onEvent: notifyMissionEvent,
  });
  missionScheduler.initialize();
  registerIpc(keystore, runtimeDatabase, networkMonitor, walletRpc, missions, ai);
  networkMonitor.start();
  missionScheduler.start();
  mainWindow = createMainWindow();
  tray = createTray();

  powerMonitor.on("suspend", () => {
    missionScheduler?.stop("system-suspend");
    keystore?.lock();
    networkMonitor?.stop();
  });
  powerMonitor.on("resume", () => {
    networkMonitor?.start();
    missionScheduler?.start();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}).catch(() => {
  // Storage is an execution prerequisite. Exit fail-closed without printing potentially sensitive paths.
  app.exit(1);
});

function notifyMissionEvent(event: MissionRuntimeEvent): void {
  const shortId = event.missionId.slice(0, 8);
  const copy = {
    halted: ["Mission halted", `Mission ${shortId} halted fail-closed. Open Silfable for the reason.`],
    skipped: ["DCA cycle skipped", `Mission ${shortId} skipped a missed simulation cycle.`],
    receipted: ["Simulation receipt ready", `Mission ${shortId} recorded a new encrypted simulation receipt.`],
    complete: ["Mission complete", `Mission ${shortId} completed its authorized simulation plan.`],
  } as const;
  const [title, body] = copy[event.type];
  tray?.setToolTip(`Silfable — ${title}`);
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body });
  notification.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  notification.show();
}

app.on("before-quit", () => {
  isQuitting = true;
  missionScheduler?.stop("application-quit", false);
  missionScheduler = null;
  keystore?.lock();
  networkMonitor?.stop();
  networkMonitor = null;
  runtimeDatabase?.close();
  runtimeDatabase = null;
  tray?.destroy();
  tray = null;
});
