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
  type RuntimeStatus,
  type MissionAuthorizeRequest,
  type MissionAuditRequest,
  type MissionAuditResponse,
  type MissionCommandRequest,
  type MissionListResponse,
  type MissionMutationResponse,
  type MissionSaveDraftRequest,
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
});

contextBridge.exposeInMainWorld("silfable", api);
