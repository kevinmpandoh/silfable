import type {
  AiDeleteProviderRequest,
  AiDraftDcaRequest,
  AiDraftDcaResponse,
  AiProviderMutationResponse,
  AiSaveProviderRequest,
  AiSettingsResponse,
  DcaSimulationRequest,
  DcaSimulationResponse,
  DevnetAirdropRequest,
  DevnetAirdropResponse,
  DevnetCanaryExecuteRequest,
  DevnetCanaryExecuteResponse,
  DevnetCanaryListResponse,
  DevnetFixtureProvisionExecuteRequest,
  DevnetFixtureProvisionExecuteResponse,
  DevnetFixtureProvisionListResponse,
  DevnetFixtureReviewActivateRequest,
  DevnetFixtureReviewActivateResponse,
  DevnetFixtureReviewGetActiveResponse,
  DevnetFixtureTransferExecuteRequest,
  DevnetFixtureTransferExecuteResponse,
  DevnetFixtureTransferListResponse,
  DevnetFixtureTransferApproveRequest,
  DevnetFixtureTransferApproveResponse,
  DevnetFixtureTransferGetApprovalResponse,
  GuardedMissionAuthorizeRequest,
  GuardedMissionRevokeRequest,
  GuardedMissionMutationResponse,
  GuardedMissionAuthorizationListResponse,
  GuardedSchedulerArmRequest,
  GuardedSchedulerArmRevokeRequest,
  GuardedSchedulerArmMutationResponse,
  GuardedSchedulerArmListResponse,
  GuardedExecutionListResponse,
  MissionAuthorizeRequest,
  MissionAuditRequest,
  MissionAuditResponse,
  MissionCommandRequest,
  MissionListResponse,
  MissionMutationResponse,
  MissionSaveDraftRequest,
  JupiterKeyMutationResponse,
  JupiterSaveKeyRequest,
  JupiterSettingsResponse,
  JupiterShadowListResponse,
  JupiterShadowQuoteRequest,
  JupiterShadowQuoteResponse,
  RuntimeStatus,
  UpdateCheckResponse,
  UpdateCommandRequest,
  UpdateOpenReviewResponse,
  UpdateStatus,
  TelemetryConsentRequest,
  TelemetryMutationResponse,
  TelemetryReportsResponse,
  TelemetrySettings,
  WalletCreateRequest,
  WalletCreateResponse,
  WalletLockResponse,
  WalletBalanceRequest,
  WalletBalanceResponse,
  WalletImportMnemonicRequest,
  WalletImportPrivateKeyRequest,
  WalletImportResponse,
  WalletUnlockRequest,
  WalletUnlockResponse,
} from "@silfable/contracts";

declare global {
  interface Window {
    silfable: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
      simulateDca(request: DcaSimulationRequest): Promise<DcaSimulationResponse>;
      unlockWalletKeystore(request: WalletUnlockRequest): Promise<WalletUnlockResponse>;
      lockWalletKeystore(request: WalletUnlockRequest): Promise<WalletLockResponse>;
      createWallet(request: WalletCreateRequest): Promise<WalletCreateResponse>;
      importWalletMnemonic(request: WalletImportMnemonicRequest): Promise<WalletImportResponse>;
      importWalletPrivateKey(request: WalletImportPrivateKeyRequest): Promise<WalletImportResponse>;
      getWalletBalance(request: WalletBalanceRequest): Promise<WalletBalanceResponse>;
      requestDevnetAirdrop(request: DevnetAirdropRequest): Promise<DevnetAirdropResponse>;
      executeDevnetCanary(request: DevnetCanaryExecuteRequest): Promise<DevnetCanaryExecuteResponse>;
      listDevnetCanaries(): Promise<DevnetCanaryListResponse>;
      executeDevnetFixtureProvision(request: DevnetFixtureProvisionExecuteRequest): Promise<DevnetFixtureProvisionExecuteResponse>;
      listDevnetFixtureProvisions(): Promise<DevnetFixtureProvisionListResponse>;
      activateDevnetFixtureReview(request: DevnetFixtureReviewActivateRequest): Promise<DevnetFixtureReviewActivateResponse>;
      getActiveDevnetFixture(): Promise<DevnetFixtureReviewGetActiveResponse>;
      executeDevnetFixtureTransfer(request: DevnetFixtureTransferExecuteRequest): Promise<DevnetFixtureTransferExecuteResponse>;
      listDevnetFixtureTransfers(): Promise<DevnetFixtureTransferListResponse>;
      approveDevnetFixtureTransfer(request: DevnetFixtureTransferApproveRequest): Promise<DevnetFixtureTransferApproveResponse>;
      getDevnetFixtureTransferApproval(): Promise<DevnetFixtureTransferGetApprovalResponse>;
      authorizeGuardedMission(request: GuardedMissionAuthorizeRequest): Promise<GuardedMissionMutationResponse>;
      revokeGuardedMission(request: GuardedMissionRevokeRequest): Promise<GuardedMissionMutationResponse>;
      listGuardedMissionAuthorizations(): Promise<GuardedMissionAuthorizationListResponse>;
      armGuardedScheduler(request: GuardedSchedulerArmRequest): Promise<GuardedSchedulerArmMutationResponse>;
      revokeGuardedSchedulerArm(request: GuardedSchedulerArmRevokeRequest): Promise<GuardedSchedulerArmMutationResponse>;
      listGuardedSchedulerArms(): Promise<GuardedSchedulerArmListResponse>;
      listGuardedExecutions(): Promise<GuardedExecutionListResponse>;
      listMissions(): Promise<MissionListResponse>;
      saveMissionDraft(request: MissionSaveDraftRequest): Promise<MissionMutationResponse>;
      authorizeMission(request: MissionAuthorizeRequest): Promise<MissionMutationResponse>;
      startMission(request: MissionCommandRequest): Promise<MissionMutationResponse>;
      haltMission(request: MissionCommandRequest): Promise<MissionMutationResponse>;
      getMissionAudit(request: MissionAuditRequest): Promise<MissionAuditResponse>;
      getAiSettings(): Promise<AiSettingsResponse>;
      saveAiProvider(request: AiSaveProviderRequest): Promise<AiProviderMutationResponse>;
      deleteAiProvider(request: AiDeleteProviderRequest): Promise<AiProviderMutationResponse>;
      draftDcaWithAi(request: AiDraftDcaRequest): Promise<AiDraftDcaResponse>;
      getJupiterSettings(): Promise<JupiterSettingsResponse>;
      saveJupiterKey(request: JupiterSaveKeyRequest): Promise<JupiterKeyMutationResponse>;
      deleteJupiterKey(request: WalletUnlockRequest): Promise<JupiterKeyMutationResponse>;
      getJupiterShadowQuote(request: JupiterShadowQuoteRequest): Promise<JupiterShadowQuoteResponse>;
      listJupiterShadowQuotes(): Promise<JupiterShadowListResponse>;
      getUpdateStatus(): Promise<UpdateStatus>;
      checkForUpdate(request: UpdateCommandRequest): Promise<UpdateCheckResponse>;
      openUpdateReview(request: UpdateCommandRequest): Promise<UpdateOpenReviewResponse>;
      getTelemetrySettings(): Promise<TelemetrySettings>;
      setTelemetryConsent(request: TelemetryConsentRequest): Promise<TelemetryMutationResponse>;
      listCrashReports(): Promise<TelemetryReportsResponse>;
      deleteCrashReports(request: UpdateCommandRequest): Promise<TelemetryMutationResponse>;
    };
  }
}

export {};
