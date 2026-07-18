import type {
  AiDeleteProviderRequest,
  AiApproveShadowTradeRequest,
  AiDraftDcaRequest,
  AiDraftDcaResponse,
  AiProviderMutationResponse,
  AiProposeShadowTradeRequest,
  AiProposeShadowTradeResponse,
  AiRejectShadowTradeRequest,
  AiSaveProviderRequest,
  AiSettingsResponse,
  AgentCreateSessionRequest,
  AgentHaltSessionRequest,
  AgentEvaluateObservationRequest,
  AgentApproveIntentRequest,
  AgentRejectIntentRequest,
  AgentSessionMutationResponse,
  AgentEvaluateObservationResponse,
  AgentIntentMutationResponse,
  AgentSessionListResponse,
  AgentSimulateDevnetIntentRequest,
  AgentSimulateDevnetIntentResponse,
  AgentDevnetSimulationListResponse,
  AgentArmDevnetSigningRequest,
  AgentRevokeDevnetSigningArmRequest,
  AgentDevnetSigningArmMutationResponse,
  AgentDevnetSigningArmListResponse,
  AgentPrepareDevnetExecutionRequest,
  AgentPrepareDevnetExecutionResponse,
  AgentDevnetPreSignExecutionListResponse,
  AgentSignDevnetExecutionRequest,
  AgentSignDevnetExecutionResponse,
  AgentDevnetSignedExecutionListResponse,
  AgentBroadcastDevnetExecutionRequest,
  AgentBroadcastDevnetExecutionResponse,
  AgentDevnetBroadcastExecutionListResponse,
  AgentQuoteDevnetSwapRequest,
  AgentQuoteDevnetSwapResponse,
  AgentDevnetSwapQuoteListResponse,
  AiShadowTradeListResponse,
  AiShadowTradeMutationResponse,
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
  MarketCreateObservationRequest,
  MarketCreateObservationResponse,
  MarketObservationListResponse,
  MarketCreateWatchRequest,
  MarketPauseWatchRequest,
  MarketWatchListResponse,
  MarketWatchMutationResponse,
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
      proposeShadowTradeWithAi(request: AiProposeShadowTradeRequest): Promise<AiProposeShadowTradeResponse>;
      listAiShadowTrades(): Promise<AiShadowTradeListResponse>;
      approveAiShadowTrade(request: AiApproveShadowTradeRequest): Promise<AiShadowTradeMutationResponse>;
      rejectAiShadowTrade(request: AiRejectShadowTradeRequest): Promise<AiShadowTradeMutationResponse>;
      getJupiterSettings(): Promise<JupiterSettingsResponse>;
      saveJupiterKey(request: JupiterSaveKeyRequest): Promise<JupiterKeyMutationResponse>;
      deleteJupiterKey(request: WalletUnlockRequest): Promise<JupiterKeyMutationResponse>;
      getJupiterShadowQuote(request: JupiterShadowQuoteRequest): Promise<JupiterShadowQuoteResponse>;
      listJupiterShadowQuotes(): Promise<JupiterShadowListResponse>;
      createMarketObservation(request: MarketCreateObservationRequest): Promise<MarketCreateObservationResponse>;
      listMarketObservations(): Promise<MarketObservationListResponse>;
      createMarketWatch(request: MarketCreateWatchRequest): Promise<MarketWatchMutationResponse>;
      pauseMarketWatch(request: MarketPauseWatchRequest): Promise<MarketWatchMutationResponse>;
      listMarketWatches(): Promise<MarketWatchListResponse>;
      createAgentSession(request: AgentCreateSessionRequest): Promise<AgentSessionMutationResponse>;
      haltAgentSession(request: AgentHaltSessionRequest): Promise<AgentSessionMutationResponse>;
      evaluateAgentObservation(request: AgentEvaluateObservationRequest): Promise<AgentEvaluateObservationResponse>;
      listAgentSessions(): Promise<AgentSessionListResponse>;
      approveAgentIntent(request: AgentApproveIntentRequest): Promise<AgentIntentMutationResponse>;
      rejectAgentIntent(request: AgentRejectIntentRequest): Promise<AgentIntentMutationResponse>;
      simulateAgentIntentOnDevnet(request: AgentSimulateDevnetIntentRequest): Promise<AgentSimulateDevnetIntentResponse>;
      listAgentDevnetSimulations(): Promise<AgentDevnetSimulationListResponse>;
      armAgentDevnetSigning(request: AgentArmDevnetSigningRequest): Promise<AgentDevnetSigningArmMutationResponse>;
      revokeAgentDevnetSigningArm(request: AgentRevokeDevnetSigningArmRequest): Promise<AgentDevnetSigningArmMutationResponse>;
      listAgentDevnetSigningArms(): Promise<AgentDevnetSigningArmListResponse>;
      prepareAgentDevnetExecution(request: AgentPrepareDevnetExecutionRequest): Promise<AgentPrepareDevnetExecutionResponse>;
      listAgentDevnetPreSignExecutions(): Promise<AgentDevnetPreSignExecutionListResponse>;
      signAgentDevnetExecution(request: AgentSignDevnetExecutionRequest): Promise<AgentSignDevnetExecutionResponse>;
      listAgentDevnetSignedExecutions(): Promise<AgentDevnetSignedExecutionListResponse>;
      broadcastAgentDevnetExecution(request: AgentBroadcastDevnetExecutionRequest): Promise<AgentBroadcastDevnetExecutionResponse>;
      listAgentDevnetBroadcastExecutions(): Promise<AgentDevnetBroadcastExecutionListResponse>;
      quoteAgentDevnetSwap(request: AgentQuoteDevnetSwapRequest): Promise<AgentQuoteDevnetSwapResponse>;
      listAgentDevnetSwapQuotes(): Promise<AgentDevnetSwapQuoteListResponse>;
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
