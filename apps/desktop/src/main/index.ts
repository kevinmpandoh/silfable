import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, powerMonitor, session, shell, Tray } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSigner } from "@solana/kit";

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
  DevnetCanaryExecuteRequestSchema,
  DevnetCanaryExecuteResponseSchema,
  DevnetCanaryListResponseSchema,
  DevnetFixtureProvisionExecuteRequestSchema,
  DevnetFixtureProvisionExecuteResponseSchema,
  DevnetFixtureProvisionListResponseSchema,
  DevnetFixtureReviewActivateRequestSchema,
  DevnetFixtureReviewActivateResponseSchema,
  DevnetFixtureReviewGetActiveResponseSchema,
  DevnetFixtureTransferExecuteRequestSchema,
  DevnetFixtureTransferExecuteResponseSchema,
  DevnetFixtureTransferListResponseSchema,
  DevnetFixtureTransferApproveRequestSchema,
  DevnetFixtureTransferApproveResponseSchema,
  DevnetFixtureTransferGetApprovalResponseSchema,
  GuardedMissionAuthorizeRequestSchema,
  GuardedMissionRevokeRequestSchema,
  GuardedMissionMutationResponseSchema,
  GuardedMissionAuthorizationListResponseSchema,
  GuardedSchedulerArmRequestSchema,
  GuardedSchedulerArmRevokeRequestSchema,
  GuardedSchedulerArmMutationResponseSchema,
  GuardedSchedulerArmListResponseSchema,
  GuardedExecutionListResponseSchema,
  IPC_CHANNELS,
  MissionAuthorizeRequestSchema,
  MissionAuditRequestSchema,
  MissionAuditResponseSchema,
  MissionCommandRequestSchema,
  MissionListResponseSchema,
  MissionMutationResponseSchema,
  MissionSaveDraftRequestSchema,
  JupiterKeyMutationResponseSchema,
  JupiterSaveKeyRequestSchema,
  JupiterSettingsResponseSchema,
  JupiterShadowListResponseSchema,
  JupiterShadowQuoteRequestSchema,
  JupiterShadowQuoteResponseSchema,
  RuntimeStatusSchema,
  UpdateCheckResponseSchema,
  UpdateCommandRequestSchema,
  UpdateOpenReviewResponseSchema,
  UpdateStatusSchema,
  TelemetryConsentRequestSchema,
  TelemetryMutationResponseSchema,
  TelemetryReportsResponseSchema,
  TelemetrySettingsSchema,
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
import {
  RuntimeDatabase,
  type FixtureProvisionStorageRecord,
  type FixtureReviewStorageRecord,
  type GuardedFixtureTransferStorageRecord,
  type GuardedFixtureTransferApprovalStorageRecord,
  type GuardedMissionAuthorizationStorageRecord,
  type GuardedSchedulerArmStorageRecord,
  type GuardedExecutionStorageRecord,
} from "./storage/database.js";
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
import { DevnetCanaryExecutionService, SolanaDevnetCanaryAdapter } from "./execution/canary.js";
import {
  FixtureProvisioningExecutionService,
  SolanaFixtureProvisioningAdapter,
} from "./execution/fixture-provisioning-executor.js";
import { FixtureReviewService } from "./execution/fixture-review.js";
import {
  GuardedFixtureTransferExecutionService,
  SolanaGuardedFixtureTransferAdapter,
} from "./execution/guarded-fixture-transfer.js";
import { FixtureTransferApprovalService } from "./execution/fixture-transfer-approval.js";
import { GuardedMissionAuthorizationService } from "./execution/guarded-mission-authorization.js";
import { GuardedSchedulerReadinessService } from "./execution/guarded-scheduler-readiness.js";
import { GuardedFixtureCycleProposalService } from "./execution/guarded-fixture-cycle-proposal.js";
import { GuardedSchedulerArmService } from "./execution/guarded-scheduler-arm.js";
import { GuardedFixtureCycleExecutionBridge } from "./execution/guarded-fixture-cycle-bridge.js";
import { JUPITER_ORDER_ENDPOINT, JupiterShadowService } from "./jupiter/shadow.js";
import { UpdateReviewService } from "./update/service.js";
import {
  LocalCrashTelemetryService,
  normalizeChildProcessType,
  normalizeCrashReason,
} from "./telemetry/service.js";
import {
  assertTrustedIpcEvent,
  denyPermissionCheck,
  denyPermissionRequest,
  denyWindowOpen,
  HARDENED_WEB_PREFERENCES,
  preventRendererNavigation,
} from "./security/policy.js";

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
      preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
      ...HARDENED_WEB_PREFERENCES,
    },
  });

  window.webContents.setWindowOpenHandler(denyWindowOpen);
  window.webContents.on("will-navigate", preventRendererNavigation);
  window.webContents.on("will-attach-webview", preventRendererNavigation);
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
  walletOnboarding: WalletOnboardingService,
  missions: MissionService,
  ai: AiDraftService,
  canary: DevnetCanaryExecutionService,
  fixtureProvisioning: FixtureProvisioningExecutionService,
  fixtureReview: FixtureReviewService,
  fixtureTransfer: GuardedFixtureTransferExecutionService,
  fixtureTransferApproval: FixtureTransferApprovalService,
  guardedMissionAuthorization: GuardedMissionAuthorizationService,
  guardedSchedulerArm: GuardedSchedulerArmService,
  guardedExecution: GuardedFixtureCycleExecutionBridge,
  jupiter: JupiterShadowService,
  updates: UpdateReviewService,
  telemetry: LocalCrashTelemetryService,
): void {
  ipcMain.handle(IPC_CHANNELS.runtimeStatus, (event) => {
    assertTrustedSender(event);

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
    assertTrustedSender(event);
    const request = DcaSimulationRequestSchema.parse(untrustedRequest);
    return DcaSimulationResponseSchema.parse(simulateDcaCycle(request));
  });

  ipcMain.handle(IPC_CHANNELS.walletUnlock, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletUnlockRequestSchema.parse(untrustedRequest);
    secretStore.unlock();
    await canary.reconcilePending();
    await fixtureProvisioning.reconcilePending();
    await fixtureTransfer.reconcilePending();
    await guardedExecution.reconcilePending();
    missionScheduler?.start();
    return WalletUnlockResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      keystore: "unlocked",
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletLock, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletUnlockRequestSchema.parse(untrustedRequest);
    const now = new Date().toISOString();
    const halted = database.haltAllRunningMissions("explicit-lock", now);
    database.revokeOpenGuardedSchedulerArms(now);
    secretStore.lock();
    for (const missionId of halted) notifyMissionEvent({ missionId, type: "halted", detail: "explicit-lock" });
    return WalletLockResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      keystore: "locked",
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletCreate, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletCreateRequestSchema.parse(untrustedRequest);
    return WalletCreateResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      ...(await walletOnboarding.createWallet()),
    });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportMnemonic, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletImportMnemonicRequestSchema.parse(untrustedRequest);
    const result = await walletOnboarding.importMnemonic(request.mnemonic);
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...result });
  });

  ipcMain.handle(IPC_CHANNELS.walletImportPrivateKey, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletImportPrivateKeyRequestSchema.parse(untrustedRequest);
    const result = await walletOnboarding.importPrivateKey(request.privateKey);
    return WalletImportResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, ...result });
  });

  ipcMain.handle(IPC_CHANNELS.walletBalance, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
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
    assertTrustedSender(event);
    const request = DevnetAirdropRequestSchema.parse(untrustedRequest);
    const result = await walletRpc.requestOneSolAirdrop();
    return DevnetAirdropResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      ...result,
      requestedLamportsAtomic: "1000000000",
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetCanaryExecute, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = DevnetCanaryExecuteRequestSchema.parse(untrustedRequest);
    return DevnetCanaryExecuteResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      execution: await canary.execute(),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetCanaryList, async (event) => {
    assertTrustedSender(event);
    return DevnetCanaryListResponseSchema.parse({ schemaVersion: 1, executions: await canary.list() });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureProvisionExecute, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = DevnetFixtureProvisionExecuteRequestSchema.parse(untrustedRequest);
    const destinationOwner = await generateKeyPairSigner();
    const provision = await fixtureProvisioning.execute({
      destinationOwner: destinationOwner.address,
      decimals: 6,
      supplyAtomic: 1_000_000_000n,
      transferAmountAtomic: 1_000_000n,
    });
    return DevnetFixtureProvisionExecuteResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      provision: toFixtureProvisionView(provision),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureProvisionList, (event) => {
    assertTrustedSender(event);
    if (secretStore.isLocked()) throw new Error("Keystore is locked");
    return DevnetFixtureProvisionListResponseSchema.parse({
      schemaVersion: 1,
      provisions: database.listFixtureProvisions(20).map(toFixtureProvisionView),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureReviewActivate, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = DevnetFixtureReviewActivateRequestSchema.parse(untrustedRequest);
    return DevnetFixtureReviewActivateResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      fixture: toFixtureReviewView(await fixtureReview.reviewAndActivate(request.provisionId)),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureReviewGetActive, (event) => {
    assertTrustedSender(event);
    const active = fixtureReview.getActive();
    return DevnetFixtureReviewGetActiveResponseSchema.parse({
      schemaVersion: 1,
      fixture: active === null ? null : toFixtureReviewView(active),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureTransferExecute, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = DevnetFixtureTransferExecuteRequestSchema.parse(untrustedRequest);
    return DevnetFixtureTransferExecuteResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      transfer: toFixtureTransferView(await fixtureTransfer.execute()),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureTransferList, (event) => {
    assertTrustedSender(event);
    if (secretStore.isLocked()) throw new Error("Keystore is locked");
    return DevnetFixtureTransferListResponseSchema.parse({
      schemaVersion: 1,
      transfers: database.listGuardedFixtureTransfers(20).map(toFixtureTransferView),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureTransferApprove, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = DevnetFixtureTransferApproveRequestSchema.parse(untrustedRequest);
    return DevnetFixtureTransferApproveResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      approval: toFixtureTransferApprovalView(await fixtureTransferApproval.approve(request.transferId)),
    });
  });

  ipcMain.handle(IPC_CHANNELS.devnetFixtureTransferGetApproval, (event) => {
    assertTrustedSender(event);
    const approval = fixtureTransferApproval.getApproval();
    return DevnetFixtureTransferGetApprovalResponseSchema.parse({
      schemaVersion: 1,
      approval: approval === null ? null : toFixtureTransferApprovalView(approval),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedMissionAuthorize, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = GuardedMissionAuthorizeRequestSchema.parse(untrustedRequest);
    return GuardedMissionMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      authorization: toGuardedMissionAuthorizationView(await guardedMissionAuthorization.authorize({
        missionId: request.missionId,
        expectedRevision: request.expectedRevision,
        expectedPlanDigest: request.expectedPlanDigest,
      })),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedMissionRevoke, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = GuardedMissionRevokeRequestSchema.parse(untrustedRequest);
    return GuardedMissionMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      authorization: toGuardedMissionAuthorizationView(guardedMissionAuthorization.revoke(request.authorizationId)),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedMissionListAuthorizations, (event) => {
    assertTrustedSender(event);
    return GuardedMissionAuthorizationListResponseSchema.parse({
      schemaVersion: 1,
      authorizations: guardedMissionAuthorization.list().map(toGuardedMissionAuthorizationView),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedSchedulerArm, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = GuardedSchedulerArmRequestSchema.parse(untrustedRequest);
    return GuardedSchedulerArmMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      arm: toGuardedSchedulerArmView(await guardedSchedulerArm.arm({
        authorizationId: request.authorizationId,
        acknowledgedAutomaticSigning: request.acknowledgedAutomaticSigning,
        acknowledgedHotWallet: request.acknowledgedHotWallet,
        acknowledgedDevnetFixtureOnly: request.acknowledgedDevnetFixtureOnly,
      })),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedSchedulerRevoke, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = GuardedSchedulerArmRevokeRequestSchema.parse(untrustedRequest);
    return GuardedSchedulerArmMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      arm: toGuardedSchedulerArmView(guardedSchedulerArm.revoke(request.schedulerArmId)),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedSchedulerListArms, (event) => {
    assertTrustedSender(event);
    return GuardedSchedulerArmListResponseSchema.parse({
      schemaVersion: 1,
      arms: guardedSchedulerArm.list().map(toGuardedSchedulerArmView),
    });
  });

  ipcMain.handle(IPC_CHANNELS.guardedExecutionList, (event) => {
    assertTrustedSender(event);
    if (secretStore.isLocked()) throw new Error("Keystore is locked");
    return GuardedExecutionListResponseSchema.parse({
      schemaVersion: 1,
      executions: database.listGuardedExecutions(20).map((record) =>
        toGuardedExecutionView(record, database)),
    });
  });

  ipcMain.handle(IPC_CHANNELS.missionList, async (event) => {
    assertTrustedSender(event);
    return MissionListResponseSchema.parse({ schemaVersion: 1, missions: await missions.list() });
  });

  ipcMain.handle(IPC_CHANNELS.missionSaveDraft, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = MissionSaveDraftRequestSchema.parse(untrustedRequest);
    const mission = await missions.saveDraft({
      plan: request.plan,
      ...(request.expectedRevision === undefined ? {} : { expectedRevision: request.expectedRevision }),
    });
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionAuthorize, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = MissionAuthorizeRequestSchema.parse(untrustedRequest);
    const mission = await missions.authorize(request);
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionStart, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = MissionCommandRequestSchema.parse(untrustedRequest);
    const mission = await missions.start(request.missionId, request.expectedRevision);
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionHalt, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = MissionCommandRequestSchema.parse(untrustedRequest);
    const mission = await missions.halt(request.missionId, request.expectedRevision);
    notifyMissionEvent({ missionId: mission.id, type: "halted", detail: "manual" });
    return MissionMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, mission });
  });

  ipcMain.handle(IPC_CHANNELS.missionAudit, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = MissionAuditRequestSchema.parse(untrustedRequest);
    return MissionAuditResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      missionId: request.missionId,
      cycles: await missions.getAudit(request.missionId),
    });
  });

  ipcMain.handle(IPC_CHANNELS.aiGetSettings, async (event) => {
    assertTrustedSender(event);
    return AiSettingsResponseSchema.parse({ schemaVersion: 1, providers: await ai.listSettings() });
  });

  ipcMain.handle(IPC_CHANNELS.aiSaveProvider, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = AiSaveProviderRequestSchema.parse(untrustedRequest);
    const setting = await ai.saveProvider(request.provider, request.apiKey, request.model);
    return AiProviderMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, setting });
  });

  ipcMain.handle(IPC_CHANNELS.aiDeleteProvider, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = AiDeleteProviderRequestSchema.parse(untrustedRequest);
    const setting = await ai.deleteProvider(request.provider);
    return AiProviderMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, setting });
  });

  ipcMain.handle(IPC_CHANNELS.aiDraftDca, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
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

  ipcMain.handle(IPC_CHANNELS.jupiterGetSettings, async (event) => {
    assertTrustedSender(event);
    return JupiterSettingsResponseSchema.parse({
      schemaVersion: 1,
      configured: await jupiter.isConfigured(),
      endpoint: JUPITER_ORDER_ENDPOINT,
    });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterSaveKey, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = JupiterSaveKeyRequestSchema.parse(untrustedRequest);
    await jupiter.saveKey(request.apiKey);
    return JupiterKeyMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, configured: true });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterDeleteKey, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = WalletUnlockRequestSchema.parse(untrustedRequest);
    await jupiter.deleteKey();
    return JupiterKeyMutationResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, configured: false });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterShadowQuote, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = JupiterShadowQuoteRequestSchema.parse(untrustedRequest);
    return JupiterShadowQuoteResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      quote: await jupiter.quote(request),
    });
  });

  ipcMain.handle(IPC_CHANNELS.jupiterShadowList, async (event) => {
    assertTrustedSender(event);
    return JupiterShadowListResponseSchema.parse({ schemaVersion: 1, quotes: await jupiter.list() });
  });

  ipcMain.handle(IPC_CHANNELS.updateGetStatus, (event) => {
    assertTrustedSender(event);
    return UpdateStatusSchema.parse(updates.getStatus());
  });

  ipcMain.handle(IPC_CHANNELS.updateCheck, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = UpdateCommandRequestSchema.parse(untrustedRequest);
    return UpdateCheckResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      status: await updates.check(),
    });
  });

  ipcMain.handle(IPC_CHANNELS.updateOpenReview, async (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = UpdateCommandRequestSchema.parse(untrustedRequest);
    await updates.openReview();
    return UpdateOpenReviewResponseSchema.parse({ schemaVersion: 1, requestId: request.requestId, opened: true });
  });

  ipcMain.handle(IPC_CHANNELS.telemetryGetSettings, (event) => {
    assertTrustedSender(event);
    return TelemetrySettingsSchema.parse(telemetry.getSettings());
  });

  ipcMain.handle(IPC_CHANNELS.telemetrySetConsent, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = TelemetryConsentRequestSchema.parse(untrustedRequest);
    return TelemetryMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      settings: telemetry.setConsent(request.consent),
    });
  });

  ipcMain.handle(IPC_CHANNELS.telemetryListReports, async (event) => {
    assertTrustedSender(event);
    return TelemetryReportsResponseSchema.parse({ schemaVersion: 1, reports: await telemetry.listReports() });
  });

  ipcMain.handle(IPC_CHANNELS.telemetryDeleteReports, (event, untrustedRequest: unknown) => {
    assertTrustedSender(event);
    const request = UpdateCommandRequestSchema.parse(untrustedRequest);
    return TelemetryMutationResponseSchema.parse({
      schemaVersion: 1,
      requestId: request.requestId,
      settings: telemetry.deleteReports(),
    });
  });
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  assertTrustedIpcEvent(event, mainWindow?.webContents ?? null);
}

function toFixtureProvisionView(record: FixtureProvisionStorageRecord) {
  return {
    schemaVersion: 1 as const,
    id: record.id,
    mintAddress: record.mintAddress,
    state: record.state,
    simulationUnits: record.simulationUnits,
    failureCode: record.failureCode,
    signingAttempted: record.signingAttempted,
    broadcastAttempted: record.broadcastAttempted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toFixtureReviewView(record: FixtureReviewStorageRecord) {
  return {
    schemaVersion: 1 as const,
    provisionId: record.provisionId,
    manifestDigest: record.manifestDigest,
    mintAddress: record.mintAddress,
    sourceTokenAccount: record.sourceTokenAccount,
    destinationTokenAccount: record.destinationTokenAccount,
    walletAuthority: record.walletAuthority,
    observedSlot: record.observedSlot,
    active: true as const,
    createdAt: record.createdAt,
  };
}

function toFixtureTransferView(record: GuardedFixtureTransferStorageRecord) {
  return {
    schemaVersion: 1 as const,
    id: record.id,
    fixtureManifestDigest: record.fixtureManifestDigest,
    state: record.state,
    amountAtomic: "1000000" as const,
    simulationUnits: record.simulationUnits,
    failureCode: record.failureCode,
    signingAttempted: record.signingAttempted,
    broadcastAttempted: record.broadcastAttempted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toFixtureTransferApprovalView(record: GuardedFixtureTransferApprovalStorageRecord) {
  return {
    schemaVersion: 1 as const,
    transferId: record.transferId,
    fixtureManifestDigest: record.fixtureManifestDigest,
    approved: true as const,
    automaticTradingEnabled: false as const,
    approvedAt: record.approvedAt,
  };
}

function toGuardedMissionAuthorizationView(record: GuardedMissionAuthorizationStorageRecord) {
  return {
    schemaVersion: 1 as const,
    id: record.id,
    missionId: record.missionId,
    missionRevision: record.missionRevision,
    planDigest: record.planDigest,
    deskRuleDigest: record.deskRuleDigest,
    fixtureManifestDigest: record.fixtureManifestDigest,
    fixtureTransferId: record.fixtureTransferId,
    state: record.state,
    schedulerSigningEnabled: false as const,
    mainnetEnabled: false as const,
    authorizedAt: record.authorizedAt,
    revokedAt: record.revokedAt,
  };
}

function toGuardedSchedulerArmView(record: GuardedSchedulerArmStorageRecord) {
  return {
    schemaVersion: 1 as const,
    id: record.id,
    authorizationId: record.authorizationId,
    missionId: record.missionId,
    missionRevision: record.missionRevision,
    planDigest: record.planDigest,
    deskRuleDigest: record.deskRuleDigest,
    fixtureManifestDigest: record.fixtureManifestDigest,
    scope: record.scope,
    state: record.state,
    executionId: record.executionId,
    oneShotSigningAuthorized: record.state === "active",
    executionBridgeConnected: true as const,
    mainnetEnabled: false as const,
    armedAt: record.armedAt,
    expiresAt: record.expiresAt,
    consumedAt: record.consumedAt,
    revokedAt: record.revokedAt,
  };
}

function toGuardedExecutionView(record: GuardedExecutionStorageRecord, database: RuntimeDatabase) {
  return {
    schemaVersion: 1 as const,
    id: record.id,
    missionId: record.missionId,
    missionRevision: record.missionRevision,
    cycle: record.cycle,
    fixtureManifestDigest: record.fixtureManifestDigest,
    state: record.state,
    signingAttempted: record.signingAttempted,
    broadcastAttempted: record.broadcastAttempted,
    failureCode: record.failureCode,
    marketSwapPerformed: false as const,
    mainnetEnabled: false as const,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    events: database.listGuardedExecutionEvents(record.id).map((event) => ({
      id: event.id,
      fromState: event.fromState,
      toState: event.toState,
      eventName: event.eventName,
      createdAt: event.createdAt,
    })),
  };
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(denyPermissionCheck);
  session.defaultSession.setPermissionRequestHandler(denyPermissionRequest);
  keystore = new LocalEncryptedKeystore(join(app.getPath("userData"), "keystore", "secrets.v1.json"));
  runtimeDatabase = await RuntimeDatabase.open(join(app.getPath("userData"), "data", "silfable.sqlite3"));
  runtimeDatabase.revokeOpenGuardedSchedulerArms(new Date().toISOString());
  const devnetRpc = new SolanaDevnetRpc();
  networkMonitor = new NetworkHealthMonitor(devnetRpc);
  const walletOnboarding = new WalletOnboardingService(keystore, runtimeDatabase);
  const walletRpc = new DevnetWalletRpcService({
    rpc: devnetRpc,
    health: networkMonitor,
    getWalletAddress: () => walletOnboarding.getWalletAddress(),
  });
  const dataCipher = new LocalDataCipher(keystore);
  const canary = new DevnetCanaryExecutionService({
    database: runtimeDatabase,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    wallet: walletOnboarding,
    chain: new SolanaDevnetCanaryAdapter(devnetRpc),
  });
  const fixtureProvisioning = new FixtureProvisioningExecutionService({
    database: runtimeDatabase,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    wallet: walletOnboarding,
    chain: new SolanaFixtureProvisioningAdapter(devnetRpc),
  });
  const fixtureReview = new FixtureReviewService({
    database: runtimeDatabase,
    cipher: dataCipher,
    rpc: devnetRpc,
    keystore,
    health: networkMonitor,
  });
  const guardedTransferChain = new SolanaGuardedFixtureTransferAdapter(devnetRpc);
  const fixtureTransfer = new GuardedFixtureTransferExecutionService({
    database: runtimeDatabase,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    wallet: walletOnboarding,
    fixtureReview,
    chain: guardedTransferChain,
  });
  const fixtureTransferApproval = new FixtureTransferApprovalService({
    database: runtimeDatabase,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    fixtureReview,
    chain: devnetRpc,
  });
  const missions = new MissionService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
    health: networkMonitor,
  });
  const guardedMissionAuthorization = new GuardedMissionAuthorizationService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
    missions,
  });
  const guardedSchedulerArm = new GuardedSchedulerArmService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
  });
  const guardedReadiness = new GuardedSchedulerReadinessService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
    health: networkMonitor,
  });
  const guardedProposal = new GuardedFixtureCycleProposalService({
    database: runtimeDatabase,
    cipher: dataCipher,
    keystore,
    health: networkMonitor,
    fixtureReview,
  });
  const guardedExecution = new GuardedFixtureCycleExecutionBridge({
    database: runtimeDatabase,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    wallet: walletOnboarding,
    fixtureReview,
    missions,
    chain: guardedTransferChain,
  });
  const ai = new AiDraftService({ keystore, settings: runtimeDatabase });
  const jupiter = new JupiterShadowService({ keystore, database: runtimeDatabase, cipher: dataCipher });
  const updates = new UpdateReviewService({
    currentVersion: app.getVersion(),
    openExternal: async (url) => shell.openExternal(url),
  });
  const telemetry = new LocalCrashTelemetryService({
    database: runtimeDatabase,
    cipher: dataCipher,
    appVersion: app.getVersion(),
  });
  missionScheduler = new MissionSimulationScheduler({
    database: runtimeDatabase,
    missions,
    cipher: dataCipher,
    health: networkMonitor,
    keystore,
    walletRpc,
    guardedReadiness,
    guardedProposal,
    guardedExecution,
    onEvent: notifyMissionEvent,
  });
  missionScheduler.initialize();
  registerIpc(keystore, runtimeDatabase, networkMonitor, walletRpc, walletOnboarding, missions, ai, canary, fixtureProvisioning, fixtureReview, fixtureTransfer, fixtureTransferApproval, guardedMissionAuthorization, guardedSchedulerArm, guardedExecution, jupiter, updates, telemetry);
  networkMonitor.start();
  missionScheduler.start();
  mainWindow = createMainWindow();
  tray = createTray();
  app.on("render-process-gone", (_event, _contents, details) => {
    void telemetry.capture({
      processType: "renderer",
      reason: normalizeCrashReason(details.reason),
      exitCode: details.exitCode,
    });
  });
  app.on("child-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    void telemetry.capture({
      processType: normalizeChildProcessType(details.type),
      reason: normalizeCrashReason(details.reason),
      exitCode: details.exitCode,
    });
  });
  void updates.check().then((status) => {
    if (status.state !== "available" || !Notification.isSupported()) return;
    const notification = new Notification({
      title: `Silfable ${status.latestVersion} is available`,
      body: "Review the release notes before downloading. Silfable will never restart automatically.",
    });
    notification.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    notification.show();
  });

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
