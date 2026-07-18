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
  aiProposeShadowTrade: "ai:propose-shadow-trade",
  aiListShadowTrades: "ai:list-shadow-trades",
  aiApproveShadowTrade: "ai:approve-shadow-trade",
  aiRejectShadowTrade: "ai:reject-shadow-trade",
  jupiterGetSettings: "jupiter:get-settings",
  jupiterSaveKey: "jupiter:save-key",
  jupiterDeleteKey: "jupiter:delete-key",
  jupiterShadowQuote: "jupiter:shadow-quote",
  jupiterShadowList: "jupiter:list-shadow-quotes",
  marketCreateObservation: "market:create-observation",
  marketListObservations: "market:list-observations",
  marketCreateWatch: "market:create-watch",
  marketPauseWatch: "market:pause-watch",
  marketListWatches: "market:list-watches",
  agentCreateSession: "agent:create-session",
  agentHaltSession: "agent:halt-session",
  agentEvaluateObservation: "agent:evaluate-observation",
  agentListSessions: "agent:list-sessions",
  agentApproveIntent: "agent:approve-intent",
  agentRejectIntent: "agent:reject-intent",
  agentSimulateDevnetIntent: "agent:simulate-devnet-intent",
  agentListDevnetSimulations: "agent:list-devnet-simulations",
  agentArmDevnetSigning: "agent:arm-devnet-signing",
  agentRevokeDevnetSigningArm: "agent:revoke-devnet-signing-arm",
  agentListDevnetSigningArms: "agent:list-devnet-signing-arms",
  agentPrepareDevnetExecution: "agent:prepare-devnet-execution",
  agentListDevnetPreSignExecutions: "agent:list-devnet-pre-sign-executions",
  agentSignDevnetExecution: "agent:sign-devnet-execution",
  agentListDevnetSignedExecutions: "agent:list-devnet-signed-executions",
  agentBroadcastDevnetExecution: "agent:broadcast-devnet-execution",
  agentListDevnetBroadcastExecutions: "agent:list-devnet-broadcast-executions",
  agentQuoteDevnetSwap: "agent:quote-devnet-swap",
  agentListDevnetSwapQuotes: "agent:list-devnet-swap-quotes",
  agentBuildDevnetSwap: "agent:build-devnet-swap",
  agentListDevnetSwapBuilds: "agent:list-devnet-swap-builds",
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

export const AiShadowTradeProposalV1Schema = z.object({
  schemaVersion: z.literal(1),
  intentType: z.literal("shadow-trade-proposal"),
  quoteId: z.string().uuid(),
  action: z.enum(["execute-quoted-swap", "hold"]),
  direction: z.enum(["sol-to-usdc", "usdc-to-sol"]),
  inAmount: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  confidenceBps: BasisPointsSchema,
  rationale: z.string().min(1).max(600),
  riskFlags: z.array(z.string().min(1).max(120)).max(8),
}).strict();

export const AiShadowTradeEvaluationDenialCodeSchema = z.enum([
  "quote-not-allowed",
  "quote-expired",
  "proposal-quote-mismatch",
  "transaction-returned",
]);

export const AiShadowTradeEvaluationReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  outcome: z.enum(["hold", "would-execute", "blocked"]),
  denialCodes: z.array(AiShadowTradeEvaluationDenialCodeSchema),
  observedAt: z.string().datetime(),
  evaluatedAt: z.string().datetime(),
  signingAttempted: z.literal(false),
  executionAttempted: z.literal(false),
  persistedLocally: z.literal(true),
});

export const AiProposeShadowTradeRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  quoteId: z.string().uuid(),
  objective: z.string().trim().min(10).max(2_000),
  acknowledgedExternalProcessing: z.literal(true),
  acknowledgedQuoteOnly: z.literal(true),
}).strict();

export const AiProposeShadowTradeResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  model: z.string().min(1).max(128),
  quote: z.lazy(() => JupiterShadowQuoteViewSchema),
  proposal: AiShadowTradeProposalV1Schema,
  receipt: AiShadowTradeEvaluationReceiptSchema,
});

export const AiShadowTradeApprovalSchema = z.object({
  state: z.enum(["not-actionable", "pending", "approved", "rejected", "expired"]),
  expiresAt: z.string().datetime().nullable(),
  decidedAt: z.string().datetime().nullable(),
  executionEnabled: z.literal(false),
});

export const AiShadowTradeEvaluationViewSchema = z.object({
  schemaVersion: z.literal(1),
  provider: AiProviderSchema,
  model: z.string().min(1).max(128),
  objective: z.string().min(10).max(2_000),
  quote: z.lazy(() => JupiterShadowQuoteViewSchema),
  proposal: AiShadowTradeProposalV1Schema,
  receipt: AiShadowTradeEvaluationReceiptSchema,
  approval: AiShadowTradeApprovalSchema,
});

export const AiShadowTradeListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  evaluations: z.array(AiShadowTradeEvaluationViewSchema).max(20),
});

const AiShadowTradeDecisionBaseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  expectedProposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const AiApproveShadowTradeRequestSchema = AiShadowTradeDecisionBaseSchema.extend({
  acknowledgedIntentOnly: z.literal(true),
  acknowledgedFreshQuoteRequired: z.literal(true),
  acknowledgedNoExecution: z.literal(true),
}).strict();

export const AiRejectShadowTradeRequestSchema = AiShadowTradeDecisionBaseSchema.extend({
  acknowledgedRejectionOrRevocation: z.literal(true),
}).strict();

export const AiShadowTradeMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluation: AiShadowTradeEvaluationViewSchema,
});

export type AiShadowTradeProposalV1 = z.infer<typeof AiShadowTradeProposalV1Schema>;
export type AiShadowTradeEvaluationDenialCode = z.infer<typeof AiShadowTradeEvaluationDenialCodeSchema>;
export type AiShadowTradeEvaluationReceipt = z.infer<typeof AiShadowTradeEvaluationReceiptSchema>;
export type AiProposeShadowTradeRequest = z.infer<typeof AiProposeShadowTradeRequestSchema>;
export type AiProposeShadowTradeResponse = z.infer<typeof AiProposeShadowTradeResponseSchema>;
export type AiShadowTradeApproval = z.infer<typeof AiShadowTradeApprovalSchema>;
export type AiShadowTradeEvaluationView = z.infer<typeof AiShadowTradeEvaluationViewSchema>;
export type AiShadowTradeListResponse = z.infer<typeof AiShadowTradeListResponseSchema>;
export type AiApproveShadowTradeRequest = z.infer<typeof AiApproveShadowTradeRequestSchema>;
export type AiRejectShadowTradeRequest = z.infer<typeof AiRejectShadowTradeRequestSchema>;
export type AiShadowTradeMutationResponse = z.infer<typeof AiShadowTradeMutationResponseSchema>;

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

export const MarketObservationViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  profile: z.literal("mainnet-shadow"),
  pair: z.literal("SOL/USDC"),
  primaryQuoteId: z.string().uuid(),
  market: z.object({
    priceMicros: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
    priceImpactBps: BasisPointsSchema,
    feeBps: BasisPointsSchema,
    routeCount: z.number().int().min(1).max(16),
    liquidityProxy: z.enum(["healthy", "caution", "thin"]),
    volatility: z.object({
      status: z.enum(["available", "insufficient-data"]),
      sampleCount: z.number().int().min(1).max(20),
      windowSeconds: z.number().int().min(0).max(86_400),
      rangeBps: BasisPointsSchema.nullable(),
    }),
  }),
  walletContext: z.object({
    status: z.literal("unavailable"),
    reason: z.literal("mainnet-wallet-not-configured"),
  }),
  provenance: z.object({
    provider: z.literal("jupiter-swap-v2"),
    sourceQuoteIds: z.array(z.string().uuid()).min(1).max(20),
    sourceSlot: z.null(),
    sourceBlock: z.null(),
    observedAt: z.string().datetime(),
    capturedAt: z.string().datetime(),
    freshnessBudgetSeconds: z.literal(10),
    expiresAt: z.string().datetime(),
  }),
  freshnessStatus: z.enum(["fresh", "stale"]),
  observationDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  modelCallsAttempted: z.literal(false),
  signingAttempted: z.literal(false),
  executionAttempted: z.literal(false),
}).strict();

export const MarketCreateObservationRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  quoteId: z.string().uuid(),
  acknowledgedObservationOnly: z.literal(true),
}).strict();

export const MarketCreateObservationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  observation: MarketObservationViewSchema,
});

export const MarketObservationListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  observations: z.array(MarketObservationViewSchema).max(20),
});

export type MarketObservationView = z.infer<typeof MarketObservationViewSchema>;
export type MarketCreateObservationRequest = z.infer<typeof MarketCreateObservationRequestSchema>;
export type MarketCreateObservationResponse = z.infer<typeof MarketCreateObservationResponseSchema>;
export type MarketObservationListResponse = z.infer<typeof MarketObservationListResponseSchema>;

export const MarketWatchViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  state: z.enum(["active", "triggered", "paused"]),
  direction: z.enum(["sol-to-usdc", "usdc-to-sol"]),
  condition: z.enum(["price-at-or-below", "price-at-or-above"]),
  thresholdPriceMicros: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  maxPriceImpactBps: BasisPointsSchema,
  intervalSeconds: z.number().int().min(60).max(3_600),
  fixedProbeAmountAtomic: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  nextCheckAt: z.string().datetime(),
  lastCheckedAt: z.string().datetime().nullable(),
  triggeredAt: z.string().datetime().nullable(),
  pausedAt: z.string().datetime().nullable(),
  lastObservationId: z.string().uuid().nullable(),
  consecutiveFailures: z.number().int().min(0).max(5),
  modelCallsAttempted: z.literal(false),
  executionEnabled: z.literal(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const MarketWakeReceiptViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  watchId: z.string().uuid(),
  observationId: z.string().uuid().nullable(),
  outcome: z.enum(["waiting", "triggered", "failed"]),
  observedPriceMicros: AtomicAmountSchema.nullable(),
  priceImpactBps: BasisPointsSchema.nullable(),
  failureCode: z.enum(["quote-unavailable", "observation-rejected", "scheduler-stopped"]).nullable(),
  evaluatedAt: z.string().datetime(),
  modelCallsAttempted: z.literal(false),
  signingAttempted: z.literal(false),
  executionAttempted: z.literal(false),
}).strict();

export const MarketCreateWatchRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  direction: z.enum(["sol-to-usdc", "usdc-to-sol"]),
  condition: z.enum(["price-at-or-below", "price-at-or-above"]),
  thresholdPriceMicros: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  maxPriceImpactBps: BasisPointsSchema,
  intervalSeconds: z.number().int().min(60).max(3_600),
  acknowledgedBackgroundMarketData: z.literal(true),
  acknowledgedZeroAiCallsWhileSleeping: z.literal(true),
  acknowledgedNoExecution: z.literal(true),
}).strict();

export const MarketPauseWatchRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  watchId: z.string().uuid(),
  acknowledgedImmediatePause: z.literal(true),
}).strict();

export const MarketWatchMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  watch: MarketWatchViewSchema,
});

export const MarketWatchListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  watches: z.array(MarketWatchViewSchema).max(20),
  wakeReceipts: z.array(MarketWakeReceiptViewSchema).max(20),
});

export type MarketWatchView = z.infer<typeof MarketWatchViewSchema>;
export type MarketWakeReceiptView = z.infer<typeof MarketWakeReceiptViewSchema>;
export type MarketCreateWatchRequest = z.infer<typeof MarketCreateWatchRequestSchema>;
export type MarketPauseWatchRequest = z.infer<typeof MarketPauseWatchRequestSchema>;
export type MarketWatchMutationResponse = z.infer<typeof MarketWatchMutationResponseSchema>;
export type MarketWatchListResponse = z.infer<typeof MarketWatchListResponseSchema>;

export const AgentSessionViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  state: z.enum(["active", "halted", "expired"]),
  provider: AiProviderSchema,
  objective: z.string().trim().min(10).max(2_000),
  venue: z.literal("jupiter-swap-v2"),
  maxActionNotionalUsdcMicros: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  maxPriceImpactBps: BasisPointsSchema,
  maxVolatilityBps: BasisPointsSchema,
  deadlineAt: z.string().datetime(),
  haltedAt: z.string().datetime().nullable(),
  haltReason: z.enum(["operator", "ai-halt", "deadline", "policy-denial"]).nullable(),
  executionEnabled: z.literal(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const AgentIntentProposalV1Schema = z.object({
  schemaVersion: z.literal(1),
  intentType: z.literal("restricted-agent-intent"),
  sessionId: z.string().uuid(),
  observationId: z.string().uuid(),
  quoteId: z.string().uuid(),
  action: z.enum(["buy-sol", "sell-sol", "hold", "halt"]),
  notionalUsdcMicros: AtomicAmountSchema,
  confidenceBps: BasisPointsSchema,
  rationale: z.string().min(1).max(600),
  riskFlags: z.array(z.string().min(1).max(120)).max(8),
}).strict();

export const AgentIntentDenialCodeSchema = z.enum([
  "session-not-active",
  "session-expired",
  "observation-stale",
  "observation-quote-mismatch",
  "quote-not-allowed",
  "quote-expired",
  "transaction-returned",
  "proposal-binding-mismatch",
  "action-direction-mismatch",
  "notional-mismatch",
  "capital-cap-exceeded",
  "price-impact-exceeded",
  "volatility-unavailable",
  "volatility-exceeded",
]);

export const AgentIntentReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  observationId: z.string().uuid(),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  outcome: z.enum(["pending-approval", "hold", "halted", "blocked"]),
  denialCodes: z.array(AgentIntentDenialCodeSchema),
  evaluatedAt: z.string().datetime(),
  modelCallsAttempted: z.literal(true),
  signingAttempted: z.literal(false),
  executionAttempted: z.literal(false),
  persistedLocally: z.literal(true),
});

export const AgentIntentApprovalSchema = z.object({
  state: z.enum(["not-actionable", "pending", "approved", "rejected", "expired"]),
  expiresAt: z.string().datetime().nullable(),
  decidedAt: z.string().datetime().nullable(),
  executionEnabled: z.literal(false),
});

export const AgentIntentEvaluationViewSchema = z.object({
  schemaVersion: z.literal(1),
  provider: AiProviderSchema,
  model: z.string().min(1).max(128),
  session: AgentSessionViewSchema,
  observation: MarketObservationViewSchema,
  quote: JupiterShadowQuoteViewSchema,
  proposal: AgentIntentProposalV1Schema,
  receipt: AgentIntentReceiptSchema,
  approval: AgentIntentApprovalSchema,
}).strict();

export const AgentCreateSessionRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  provider: AiProviderSchema,
  objective: z.string().trim().min(10).max(2_000),
  maxActionNotionalUsdcMicros: AtomicAmountSchema.refine((value) => BigInt(value) > 0n),
  maxPriceImpactBps: BasisPointsSchema,
  maxVolatilityBps: BasisPointsSchema,
  deadlineAt: z.string().datetime(),
  acknowledgedExternalAiProcessing: z.literal(true),
  acknowledgedPerActionApproval: z.literal(true),
  acknowledgedNoExecution: z.literal(true),
}).strict();

export const AgentHaltSessionRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  acknowledgedImmediateHalt: z.literal(true),
}).strict();

export const AgentEvaluateObservationRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  observationId: z.string().uuid(),
  acknowledgedExternalAiProcessing: z.literal(true),
  acknowledgedIntentOnly: z.literal(true),
}).strict();

const AgentIntentDecisionBaseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  expectedProposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const AgentApproveIntentRequestSchema = AgentIntentDecisionBaseSchema.extend({
  acknowledgedIntentOnly: z.literal(true),
  acknowledgedFreshQuoteRequired: z.literal(true),
  acknowledgedNoExecution: z.literal(true),
}).strict();

export const AgentRejectIntentRequestSchema = AgentIntentDecisionBaseSchema.extend({
  acknowledgedRejectionOrRevocation: z.literal(true),
}).strict();

export const AgentSessionMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  session: AgentSessionViewSchema,
});

export const AgentEvaluateObservationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluation: AgentIntentEvaluationViewSchema,
});

export const AgentIntentMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluation: AgentIntentEvaluationViewSchema,
});

export const AgentSessionListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  sessions: z.array(AgentSessionViewSchema).max(20),
  evaluations: z.array(AgentIntentEvaluationViewSchema).max(20),
});

export type AgentSessionView = z.infer<typeof AgentSessionViewSchema>;
export type AgentIntentProposalV1 = z.infer<typeof AgentIntentProposalV1Schema>;
export type AgentIntentDenialCode = z.infer<typeof AgentIntentDenialCodeSchema>;
export type AgentIntentReceipt = z.infer<typeof AgentIntentReceiptSchema>;
export type AgentIntentApproval = z.infer<typeof AgentIntentApprovalSchema>;
export type AgentIntentEvaluationView = z.infer<typeof AgentIntentEvaluationViewSchema>;
export type AgentCreateSessionRequest = z.infer<typeof AgentCreateSessionRequestSchema>;
export type AgentHaltSessionRequest = z.infer<typeof AgentHaltSessionRequestSchema>;
export type AgentEvaluateObservationRequest = z.infer<typeof AgentEvaluateObservationRequestSchema>;
export type AgentApproveIntentRequest = z.infer<typeof AgentApproveIntentRequestSchema>;
export type AgentRejectIntentRequest = z.infer<typeof AgentRejectIntentRequestSchema>;
export type AgentSessionMutationResponse = z.infer<typeof AgentSessionMutationResponseSchema>;
export type AgentEvaluateObservationResponse = z.infer<typeof AgentEvaluateObservationResponseSchema>;
export type AgentIntentMutationResponse = z.infer<typeof AgentIntentMutationResponseSchema>;
export type AgentSessionListResponse = z.infer<typeof AgentSessionListResponseSchema>;

export const AgentDevnetSimulationViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  evaluationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentAction: z.enum(["buy-sol", "sell-sol"]),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  profile: z.literal("devnet-simulation"),
  proofKind: z.literal("spl-transfer-checked-simulation-v1"),
  outcome: z.enum(["simulated", "failed"]),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  messageHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  programIds: z.array(z.string().min(32).max(64)).max(4),
  unitsConsumed: AtomicAmountSchema.nullable(),
  feeLamports: AtomicAmountSchema.nullable(),
  failureCode: z.enum(["provenance-denied", "simulation-failed", "fee-exceeded", "binding-changed"]).nullable(),
  economicValueMapping: z.literal("none"),
  marketSwapPerformed: z.literal(false),
  signingAttempted: z.literal(false),
  broadcastAttempted: z.literal(false),
  executionAttempted: z.literal(false),
  simulatedAt: z.string().datetime(),
}).strict();

export const AgentSimulateDevnetIntentRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  expectedProposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedDevnetFixtureProofOnly: z.literal(true),
  acknowledgedNoEconomicValueMapping: z.literal(true),
  acknowledgedNoSigningOrBroadcast: z.literal(true),
}).strict();

export const AgentSimulateDevnetIntentResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  simulation: AgentDevnetSimulationViewSchema,
});

export const AgentDevnetSimulationListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  simulations: z.array(AgentDevnetSimulationViewSchema).max(20),
});

export type AgentDevnetSimulationView = z.infer<typeof AgentDevnetSimulationViewSchema>;
export type AgentSimulateDevnetIntentRequest = z.infer<typeof AgentSimulateDevnetIntentRequestSchema>;
export type AgentSimulateDevnetIntentResponse = z.infer<typeof AgentSimulateDevnetIntentResponseSchema>;
export type AgentDevnetSimulationListResponse = z.infer<typeof AgentDevnetSimulationListResponseSchema>;

export const AgentDevnetSigningArmViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  simulationId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  messageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  scope: z.literal("agent-devnet-fixture-sign-once"),
  state: z.enum(["active", "consumed", "revoked", "expired"]),
  executionId: z.string().uuid().nullable(),
  oneShotSigningAuthorized: z.literal(true),
  executionBridgeConnected: z.literal(false),
  economicValueMapping: z.literal("none"),
  marketSwapPerformed: z.literal(false),
  mainnetEnabled: z.literal(false),
  armedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
}).strict();

export const AgentArmDevnetSigningRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  simulationId: z.string().uuid(),
  expectedProposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  expectedMessageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedOneShotDevnetSigning: z.literal(true),
  acknowledgedDedicatedHotWallet: z.literal(true),
  acknowledgedNoMarketSwapOrEconomicMapping: z.literal(true),
}).strict();

export const AgentRevokeDevnetSigningArmRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  signingArmId: z.string().uuid(),
  acknowledgedImmediateRevocation: z.literal(true),
}).strict();

export const AgentDevnetSigningArmMutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  arm: AgentDevnetSigningArmViewSchema,
}).strict();

export const AgentDevnetSigningArmListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  arms: z.array(AgentDevnetSigningArmViewSchema).max(20),
}).strict();

export type AgentDevnetSigningArmView = z.infer<typeof AgentDevnetSigningArmViewSchema>;
export type AgentArmDevnetSigningRequest = z.infer<typeof AgentArmDevnetSigningRequestSchema>;
export type AgentRevokeDevnetSigningArmRequest = z.infer<typeof AgentRevokeDevnetSigningArmRequestSchema>;
export type AgentDevnetSigningArmMutationResponse = z.infer<typeof AgentDevnetSigningArmMutationResponseSchema>;
export type AgentDevnetSigningArmListResponse = z.infer<typeof AgentDevnetSigningArmListResponseSchema>;

export const AgentDevnetPreSignExecutionViewSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  signingArmId: z.string().uuid(),
  simulationId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  fixtureManifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  messageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  state: z.enum(["ready-for-signing", "failed"]),
  failureCode: z.enum(["arm-invalid", "binding-changed", "network-unhealthy", "provenance-denied", "blockhash-expired", "simulation-failed", "fee-exceeded"]).nullable(),
  signingArmConsumed: z.boolean(),
  exactMessageRevalidated: z.boolean(),
  executionBridgeConnected: z.literal(false),
  signingAttempted: z.literal(false),
  broadcastAttempted: z.literal(false),
  executionAttempted: z.literal(false),
  marketSwapPerformed: z.literal(false),
  mainnetEnabled: z.literal(false),
  preparedAt: z.string().datetime(),
}).strict();

export const AgentPrepareDevnetExecutionRequestSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), signingArmId: z.string().uuid(),
  expectedMessageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedConsumesOneShotArm: z.literal(true),
  acknowledgedPreSignOnly: z.literal(true),
  acknowledgedNoSigningOrBroadcast: z.literal(true),
}).strict();

export const AgentPrepareDevnetExecutionResponseSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), execution: AgentDevnetPreSignExecutionViewSchema,
}).strict();
export const AgentDevnetPreSignExecutionListResponseSchema = z.object({
  schemaVersion: z.literal(1), executions: z.array(AgentDevnetPreSignExecutionViewSchema).max(20),
}).strict();
export type AgentDevnetPreSignExecutionView = z.infer<typeof AgentDevnetPreSignExecutionViewSchema>;
export type AgentPrepareDevnetExecutionRequest = z.infer<typeof AgentPrepareDevnetExecutionRequestSchema>;
export type AgentPrepareDevnetExecutionResponse = z.infer<typeof AgentPrepareDevnetExecutionResponseSchema>;
export type AgentDevnetPreSignExecutionListResponse = z.infer<typeof AgentDevnetPreSignExecutionListResponseSchema>;

export const AgentDevnetSignedExecutionViewSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), preSignExecutionId: z.string().uuid(),
  signingArmId: z.string().uuid(), simulationId: z.string().uuid(), evaluationId: z.string().uuid(),
  sessionId: z.string().uuid(), messageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  state: z.enum(["proposed", "signing", "signed-awaiting-broadcast", "failed"]),
  signatureHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  failureCode: z.enum(["binding-changed", "network-unhealthy", "provenance-denied", "blockhash-expired", "signing-failed", "journal-conflict", "restart-before-sign-complete"]).nullable(),
  signingAttempted: z.boolean(), broadcastAttempted: z.literal(false), executionAttempted: z.literal(false),
  marketSwapPerformed: z.literal(false), mainnetEnabled: z.literal(false),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
export const AgentSignDevnetExecutionRequestSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), preSignExecutionId: z.string().uuid(),
  expectedMessageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedExactFixtureSignature: z.literal(true), acknowledgedConsumesReadyReceipt: z.literal(true),
  acknowledgedNoBroadcastOrMarketSwap: z.literal(true),
}).strict();
export const AgentSignDevnetExecutionResponseSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), execution: AgentDevnetSignedExecutionViewSchema,
}).strict();
export const AgentDevnetSignedExecutionListResponseSchema = z.object({
  schemaVersion: z.literal(1), executions: z.array(AgentDevnetSignedExecutionViewSchema).max(20),
}).strict();
export type AgentDevnetSignedExecutionView = z.infer<typeof AgentDevnetSignedExecutionViewSchema>;
export type AgentSignDevnetExecutionRequest = z.infer<typeof AgentSignDevnetExecutionRequestSchema>;
export type AgentSignDevnetExecutionResponse = z.infer<typeof AgentSignDevnetExecutionResponseSchema>;
export type AgentDevnetSignedExecutionListResponse = z.infer<typeof AgentDevnetSignedExecutionListResponseSchema>;

export const AgentDevnetBroadcastExecutionViewSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), signedExecutionId: z.string().uuid(),
  preSignExecutionId: z.string().uuid(), simulationId: z.string().uuid(), evaluationId: z.string().uuid(),
  sessionId: z.string().uuid(), messageHash: z.string().regex(/^[a-f0-9]{64}$/u),
  signatureHash: z.string().regex(/^[a-f0-9]{64}$/u),
  state: z.enum(["proposed", "broadcast", "confirmed", "failed", "ambiguous"]),
  failureCode: z.enum(["binding-changed", "network-unhealthy", "provenance-denied", "blockhash-expired",
    "broadcast-status-unknown", "network-lost-after-broadcast", "transaction-error",
    "blockhash-expired-unconfirmed", "confirmation-timeout", "restart-before-broadcast",
    "reconciliation-pending", "reconciliation-unavailable", "journal-integrity-error"]).nullable(),
  broadcastAttempted: z.boolean(), executionAttempted: z.boolean(), fixtureTransferPerformed: z.boolean(),
  economicValueMapping: z.literal("none"), marketSwapPerformed: z.literal(false), mainnetEnabled: z.literal(false),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const attemptedState = value.state === "broadcast" || value.state === "confirmed" || value.state === "ambiguous";
  if (attemptedState && (!value.broadcastAttempted || !value.executionAttempted)) {
    context.addIssue({ code: "custom", message: "Broadcast state requires an attempt marker" });
  }
  if (value.state === "proposed" && (value.broadcastAttempted || value.executionAttempted)) {
    context.addIssue({ code: "custom", message: "Proposed state cannot claim an attempt" });
  }
  const failureState = value.state === "failed" || value.state === "ambiguous";
  if (value.fixtureTransferPerformed !== (value.state === "confirmed")
    || (failureState && value.failureCode === null) || (!failureState && value.failureCode !== null)) {
    context.addIssue({ code: "custom", message: "Confirmation evidence is inconsistent" });
  }
});
export const AgentBroadcastDevnetExecutionRequestSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), signedExecutionId: z.string().uuid(),
  expectedMessageHash: z.string().regex(/^[a-f0-9]{64}$/u), expectedSignatureHash: z.string().regex(/^[a-f0-9]{64}$/u),
  acknowledgedDevnetFeeAndFixtureTransfer: z.literal(true), acknowledgedNoAutomaticRetry: z.literal(true),
  acknowledgedNoMarketSwapOrMainnet: z.literal(true),
}).strict();
export const AgentBroadcastDevnetExecutionResponseSchema = z.object({
  schemaVersion: z.literal(1), requestId: z.string().uuid(), execution: AgentDevnetBroadcastExecutionViewSchema,
}).strict();
export const AgentDevnetBroadcastExecutionListResponseSchema = z.object({
  schemaVersion: z.literal(1), executions: z.array(AgentDevnetBroadcastExecutionViewSchema).max(20),
}).strict();
export type AgentDevnetBroadcastExecutionView = z.infer<typeof AgentDevnetBroadcastExecutionViewSchema>;
export type AgentBroadcastDevnetExecutionRequest = z.infer<typeof AgentBroadcastDevnetExecutionRequestSchema>;
export type AgentBroadcastDevnetExecutionResponse = z.infer<typeof AgentBroadcastDevnetExecutionResponseSchema>;
export type AgentDevnetBroadcastExecutionListResponse = z.infer<typeof AgentDevnetBroadcastExecutionListResponseSchema>;

export const AgentDevnetSwapQuoteViewSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), evaluationId: z.string().uuid(), sessionId: z.string().uuid(),
  action: z.enum(["buy-sol", "sell-sol"]), venue: z.literal("raydium-devnet"),
  inputMint: z.string().min(32).max(44), outputMint: z.string().min(32).max(44), inputAmount: z.string().regex(/^[1-9][0-9]*$/u),
  outputAmount: z.string().regex(/^[1-9][0-9]*$/u), minimumOutputAmount: z.string().regex(/^[1-9][0-9]*$/u),
  slippageBps: z.number().int().min(1).max(50), priceImpactBps: z.number().int().min(0).max(10_000),
  routePoolIds: z.array(z.string().min(32).max(44)).min(1).max(4), proposalNotionalUsdcMicros: z.string().regex(/^[1-9][0-9]*$/u),
  economicValueMapping: z.literal("direction-only-capped-devnet"), amountPolicy: z.literal("fixed-low-value-canary-v1"),
  allowed: z.boolean(), denialCodes: z.array(z.enum(["binding-changed", "action-unsupported", "quote-invalid", "price-impact-exceeded", "route-invalid"])).max(5),
  transactionBuilt: z.literal(false), signingAttempted: z.literal(false), broadcastAttempted: z.literal(false),
  marketSwapPerformed: z.literal(false), mainnetEnabled: z.literal(false), quotedAt: z.string().datetime(), expiresAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.allowed !== (value.denialCodes.length === 0)) {
    context.addIssue({ code: "custom", message: "Devnet swap quote allow state is inconsistent" });
  }
});
export const AgentQuoteDevnetSwapRequestSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid(),
  evaluationId: z.string().uuid(), acknowledgedDirectionOnlyCanaryAmount: z.literal(true),
  acknowledgedDevnetPriceIsNotMarketPrice: z.literal(true), acknowledgedNoBuildSignOrBroadcast: z.literal(true),
}).strict();
export const AgentQuoteDevnetSwapResponseSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid(),
  quote: AgentDevnetSwapQuoteViewSchema }).strict();
export const AgentDevnetSwapQuoteListResponseSchema = z.object({ schemaVersion: z.literal(1),
  quotes: z.array(AgentDevnetSwapQuoteViewSchema).max(20) }).strict();
export type AgentDevnetSwapQuoteView = z.infer<typeof AgentDevnetSwapQuoteViewSchema>;
export type AgentQuoteDevnetSwapRequest = z.infer<typeof AgentQuoteDevnetSwapRequestSchema>;
export type AgentQuoteDevnetSwapResponse = z.infer<typeof AgentQuoteDevnetSwapResponseSchema>;
export type AgentDevnetSwapQuoteListResponse = z.infer<typeof AgentDevnetSwapQuoteListResponseSchema>;

export const AgentDevnetSwapBuildViewSchema = z.object({ schemaVersion: z.literal(1), id: z.string().uuid(),
  quoteId: z.string().uuid(), evaluationId: z.string().uuid(), sessionId: z.string().uuid(), action: z.literal("sell-sol"),
  state: z.enum(["simulated", "denied"]), failureCode: z.enum(["binding-changed", "quote-expired", "build-invalid", "program-denied", "amount-mismatch", "simulation-failed", "fee-exceeded", "account-proof-failed", "balance-delta-invalid"]).nullable(),
  messageHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(), programIds: z.array(z.string().min(32).max(44)).max(4),
  inputAmount: z.string().regex(/^[1-9][0-9]*$/u), minimumOutputAmount: z.string().regex(/^[1-9][0-9]*$/u),
  feeLamports: z.string().regex(/^[0-9]+$/u).nullable(), unitsConsumed: z.string().regex(/^[0-9]+$/u).nullable(),
  outputTokenAccount: z.string().min(32).max(44), preOutputAmount: z.string().regex(/^[0-9]+$/u).nullable(),
  postOutputAmount: z.string().regex(/^[0-9]+$/u).nullable(), outputAmountDelta: z.string().regex(/^[0-9]+$/u).nullable(),
  walletLamportsDelta: z.string().regex(/^[0-9]+$/u).nullable(), preContextSlot: z.string().regex(/^[0-9]+$/u).nullable(),
  simulationContextSlot: z.string().regex(/^[0-9]+$/u).nullable(), associatedTokenAccountVerified: z.boolean(), balanceDeltaVerified: z.boolean(),
  exactAmountBound: z.boolean(), transactionBuilt: z.boolean(), simulationAttempted: z.boolean(), signingAttempted: z.literal(false),
  broadcastAttempted: z.literal(false), marketSwapPerformed: z.literal(false), mainnetEnabled: z.literal(false),
  builtAt: z.string().datetime(), expiresAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const completeProof = value.failureCode === null && value.messageHash !== null && value.exactAmountBound
    && value.associatedTokenAccountVerified && value.balanceDeltaVerified && value.preOutputAmount !== null
    && value.postOutputAmount !== null && value.outputAmountDelta !== null && value.walletLamportsDelta !== null
    && value.preContextSlot !== null && value.simulationContextSlot !== null;
  if ((value.state === "simulated") !== completeProof) {
    context.addIssue({ code: "custom", message: "Devnet swap build evidence is inconsistent" });
  }
});
export const AgentBuildDevnetSwapRequestSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid(), quoteId: z.string().uuid(),
  acknowledgedExactServerTransaction: z.literal(true), acknowledgedSimulationOnly: z.literal(true), acknowledgedNoSigningOrBroadcast: z.literal(true) }).strict();
export const AgentBuildDevnetSwapResponseSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid(), build: AgentDevnetSwapBuildViewSchema }).strict();
export const AgentDevnetSwapBuildListResponseSchema = z.object({ schemaVersion: z.literal(1), builds: z.array(AgentDevnetSwapBuildViewSchema).max(20) }).strict();
export type AgentDevnetSwapBuildView = z.infer<typeof AgentDevnetSwapBuildViewSchema>;
export type AgentBuildDevnetSwapRequest = z.infer<typeof AgentBuildDevnetSwapRequestSchema>;
export type AgentBuildDevnetSwapResponse = z.infer<typeof AgentBuildDevnetSwapResponseSchema>;
export type AgentDevnetSwapBuildListResponse = z.infer<typeof AgentDevnetSwapBuildListResponseSchema>;

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
