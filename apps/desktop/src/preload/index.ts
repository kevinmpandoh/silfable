import { contextBridge, ipcRenderer } from "electron";

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
  WalletBalanceRequestSchema,
  WalletBalanceResponseSchema,
  WalletImportMnemonicRequestSchema,
  WalletImportPrivateKeyRequestSchema,
  WalletImportResponseSchema,
  WalletUnlockRequestSchema,
  WalletUnlockResponseSchema,
  type DcaSimulationRequest,
  type DcaSimulationResponse,
  type DevnetAirdropRequest,
  type DevnetAirdropResponse,
  type DevnetCanaryExecuteRequest,
  type DevnetCanaryExecuteResponse,
  type DevnetCanaryListResponse,
  type DevnetFixtureProvisionExecuteRequest,
  type DevnetFixtureProvisionExecuteResponse,
  type DevnetFixtureProvisionListResponse,
  type DevnetFixtureReviewActivateRequest,
  type DevnetFixtureReviewActivateResponse,
  type DevnetFixtureReviewGetActiveResponse,
  type DevnetFixtureTransferExecuteRequest,
  type DevnetFixtureTransferExecuteResponse,
  type DevnetFixtureTransferListResponse,
  type DevnetFixtureTransferApproveRequest,
  type DevnetFixtureTransferApproveResponse,
  type DevnetFixtureTransferGetApprovalResponse,
  type GuardedMissionAuthorizeRequest,
  type GuardedMissionRevokeRequest,
  type GuardedMissionMutationResponse,
  type GuardedMissionAuthorizationListResponse,
  type GuardedSchedulerArmRequest,
  type GuardedSchedulerArmRevokeRequest,
  type GuardedSchedulerArmMutationResponse,
  type GuardedSchedulerArmListResponse,
  type GuardedExecutionListResponse,
  type RuntimeStatus,
  type UpdateCheckResponse,
  type UpdateCommandRequest,
  type UpdateOpenReviewResponse,
  type UpdateStatus,
  type TelemetryConsentRequest,
  type TelemetryMutationResponse,
  type TelemetryReportsResponse,
  type TelemetrySettings,
  type MissionAuthorizeRequest,
  type MissionAuditRequest,
  type MissionAuditResponse,
  type MissionCommandRequest,
  type MissionListResponse,
  type MissionMutationResponse,
  type MissionSaveDraftRequest,
  type JupiterKeyMutationResponse,
  type JupiterSaveKeyRequest,
  type JupiterSettingsResponse,
  type JupiterShadowListResponse,
  type JupiterShadowQuoteRequest,
  type JupiterShadowQuoteResponse,
  type WalletCreateRequest,
  type WalletCreateResponse,
  type WalletLockResponse,
  type WalletBalanceRequest,
  type WalletBalanceResponse,
  type WalletImportMnemonicRequest,
  type WalletImportPrivateKeyRequest,
  type WalletImportResponse,
  type WalletUnlockRequest,
  type WalletUnlockResponse,
  type AiDeleteProviderRequest,
  type AiDraftDcaRequest,
  type AiDraftDcaResponse,
  type AiProviderMutationResponse,
  type AiSaveProviderRequest,
  type AiSettingsResponse,
} from "@silfable/contracts";

const api = Object.freeze({
  async getRuntimeStatus(): Promise<RuntimeStatus> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.runtimeStatus);
    return RuntimeStatusSchema.parse(response);
  },
  async simulateDca(request: DcaSimulationRequest): Promise<DcaSimulationResponse> {
    const validatedRequest = DcaSimulationRequestSchema.parse(request);
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.simulateDca, validatedRequest);
    return DcaSimulationResponseSchema.parse(response);
  },
  async unlockWalletKeystore(request: WalletUnlockRequest): Promise<WalletUnlockResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletUnlock,
      WalletUnlockRequestSchema.parse(request),
    );
    return WalletUnlockResponseSchema.parse(response);
  },
  async lockWalletKeystore(request: WalletUnlockRequest): Promise<WalletLockResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletLock,
      WalletUnlockRequestSchema.parse(request),
    );
    return WalletLockResponseSchema.parse(response);
  },
  async createWallet(request: WalletCreateRequest): Promise<WalletCreateResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletCreate,
      WalletCreateRequestSchema.parse(request),
    );
    return WalletCreateResponseSchema.parse(response);
  },
  async importWalletMnemonic(request: WalletImportMnemonicRequest): Promise<WalletImportResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletImportMnemonic,
      WalletImportMnemonicRequestSchema.parse(request),
    );
    return WalletImportResponseSchema.parse(response);
  },
  async importWalletPrivateKey(request: WalletImportPrivateKeyRequest): Promise<WalletImportResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletImportPrivateKey,
      WalletImportPrivateKeyRequestSchema.parse(request),
    );
    return WalletImportResponseSchema.parse(response);
  },
  async getWalletBalance(request: WalletBalanceRequest): Promise<WalletBalanceResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.walletBalance,
      WalletBalanceRequestSchema.parse(request),
    );
    return WalletBalanceResponseSchema.parse(response);
  },
  async requestDevnetAirdrop(request: DevnetAirdropRequest): Promise<DevnetAirdropResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetAirdrop,
      DevnetAirdropRequestSchema.parse(request),
    );
    return DevnetAirdropResponseSchema.parse(response);
  },
  async executeDevnetCanary(request: DevnetCanaryExecuteRequest): Promise<DevnetCanaryExecuteResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetCanaryExecute,
      DevnetCanaryExecuteRequestSchema.parse(request),
    );
    return DevnetCanaryExecuteResponseSchema.parse(response);
  },
  async listDevnetCanaries(): Promise<DevnetCanaryListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.devnetCanaryList);
    return DevnetCanaryListResponseSchema.parse(response);
  },
  async executeDevnetFixtureProvision(
    request: DevnetFixtureProvisionExecuteRequest,
  ): Promise<DevnetFixtureProvisionExecuteResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetFixtureProvisionExecute,
      DevnetFixtureProvisionExecuteRequestSchema.parse(request),
    );
    return DevnetFixtureProvisionExecuteResponseSchema.parse(response);
  },
  async listDevnetFixtureProvisions(): Promise<DevnetFixtureProvisionListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.devnetFixtureProvisionList);
    return DevnetFixtureProvisionListResponseSchema.parse(response);
  },
  async activateDevnetFixtureReview(
    request: DevnetFixtureReviewActivateRequest,
  ): Promise<DevnetFixtureReviewActivateResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetFixtureReviewActivate,
      DevnetFixtureReviewActivateRequestSchema.parse(request),
    );
    return DevnetFixtureReviewActivateResponseSchema.parse(response);
  },
  async getActiveDevnetFixture(): Promise<DevnetFixtureReviewGetActiveResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.devnetFixtureReviewGetActive);
    return DevnetFixtureReviewGetActiveResponseSchema.parse(response);
  },
  async executeDevnetFixtureTransfer(
    request: DevnetFixtureTransferExecuteRequest,
  ): Promise<DevnetFixtureTransferExecuteResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetFixtureTransferExecute,
      DevnetFixtureTransferExecuteRequestSchema.parse(request),
    );
    return DevnetFixtureTransferExecuteResponseSchema.parse(response);
  },
  async listDevnetFixtureTransfers(): Promise<DevnetFixtureTransferListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.devnetFixtureTransferList);
    return DevnetFixtureTransferListResponseSchema.parse(response);
  },
  async approveDevnetFixtureTransfer(
    request: DevnetFixtureTransferApproveRequest,
  ): Promise<DevnetFixtureTransferApproveResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.devnetFixtureTransferApprove,
      DevnetFixtureTransferApproveRequestSchema.parse(request),
    );
    return DevnetFixtureTransferApproveResponseSchema.parse(response);
  },
  async getDevnetFixtureTransferApproval(): Promise<DevnetFixtureTransferGetApprovalResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.devnetFixtureTransferGetApproval);
    return DevnetFixtureTransferGetApprovalResponseSchema.parse(response);
  },
  async authorizeGuardedMission(request: GuardedMissionAuthorizeRequest): Promise<GuardedMissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.guardedMissionAuthorize,
      GuardedMissionAuthorizeRequestSchema.parse(request),
    );
    return GuardedMissionMutationResponseSchema.parse(response);
  },
  async revokeGuardedMission(request: GuardedMissionRevokeRequest): Promise<GuardedMissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.guardedMissionRevoke,
      GuardedMissionRevokeRequestSchema.parse(request),
    );
    return GuardedMissionMutationResponseSchema.parse(response);
  },
  async listGuardedMissionAuthorizations(): Promise<GuardedMissionAuthorizationListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.guardedMissionListAuthorizations);
    return GuardedMissionAuthorizationListResponseSchema.parse(response);
  },
  async armGuardedScheduler(request: GuardedSchedulerArmRequest): Promise<GuardedSchedulerArmMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.guardedSchedulerArm,
      GuardedSchedulerArmRequestSchema.parse(request),
    );
    return GuardedSchedulerArmMutationResponseSchema.parse(response);
  },
  async revokeGuardedSchedulerArm(
    request: GuardedSchedulerArmRevokeRequest,
  ): Promise<GuardedSchedulerArmMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.guardedSchedulerRevoke,
      GuardedSchedulerArmRevokeRequestSchema.parse(request),
    );
    return GuardedSchedulerArmMutationResponseSchema.parse(response);
  },
  async listGuardedSchedulerArms(): Promise<GuardedSchedulerArmListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.guardedSchedulerListArms);
    return GuardedSchedulerArmListResponseSchema.parse(response);
  },
  async listGuardedExecutions(): Promise<GuardedExecutionListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.guardedExecutionList);
    return GuardedExecutionListResponseSchema.parse(response);
  },
  async listMissions(): Promise<MissionListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.missionList);
    return MissionListResponseSchema.parse(response);
  },
  async saveMissionDraft(request: MissionSaveDraftRequest): Promise<MissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.missionSaveDraft,
      MissionSaveDraftRequestSchema.parse(request),
    );
    return MissionMutationResponseSchema.parse(response);
  },
  async authorizeMission(request: MissionAuthorizeRequest): Promise<MissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.missionAuthorize,
      MissionAuthorizeRequestSchema.parse(request),
    );
    return MissionMutationResponseSchema.parse(response);
  },
  async startMission(request: MissionCommandRequest): Promise<MissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.missionStart,
      MissionCommandRequestSchema.parse(request),
    );
    return MissionMutationResponseSchema.parse(response);
  },
  async haltMission(request: MissionCommandRequest): Promise<MissionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.missionHalt,
      MissionCommandRequestSchema.parse(request),
    );
    return MissionMutationResponseSchema.parse(response);
  },
  async getMissionAudit(request: MissionAuditRequest): Promise<MissionAuditResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.missionAudit,
      MissionAuditRequestSchema.parse(request),
    );
    return MissionAuditResponseSchema.parse(response);
  },
  async getAiSettings(): Promise<AiSettingsResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.aiGetSettings);
    return AiSettingsResponseSchema.parse(response);
  },
  async saveAiProvider(request: AiSaveProviderRequest): Promise<AiProviderMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiSaveProvider,
      AiSaveProviderRequestSchema.parse(request),
    );
    return AiProviderMutationResponseSchema.parse(response);
  },
  async deleteAiProvider(request: AiDeleteProviderRequest): Promise<AiProviderMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiDeleteProvider,
      AiDeleteProviderRequestSchema.parse(request),
    );
    return AiProviderMutationResponseSchema.parse(response);
  },
  async draftDcaWithAi(request: AiDraftDcaRequest): Promise<AiDraftDcaResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiDraftDca,
      AiDraftDcaRequestSchema.parse(request),
    );
    return AiDraftDcaResponseSchema.parse(response);
  },
  async getJupiterSettings(): Promise<JupiterSettingsResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.jupiterGetSettings);
    return JupiterSettingsResponseSchema.parse(response);
  },
  async saveJupiterKey(request: JupiterSaveKeyRequest): Promise<JupiterKeyMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.jupiterSaveKey,
      JupiterSaveKeyRequestSchema.parse(request),
    );
    return JupiterKeyMutationResponseSchema.parse(response);
  },
  async deleteJupiterKey(request: WalletUnlockRequest): Promise<JupiterKeyMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.jupiterDeleteKey,
      WalletUnlockRequestSchema.parse(request),
    );
    return JupiterKeyMutationResponseSchema.parse(response);
  },
  async getJupiterShadowQuote(request: JupiterShadowQuoteRequest): Promise<JupiterShadowQuoteResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.jupiterShadowQuote,
      JupiterShadowQuoteRequestSchema.parse(request),
    );
    return JupiterShadowQuoteResponseSchema.parse(response);
  },
  async listJupiterShadowQuotes(): Promise<JupiterShadowListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.jupiterShadowList);
    return JupiterShadowListResponseSchema.parse(response);
  },
  async getUpdateStatus(): Promise<UpdateStatus> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.updateGetStatus);
    return UpdateStatusSchema.parse(response);
  },
  async checkForUpdate(request: UpdateCommandRequest): Promise<UpdateCheckResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.updateCheck,
      UpdateCommandRequestSchema.parse(request),
    );
    return UpdateCheckResponseSchema.parse(response);
  },
  async openUpdateReview(request: UpdateCommandRequest): Promise<UpdateOpenReviewResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.updateOpenReview,
      UpdateCommandRequestSchema.parse(request),
    );
    return UpdateOpenReviewResponseSchema.parse(response);
  },
  async getTelemetrySettings(): Promise<TelemetrySettings> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.telemetryGetSettings);
    return TelemetrySettingsSchema.parse(response);
  },
  async setTelemetryConsent(request: TelemetryConsentRequest): Promise<TelemetryMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.telemetrySetConsent,
      TelemetryConsentRequestSchema.parse(request),
    );
    return TelemetryMutationResponseSchema.parse(response);
  },
  async listCrashReports(): Promise<TelemetryReportsResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.telemetryListReports);
    return TelemetryReportsResponseSchema.parse(response);
  },
  async deleteCrashReports(request: UpdateCommandRequest): Promise<TelemetryMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.telemetryDeleteReports,
      UpdateCommandRequestSchema.parse(request),
    );
    return TelemetryMutationResponseSchema.parse(response);
  },
});

contextBridge.exposeInMainWorld("silfable", api);
