import type {
  AiChatRequest,
  AiChatResponse,
  AiPreviewOpenRouterModelsRequest,
  AiPreviewOpenRouterModelsResponse,
  AiProviderMutationResponse,
  AiSaveProviderRequest,
  AiSettingsResponse,
  ClipboardWriteWalletAddressRequest,
  ClipboardWriteWalletAddressResponse,
  ClipboardWriteTransactionSignatureRequest,
  ClipboardWriteTransactionSignatureResponse,
  ExternalOpenTransactionRequest,
  ExternalOpenTransactionResponse,
  AutonomousExecutionJobListResponse,
  FullAccessExecutionGrantActionRequest,
  FullAccessExecutionGrantCreateRequest,
  FullAccessExecutionGrantGetResponse,
  FullAccessExecutionGrantMutationResponse,
  FullAccessExecutionCreateSolanaSwapJobRequest,
  FullAccessExecutionCreateSolanaSwapJobResponse,
  FullAccessSessionEnrollmentRequest,
  FullAccessSessionEnrollmentResponse,
  EmergencyStopEngageRequest,
  EmergencyStopGetResponse,
  EmergencyStopMutationResponse,
  EmergencyStopReleaseRequest,
  JupiterKeyMutationResponse,
  JupiterSaveKeyRequest,
  JupiterSettingsResponse,
  RobinhoodKeyMutationResponse,
  RobinhoodRpcMutationResponse,
  RobinhoodSaveRpcUrlRequest,
  RobinhoodSaveZeroXKeyRequest,
  RobinhoodSettingsResponse,
  RobinhoodTestRpcResponse,
  RobinhoodTestZeroXResponse,
  RobinhoodWalletCreateRequest,
  RobinhoodWalletCreateResponse,
  RobinhoodWalletGetResponse,
  RobinhoodWalletImportMnemonicRequest,
  RobinhoodWalletImportPrivateKeyRequest,
  RobinhoodWalletImportResponse,
  RobinhoodIndicativePriceRequest,
  RobinhoodIndicativePriceResponse,
  RobinhoodPrepareTradeResponse,
  RobinhoodExecuteApprovalRequest,
  RobinhoodExecuteSwapRequest,
  RobinhoodExecutionResponse,
  RobinhoodReceiptsResponse,
  RobinhoodReconcileReceiptsResponse,
  LimitOrderExecuteRequest,
  LimitOrderExecuteResponse,
  LimitOrderVerifyExecutionRequest,
  LimitOrderVerifyExecutionResponse,
  LimitOrderSimulateRequest,
  LimitOrderSimulateResponse,
  LimitOrderCancelExecuteRequest,
  LimitOrderCancelExecuteResponse,
  LimitOrderVerifyCancelRequest,
  LimitOrderVerifyCancelResponse,
  LimitOrderCancelSimulateRequest,
  LimitOrderCancelSimulateResponse,
  LimitOrderListRequest,
  LimitOrderListResponse,
  MissionSimulateRequest,
  MissionSimulateResponse,
  MissionExecuteRequest,
  MissionFullAccessExecuteRequest,
  MissionExecuteResponse,
  MissionVerifyExecutionRequest,
  MissionVerifyExecutionResponse,
  PortfolioGetRequest,
  PortfolioGetResponse,
  PortfolioCostBasisGetRequest,
  PortfolioCostBasisGetResponse,
  PumpFinalRevalidateRequest,
  PumpFinalRevalidateResponse,
  PumpExecuteRequest,
  PumpExecuteResponse,
  PumpLaunchDraftRequest,
  PumpLaunchDraftResponse,
  PumpLaunchManagedMetadataPublishRequest,
  PumpLaunchManagedMetadataPublishResponse,
  PumpLaunchPreflightRequest,
  PumpLaunchPreflightResponse,
  PumpLaunchFinalRevalidateRequest,
  PumpLaunchFinalRevalidateResponse,
  PumpLaunchExecuteRequest,
  PumpLaunchExecuteResponse,
  PumpLaunchVerifyExecutionRequest,
  PumpLaunchVerifyExecutionResponse,
  PumpLaunchOpenOfficialCreateRequest,
  PumpLaunchOpenOfficialCreateResponse,
  R2PublishLaunchMetadataRequest,
  R2PublishLaunchMetadataResponse,
  R2SaveSettingsRequest,
  R2SettingsMutationResponse,
  R2SettingsResponse,
  R2TestSettingsRequest,
  R2TestSettingsResponse,
  PumpVerifyExecutionRequest,
  PumpVerifyExecutionResponse,
  PumpSimulateRequest,
  PumpSimulateResponse,
  PumpRiskSettingsMutationResponse,
  PumpRiskSettingsResponse,
  PumpRiskSettingsSaveRequest,
  RuntimeStatus,
  SecurityChangePasswordRequest,
  SecurityConfigurePasswordRequest,
  SecurityPasswordMutationResponse,
  SecurityResetVaultRequest,
  SecurityResetVaultResponse,
  SecurityUnlockRequest,
  SessionListResponse,
  SessionUpsertRequest,
  SessionUpsertResponse,
  TavilyKeyMutationResponse,
  TavilySaveKeyRequest,
  TavilySettingsResponse,
  TransactionSettingsMutationResponse,
  TransactionSettingsResponse,
  TransactionSettingsSaveRequest,
  WalletCreateRequest,
  WalletCreateResponse,
  WalletClearAllRequest,
  WalletClearAllResponse,
  WalletActivityGetRequest,
  WalletActivityGetResponse,
  WalletImportMnemonicRequest,
  WalletImportPrivateKeyRequest,
  WalletImportResponse,
  WalletListResponse,
  EvmWalletClearAllRequest,
  EvmWalletClearAllResponse,
  KaminoRwaDiscoverRequest,
  KaminoRwaDiscoverResponse,
  KaminoRwaPrepareRequest,
  KaminoRwaPrepareResponse,
  KaminoRwaExecuteRequest,
  KaminoRwaExecuteResponse,
  KaminoRwaPositionsResponse,
} from "@mirae/contracts";

declare global {
  interface Window {
    mirae: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
      discoverX402(request: import("@mirae/contracts").X402DiscoverRequest): Promise<import("@mirae/contracts").X402DiscoverResponse>;
      prepareX402(request: import("@mirae/contracts").X402PrepareRequest): Promise<import("@mirae/contracts").X402PrepareResponse>;
      executeX402(request: import("@mirae/contracts").X402ExecuteRequest): Promise<import("@mirae/contracts").X402ExecuteResponse>;
      listX402Receipts(): Promise<import("@mirae/contracts").X402ReceiptsResponse>;
      selectX402(request: import("@mirae/contracts").X402SelectRequest): Promise<import("@mirae/contracts").X402SelectResponse>;
      analyzeX402(request: import("@mirae/contracts").X402AnalyzeRequest): Promise<import("@mirae/contracts").X402AnalyzeResponse>;
      discoverKaminoRwa(request: KaminoRwaDiscoverRequest): Promise<KaminoRwaDiscoverResponse>;
      prepareKaminoRwa(request: KaminoRwaPrepareRequest): Promise<KaminoRwaPrepareResponse>;
      executeKaminoRwa(request: KaminoRwaExecuteRequest): Promise<KaminoRwaExecuteResponse>;
      listKaminoRwaPositions(): Promise<KaminoRwaPositionsResponse>;
      getEmergencyStop(): Promise<EmergencyStopGetResponse>;
      engageEmergencyStop(request: EmergencyStopEngageRequest): Promise<EmergencyStopMutationResponse>;
      releaseEmergencyStop(request: EmergencyStopReleaseRequest): Promise<EmergencyStopMutationResponse>;
      configureMasterPassword(request: SecurityConfigurePasswordRequest): Promise<SecurityPasswordMutationResponse>;
      unlockVault(request: SecurityUnlockRequest): Promise<SecurityPasswordMutationResponse>;
      changeMasterPassword(request: SecurityChangePasswordRequest): Promise<SecurityPasswordMutationResponse>;
      resetVault(request: SecurityResetVaultRequest): Promise<SecurityResetVaultResponse>;
      listSessions(): Promise<SessionListResponse>;
      upsertSession(request: SessionUpsertRequest): Promise<SessionUpsertResponse>;
      copyWalletAddress(request: ClipboardWriteWalletAddressRequest): Promise<ClipboardWriteWalletAddressResponse>;
      copyTransactionSignature(request: ClipboardWriteTransactionSignatureRequest): Promise<ClipboardWriteTransactionSignatureResponse>;
      openTransactionInExplorer(request: ExternalOpenTransactionRequest): Promise<ExternalOpenTransactionResponse>;
      createWallet(request: WalletCreateRequest): Promise<WalletCreateResponse>;
      clearWallets(request: WalletClearAllRequest): Promise<WalletClearAllResponse>;
      clearEvmWallets(request: EvmWalletClearAllRequest): Promise<EvmWalletClearAllResponse>;
      importWalletMnemonic(request: WalletImportMnemonicRequest): Promise<WalletImportResponse>;
      importWalletPrivateKey(request: WalletImportPrivateKeyRequest): Promise<WalletImportResponse>;
      listWallets(): Promise<WalletListResponse>;
      getPortfolio(request: PortfolioGetRequest): Promise<PortfolioGetResponse>;
      getPortfolioCostBasis(request: PortfolioCostBasisGetRequest): Promise<PortfolioCostBasisGetResponse>;
      getWalletActivity(request: WalletActivityGetRequest): Promise<WalletActivityGetResponse>;
      getAiSettings(): Promise<AiSettingsResponse>;
      previewOpenRouterModels(request: AiPreviewOpenRouterModelsRequest): Promise<AiPreviewOpenRouterModelsResponse>;
      saveAiProvider(request: AiSaveProviderRequest): Promise<AiProviderMutationResponse>;
      chatWithAi(request: AiChatRequest): Promise<AiChatResponse>;
      createPumpLaunchDraft(request: PumpLaunchDraftRequest): Promise<PumpLaunchDraftResponse>;
      publishManagedPumpLaunchMetadata(request: PumpLaunchManagedMetadataPublishRequest): Promise<PumpLaunchManagedMetadataPublishResponse>;
      preflightPumpLaunch(request: PumpLaunchPreflightRequest): Promise<PumpLaunchPreflightResponse>;
      finalRevalidatePumpLaunch(request: PumpLaunchFinalRevalidateRequest): Promise<PumpLaunchFinalRevalidateResponse>;
      executePumpLaunch(request: PumpLaunchExecuteRequest): Promise<PumpLaunchExecuteResponse>;
      verifyPumpLaunchExecution(request: PumpLaunchVerifyExecutionRequest): Promise<PumpLaunchVerifyExecutionResponse>;
      openPumpLaunchOfficialCreate(request: PumpLaunchOpenOfficialCreateRequest): Promise<PumpLaunchOpenOfficialCreateResponse>;
      getR2Settings(): Promise<R2SettingsResponse>;
      saveR2Settings(request: R2SaveSettingsRequest): Promise<R2SettingsMutationResponse>;
      testR2Settings(request: R2TestSettingsRequest): Promise<R2TestSettingsResponse>;
      publishPumpLaunchMetadata(request: R2PublishLaunchMetadataRequest): Promise<R2PublishLaunchMetadataResponse>;
      simulateMission(request: MissionSimulateRequest): Promise<MissionSimulateResponse>;
      executeFullAccessMission(request: MissionFullAccessExecuteRequest): Promise<MissionExecuteResponse>;
      simulatePumpTrade(request: PumpSimulateRequest): Promise<PumpSimulateResponse>;
      finalRevalidatePumpTrade(request: PumpFinalRevalidateRequest): Promise<PumpFinalRevalidateResponse>;
      executePumpTrade(request: PumpExecuteRequest): Promise<PumpExecuteResponse>;
      verifyPumpExecution(request: PumpVerifyExecutionRequest): Promise<PumpVerifyExecutionResponse>;
      getPumpRiskSettings(): Promise<PumpRiskSettingsResponse>;
      savePumpRiskSettings(request: PumpRiskSettingsSaveRequest): Promise<PumpRiskSettingsMutationResponse>;
      executeMission(request: MissionExecuteRequest): Promise<MissionExecuteResponse>;
      verifyMissionExecution(request: MissionVerifyExecutionRequest): Promise<MissionVerifyExecutionResponse>;
      getTransactionSettings(): Promise<TransactionSettingsResponse>;
      saveTransactionSettings(request: TransactionSettingsSaveRequest): Promise<TransactionSettingsMutationResponse>;
      simulateLimitOrder(request: LimitOrderSimulateRequest): Promise<LimitOrderSimulateResponse>;
      executeLimitOrder(request: LimitOrderExecuteRequest): Promise<LimitOrderExecuteResponse>;
      verifyLimitOrderExecution(request: LimitOrderVerifyExecutionRequest): Promise<LimitOrderVerifyExecutionResponse>;
      listLimitOrders(request: LimitOrderListRequest): Promise<LimitOrderListResponse>;
      simulateLimitOrderCancel(request: LimitOrderCancelSimulateRequest): Promise<LimitOrderCancelSimulateResponse>;
      executeLimitOrderCancel(request: LimitOrderCancelExecuteRequest): Promise<LimitOrderCancelExecuteResponse>;
      verifyLimitOrderCancel(request: LimitOrderVerifyCancelRequest): Promise<LimitOrderVerifyCancelResponse>;
      getJupiterSettings(): Promise<JupiterSettingsResponse>;
      saveJupiterKey(request: JupiterSaveKeyRequest): Promise<JupiterKeyMutationResponse>;
      getTavilySettings(): Promise<TavilySettingsResponse>;
      saveTavilyKey(request: TavilySaveKeyRequest): Promise<TavilyKeyMutationResponse>;
      getSolanaRpcSettings(): Promise<SolanaRpcSettingsResponse>;
      saveSolanaRpcUrl(request: SolanaRpcSaveUrlRequest): Promise<SolanaRpcMutationResponse>;
      getRobinhoodSettings(): Promise<RobinhoodSettingsResponse>;
      saveRobinhoodZeroXKey(request: RobinhoodSaveZeroXKeyRequest): Promise<RobinhoodKeyMutationResponse>;
      saveRobinhoodRpcUrl(request: RobinhoodSaveRpcUrlRequest): Promise<RobinhoodRpcMutationResponse>;
      testRobinhoodRpcUrl(request: RobinhoodSaveRpcUrlRequest): Promise<RobinhoodTestRpcResponse>;
      testRobinhoodZeroXKey(request: Pick<RobinhoodSaveZeroXKeyRequest, "schemaVersion" | "requestId">): Promise<RobinhoodTestZeroXResponse>;
      getRobinhoodWallet(): Promise<RobinhoodWalletGetResponse>;
      createRobinhoodWallet(request: RobinhoodWalletCreateRequest): Promise<RobinhoodWalletCreateResponse>;
      importRobinhoodWalletMnemonic(request: RobinhoodWalletImportMnemonicRequest): Promise<RobinhoodWalletImportResponse>;
      importRobinhoodWalletPrivateKey(request: RobinhoodWalletImportPrivateKeyRequest): Promise<RobinhoodWalletImportResponse>;
      getRobinhoodIndicativePrice(request: RobinhoodIndicativePriceRequest): Promise<RobinhoodIndicativePriceResponse>;
      prepareRobinhoodTrade(request: RobinhoodIndicativePriceRequest): Promise<RobinhoodPrepareTradeResponse>;
      executeRobinhoodApproval(request: RobinhoodExecuteApprovalRequest): Promise<RobinhoodExecutionResponse>;
      executeRobinhoodSwap(request: RobinhoodExecuteSwapRequest): Promise<RobinhoodExecutionResponse>;
      listRobinhoodReceipts(): Promise<RobinhoodReceiptsResponse>;
      reconcileRobinhoodReceipts(): Promise<RobinhoodReconcileReceiptsResponse>;
      getActivePositions(): Promise<{ positions: any[] }>;
      upsertPosition(config: any): Promise<{ success: boolean }>;
      closePosition(id: string): Promise<{ success: boolean }>;
      toggleBackgroundLoop(enabled: boolean): Promise<{ success: boolean }>;
      listAutomationStrategies(): Promise<{ schemaVersion: 1; strategies: any[]; proposals: any[] }>;
      setAutomationStatus(request: { schemaVersion: 1; requestId: string; id: string; action: "PAUSE" | "RESUME" | "CANCEL" }): Promise<{ schemaVersion: 1; requestId: string; strategy: any }>;
      getFullAccessExecutionStatus(request: { schemaVersion: 1; requestId: string }): Promise<FullAccessExecutionGrantGetResponse>;
      createFullAccessExecutionGrant(request: FullAccessExecutionGrantCreateRequest): Promise<FullAccessExecutionGrantMutationResponse>;
      actOnFullAccessExecutionGrant(request: FullAccessExecutionGrantActionRequest): Promise<FullAccessExecutionGrantMutationResponse>;
      listFullAccessExecutionJobs(request: { schemaVersion: 1; requestId: string }): Promise<AutonomousExecutionJobListResponse>;
      createFullAccessSolanaSwapJob(request: FullAccessExecutionCreateSolanaSwapJobRequest): Promise<FullAccessExecutionCreateSolanaSwapJobResponse>;
      verifyFullAccessSessionEnrollment(request: FullAccessSessionEnrollmentRequest): Promise<FullAccessSessionEnrollmentResponse>;
      checkForUpdates(): Promise<{ ok: boolean; update?: { currentVersion: string; latestVersion: string; available: boolean; releaseUrl: string; publishedAt: string | null }; error?: string }>;
      openUpdateRelease(releaseUrl: string): Promise<{ ok: boolean }>;
      getPerpMarkets(): Promise<{ markets: import("@mirae/contracts").PerpMarket[] }>;
      getPerpCandles(request: { symbol: string; timeframe: string; limit: number }): Promise<{ candles: import("@mirae/contracts").PerpCandle[] }>;
      getPerpAccount(walletAddress: string): Promise<{ account: import("@mirae/contracts").PerpAccount }>;
      preparePerpOrder(request: any): Promise<{ proposal: import("@mirae/contracts").PerpProposal }>;
      executePerpOrder(request: any): Promise<{ signature: string }>;
      getDriftMarkets(): Promise<{ markets: any[] }>;
      getDriftAccount(walletAddress: string): Promise<{ account: any }>;
      prepareDriftOrder(request: any): Promise<{ proposal: any }>;
    };
  }
}

export {};
