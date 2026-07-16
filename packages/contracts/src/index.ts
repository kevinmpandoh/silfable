import { z } from "zod";

export const IPC_CHANNELS = {
  runtimeStatus: "runtime:get-status",
  simulateDca: "dca:simulate-cycle",
  walletUnlock: "wallet:unlock",
  walletLock: "wallet:lock",
  walletCreate: "wallet:create",
  walletImportMnemonic: "wallet:import-mnemonic",
  walletImportPrivateKey: "wallet:import-private-key",
  walletBalance: "wallet:get-devnet-balance",
  devnetAirdrop: "devnet:request-airdrop",
  missionList: "mission:list",
  missionSaveDraft: "mission:save-draft",
  missionAuthorize: "mission:authorize",
  missionStart: "mission:start",
  missionHalt: "mission:halt",
  missionAudit: "mission:get-audit",
  aiGetSettings: "ai:get-settings",
  aiSaveProvider: "ai:save-provider",
  aiDeleteProvider: "ai:delete-provider",
  aiDraftDca: "ai:draft-dca",
} as const;

export const EnvironmentProfileSchema = z.enum([
  "devnet-simulation",
  "mainnet-shadow",
  "mainnet-guarded",
]);

export const RuntimeStatusSchema = z.object({
  appVersion: z.string().min(1),
  profile: EnvironmentProfileSchema,
  networkHealth: z.enum(["unknown", "healthy", "degraded", "offline"]),
  keystore: z.enum(["locked", "unlocked"]),
  wallet: z.enum(["none", "configured"]),
  activeMissionCount: z.number().int().nonnegative(),
});

export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;

const AtomicAmountSchema = z.string().regex(/^\d+$/, "Atomic amounts must be unsigned base-10 integers");
const BasisPointsSchema = z.number().int().min(0).max(10_000);
const PositiveDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Price must be a base-10 decimal")
  .refine((value) => Number(value) > 0, "Price must be greater than zero");

export const DcaPlanV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    profile: EnvironmentProfileSchema,
    inputMint: z.string().min(32).max(64),
    outputMint: z.string().min(32).max(64),
    amountPerCycleAtomic: AtomicAmountSchema,
    intervalSeconds: z.number().int().min(3_600),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    maxCycles: z.number().int().positive().optional(),
    minPrice: PositiveDecimalSchema.optional(),
    maxPrice: PositiveDecimalSchema.optional(),
    maxSlippageBps: BasisPointsSchema,
    maxPriceImpactBps: BasisPointsSchema,
    maxFeeLamports: AtomicAmountSchema,
    dailySpendLimitAtomic: AtomicAmountSchema,
    minimumWalletReserveAtomic: AtomicAmountSchema,
    missedCyclePolicy: z.literal("skip"),
    failurePolicy: z.literal("halt"),
  })
  .refine((plan) => plan.inputMint !== plan.outputMint, {
    message: "Input and output mints must differ",
    path: ["outputMint"],
  });

export type DcaPlanV1 = z.infer<typeof DcaPlanV1Schema>;

export const DeskRuleSnapshotSchema = z.object({
  observedAt: z.string().datetime(),
  quoteExpiresAt: z.string().datetime(),
  networkHealth: z.enum(["healthy", "degraded", "offline"]),
  keystoreUnlocked: z.boolean(),
  globalKillSwitch: z.boolean(),
  missionKillSwitch: z.boolean(),
  walletBalanceAtomic: AtomicAmountSchema,
  spentTodayAtomic: AtomicAmountSchema,
  price: PositiveDecimalSchema,
  priceImpactBps: BasisPointsSchema,
  feeLamports: AtomicAmountSchema,
  inputMintAllowed: z.boolean(),
  outputMintAllowed: z.boolean(),
  marketEligible: z.boolean(),
  simulationSucceeded: z.boolean(),
});

export type DeskRuleSnapshot = z.infer<typeof DeskRuleSnapshotSchema>;

export const DcaSimulationRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  plan: DcaPlanV1Schema,
  completedCycles: z.number().int().nonnegative(),
  lastSchedulerTickAt: z.string().datetime(),
  now: z.string().datetime(),
  snapshot: DeskRuleSnapshotSchema,
});

export type DcaSimulationRequest = z.infer<typeof DcaSimulationRequestSchema>;

export const DeskRuleDenialCodeSchema = z.enum([
  "profile-not-simulation",
  "network-unhealthy",
  "keystore-locked",
  "kill-switch-active",
  "mint-denied",
  "market-ineligible",
  "observation-stale",
  "quote-expired",
  "price-outside-range",
  "price-impact-exceeded",
  "fee-exceeded",
  "daily-spend-exceeded",
  "wallet-reserve-breached",
  "simulation-failed",
]);

export type DeskRuleDenialCode = z.infer<typeof DeskRuleDenialCodeSchema>;

export const DcaSimulationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  schedulerAction: z.enum(["wait", "execute", "skip", "complete"]),
  outcome: z.enum(["not-due", "would-execute", "skipped", "complete", "halted"]),
  cycle: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  denialCodes: z.array(DeskRuleDenialCodeSchema),
  signingAttempted: z.literal(false),
});

export type DcaSimulationResponse = z.infer<typeof DcaSimulationResponseSchema>;

const AuthorizedWalletRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  acknowledgedHotWalletRisk: z.literal(true),
});

export const WalletUnlockRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
});

export const WalletUnlockResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  keystore: z.literal("unlocked"),
});

export const WalletLockResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  keystore: z.literal("locked"),
});

export const WalletCreateRequestSchema = AuthorizedWalletRequestSchema;
export const WalletCreateResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  address: z.string().min(32).max(44),
  recoveryMnemonic: z.string().min(1),
  derivationPath: z.literal("m/44'/501'/0'/0'"),
});

export const WalletImportMnemonicRequestSchema = AuthorizedWalletRequestSchema.extend({
  mnemonic: z.string().min(1).max(512),
});

export const WalletImportPrivateKeyRequestSchema = AuthorizedWalletRequestSchema.extend({
  privateKey: z.string().min(1).max(1_024),
});

export const WalletImportResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  address: z.string().min(32).max(44),
});

export type WalletUnlockRequest = z.infer<typeof WalletUnlockRequestSchema>;
export type WalletUnlockResponse = z.infer<typeof WalletUnlockResponseSchema>;
export type WalletLockResponse = z.infer<typeof WalletLockResponseSchema>;
export type WalletCreateRequest = z.infer<typeof WalletCreateRequestSchema>;
export type WalletCreateResponse = z.infer<typeof WalletCreateResponseSchema>;
export type WalletImportMnemonicRequest = z.infer<typeof WalletImportMnemonicRequestSchema>;
export type WalletImportPrivateKeyRequest = z.infer<typeof WalletImportPrivateKeyRequestSchema>;
export type WalletImportResponse = z.infer<typeof WalletImportResponseSchema>;

export const WalletBalanceRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
});

export const WalletBalanceResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  address: z.string().min(32).max(44),
  lamportsAtomic: AtomicAmountSchema,
  observedAt: z.string().datetime(),
  commitment: z.literal("confirmed"),
});

export const DevnetAirdropRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  acknowledgedDevnetOnly: z.literal(true),
});

export const DevnetAirdropResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  address: z.string().min(32).max(44),
  requestedLamportsAtomic: z.literal("1000000000"),
  signature: z.string().min(64).max(128),
});

export type WalletBalanceRequest = z.infer<typeof WalletBalanceRequestSchema>;
export type WalletBalanceResponse = z.infer<typeof WalletBalanceResponseSchema>;
export type DevnetAirdropRequest = z.infer<typeof DevnetAirdropRequestSchema>;
export type DevnetAirdropResponse = z.infer<typeof DevnetAirdropResponseSchema>;

export const MissionStateSchema = z.enum(["draft", "authorized", "running", "halted", "complete"]);

export const MissionViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  state: MissionStateSchema,
  revision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  plan: DcaPlanV1Schema,
  authorizedAt: z.string().datetime().nullable(),
  haltReason: z.string().nullable(),
  completedCycles: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const MissionListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  missions: z.array(MissionViewSchema),
});

export const MissionSaveDraftRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().positive().optional(),
  plan: DcaPlanV1Schema,
});

export const MissionAuthorizeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  expectedPlanDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedSimulationOnly: z.literal(true),
});

export const MissionCommandRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
});

export const MissionMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  mission: MissionViewSchema,
});

export type MissionView = z.infer<typeof MissionViewSchema>;
export type MissionListResponse = z.infer<typeof MissionListResponseSchema>;
export type MissionSaveDraftRequest = z.infer<typeof MissionSaveDraftRequestSchema>;
export type MissionAuthorizeRequest = z.infer<typeof MissionAuthorizeRequestSchema>;
export type MissionCommandRequest = z.infer<typeof MissionCommandRequestSchema>;
export type MissionMutationResponse = z.infer<typeof MissionMutationResponseSchema>;

export const MissionAuditRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
});

export const SimulationReceiptViewSchema = z.object({
  receiptId: z.string().uuid(),
  createdAt: z.string().datetime(),
  revision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  outcome: z.literal("would-execute"),
  signingAttempted: z.literal(false),
  observedAt: z.string().datetime(),
});

export const DcaCycleAuditSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  cycle: z.number().int().positive(),
  dueAt: z.string().datetime(),
  state: z.enum(["skipped", "halted", "receipted"]),
  reason: z.string().nullable(),
  receipt: SimulationReceiptViewSchema.nullable(),
});

export const MissionAuditResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  cycles: z.array(DcaCycleAuditSchema),
});

export type MissionAuditRequest = z.infer<typeof MissionAuditRequestSchema>;
export type SimulationReceiptView = z.infer<typeof SimulationReceiptViewSchema>;
export type DcaCycleAudit = z.infer<typeof DcaCycleAuditSchema>;
export type MissionAuditResponse = z.infer<typeof MissionAuditResponseSchema>;

export const AiProviderSchema = z.enum(["openai", "anthropic"]);
const SolDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/u)
  .refine((value) => Number(value) > 0, "SOL amount must be positive");

export const AiDcaIntentV1Schema = z.object({
  schemaVersion: z.literal(1),
  intentType: z.literal("auto-dca-draft"),
  amountPerCycleSol: SolDecimalSchema,
  intervalHours: z.number().int().min(1).max(8_760),
  maxCycles: z.number().int().min(1).max(10_000),
  dailyLimitSol: SolDecimalSchema,
  minimumWalletReserveSol: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/u),
  maxSlippageBps: z.number().int().min(0).max(10_000),
  maxPriceImpactBps: z.number().int().min(0).max(10_000),
  rationale: z.string().min(1).max(600),
  assumptions: z.array(z.string().min(1).max(200)).max(8),
});

export const AiProviderSettingSchema = z.object({
  provider: AiProviderSchema,
  configured: z.boolean(),
  model: z.string().min(1).max(128),
});

export const AiSettingsResponseSchema = z.object({
  schemaVersion: z.literal(1),
  providers: z.array(AiProviderSettingSchema).length(2),
});

export const AiSaveProviderRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  apiKey: z.string().trim().min(8).max(512),
  model: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/u),
  acknowledgedExternalProcessing: z.literal(true),
});

export const AiDeleteProviderRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
});

export const AiProviderMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  setting: AiProviderSettingSchema,
});

export const AiDraftDcaRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  prompt: z.string().trim().min(10).max(4_000),
  acknowledgedExternalProcessing: z.literal(true),
});

export const AiDraftDcaResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  model: z.string().min(1).max(128),
  intent: AiDcaIntentV1Schema,
  executionAttempted: z.literal(false),
});

export type AiProvider = z.infer<typeof AiProviderSchema>;
export type AiDcaIntentV1 = z.infer<typeof AiDcaIntentV1Schema>;
export type AiProviderSetting = z.infer<typeof AiProviderSettingSchema>;
export type AiSettingsResponse = z.infer<typeof AiSettingsResponseSchema>;
export type AiSaveProviderRequest = z.infer<typeof AiSaveProviderRequestSchema>;
export type AiDeleteProviderRequest = z.infer<typeof AiDeleteProviderRequestSchema>;
export type AiProviderMutationResponse = z.infer<typeof AiProviderMutationResponseSchema>;
export type AiDraftDcaRequest = z.infer<typeof AiDraftDcaRequestSchema>;
export type AiDraftDcaResponse = z.infer<typeof AiDraftDcaResponseSchema>;
