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
  JupiterKeyMutationResponse,
  JupiterSaveKeyRequest,
  JupiterSettingsResponse,
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
  MissionExecuteResponse,
  MissionVerifyExecutionRequest,
  MissionVerifyExecutionResponse,
  PortfolioGetRequest,
  PortfolioGetResponse,
  PumpFinalRevalidateRequest,
  PumpFinalRevalidateResponse,
  PumpExecuteRequest,
  PumpExecuteResponse,
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
  WalletActivityGetRequest,
  WalletActivityGetResponse,
  WalletImportMnemonicRequest,
  WalletImportPrivateKeyRequest,
  WalletImportResponse,
  WalletListResponse,
} from "@silfable/contracts";

declare global {
  interface Window {
    silfable: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
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
      importWalletMnemonic(request: WalletImportMnemonicRequest): Promise<WalletImportResponse>;
      importWalletPrivateKey(request: WalletImportPrivateKeyRequest): Promise<WalletImportResponse>;
      listWallets(): Promise<WalletListResponse>;
      getPortfolio(request: PortfolioGetRequest): Promise<PortfolioGetResponse>;
      getWalletActivity(request: WalletActivityGetRequest): Promise<WalletActivityGetResponse>;
      getAiSettings(): Promise<AiSettingsResponse>;
      previewOpenRouterModels(request: AiPreviewOpenRouterModelsRequest): Promise<AiPreviewOpenRouterModelsResponse>;
      saveAiProvider(request: AiSaveProviderRequest): Promise<AiProviderMutationResponse>;
      chatWithAi(request: AiChatRequest): Promise<AiChatResponse>;
      simulateMission(request: MissionSimulateRequest): Promise<MissionSimulateResponse>;
      simulatePumpTrade(request: PumpSimulateRequest): Promise<PumpSimulateResponse>;
      finalRevalidatePumpTrade(request: PumpFinalRevalidateRequest): Promise<PumpFinalRevalidateResponse>;
      executePumpTrade(request: PumpExecuteRequest): Promise<PumpExecuteResponse>;
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
      getActivePositions(): Promise<{ positions: any[] }>;
      upsertPosition(config: any): Promise<{ success: boolean }>;
      closePosition(id: string): Promise<{ success: boolean }>;
      toggleBackgroundLoop(enabled: boolean): Promise<{ success: boolean }>;
    };
  }
}

export {};
