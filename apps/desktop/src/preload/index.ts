import { contextBridge, ipcRenderer } from "electron";
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
  PumpExecuteResponseSchema,
  PumpSimulateRequestSchema,
  PumpSimulateResponseSchema,
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
  type AiChatRequest,
  type AiPreviewOpenRouterModelsRequest,
  type AiSaveProviderRequest,
  type ClipboardWriteWalletAddressRequest,
  type ClipboardWriteTransactionSignatureRequest,
  type ExternalOpenTransactionRequest,
  type JupiterSaveKeyRequest,
  type LimitOrderExecuteRequest,
  type LimitOrderSimulateRequest,
  type LimitOrderCancelExecuteRequest,
  type LimitOrderCancelSimulateRequest,
  type LimitOrderListRequest,
  type MissionSimulateRequest,
  type MissionExecuteRequest,
  type MissionVerifyExecutionRequest,
  type PortfolioGetRequest,
  type PumpFinalRevalidateRequest,
  type PumpExecuteRequest,
  type PumpSimulateRequest,
  type PumpRiskSettingsSaveRequest,
  type SolanaRpcSaveUrlRequest,
  type TavilySaveKeyRequest,
  type TransactionSettingsSaveRequest,
  type WalletCreateRequest,
  type WalletActivityGetRequest,
  type WalletImportMnemonicRequest,
  type WalletImportPrivateKeyRequest,
  type SecurityChangePasswordRequest,
  type SecurityConfigurePasswordRequest,
  type SecurityUnlockRequest,
  type SecurityResetVaultRequest,
  type SessionUpsertRequest,
} from "@silfable/contracts";

const api = {
  async getRuntimeStatus() {
    return RuntimeStatusSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.runtimeStatus));
  },
  async configureMasterPassword(request: SecurityConfigurePasswordRequest) {
    return SecurityPasswordMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.securityConfigurePassword, SecurityConfigurePasswordRequestSchema.parse(request)));
  },
  async unlockVault(request: SecurityUnlockRequest) {
    return SecurityPasswordMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.securityUnlock, SecurityUnlockRequestSchema.parse(request)));
  },
  async changeMasterPassword(request: SecurityChangePasswordRequest) {
    return SecurityPasswordMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.securityChangePassword, SecurityChangePasswordRequestSchema.parse(request)));
  },
  async resetVault(request: SecurityResetVaultRequest) {
    return SecurityResetVaultResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.securityResetVault, SecurityResetVaultRequestSchema.parse(request)));
  },
  async listSessions() {
    return SessionListResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.sessionList));
  },
  async upsertSession(request: SessionUpsertRequest) {
    return SessionUpsertResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.sessionUpsert, SessionUpsertRequestSchema.parse(request)));
  },
  async copyWalletAddress(request: ClipboardWriteWalletAddressRequest) {
    return ClipboardWriteWalletAddressResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.clipboardWriteWalletAddress, ClipboardWriteWalletAddressRequestSchema.parse(request)));
  },
  async copyTransactionSignature(request: ClipboardWriteTransactionSignatureRequest) {
    return ClipboardWriteTransactionSignatureResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.clipboardWriteTransactionSignature, ClipboardWriteTransactionSignatureRequestSchema.parse(request)));
  },
  async openTransactionInExplorer(request: ExternalOpenTransactionRequest) {
    return ExternalOpenTransactionResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.externalOpenTransaction, ExternalOpenTransactionRequestSchema.parse(request)));
  },
  async createWallet(request: WalletCreateRequest) {
    return WalletCreateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.walletCreate, WalletCreateRequestSchema.parse(request)));
  },
  async importWalletMnemonic(request: WalletImportMnemonicRequest) {
    return WalletImportResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.walletImportMnemonic, WalletImportMnemonicRequestSchema.parse(request)));
  },
  async importWalletPrivateKey(request: WalletImportPrivateKeyRequest) {
    return WalletImportResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.walletImportPrivateKey, WalletImportPrivateKeyRequestSchema.parse(request)));
  },
  async listWallets() {
    return WalletListResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.walletList));
  },
  async getPortfolio(request: PortfolioGetRequest) {
    return PortfolioGetResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.portfolioGet, PortfolioGetRequestSchema.parse(request)));
  },
  async getWalletActivity(request: WalletActivityGetRequest) {
    return WalletActivityGetResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.walletActivityGet, WalletActivityGetRequestSchema.parse(request)));
  },
  async getAiSettings() {
    return AiSettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.aiGetSettings));
  },
  async previewOpenRouterModels(request: AiPreviewOpenRouterModelsRequest) {
    return AiPreviewOpenRouterModelsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.aiPreviewOpenRouterModels, AiPreviewOpenRouterModelsRequestSchema.parse(request)));
  },
  async saveAiProvider(request: AiSaveProviderRequest) {
    return AiProviderMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.aiSaveProvider, AiSaveProviderRequestSchema.parse(request)));
  },
  async chatWithAi(request: AiChatRequest) {
    return AiChatResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.aiChat, AiChatRequestSchema.parse(request)));
  },
  async simulateMission(request: MissionSimulateRequest) {
    return MissionSimulateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.missionSimulate, MissionSimulateRequestSchema.parse(request)));
  },
  async simulatePumpTrade(request: PumpSimulateRequest) {
    return PumpSimulateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.pumpSimulate, PumpSimulateRequestSchema.parse(request)));
  },
  async finalRevalidatePumpTrade(request: PumpFinalRevalidateRequest) {
    return PumpFinalRevalidateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.pumpFinalRevalidate, PumpFinalRevalidateRequestSchema.parse(request)));
  },
  async executePumpTrade(request: PumpExecuteRequest) {
    return PumpExecuteResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.pumpExecute, PumpExecuteRequestSchema.parse(request)));
  },
  async getPumpRiskSettings() {
    return PumpRiskSettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.pumpRiskSettingsGet));
  },
  async savePumpRiskSettings(request: PumpRiskSettingsSaveRequest) {
    return PumpRiskSettingsMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.pumpRiskSettingsSave, PumpRiskSettingsSaveRequestSchema.parse(request)));
  },
  async executeMission(request: MissionExecuteRequest) {
    return MissionExecuteResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.missionExecute, MissionExecuteRequestSchema.parse(request)));
  },
  async verifyMissionExecution(request: MissionVerifyExecutionRequest) {
    return MissionVerifyExecutionResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.missionVerifyExecution, MissionVerifyExecutionRequestSchema.parse(request)));
  },
  async getTransactionSettings() {
    return TransactionSettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.transactionSettingsGet));
  },
  async saveTransactionSettings(request: TransactionSettingsSaveRequest) {
    return TransactionSettingsMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.transactionSettingsSave, TransactionSettingsSaveRequestSchema.parse(request)));
  },
  async simulateLimitOrder(request: LimitOrderSimulateRequest) {
    return LimitOrderSimulateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.limitOrderSimulate, LimitOrderSimulateRequestSchema.parse(request)));
  },
  async executeLimitOrder(request: LimitOrderExecuteRequest) {
    return LimitOrderExecuteResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.limitOrderExecute, LimitOrderExecuteRequestSchema.parse(request)));
  },
  async listLimitOrders(request: LimitOrderListRequest) {
    return LimitOrderListResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.limitOrderList, LimitOrderListRequestSchema.parse(request)));
  },
  async simulateLimitOrderCancel(request: LimitOrderCancelSimulateRequest) {
    return LimitOrderCancelSimulateResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.limitOrderCancelSimulate, LimitOrderCancelSimulateRequestSchema.parse(request)));
  },
  async executeLimitOrderCancel(request: LimitOrderCancelExecuteRequest) {
    return LimitOrderCancelExecuteResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.limitOrderCancelExecute, LimitOrderCancelExecuteRequestSchema.parse(request)));
  },
  async getJupiterSettings() {
    return JupiterSettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.jupiterGetSettings));
  },
  async saveJupiterKey(request: JupiterSaveKeyRequest) {
    return JupiterKeyMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.jupiterSaveKey, JupiterSaveKeyRequestSchema.parse(request)));
  },
  async getTavilySettings() {
    return TavilySettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.tavilyGetSettings));
  },
  async saveTavilyKey(request: TavilySaveKeyRequest) {
    return TavilyKeyMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.tavilySaveKey, TavilySaveKeyRequestSchema.parse(request)));
  },
  async getSolanaRpcSettings() {
    return SolanaRpcSettingsResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.solanaRpcGetSettings));
  },
  async saveSolanaRpcUrl(request: SolanaRpcSaveUrlRequest) {
    return SolanaRpcMutationResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.solanaRpcSaveUrl, SolanaRpcSaveUrlRequestSchema.parse(request)));
  },
};

contextBridge.exposeInMainWorld("silfable", Object.freeze(api));
