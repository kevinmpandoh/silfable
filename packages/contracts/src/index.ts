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
  devnetCanaryExecute: "devnet:execute-canary",
  devnetCanaryList: "devnet:list-canaries",
  devnetFixtureProvisionExecute: "devnet:provision-fixture",
  devnetFixtureProvisionList: "devnet:list-fixture-provisions",
  devnetFixtureReviewActivate: "devnet:activate-fixture-review",
  devnetFixtureReviewGetActive: "devnet:get-active-fixture",
  devnetFixtureTransferExecute: "devnet:execute-fixture-transfer",
  devnetFixtureTransferList: "devnet:list-fixture-transfers",
  devnetFixtureTransferApprove: "devnet:approve-fixture-transfer",
  devnetFixtureTransferGetApproval: "devnet:get-fixture-transfer-approval",
  guardedMissionAuthorize: "guarded:authorize-mission",
  guardedMissionRevoke: "guarded:revoke-mission",
  guardedMissionListAuthorizations: "guarded:list-authorizations",
  guardedSchedulerArm: "guarded:arm-scheduler",
  guardedSchedulerRevoke: "guarded:revoke-scheduler-arm",
  guardedSchedulerListArms: "guarded:list-scheduler-arms",
  guardedExecutionList: "guarded:list-executions",
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
  jupiterGetSettings: "jupiter:get-settings",
  jupiterSaveKey: "jupiter:save-key",
  jupiterDeleteKey: "jupiter:delete-key",
  jupiterShadowQuote: "jupiter:shadow-quote",
  jupiterShadowList: "jupiter:list-shadow-quotes",
  updateGetStatus: "update:get-status",
  updateCheck: "update:check",
  updateOpenReview: "update:open-review",
  telemetryGetSettings: "telemetry:get-settings",
  telemetrySetConsent: "telemetry:set-consent",
  telemetryListReports: "telemetry:list-reports",
  telemetryDeleteReports: "telemetry:delete-reports",
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

export const UpdateStatusSchema = z.object({
  schemaVersion: z.literal(1),
  state: z.enum(["not-checked", "up-to-date", "available", "unavailable"]),
  currentVersion: z.string().min(1).max(64),
  latestVersion: z.string().min(1).max(64).nullable(),
  publishedAt: z.string().datetime().nullable(),
  checkedAt: z.string().datetime().nullable(),
  reviewUrl: z.literal("https://github.com/kevinmpandoh/silfable/releases/latest"),
  automaticDownload: z.literal(false),
  automaticInstall: z.literal(false),
  automaticRestart: z.literal(false),
});

export const UpdateCommandRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
}).strict();

export const UpdateCheckResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  status: UpdateStatusSchema,
});

export const UpdateOpenReviewResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  opened: z.literal(true),
});

export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;
export type UpdateCommandRequest = z.infer<typeof UpdateCommandRequestSchema>;
export type UpdateCheckResponse = z.infer<typeof UpdateCheckResponseSchema>;
export type UpdateOpenReviewResponse = z.infer<typeof UpdateOpenReviewResponseSchema>;

export const CrashProcessTypeSchema = z.enum(["renderer", "gpu", "utility", "other-child"]);
export const CrashReasonSchema = z.enum([
  "abnormal-exit",
  "killed",
  "crashed",
  "oom",
  "launch-failed",
  "integrity-failure",
  "memory-eviction",
  "unknown",
]);

export const CrashReportViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  processType: CrashProcessTypeSchema,
  reason: CrashReasonSchema,
  errorCode: z.string().regex(/^exit:-?\d+$/),
  appVersion: z.string().min(1).max(64),
  platform: z.enum(["linux", "darwin", "win32", "other"]),
  createdAt: z.string().datetime(),
  transmitted: z.literal(false),
});

export const TelemetrySettingsSchema = z.object({
  schemaVersion: z.literal(1),
  consent: z.boolean(),
  reportCount: z.number().int().nonnegative(),
  endpointConfigured: z.literal(false),
  networkTransmissionEnabled: z.literal(false),
});

export const TelemetryConsentRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  consent: z.boolean(),
  acknowledgedCrashOnly: z.literal(true),
}).strict();

export const TelemetryMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  settings: TelemetrySettingsSchema,
});

export const TelemetryReportsResponseSchema = z.object({
  schemaVersion: z.literal(1),
  reports: z.array(CrashReportViewSchema).max(20),
});

export type CrashProcessType = z.infer<typeof CrashProcessTypeSchema>;
export type CrashReason = z.infer<typeof CrashReasonSchema>;
export type CrashReportView = z.infer<typeof CrashReportViewSchema>;
export type TelemetrySettings = z.infer<typeof TelemetrySettingsSchema>;
export type TelemetryConsentRequest = z.infer<typeof TelemetryConsentRequestSchema>;
export type TelemetryMutationResponse = z.infer<typeof TelemetryMutationResponseSchema>;
export type TelemetryReportsResponse = z.infer<typeof TelemetryReportsResponseSchema>;

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
  .strict()
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
}).strict();

export type DeskRuleSnapshot = z.infer<typeof DeskRuleSnapshotSchema>;

export const DcaSimulationRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  plan: DcaPlanV1Schema,
  completedCycles: z.number().int().nonnegative(),
  lastSchedulerTickAt: z.string().datetime(),
  now: z.string().datetime(),
  snapshot: DeskRuleSnapshotSchema,
}).strict();

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
}).strict();

export const WalletUnlockRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
}).strict();

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
}).strict();

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
}).strict();

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

export const DevnetCanaryStateSchema = z.enum([
  "proposed",
  "simulated",
  "signed",
  "broadcast",
  "confirmed",
  "failed",
  "ambiguous",
]);

export const DevnetCanaryExecuteRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  acknowledgedDevnetFee: z.literal(true),
}).strict();

export const DevnetCanaryViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("self-transfer-zero-lamports"),
  state: DevnetCanaryStateSchema,
  signature: z.string().min(64).max(128).nullable(),
  simulationUnits: AtomicAmountSchema.nullable(),
  failureCode: z.string().min(1).max(100).nullable(),
  signingAttempted: z.boolean(),
  broadcastAttempted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DevnetCanaryExecuteResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  execution: DevnetCanaryViewSchema,
});

export const DevnetCanaryListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  executions: z.array(DevnetCanaryViewSchema).max(20),
});

export type DevnetCanaryState = z.infer<typeof DevnetCanaryStateSchema>;
export type DevnetCanaryExecuteRequest = z.infer<typeof DevnetCanaryExecuteRequestSchema>;
export type DevnetCanaryView = z.infer<typeof DevnetCanaryViewSchema>;
export type DevnetCanaryExecuteResponse = z.infer<typeof DevnetCanaryExecuteResponseSchema>;
export type DevnetCanaryListResponse = z.infer<typeof DevnetCanaryListResponseSchema>;

export const DevnetFixtureProvisionStateSchema = z.enum([
  "proposed",
  "simulated",
  "signed",
  "broadcast",
  "confirmed",
  "failed",
  "ambiguous",
]);

export const DevnetFixtureProvisionExecuteRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  acknowledgedCreatesDevnetMint: z.literal(true),
  acknowledgedPaysNetworkFees: z.literal(true),
  acknowledgedAuthorityRevocationIsPermanent: z.literal(true),
  acknowledgedDoesNotEnableAutomaticTrading: z.literal(true),
}).strict();

export const DevnetFixtureProvisionViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  mintAddress: z.string().min(32).max(44),
  state: DevnetFixtureProvisionStateSchema,
  simulationUnits: AtomicAmountSchema.nullable(),
  failureCode: z.string().min(1).max(100).nullable(),
  signingAttempted: z.boolean(),
  broadcastAttempted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DevnetFixtureProvisionExecuteResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provision: DevnetFixtureProvisionViewSchema,
});

export const DevnetFixtureProvisionListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  provisions: z.array(DevnetFixtureProvisionViewSchema).max(20),
});

export type DevnetFixtureProvisionExecuteRequest = z.infer<typeof DevnetFixtureProvisionExecuteRequestSchema>;
export type DevnetFixtureProvisionView = z.infer<typeof DevnetFixtureProvisionViewSchema>;
export type DevnetFixtureProvisionExecuteResponse = z.infer<typeof DevnetFixtureProvisionExecuteResponseSchema>;
export type DevnetFixtureProvisionListResponse = z.infer<typeof DevnetFixtureProvisionListResponseSchema>;

export const DevnetFixtureReviewActivateRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provisionId: z.string().uuid(),
  acknowledgedFreshOnChainReview: z.literal(true),
  acknowledgedGuardedDevnetOnly: z.literal(true),
  acknowledgedAutomaticTradingRemainsDisabled: z.literal(true),
}).strict();

export const DevnetFixtureReviewViewSchema = z.object({
  schemaVersion: z.literal(1),
  provisionId: z.string().uuid(),
  manifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  mintAddress: z.string().min(32).max(44),
  sourceTokenAccount: z.string().min(32).max(44),
  destinationTokenAccount: z.string().min(32).max(44),
  walletAuthority: z.string().min(32).max(44),
  observedSlot: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  active: z.literal(true),
  createdAt: z.string().datetime(),
});

export const DevnetFixtureReviewActivateResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  fixture: DevnetFixtureReviewViewSchema,
});

export const DevnetFixtureReviewGetActiveResponseSchema = z.object({
  schemaVersion: z.literal(1),
  fixture: DevnetFixtureReviewViewSchema.nullable(),
});

export type DevnetFixtureReviewActivateRequest = z.infer<typeof DevnetFixtureReviewActivateRequestSchema>;
export type DevnetFixtureReviewView = z.infer<typeof DevnetFixtureReviewViewSchema>;
export type DevnetFixtureReviewActivateResponse = z.infer<typeof DevnetFixtureReviewActivateResponseSchema>;
export type DevnetFixtureReviewGetActiveResponse = z.infer<typeof DevnetFixtureReviewGetActiveResponseSchema>;

export const DevnetFixtureTransferExecuteRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  acknowledgedUsesActiveReviewedFixture: z.literal(true),
  acknowledgedFixedLowValueTransfer: z.literal(true),
  acknowledgedPaysNetworkFee: z.literal(true),
  acknowledgedAutomaticTradingRemainsDisabled: z.literal(true),
}).strict();

export const DevnetFixtureTransferViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  state: DevnetFixtureProvisionStateSchema,
  amountAtomic: z.literal("1000000"),
  simulationUnits: AtomicAmountSchema.nullable(),
  failureCode: z.string().min(1).max(100).nullable(),
  signingAttempted: z.boolean(),
  broadcastAttempted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const DevnetFixtureTransferExecuteResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  transfer: DevnetFixtureTransferViewSchema,
}).strict();

export const DevnetFixtureTransferListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  transfers: z.array(DevnetFixtureTransferViewSchema).max(20),
}).strict();

export type DevnetFixtureTransferExecuteRequest = z.infer<typeof DevnetFixtureTransferExecuteRequestSchema>;
export type DevnetFixtureTransferView = z.infer<typeof DevnetFixtureTransferViewSchema>;
export type DevnetFixtureTransferExecuteResponse = z.infer<typeof DevnetFixtureTransferExecuteResponseSchema>;
export type DevnetFixtureTransferListResponse = z.infer<typeof DevnetFixtureTransferListResponseSchema>;

export const DevnetFixtureTransferApproveRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  transferId: z.string().uuid(),
  acknowledgedReviewedExactReceipt: z.literal(true),
  acknowledgedFreshOnChainConfirmation: z.literal(true),
  acknowledgedAutomaticTradingRemainsDisabled: z.literal(true),
}).strict();

export const DevnetFixtureTransferApprovalViewSchema = z.object({
  schemaVersion: z.literal(1),
  transferId: z.string().uuid(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  approved: z.literal(true),
  automaticTradingEnabled: z.literal(false),
  approvedAt: z.string().datetime(),
}).strict();

export const DevnetFixtureTransferApproveResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  approval: DevnetFixtureTransferApprovalViewSchema,
}).strict();

export const DevnetFixtureTransferGetApprovalResponseSchema = z.object({
  schemaVersion: z.literal(1),
  approval: DevnetFixtureTransferApprovalViewSchema.nullable(),
}).strict();

export type DevnetFixtureTransferApproveRequest = z.infer<typeof DevnetFixtureTransferApproveRequestSchema>;
export type DevnetFixtureTransferApprovalView = z.infer<typeof DevnetFixtureTransferApprovalViewSchema>;
export type DevnetFixtureTransferApproveResponse = z.infer<typeof DevnetFixtureTransferApproveResponseSchema>;
export type DevnetFixtureTransferGetApprovalResponse = z.infer<typeof DevnetFixtureTransferGetApprovalResponseSchema>;

export const GuardedMissionAuthorizeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  expectedPlanDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedExactMissionRevision: z.literal(true),
  acknowledgedDeskRuleLimits: z.literal(true),
  acknowledgedDedicatedHotWallet: z.literal(true),
  acknowledgedSchedulerSigningRemainsDisabled: z.literal(true),
}).strict();

export const GuardedMissionRevokeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  authorizationId: z.string().uuid(),
  acknowledgedRevocation: z.literal(true),
}).strict();

export const GuardedMissionAuthorizationViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  missionRevision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  deskRuleDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureTransferId: z.string().uuid(),
  state: z.enum(["active", "revoked"]),
  schedulerSigningEnabled: z.literal(false),
  mainnetEnabled: z.literal(false),
  authorizedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
}).strict();

export const GuardedMissionMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  authorization: GuardedMissionAuthorizationViewSchema,
}).strict();

export const GuardedMissionAuthorizationListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  authorizations: z.array(GuardedMissionAuthorizationViewSchema).max(20),
}).strict();

export type GuardedMissionAuthorizeRequest = z.infer<typeof GuardedMissionAuthorizeRequestSchema>;
export type GuardedMissionRevokeRequest = z.infer<typeof GuardedMissionRevokeRequestSchema>;
export type GuardedMissionAuthorizationView = z.infer<typeof GuardedMissionAuthorizationViewSchema>;
export type GuardedMissionMutationResponse = z.infer<typeof GuardedMissionMutationResponseSchema>;
export type GuardedMissionAuthorizationListResponse = z.infer<typeof GuardedMissionAuthorizationListResponseSchema>;

export const GuardedSchedulerArmRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  authorizationId: z.string().uuid(),
  acknowledgedAutomaticSigning: z.literal(true),
  acknowledgedHotWallet: z.literal(true),
  acknowledgedDevnetFixtureOnly: z.literal(true),
}).strict();

export const GuardedSchedulerArmRevokeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  schedulerArmId: z.string().uuid(),
  acknowledgedImmediateRevocation: z.literal(true),
}).strict();

export const GuardedSchedulerArmViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  authorizationId: z.string().uuid(),
  missionId: z.string().uuid(),
  missionRevision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  deskRuleDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  scope: z.literal("devnet-fixture-cycle-once"),
  state: z.enum(["active", "consumed", "revoked", "expired"]),
  executionId: z.string().uuid().nullable(),
  oneShotSigningAuthorized: z.boolean(),
  executionBridgeConnected: z.literal(true),
  mainnetEnabled: z.literal(false),
  armedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
}).strict();

export const GuardedSchedulerArmMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  arm: GuardedSchedulerArmViewSchema,
}).strict();

export const GuardedSchedulerArmListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  arms: z.array(GuardedSchedulerArmViewSchema).max(20),
}).strict();

export type GuardedSchedulerArmRequest = z.infer<typeof GuardedSchedulerArmRequestSchema>;
export type GuardedSchedulerArmRevokeRequest = z.infer<typeof GuardedSchedulerArmRevokeRequestSchema>;
export type GuardedSchedulerArmView = z.infer<typeof GuardedSchedulerArmViewSchema>;
export type GuardedSchedulerArmMutationResponse = z.infer<typeof GuardedSchedulerArmMutationResponseSchema>;
export type GuardedSchedulerArmListResponse = z.infer<typeof GuardedSchedulerArmListResponseSchema>;

export const GuardedExecutionStateSchema = z.enum([
  "proposed", "validated", "simulated", "signed", "broadcast",
  "confirmed", "receipted", "failed", "ambiguous",
]);

export const GuardedExecutionEventViewSchema = z.object({
  id: z.string().uuid(),
  fromState: GuardedExecutionStateSchema.nullable(),
  toState: GuardedExecutionStateSchema,
  eventName: z.enum([
    "proposal-created", "validation-passed", "simulation-passed", "signed",
    "broadcast-attempted", "confirmed", "receipt-stored",
    "pre-broadcast-failure", "post-broadcast-failure",
  ]),
  createdAt: z.string().datetime(),
}).strict();

export const GuardedExecutionViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  missionRevision: z.number().int().positive(),
  cycle: z.number().int().positive(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  state: GuardedExecutionStateSchema,
  signingAttempted: z.boolean(),
  broadcastAttempted: z.boolean(),
  failureCode: z.string().min(1).max(128).nullable(),
  marketSwapPerformed: z.literal(false),
  mainnetEnabled: z.literal(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  events: z.array(GuardedExecutionEventViewSchema).max(16),
}).strict();

export const GuardedExecutionListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  executions: z.array(GuardedExecutionViewSchema).max(20),
}).strict();

export type GuardedExecutionView = z.infer<typeof GuardedExecutionViewSchema>;
export type GuardedExecutionListResponse = z.infer<typeof GuardedExecutionListResponseSchema>;

export const GuardedFixtureCycleProposalSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  proposalKind: z.literal("spl-transfer-checked-cycle-v1"),
  purpose: z.literal("devnet-execution-path-proof"),
  missionId: z.string().uuid(),
  missionRevision: z.number().int().positive(),
  cycle: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  deskRuleDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  authorizationId: z.string().uuid(),
  schedulerArmId: z.string().uuid(),
  readinessEvaluationId: z.string().uuid(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  sourceTokenAccount: z.string().min(32).max(44),
  mintAddress: z.string().min(32).max(44),
  destinationTokenAccount: z.string().min(32).max(44),
  walletAuthority: z.string().min(32).max(44),
  fixtureAmountAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  mintDecimals: z.number().int().min(0).max(9),
  authorizedDcaAmountAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  economicValueMapping: z.literal("none"),
  marketSwapPerformed: z.literal(false),
  executionEnabled: z.literal(false),
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export type GuardedFixtureCycleProposal = z.infer<typeof GuardedFixtureCycleProposalSchema>;

export const GuardedDevnetProposalSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  missionRevision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  cycle: z.number().int().positive(),
  transactionKind: z.literal("spl-test-swap-v1"),
  inputMint: z.string().min(32).max(64),
  outputMint: z.string().min(32).max(64),
  inputAmountAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  quotedOutputAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  minimumOutputAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  slippageBps: BasisPointsSchema,
  priceImpactBps: BasisPointsSchema,
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export const GuardedDevnetSimulationSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: z.string().uuid(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  succeeded: z.boolean(),
  feeLamports: AtomicAmountSchema,
  unitsConsumed: AtomicAmountSchema,
  lastValidBlockHeight: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  transactionMessageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  programIds: z.array(z.string().min(32).max(64)).min(1).max(8),
  inputDebitAtomic: AtomicAmountSchema,
  outputCreditAtomic: AtomicAmountSchema,
}).strict();

export const GuardedDevnetDenialCodeSchema = z.enum([
  "profile-invalid",
  "fixture-provenance-invalid",
  "mission-context-mismatch",
  "mint-mismatch",
  "amount-mismatch",
  "quote-invalid",
  "quote-stale",
  "quote-expired",
  "slippage-exceeded",
  "price-impact-exceeded",
  "fee-exceeded",
  "daily-spend-exceeded",
  "wallet-reserve-breached",
  "network-unhealthy",
  "keystore-locked",
  "kill-switch-active",
  "simulation-missing",
  "simulation-failed",
  "proposal-mismatch",
  "program-denied",
  "balance-delta-invalid",
]);

export const GuardedDevnetValidationSchema = z.object({
  schemaVersion: z.literal(1),
  stage: z.enum(["pre-simulation", "pre-sign"]),
  proposalId: z.string().uuid(),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  allowed: z.boolean(),
  signingAllowed: z.boolean(),
  denialCodes: z.array(GuardedDevnetDenialCodeSchema),
  validatedAt: z.string().datetime(),
});

export type GuardedDevnetProposal = z.infer<typeof GuardedDevnetProposalSchema>;
export type GuardedDevnetSimulation = z.infer<typeof GuardedDevnetSimulationSchema>;
export type GuardedDevnetDenialCode = z.infer<typeof GuardedDevnetDenialCodeSchema>;
export type GuardedDevnetValidation = z.infer<typeof GuardedDevnetValidationSchema>;

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
}).strict();

export const MissionAuthorizeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  expectedPlanDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedSimulationOnly: z.literal(true),
}).strict();

export const MissionCommandRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
}).strict();

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
}).strict();

export const SimulationReceiptViewSchema = z.object({
  receiptId: z.string().uuid(),
  createdAt: z.string().datetime(),
  revision: z.number().int().positive(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  outcome: z.literal("would-execute"),
  signingAttempted: z.literal(false),
  observedAt: z.string().datetime(),
});

export const GuardedSchedulerReadinessViewSchema = z.object({
  evaluationId: z.string().uuid(),
  outcome: z.enum(["inactive", "ready", "denied"]),
  reasonCode: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u),
  authorizationId: z.string().uuid().nullable(),
  evaluatedAt: z.string().datetime(),
  executionEnabled: z.literal(false),
  signingAttempted: z.literal(false),
});

export const DcaCycleAuditSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  cycle: z.number().int().positive(),
  dueAt: z.string().datetime(),
  state: z.enum(["skipped", "halted", "receipted"]),
  reason: z.string().nullable(),
  receipt: SimulationReceiptViewSchema.nullable(),
  guardedReadiness: GuardedSchedulerReadinessViewSchema.nullable(),
});

export const MissionAuditResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  missionId: z.string().uuid(),
  cycles: z.array(DcaCycleAuditSchema),
});

export type MissionAuditRequest = z.infer<typeof MissionAuditRequestSchema>;
export type SimulationReceiptView = z.infer<typeof SimulationReceiptViewSchema>;
export type GuardedSchedulerReadinessView = z.infer<typeof GuardedSchedulerReadinessViewSchema>;
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
}).strict();

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
}).strict();

export const AiDeleteProviderRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
}).strict();

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
}).strict();

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

export const JupiterSettingsResponseSchema = z.object({
  schemaVersion: z.literal(1),
  configured: z.boolean(),
  endpoint: z.literal("https://api.jup.ag/swap/v2/order"),
});

export const JupiterSaveKeyRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  apiKey: z.string().trim().min(8).max(512),
  acknowledgedMainnetMarketData: z.literal(true),
}).strict();

export const JupiterKeyMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  configured: z.boolean(),
});

export const JupiterShadowQuoteRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  direction: z.enum(["sol-to-usdc", "usdc-to-sol"]),
  amountAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  slippageBps: BasisPointsSchema,
  maxPriceImpactBps: BasisPointsSchema,
  maxFeeBps: BasisPointsSchema,
  acknowledgedQuoteOnly: z.literal(true),
}).strict();

export const JupiterShadowDenialCodeSchema = z.enum([
  "mint-mismatch",
  "amount-mismatch",
  "swap-mode-invalid",
  "transaction-returned",
  "route-empty",
  "route-allocation-invalid",
  "slippage-exceeded",
  "price-impact-exceeded",
  "fee-exceeded",
  "amount-threshold-invalid",
]);

export const JupiterShadowQuoteViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  profile: z.literal("mainnet-shadow"),
  direction: z.enum(["sol-to-usdc", "usdc-to-sol"]),
  inputMint: z.string().min(32).max(64),
  outputMint: z.string().min(32).max(64),
  inAmount: AtomicAmountSchema,
  outAmount: AtomicAmountSchema,
  otherAmountThreshold: AtomicAmountSchema,
  slippageBps: BasisPointsSchema,
  priceImpactBps: BasisPointsSchema,
  feeBps: BasisPointsSchema,
  router: z.enum(["metis", "jupiterz", "dflow", "okx"]),
  routeLabels: z.array(z.string().min(1).max(100)).min(1).max(16),
  allowed: z.boolean(),
  denialCodes: z.array(JupiterShadowDenialCodeSchema),
  transactionReturned: z.boolean(),
  signingAttempted: z.literal(false),
  broadcastAttempted: z.literal(false),
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const JupiterShadowQuoteResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  quote: JupiterShadowQuoteViewSchema,
});

export const JupiterShadowListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  quotes: z.array(JupiterShadowQuoteViewSchema).max(20),
});

export type JupiterSettingsResponse = z.infer<typeof JupiterSettingsResponseSchema>;
export type JupiterSaveKeyRequest = z.infer<typeof JupiterSaveKeyRequestSchema>;
export type JupiterKeyMutationResponse = z.infer<typeof JupiterKeyMutationResponseSchema>;
export type JupiterShadowQuoteRequest = z.infer<typeof JupiterShadowQuoteRequestSchema>;
export type JupiterShadowDenialCode = z.infer<typeof JupiterShadowDenialCodeSchema>;
export type JupiterShadowQuoteView = z.infer<typeof JupiterShadowQuoteViewSchema>;
export type JupiterShadowQuoteResponse = z.infer<typeof JupiterShadowQuoteResponseSchema>;
export type JupiterShadowListResponse = z.infer<typeof JupiterShadowListResponseSchema>;

export const JupiterOrderQuoteSchema = z.object({
  mode: z.string().min(1),
  inputMint: z.string().min(32).max(64),
  outputMint: z.string().min(32).max(64),
  inAmount: AtomicAmountSchema,
  outAmount: AtomicAmountSchema,
  otherAmountThreshold: AtomicAmountSchema,
  swapMode: z.string().min(1),
  slippageBps: BasisPointsSchema,
  priceImpact: z.number(),
  feeBps: BasisPointsSchema,
  router: z.enum(["metis", "jupiterz", "dflow", "okx"]),
  transaction: z.string().nullable(),
  routePlan: z.array(
    z.object({
      swapInfo: z.object({ label: z.string().min(1).max(100) }),
      percent: z.number().min(0).max(100).optional(),
      bps: z.number().int().min(0).max(10_000).optional(),
    }),
  ).max(16),
});

export type JupiterOrderQuote = z.infer<typeof JupiterOrderQuoteSchema>;
