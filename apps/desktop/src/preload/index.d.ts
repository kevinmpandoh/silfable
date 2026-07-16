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
  MissionAuthorizeRequest,
  MissionAuditRequest,
  MissionAuditResponse,
  MissionCommandRequest,
  MissionListResponse,
  MissionMutationResponse,
  MissionSaveDraftRequest,
  RuntimeStatus,
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
    };
  }
}

export {};
