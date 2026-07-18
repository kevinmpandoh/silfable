import { contextBridge, ipcRenderer } from "electron";

import {
  AiDeleteProviderRequestSchema,
  AiApproveShadowTradeRequestSchema,
  AiDraftDcaRequestSchema,
  AiDraftDcaResponseSchema,
  AiProviderMutationResponseSchema,
  AiProposeShadowTradeRequestSchema,
  AiProposeShadowTradeResponseSchema,
  AiRejectShadowTradeRequestSchema,
  AiSaveProviderRequestSchema,
  AiSettingsResponseSchema,
  AgentCreateSessionRequestSchema,
  AgentHaltSessionRequestSchema,
  AgentEvaluateObservationRequestSchema,
  AgentApproveIntentRequestSchema,
  AgentRejectIntentRequestSchema,
  AgentSessionMutationResponseSchema,
  AgentEvaluateObservationResponseSchema,
  AgentIntentMutationResponseSchema,
  AgentSessionListResponseSchema,
  AgentSimulateDevnetIntentRequestSchema,
  AgentSimulateDevnetIntentResponseSchema,
  AgentDevnetSimulationListResponseSchema,
  AgentArmDevnetSigningRequestSchema,
  AgentRevokeDevnetSigningArmRequestSchema,
  AgentDevnetSigningArmMutationResponseSchema,
  AgentDevnetSigningArmListResponseSchema,
  AiShadowTradeListResponseSchema,
  AiShadowTradeMutationResponseSchema,
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
  MarketCreateObservationRequestSchema,
  MarketCreateObservationResponseSchema,
  MarketObservationListResponseSchema,
  MarketCreateWatchRequestSchema,
  MarketPauseWatchRequestSchema,
  MarketWatchListResponseSchema,
  MarketWatchMutationResponseSchema,
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
  type MarketCreateObservationRequest,
  type MarketCreateObservationResponse,
  type MarketObservationListResponse,
  type MarketCreateWatchRequest,
  type MarketPauseWatchRequest,
  type MarketWatchListResponse,
  type MarketWatchMutationResponse,
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
  type AiApproveShadowTradeRequest,
  type AiDraftDcaRequest,
  type AiDraftDcaResponse,
  type AiProviderMutationResponse,
  type AiProposeShadowTradeRequest,
  type AiProposeShadowTradeResponse,
  type AiRejectShadowTradeRequest,
  type AiSaveProviderRequest,
  type AiSettingsResponse,
  type AgentCreateSessionRequest,
  type AgentHaltSessionRequest,
  type AgentEvaluateObservationRequest,
  type AgentApproveIntentRequest,
  type AgentRejectIntentRequest,
  type AgentSessionMutationResponse,
  type AgentEvaluateObservationResponse,
  type AgentIntentMutationResponse,
  type AgentSessionListResponse,
  type AgentSimulateDevnetIntentRequest,
  type AgentSimulateDevnetIntentResponse,
  type AgentDevnetSimulationListResponse,
  type AgentArmDevnetSigningRequest,
  type AgentRevokeDevnetSigningArmRequest,
  type AgentDevnetSigningArmMutationResponse,
  type AgentDevnetSigningArmListResponse,
  type AiShadowTradeListResponse,
  type AiShadowTradeMutationResponse,
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
  async proposeShadowTradeWithAi(request: AiProposeShadowTradeRequest): Promise<AiProposeShadowTradeResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiProposeShadowTrade,
      AiProposeShadowTradeRequestSchema.parse(request),
    );
    return AiProposeShadowTradeResponseSchema.parse(response);
  },
  async listAiShadowTrades(): Promise<AiShadowTradeListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.aiListShadowTrades);
    return AiShadowTradeListResponseSchema.parse(response);
  },
  async approveAiShadowTrade(request: AiApproveShadowTradeRequest): Promise<AiShadowTradeMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiApproveShadowTrade,
      AiApproveShadowTradeRequestSchema.parse(request),
    );
    return AiShadowTradeMutationResponseSchema.parse(response);
  },
  async rejectAiShadowTrade(request: AiRejectShadowTradeRequest): Promise<AiShadowTradeMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.aiRejectShadowTrade,
      AiRejectShadowTradeRequestSchema.parse(request),
    );
    return AiShadowTradeMutationResponseSchema.parse(response);
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
  async createMarketObservation(request: MarketCreateObservationRequest): Promise<MarketCreateObservationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.marketCreateObservation,
      MarketCreateObservationRequestSchema.parse(request),
    );
    return MarketCreateObservationResponseSchema.parse(response);
  },
  async listMarketObservations(): Promise<MarketObservationListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.marketListObservations);
    return MarketObservationListResponseSchema.parse(response);
  },
  async createMarketWatch(request: MarketCreateWatchRequest): Promise<MarketWatchMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.marketCreateWatch,
      MarketCreateWatchRequestSchema.parse(request),
    );
    return MarketWatchMutationResponseSchema.parse(response);
  },
  async pauseMarketWatch(request: MarketPauseWatchRequest): Promise<MarketWatchMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.marketPauseWatch,
      MarketPauseWatchRequestSchema.parse(request),
    );
    return MarketWatchMutationResponseSchema.parse(response);
  },
  async listMarketWatches(): Promise<MarketWatchListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.marketListWatches);
    return MarketWatchListResponseSchema.parse(response);
  },
  async createAgentSession(request: AgentCreateSessionRequest): Promise<AgentSessionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentCreateSession, AgentCreateSessionRequestSchema.parse(request));
    return AgentSessionMutationResponseSchema.parse(response);
  },
  async haltAgentSession(request: AgentHaltSessionRequest): Promise<AgentSessionMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentHaltSession, AgentHaltSessionRequestSchema.parse(request));
    return AgentSessionMutationResponseSchema.parse(response);
  },
  async evaluateAgentObservation(request: AgentEvaluateObservationRequest): Promise<AgentEvaluateObservationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentEvaluateObservation, AgentEvaluateObservationRequestSchema.parse(request));
    return AgentEvaluateObservationResponseSchema.parse(response);
  },
  async listAgentSessions(): Promise<AgentSessionListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentListSessions);
    return AgentSessionListResponseSchema.parse(response);
  },
  async approveAgentIntent(request: AgentApproveIntentRequest): Promise<AgentIntentMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentApproveIntent, AgentApproveIntentRequestSchema.parse(request));
    return AgentIntentMutationResponseSchema.parse(response);
  },
  async rejectAgentIntent(request: AgentRejectIntentRequest): Promise<AgentIntentMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentRejectIntent, AgentRejectIntentRequestSchema.parse(request));
    return AgentIntentMutationResponseSchema.parse(response);
  },
  async simulateAgentIntentOnDevnet(request: AgentSimulateDevnetIntentRequest): Promise<AgentSimulateDevnetIntentResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentSimulateDevnetIntent, AgentSimulateDevnetIntentRequestSchema.parse(request));
    return AgentSimulateDevnetIntentResponseSchema.parse(response);
  },
  async listAgentDevnetSimulations(): Promise<AgentDevnetSimulationListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentListDevnetSimulations);
    return AgentDevnetSimulationListResponseSchema.parse(response);
  },
  async armAgentDevnetSigning(request: AgentArmDevnetSigningRequest): Promise<AgentDevnetSigningArmMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentArmDevnetSigning, AgentArmDevnetSigningRequestSchema.parse(request));
    return AgentDevnetSigningArmMutationResponseSchema.parse(response);
  },
  async revokeAgentDevnetSigningArm(request: AgentRevokeDevnetSigningArmRequest): Promise<AgentDevnetSigningArmMutationResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentRevokeDevnetSigningArm, AgentRevokeDevnetSigningArmRequestSchema.parse(request));
    return AgentDevnetSigningArmMutationResponseSchema.parse(response);
  },
  async listAgentDevnetSigningArms(): Promise<AgentDevnetSigningArmListResponse> {
    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.agentListDevnetSigningArms);
    return AgentDevnetSigningArmListResponseSchema.parse(response);
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
