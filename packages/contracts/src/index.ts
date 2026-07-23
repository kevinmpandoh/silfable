import { z } from "zod";

export const IPC_CHANNELS = {
  runtimeStatus: "runtime:get-status",
  securityConfigurePassword: "security:configure-password",
  securityUnlock: "security:unlock",
  securityChangePassword: "security:change-password",
  securityResetVault: "security:reset-vault",
  sessionList: "session:list",
  sessionUpsert: "session:upsert",
  clipboardWriteWalletAddress: "clipboard:write-wallet-address",
  clipboardWriteTransactionSignature: "clipboard:write-transaction-signature",
  externalOpenTransaction: "external:open-transaction",
  walletCreate: "wallet:create",
  walletImportMnemonic: "wallet:import-mnemonic",
  walletImportPrivateKey: "wallet:import-private-key",
  walletList: "wallet:list",
  portfolioGet: "portfolio:get",
  walletActivityGet: "wallet:get-activity",
  aiGetSettings: "ai:get-settings",
  aiPreviewOpenRouterModels: "ai:preview-openrouter-models",
  aiSaveProvider: "ai:save-provider",
  aiChat: "ai:chat",
  pumpSimulate: "pump:simulate",
  pumpFinalRevalidate: "pump:final-revalidate",
  pumpExecute: "pump:execute",
  missionSimulate: "mission:simulate",
  missionExecute: "mission:execute",
  missionVerifyExecution: "mission:verify-execution",
  transactionSettingsGet: "transaction:get-settings",
  transactionSettingsSave: "transaction:save-settings",
  pumpRiskSettingsGet: "pump:get-risk-settings",
  pumpRiskSettingsSave: "pump:save-risk-settings",
  limitOrderSimulate: "trigger:simulate-order",
  limitOrderExecute: "trigger:execute-order",
  limitOrderList: "trigger:list-orders",
  limitOrderCancelSimulate: "trigger:simulate-cancel",
  limitOrderCancelExecute: "trigger:execute-cancel",
  jupiterGetSettings: "jupiter:get-settings",
  jupiterSaveKey: "jupiter:save-key",
  tavilyGetSettings: "tavily:get-settings",
  tavilySaveKey: "tavily:save-key",
  solanaRpcGetSettings: "solana:get-rpc-settings",
  solanaRpcSaveUrl: "solana:save-rpc-url",
} as const;

const RequestBaseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
});

export const RuntimeStatusSchema = z.object({
  appVersion: z.string().min(1),
  profile: z.literal("mainnet-guarded"),
  networkHealth: z.enum(["unknown", "healthy", "degraded", "offline"]),
  keystore: z.enum(["locked", "unlocked"]),
  masterPassword: z.enum(["missing", "configured"]),
  wallet: z.enum(["none", "configured"]),
  activeMissionCount: z.number().int().nonnegative(),
}).strict();
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;

const PasswordSchema = z.string().min(8, "Password must contain at least 8 characters").max(256, "Password is too long");
export const SecurityConfigurePasswordRequestSchema = RequestBaseSchema.extend({
  password: PasswordSchema,
  confirmPassword: PasswordSchema,
  acknowledgedPasswordLossRisk: z.literal(true),
}).strict().refine((value) => value.password === value.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const SecurityUnlockRequestSchema = RequestBaseSchema.extend({ password: z.string().min(1).max(256) }).strict();
export const SecurityChangePasswordRequestSchema = RequestBaseSchema.extend({
  currentPassword: z.string().min(1).max(256),
  newPassword: PasswordSchema,
  confirmPassword: PasswordSchema,
  acknowledgedPasswordLossRisk: z.literal(true),
}).strict().refine((value) => value.newPassword === value.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const SecurityPasswordMutationResponseSchema = RequestBaseSchema.extend({ keystore: z.literal("unlocked"), masterPassword: z.literal("configured") }).strict();
export type SecurityConfigurePasswordRequest = z.infer<typeof SecurityConfigurePasswordRequestSchema>;
export type SecurityUnlockRequest = z.infer<typeof SecurityUnlockRequestSchema>;
export type SecurityChangePasswordRequest = z.infer<typeof SecurityChangePasswordRequestSchema>;
export type SecurityPasswordMutationResponse = z.infer<typeof SecurityPasswordMutationResponseSchema>;

export const SecurityResetVaultRequestSchema = RequestBaseSchema.extend({
  confirmation: z.literal("SET UP NEW VAULT"),
  acknowledgedPermanentAccessLoss: z.literal(true),
}).strict();
export const SecurityResetVaultResponseSchema = RequestBaseSchema.extend({
  reset: z.literal(true),
  backupCreated: z.boolean(),
}).strict();
export type SecurityResetVaultRequest = z.infer<typeof SecurityResetVaultRequestSchema>;
export type SecurityResetVaultResponse = z.infer<typeof SecurityResetVaultResponseSchema>;

const MissionQuoteSchema = z.object({
  inputMint: z.string().min(32).max(44), outputMint: z.string().min(32).max(44),
  inAmount: z.string().regex(/^[1-9]\d*$/u), outAmount: z.string().regex(/^\d+$/u),
  router: z.string().min(1).max(64), mode: z.string().min(1).max(32),
  feeBps: z.number().int().min(0).max(10_000).nullable(), feeMint: z.string().min(32).max(44).nullable(),
  quoteOnly: z.literal(true), verifiedAt: z.string().datetime(),
}).strict();
export const MissionPolicyCheckSchema = z.object({
  code: z.enum(["wallet_registered", "token_pair_valid", "amount_valid", "slippage_within_limit", "deadline_valid", "balance_sufficient", "quote_only"]),
  status: z.enum(["pass", "fail"]),
  message: z.string().min(1).max(240),
}).strict();
export const MissionContractPreviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ready-for-review", "blocked"]),
  goal: z.string().min(1).max(400),
  walletAddress: z.string().min(32).max(44),
  inputMint: z.string().min(32).max(44),
  outputMint: z.string().min(32).max(44),
  inputAmount: z.string().regex(/^[1-9]\d*$/u),
  maxSlippageBps: z.number().int().min(0).max(10_000),
  deadlineAt: z.string().datetime(),
  stopConditions: z.array(z.string().min(1).max(160)).min(1).max(8),
  quote: MissionQuoteSchema.nullable(),
  checks: z.array(MissionPolicyCheckSchema).min(1).max(10),
  executionAllowed: z.literal(false),
  createdAt: z.string().datetime(),
}).strict();
export type MissionContractPreview = z.infer<typeof MissionContractPreviewSchema>;
export const PumpTradePolicyCheckSchema = z.object({
  code: z.enum(["wallet_registered", "exact_mint_valid", "venue_verified", "amount_valid", "sol_exposure_within_limit", "minimum_output_valid", "slippage_within_limit", "deadline_valid", "balance_sufficient", "token_authorities_safe", "concentration_within_limit", "liquidity_verified", "quote_only"]),
  status: z.enum(["pass", "fail"]),
  message: z.string().min(1).max(240),
}).strict();
export const PumpTradeContractPreviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(["ready-for-review", "blocked"]), goal: z.string().min(1).max(400),
  walletAddress: z.string().min(32).max(44), side: z.enum(["buy", "sell"]), tokenMint: z.string().min(32).max(44),
  inputMint: z.string().min(32).max(44), outputMint: z.string().min(32).max(44), inputAmount: z.string().regex(/^[1-9]\d*$/u),
  maxSolExposureLamports: z.string().regex(/^\d+$/u), minimumOutputAmount: z.string().regex(/^[1-9]\d*$/u),
  maxSlippageBps: z.number().int().min(0).max(10_000), deadlineAt: z.string().datetime(),
  stopConditions: z.array(z.string().min(1).max(160)).min(1).max(8),
  venue: z.enum(["bonding-curve-active", "bonding-curve-complete", "pumpswap-migrated", "unknown"]),
  risk: z.object({ mintAuthority: z.string().min(32).max(44).nullable(), freezeAuthority: z.string().min(32).max(44).nullable(), top10ConcentrationPercent: z.number().finite().nonnegative().nullable(), liquidityVerified: z.boolean(), evidenceSlot: z.number().int().nonnegative() }).strict(),
  inspectionBoundary: z.object({
    idlRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    venue: z.enum(["pump", "pumpswap", "unavailable"]),
    instructionName: z.enum(["buy_exact_quote_in_v2", "sell_v2", "buy_exact_quote_in", "sell"]).nullable(),
    accountCount: z.number().int().nonnegative(),
    transactionInspected: z.literal(false),
  }).strict().optional(),
  quote: MissionQuoteSchema.nullable(), checks: z.array(PumpTradePolicyCheckSchema).min(1).max(16),
  executionAllowed: z.literal(false), lifecycle: z.literal("proposal-only"), createdAt: z.string().datetime(),
}).strict();
export type PumpTradeContractPreview = z.infer<typeof PumpTradeContractPreviewSchema>;
export const PumpResearchEligibilityCheckSchema = z.object({
  id: z.enum(["canonical-venue", "token-program", "authorities-revoked", "holder-concentration", "quote-reserves", "reference-buy-path", "reference-sell-path", "price-impact", "freshness", "no-execution-authority"]),
  passed: z.boolean(),
  message: z.string().min(1).max(240),
}).strict();
export const PumpResearchEligibilitySchema = z.object({
  status: z.enum(["eligible", "blocked"]),
  tokenMint: z.string().min(32).max(44),
  venue: z.enum(["bonding-curve-active", "bonding-curve-complete", "pumpswap-migrated", "unknown"]),
  evidenceSlot: z.number().int().nonnegative(),
  thresholds: z.object({
    maxTop10ConcentrationPercent: z.number().finite().min(0).max(100),
    maxReferencePriceImpactBps: z.number().finite().min(0).max(10_000),
    maxEvidenceAgeMs: z.number().int().positive().max(10 * 60_000),
  }).strict(),
  checks: z.array(PumpResearchEligibilityCheckSchema).length(10),
  rankingAllowed: z.boolean(),
  executionAllowed: z.literal(false),
  evaluatedAt: z.string().datetime(),
}).strict().superRefine((evidence, context) => {
  const passed = evidence.checks.every((check) => check.passed);
  if (new Set(evidence.checks.map((check) => check.id)).size !== evidence.checks.length) {
    context.addIssue({ code: "custom", path: ["checks"], message: "Pump research eligibility checks must be unique and complete" });
  }
  if ((evidence.status === "eligible") !== passed || evidence.rankingAllowed !== passed) {
    context.addIssue({ code: "custom", message: "Pump research eligibility must match every deterministic check" });
  }
});
export type PumpResearchEligibility = z.infer<typeof PumpResearchEligibilitySchema>;
export const PumpTokenIntelligenceSchema = z.object({
  mint: z.string().min(32).max(44),
  programId: z.string().min(32).max(44),
  pumpSwapProgramId: z.string().min(32).max(44),
  bondingCurveAddress: z.string().min(32).max(44),
  pumpSwapPoolAddress: z.string().min(32).max(44),
  venue: z.enum(["bonding-curve-active", "bonding-curve-complete", "pumpswap-migrated", "unknown"]),
  bondingCurveExists: z.boolean(),
  accountVerified: z.boolean(),
  pumpSwapPoolVerified: z.boolean(),
  complete: z.boolean().nullable(),
  virtualTokenReserves: z.string().regex(/^\d+$/u).nullable(),
  virtualQuoteReserves: z.string().regex(/^\d+$/u).nullable(),
  realTokenReserves: z.string().regex(/^\d+$/u).nullable(),
  realQuoteReserves: z.string().regex(/^\d+$/u).nullable(),
  tokenTotalSupply: z.string().regex(/^\d+$/u).nullable(),
  tokenProgram: z.string().min(32).max(44).nullable(),
  decimals: z.number().int().min(0).max(18).nullable(),
  mintSupply: z.string().regex(/^\d+$/u).nullable(),
  mintAuthority: z.string().min(32).max(44).nullable(),
  freezeAuthority: z.string().min(32).max(44).nullable(),
  top10ConcentrationPercent: z.number().finite().min(0).max(100).nullable(),
  poolBaseTokenAccount: z.string().min(32).max(44).nullable(),
  poolQuoteTokenAccount: z.string().min(32).max(44).nullable(),
  poolBaseReserves: z.string().regex(/^\d+$/u).nullable(),
  poolQuoteReserves: z.string().regex(/^\d+$/u).nullable(),
  pumpSwapVirtualQuoteReserves: z.string().regex(/^-?\d+$/u).nullable(),
  pumpSwapEffectiveQuoteReserves: z.string().regex(/^\d+$/u).nullable(),
  metrics: z.object({
    quoteMint: z.string().min(32).max(44).nullable(),
    quoteSymbol: z.enum(["SOL", "USDC", "unknown"]),
    spotPriceQuotePerToken: z.number().finite().nonnegative().nullable(),
    estimatedMarketCapQuote: z.number().finite().nonnegative().nullable(),
    curveProgressPercent: z.number().finite().min(0).max(100).nullable(),
    quoteReservesUi: z.number().finite().nonnegative().nullable(),
    referenceBuyInputLamports: z.string().regex(/^\d+$/u),
    referenceBuyPriceImpactBps: z.number().finite().min(0).max(10_000).nullable(),
    referencePath: z.object({
      venue: z.enum(["bonding-curve", "pumpswap", "unavailable"]),
      buyInputQuoteAmount: z.string().regex(/^\d+$/u),
      buyOutputTokenAmount: z.string().regex(/^\d+$/u).nullable(),
      buyPriceImpactBps: z.number().finite().min(0).max(10_000).nullable(),
      sellInputTokenAmount: z.string().regex(/^\d+$/u).nullable(),
      sellOutputQuoteAmount: z.string().regex(/^\d+$/u).nullable(),
      sellPriceImpactBps: z.number().finite().min(0).max(10_000).nullable(),
      roundTripLossBps: z.number().finite().min(0).max(10_000).nullable(),
      estimateKind: z.literal("reserve-only"),
      networkFeeLamports: z.null(),
      rentLamports: z.null(),
      disclosure: z.string().min(1).max(500),
    }).strict(),
    priceImpactNote: z.string().min(1).max(240),
    baseProtocolFeeBps: z.number().int().min(0).max(10_000).nullable(),
    baseCreatorFeeBps: z.number().int().min(0).max(10_000).nullable(),
    feeNote: z.string().min(1).max(240),
  }).strict(),
  slot: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1).max(500)).max(12),
  verifiedAt: z.string().datetime(),
  researchEligibility: PumpResearchEligibilitySchema.optional(),
}).strict();
export type PumpTokenIntelligence = z.infer<typeof PumpTokenIntelligenceSchema>;
  export const PumpDiscoverySnapshotSchema = z.object({
  source: z.literal("recent-program-transactions"),
  programId: z.string().min(32).max(44),
  commitment: z.literal("finalized"),
    scannedSignatures: z.number().int().min(0).max(10),
    observedMints: z.number().int().min(0).max(100),
    decodedEvents: z.number().int().min(0).max(100).default(0),
    cursorSignature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,128}$/u).nullable().default(null),
    candidates: z.array(z.object({
      mint: z.string().min(32).max(44),
      sourceSignature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,128}$/u),
      sourceSlot: z.number().int().nonnegative(),
      sourceBlockTime: z.string().datetime().nullable(),
      signals: z.array(z.enum([
        "token-created",
        "curve-buy",
        "curve-sell",
        "curve-active",
        "curve-complete",
        "migration-observed",
        "pumpswap-migrated",
        "token-balance-observed",
        "create-event",
        "trade-event",
        "complete-event",
        "migration-event",
      ])).min(1).max(8).default(["token-balance-observed"]),
      intelligence: PumpTokenIntelligenceSchema,
  }).strict()).max(5),
  executionAllowed: z.literal(false),
  disclosure: z.string().min(1).max(500),
  scannedAt: z.string().datetime(),
}).strict().superRefine((snapshot, context) => {
  const mints = snapshot.candidates.map((candidate) => candidate.mint);
  if (new Set(mints).size !== mints.length || snapshot.candidates.some((candidate) => candidate.intelligence.mint !== candidate.mint)) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Pump discovery candidates must be unique and exactly bound to their intelligence" });
  }
});
export type PumpDiscoverySnapshot = z.infer<typeof PumpDiscoverySnapshotSchema>;
export const LimitOrderPolicyCheckSchema = z.object({
  code: z.enum(["wallet_registered", "token_pair_valid", "amount_valid", "minimum_order_value", "slippage_within_limit", "expiry_valid", "trigger_valid", "balance_sufficient"]),
  status: z.enum(["pass", "fail"]),
  message: z.string().min(1).max(240),
}).strict();
export const LimitOrderContractPreviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ready-for-review", "blocked"]),
  goal: z.string().min(1).max(400),
  walletAddress: z.string().min(32).max(44),
  inputMint: z.string().min(32).max(44),
  outputMint: z.string().min(32).max(44),
  inputAmount: z.string().regex(/^[1-9]\d*$/u),
  triggerMint: z.string().min(32).max(44),
  triggerCondition: z.enum(["above", "below"]),
  triggerPriceUsd: z.number().finite().positive(),
  maxSlippageBps: z.number().int().min(0).max(10_000),
  expiresAt: z.string().datetime(),
  estimatedInputValueUsd: z.number().finite().nonnegative().nullable(),
  checks: z.array(LimitOrderPolicyCheckSchema).min(1).max(10),
  executionAllowed: z.literal(false),
  lifecycle: z.literal("preview-only"),
  createdAt: z.string().datetime(),
}).strict();
export type LimitOrderContractPreview = z.infer<typeof LimitOrderContractPreviewSchema>;
export const LimitOrderSimulationPreviewSchema = z.object({
  id: z.string().uuid(), orderId: z.string().uuid(), status: z.enum(["passed", "failed", "blocked"]),
  vaultAddress: z.string().min(32).max(44).nullable(), programIds: z.array(z.string().min(32).max(44)).max(12),
  unitsConsumed: z.number().int().nonnegative().nullable(), feeLamports: z.number().int().nonnegative().nullable(),
  error: z.string().min(1).max(500).nullable(), transactionSigned: z.literal(false), broadcastAttempted: z.literal(false), simulatedAt: z.string().datetime(),
}).strict();
export type LimitOrderSimulationPreview = z.infer<typeof LimitOrderSimulationPreviewSchema>;
export const LimitOrderExecutionReceiptSchema = z.object({
  id: z.string().uuid(), previewId: z.string().uuid(), simulationId: z.string().uuid(), orderId: z.string().min(8).max(128).nullable(),
  status: z.enum(["active", "failed", "unknown"]), depositSignature: z.string().min(32).max(128).nullable(), vaultAddress: z.string().min(32).max(44),
  explorerUrl: z.string().url().nullable(), depositConfirmed: z.boolean(), chainVerification: z.enum(["finalized", "confirmed", "processed", "not-found", "failed", "unavailable"]),
  chainSlot: z.number().int().nonnegative().nullable(), error: z.string().min(1).max(500).nullable(), verifiedAt: z.string().datetime().nullable(), createdAt: z.string().datetime(),
}).strict();
export type LimitOrderExecutionReceipt = z.infer<typeof LimitOrderExecutionReceiptSchema>;
export const LimitOrderSimulateRequestSchema = RequestBaseSchema.extend({ sessionId: z.string().uuid(), previewId: z.string().uuid(), acknowledgedVaultRegistration: z.literal(true), acknowledgedSimulationOnly: z.literal(true) }).strict();
export const LimitOrderSimulateResponseSchema = RequestBaseSchema.extend({ simulation: LimitOrderSimulationPreviewSchema }).strict();
export const LimitOrderExecuteRequestSchema = RequestBaseSchema.extend({ sessionId: z.string().uuid(), previewId: z.string().uuid(), simulationId: z.string().uuid(), masterPassword: z.string().min(1).max(256), confirmation: z.literal("CREATE LIMIT ORDER"), acknowledgedCustodialVaultDeposit: z.literal(true) }).strict();
export const LimitOrderExecuteResponseSchema = RequestBaseSchema.extend({ receipt: LimitOrderExecutionReceiptSchema }).strict();
export type LimitOrderSimulateRequest = z.infer<typeof LimitOrderSimulateRequestSchema>;
export type LimitOrderSimulateResponse = z.infer<typeof LimitOrderSimulateResponseSchema>;
export type LimitOrderExecuteRequest = z.infer<typeof LimitOrderExecuteRequestSchema>;
export type LimitOrderExecuteResponse = z.infer<typeof LimitOrderExecuteResponseSchema>;
export const LimitOrderViewSchema = z.object({
  id: z.string().min(8).max(128), orderState: z.enum(["pending", "open", "executing", "filled", "pending_withdraw", "cancelled", "expired", "failed"]),
  userPubkey: z.string().min(32).max(44), inputMint: z.string().min(32).max(44), outputMint: z.string().min(32).max(44),
  initialInputAmount: z.string().regex(/^\d+$/u), remainingInputAmount: z.string().regex(/^\d+$/u), triggerMint: z.string().min(32).max(44),
  triggerCondition: z.enum(["above", "below"]), triggerPriceUsd: z.number().finite().positive(), slippageBps: z.number().int().min(0).max(10_000),
  expiresAt: z.number().int().positive(), createdAt: z.number().int().positive(), updatedAt: z.number().int().positive(),
}).strict();
export type LimitOrderView = z.infer<typeof LimitOrderViewSchema>;
export const LimitOrderListRequestSchema = RequestBaseSchema.extend({ walletAddress: z.string().min(32).max(44), state: z.enum(["active", "past"]) }).strict();
export const LimitOrderListResponseSchema = RequestBaseSchema.extend({ orders: z.array(LimitOrderViewSchema).max(50) }).strict();
export const LimitOrderCancelSimulationSchema = z.object({
  id: z.string().uuid(), orderId: z.string().min(8).max(128), status: z.enum(["passed", "failed", "blocked"]), programIds: z.array(z.string().min(32).max(44)).max(12),
  unitsConsumed: z.number().int().nonnegative().nullable(), feeLamports: z.number().int().nonnegative().nullable(), error: z.string().min(1).max(500).nullable(),
  transactionSigned: z.literal(false), broadcastAttempted: z.literal(false), simulatedAt: z.string().datetime(),
}).strict();
export type LimitOrderCancelSimulation = z.infer<typeof LimitOrderCancelSimulationSchema>;
export const LimitOrderCancelReceiptSchema = z.object({
  id: z.string().uuid(), orderId: z.string().min(8).max(128), simulationId: z.string().uuid(), status: z.enum(["cancelled", "failed", "unknown"]),
  withdrawalSignature: z.string().min(32).max(128).nullable(), explorerUrl: z.string().url().nullable(), chainVerification: z.enum(["finalized", "confirmed", "processed", "not-found", "failed", "unavailable"]),
  chainSlot: z.number().int().nonnegative().nullable(), error: z.string().min(1).max(500).nullable(), verifiedAt: z.string().datetime().nullable(), createdAt: z.string().datetime(),
}).strict();
export type LimitOrderCancelReceipt = z.infer<typeof LimitOrderCancelReceiptSchema>;
export const LimitOrderCancelSimulateRequestSchema = RequestBaseSchema.extend({ walletAddress: z.string().min(32).max(44), orderId: z.string().min(8).max(128), acknowledgedWithdrawalSimulationOnly: z.literal(true) }).strict();
export const LimitOrderCancelSimulateResponseSchema = RequestBaseSchema.extend({ simulation: LimitOrderCancelSimulationSchema }).strict();
export const LimitOrderCancelExecuteRequestSchema = RequestBaseSchema.extend({ walletAddress: z.string().min(32).max(44), orderId: z.string().min(8).max(128), simulationId: z.string().uuid(), masterPassword: z.string().min(1).max(256), confirmation: z.literal("CANCEL LIMIT ORDER"), acknowledgedVaultWithdrawal: z.literal(true) }).strict();
export const LimitOrderCancelExecuteResponseSchema = RequestBaseSchema.extend({ receipt: LimitOrderCancelReceiptSchema }).strict();
export type LimitOrderListRequest = z.infer<typeof LimitOrderListRequestSchema>;
export type LimitOrderListResponse = z.infer<typeof LimitOrderListResponseSchema>;
export type LimitOrderCancelSimulateRequest = z.infer<typeof LimitOrderCancelSimulateRequestSchema>;
export type LimitOrderCancelSimulateResponse = z.infer<typeof LimitOrderCancelSimulateResponseSchema>;
export type LimitOrderCancelExecuteRequest = z.infer<typeof LimitOrderCancelExecuteRequestSchema>;
export type LimitOrderCancelExecuteResponse = z.infer<typeof LimitOrderCancelExecuteResponseSchema>;
export const MissionSimulationPreviewSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  status: z.enum(["passed", "failed", "blocked"]),
  router: z.string().min(1).max(64).nullable(),
  expectedOutAmount: z.string().regex(/^\d+$/u).nullable(),
  programIds: z.array(z.string().min(32).max(44)).max(16),
  unitsConsumed: z.number().int().nonnegative().nullable(),
  feeLamports: z.number().int().nonnegative().nullable(),
  feeSol: z.string().min(1).max(64).nullable().optional(),
  feeUsd: z.number().finite().nonnegative().nullable().optional(),
  feePercent: z.number().finite().nonnegative().nullable().optional(),
  feeRisk: z.enum(["reasonable", "high", "extreme", "unavailable"]).optional(),
  feeGuardPassed: z.boolean().optional(),
  feeGuardMessage: z.string().min(1).max(500).optional(),
  logs: z.array(z.string().max(240)).max(20),
  error: z.string().min(1).max(500).nullable(),
  transactionSigned: z.literal(false),
  broadcastAttempted: z.literal(false),
  simulatedAt: z.string().datetime(),
}).strict();
export type MissionSimulationPreview = z.infer<typeof MissionSimulationPreviewSchema>;

export const TransactionPrioritySchema = z.enum(["economy", "standard", "fast"]);
export const TransactionSettingsSchema = z.object({
  maxNetworkFeeLamports: z.number().int().min(5_000).max(10_000_000),
  maxFeePercent: z.number().finite().min(0.1).max(100),
  defaultSlippageBps: z.number().int().min(0).max(300),
  defaultDeadlineMinutes: z.number().int().min(5).max(43_200),
  priority: TransactionPrioritySchema,
}).strict();
export const TransactionSettingsResponseSchema = z.object({ schemaVersion: z.literal(1), settings: TransactionSettingsSchema }).strict();
export const TransactionSettingsSaveRequestSchema = RequestBaseSchema.extend({ settings: TransactionSettingsSchema }).strict();
export const TransactionSettingsMutationResponseSchema = RequestBaseSchema.extend({ settings: TransactionSettingsSchema }).strict();
export type TransactionSettings = z.infer<typeof TransactionSettingsSchema>;
export type TransactionSettingsResponse = z.infer<typeof TransactionSettingsResponseSchema>;
export type TransactionSettingsSaveRequest = z.infer<typeof TransactionSettingsSaveRequestSchema>;
export type TransactionSettingsMutationResponse = z.infer<typeof TransactionSettingsMutationResponseSchema>;
export const PumpRiskSettingsSchema = z.object({
  maxTradingFeeBps: z.number().int().min(1).max(1_000),
  maxSlippageBps: z.number().int().min(0).max(1_000),
  maxSpendPerTradeLamports: z.string().regex(/^[1-9]\d*$/u),
  maxDailySpendLamports: z.string().regex(/^[1-9]\d*$/u),
  maxPerTokenExposureLamports: z.string().regex(/^[1-9]\d*$/u),
  maxTotalExposureLamports: z.string().regex(/^[1-9]\d*$/u),
  maxOpenPositions: z.number().int().min(1).max(100),
  maxTransactionsPerHour: z.number().int().min(1).max(100),
  minSolReserveLamports: z.string().regex(/^\d+$/u),
}).strict().superRefine((value, context) => {
  if (BigInt(value.maxDailySpendLamports) < BigInt(value.maxSpendPerTradeLamports)) context.addIssue({ code: "custom", path: ["maxDailySpendLamports"], message: "Daily spend must cover at least one maximum-size trade" });
  if (BigInt(value.maxTotalExposureLamports) < BigInt(value.maxPerTokenExposureLamports)) context.addIssue({ code: "custom", path: ["maxTotalExposureLamports"], message: "Total exposure must not be below per-token exposure" });
});
export const PumpRiskSettingsResponseSchema = z.object({ schemaVersion: z.literal(1), settings: PumpRiskSettingsSchema }).strict();
export const PumpRiskSettingsSaveRequestSchema = RequestBaseSchema.extend({ settings: PumpRiskSettingsSchema }).strict();
export const PumpRiskSettingsMutationResponseSchema = RequestBaseSchema.extend({ settings: PumpRiskSettingsSchema }).strict();
export type PumpRiskSettings = z.infer<typeof PumpRiskSettingsSchema>;
export type PumpRiskSettingsResponse = z.infer<typeof PumpRiskSettingsResponseSchema>;
export type PumpRiskSettingsSaveRequest = z.infer<typeof PumpRiskSettingsSaveRequestSchema>;
export type PumpRiskSettingsMutationResponse = z.infer<typeof PumpRiskSettingsMutationResponseSchema>;
export const MissionSimulateRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  missionId: z.string().uuid(),
  acknowledgedSimulationOnly: z.literal(true),
}).strict();
export const MissionSimulateResponseSchema = RequestBaseSchema.extend({ simulation: MissionSimulationPreviewSchema }).strict();
export type MissionSimulateRequest = z.infer<typeof MissionSimulateRequestSchema>;
export type MissionSimulateResponse = z.infer<typeof MissionSimulateResponseSchema>;
export const MissionExecutionReceiptSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  simulationId: z.string().uuid(),
  status: z.enum(["confirmed", "failed", "unknown"]),
  signature: z.string().min(64).max(128).nullable(),
  explorerUrl: z.string().url().nullable(),
  router: z.string().min(1).max(64),
  inputAmount: z.string().regex(/^\d+$/u).nullable(),
  outputAmount: z.string().regex(/^\d+$/u).nullable(),
  expectedOutputAmount: z.string().regex(/^\d+$/u).nullable().optional(),
  actualSlippageBps: z.number().finite().nullable().optional(),
  networkFeeLamports: z.number().int().nonnegative().nullable().optional(),
  actualNetworkFeeLamports: z.number().int().nonnegative().nullable().optional(),
  walletPreLamports: z.string().regex(/^\d+$/u).nullable().optional(),
  walletPostLamports: z.string().regex(/^\d+$/u).nullable().optional(),
  totalWalletOutflowLamports: z.string().regex(/^\d+$/u).nullable().optional(),
  accountFundingLamports: z.string().regex(/^\d+$/u).nullable().optional(),
  walletAddress: z.string().min(32).max(44).optional(),
  inputMint: z.string().min(32).max(44).optional(),
  code: z.number().int().nullable(),
  error: z.string().min(1).max(500).nullable(),
  transactionSigned: z.literal(true),
  broadcastAttempted: z.literal(true),
  executedAt: z.string().datetime(),
  chainVerification: z.enum(["finalized", "confirmed", "processed", "not-found", "failed", "unavailable"]).optional(),
  chainSlot: z.number().int().nonnegative().nullable().optional(),
  chainError: z.string().min(1).max(500).nullable().optional(),
  verifiedAt: z.string().datetime().nullable().optional(),
}).strict();
export type MissionExecutionReceipt = z.infer<typeof MissionExecutionReceiptSchema>;
export const MissionExecuteRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  missionId: z.string().uuid(),
  simulationId: z.string().uuid(),
  masterPassword: z.string().min(1).max(256),
  confirmation: z.literal("EXECUTE MAINNET"),
  acknowledgedIrreversibleMainnetExecution: z.literal(true),
}).strict();
export const MissionExecuteResponseSchema = RequestBaseSchema.extend({ receipt: MissionExecutionReceiptSchema }).strict();
export type MissionExecuteRequest = z.infer<typeof MissionExecuteRequestSchema>;
export type MissionExecuteResponse = z.infer<typeof MissionExecuteResponseSchema>;
export const MissionVerifyExecutionRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  missionId: z.string().uuid(),
  receiptId: z.string().uuid(),
}).strict();
export const MissionVerifyExecutionResponseSchema = RequestBaseSchema.extend({ receipt: MissionExecutionReceiptSchema }).strict();
export type MissionVerifyExecutionRequest = z.infer<typeof MissionVerifyExecutionRequestSchema>;
export type MissionVerifyExecutionResponse = z.infer<typeof MissionVerifyExecutionResponseSchema>;

export const PumpRiskUsageSchema = z.object({
  dailySpendLamports: z.string().regex(/^\d+$/u),
  perTokenExposureLamports: z.string().regex(/^\d+$/u),
  totalExposureLamports: z.string().regex(/^\d+$/u),
  openPositions: z.number().int().nonnegative(),
  transactionsThisHour: z.number().int().nonnegative(),
}).strict();
export type PumpRiskUsage = z.infer<typeof PumpRiskUsageSchema>;

export const PumpRiskLedgerEventSchema = z.object({
  id: z.string().uuid(),
  signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/u),
  walletAddress: z.string().min(32).max(44),
  tokenMint: z.string().min(32).max(44),
  side: z.enum(["buy", "sell"]),
  spendLamports: z.string().regex(/^\d+$/u),
  exposureDeltaLamports: z.string().regex(/^-?\d+$/u),
  slot: z.number().int().positive(),
  chainVerification: z.literal("finalized"),
  finalizedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const spend = BigInt(value.spendLamports);
  const exposureDelta = BigInt(value.exposureDeltaLamports);
  if (value.side === "buy" && (spend < 1n || exposureDelta < 1n)) {
    context.addIssue({ code: "custom", message: "A finalized Pump buy must increase exposure and record positive SOL spend" });
  }
  if (value.side === "sell" && (spend !== 0n || exposureDelta >= 0n)) {
    context.addIssue({ code: "custom", message: "A finalized Pump sell must reduce exposure and cannot record buy spend" });
  }
});
export type PumpRiskLedgerEvent = z.infer<typeof PumpRiskLedgerEventSchema>;
export const PumpRiskLedgerSchema = z.object({
  version: z.literal(1),
  events: z.array(PumpRiskLedgerEventSchema).max(5_000),
}).strict();
export type PumpRiskLedger = z.infer<typeof PumpRiskLedgerSchema>;

export const PumpRiskEvidenceSchema = z.object({
  side: z.enum(["buy", "sell"]),
  proposedSpendLamports: z.string().regex(/^\d+$/u),
  walletBalanceLamports: z.string().regex(/^\d+$/u),
  maxNetworkFeeLamports: z.number().int().nonnegative(),
  projectedWalletBalanceLamports: z.string().regex(/^-?\d+$/u),
  reserveFloorLamports: z.string().regex(/^\d+$/u),
  usageSource: z.enum(["no-execution-baseline", "persisted-receipts"]),
  usage: PumpRiskUsageSchema,
  limits: PumpRiskSettingsSchema,
  checks: z.array(z.object({
    id: z.enum(["slippage", "per-trade-spend", "daily-spend", "per-token-exposure", "total-exposure", "open-positions", "hourly-transactions", "sol-reserve"]),
    passed: z.boolean(),
    message: z.string().min(1).max(240),
  }).strict()).length(8),
  passed: z.boolean(),
  evaluatedAt: z.string().datetime(),
}).strict();
export type PumpRiskEvidence = z.infer<typeof PumpRiskEvidenceSchema>;

export const PumpEligibilityEvidenceSchema = z.object({
  status: z.enum(["eligible", "blocked"]),
  tokenMint: z.string().min(32).max(44),
  venue: z.literal("bonding-curve-active"),
  stateSlot: z.number().int().positive(),
  simulationSlot: z.number().int().nonnegative(),
  checks: z.array(z.object({
    id: z.enum(["exact-mint-binding", "finalized-state", "token-program", "authorities-revoked", "active-curve", "reserves-available", "fee-tier", "quote-binding", "state-freshness", "sell-path", "risk-policy", "simulation-passed", "program-allowlist", "no-execution-authority"]),
    passed: z.boolean(),
    message: z.string().min(1).max(240),
  }).strict()).length(14),
  rankingAllowed: z.boolean(),
  executionAllowed: z.literal(false),
  evaluatedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const passed = value.checks.every((check) => check.passed);
  if ((value.status === "eligible") !== passed || value.rankingAllowed !== passed) {
    context.addIssue({ code: "custom", message: "Pump eligibility status must match every deterministic check" });
  }
});
export type PumpEligibilityEvidence = z.infer<typeof PumpEligibilityEvidenceSchema>;

export const PumpExecutionReadinessSchema = z.object({
  status: z.enum(["ready-for-final-approval", "blocked"]),
  previewId: z.string().uuid(),
  walletAddress: z.string().min(32).max(44),
  tokenMint: z.string().min(32).max(44),
  side: z.enum(["buy", "sell"]),
  checks: z.array(z.object({
    id: z.enum(["session-binding", "exact-mint", "proposal-ready", "simulation-passed", "fee-guard", "eligibility", "risk-policy", "freshness", "unsigned", "no-broadcast"]),
    passed: z.boolean(),
    message: z.string().min(1).max(240),
  }).strict()).length(10),
  requiresMasterPassword: z.literal(true),
  requiredConfirmation: z.literal("EXECUTE PUMP MAINNET"),
  executionAllowed: z.literal(false),
  evaluatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const ready = value.checks.every((check) => check.passed);
  if ((value.status === "ready-for-final-approval") !== ready) {
    context.addIssue({ code: "custom", message: "Pump execution readiness must match every deterministic check" });
  }
});
export type PumpExecutionReadiness = z.infer<typeof PumpExecutionReadinessSchema>;

export const PumpFinalRevalidationSchema = z.object({
  status: z.enum(["ready-for-password", "blocked"]),
  previewId: z.string().uuid(),
  walletAddress: z.string().min(32).max(44),
  tokenMint: z.string().min(32).max(44),
  side: z.enum(["buy", "sell"]),
  initialTransactionDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  finalTransactionDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  initialStateSlot: z.number().int().positive(),
  finalStateSlot: z.number().int().positive(),
  finalSimulationSlot: z.number().int().positive(),
  checks: z.array(z.object({
    id: z.enum(["cache-binding", "proposal-binding", "wallet-binding", "mint-binding", "parameter-binding", "finalized-state", "quote-floor", "fresh-blockhash", "final-simulation", "fee-guard", "risk-policy", "unsigned"]),
    passed: z.boolean(),
    message: z.string().min(1).max(240),
  }).strict()).length(12),
  requiresMasterPassword: z.literal(true),
  requiredConfirmation: z.literal("EXECUTE PUMP MAINNET"),
  signingAttempted: z.literal(false),
  broadcastAttempted: z.literal(false),
  executionAllowed: z.literal(false),
  evaluatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const ready = value.checks.every((check) => check.passed);
  if ((value.status === "ready-for-password") !== ready) {
    context.addIssue({ code: "custom", message: "Pump final revalidation status must match every deterministic check" });
  }
});
export type PumpFinalRevalidation = z.infer<typeof PumpFinalRevalidationSchema>;

export const PumpExecutionReceiptSchema = z.object({
  id: z.string().uuid(),
  previewId: z.string().uuid(),
  signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/u),
  walletAddress: z.string().min(32).max(44),
  tokenMint: z.string().min(32).max(44),
  side: z.enum(["buy", "sell"]),
  status: z.literal("finalized"),
  slot: z.number().int().positive(),
  networkFeeLamports: z.number().int().nonnegative(),
  accountCreationFundingLamports: z.number().int().nonnegative(),
  walletLamportDelta: z.string().regex(/^-?\d+$/u),
  tokenRawDelta: z.string().regex(/^-?\d+$/u),
  actualInputAmount: z.string().regex(/^[1-9]\d*$/u),
  actualOutputAmount: z.string().regex(/^[1-9]\d*$/u),
  chainVerification: z.literal("finalized"),
  signingSource: z.literal("future-local-signer"),
  broadcastAttempted: z.literal(true),
  reconciledAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const walletDelta = BigInt(value.walletLamportDelta);
  const tokenDelta = BigInt(value.tokenRawDelta);
  if (value.side === "buy" && (walletDelta >= 0n || tokenDelta <= 0n)) {
    context.addIssue({ code: "custom", message: "A finalized Pump buy must spend SOL and increase the exact token balance" });
  }
  if (value.side === "sell" && (walletDelta <= 0n || tokenDelta >= 0n)) {
    context.addIssue({ code: "custom", message: "A finalized Pump sell must receive SOL and reduce the exact token balance" });
  }
});
export type PumpExecutionReceipt = z.infer<typeof PumpExecutionReceiptSchema>;

export const PumpSimulationArtifactSchema = z.object({
  status: z.enum(["passed", "blocked", "failed"]),
  simulationSlot: z.number().int().nonnegative(),
  unitsConsumed: z.number().int().nonnegative().nullable(),
  networkFeeLamports: z.number().int().nonnegative().nullable(),
  rentLamports: z.number().int().nonnegative().nullable(),
  networkFeePercent: z.number().finite().nonnegative().nullable(),
  totalKnownFeeLamports: z.string().regex(/^\d+$/u).nullable(),
  feeRisk: z.enum(["reasonable", "high", "extreme", "unavailable"]),
  invokedPrograms: z.array(z.string().min(32).max(44)).max(16),
  logs: z.array(z.string().max(500)).max(200),
  error: z.string().min(1).max(500).nullable(),
  quoteEvidence: z.object({
    kind: z.literal("exact-finalized"),
    side: z.enum(["buy", "sell"]),
    inputAmount: z.string().regex(/^[1-9]\d*$/u),
    expectedOutputAmount: z.string().regex(/^[1-9]\d*$/u),
    minimumOutputAmount: z.string().regex(/^[1-9]\d*$/u),
    approvedMinimumOutputAmount: z.string().regex(/^[1-9]\d*$/u),
    maxSlippageBps: z.number().int().min(0).max(3_000),
    stateSlot: z.number().int().positive(),
    derivedAt: z.string().datetime(),
  }).strict().optional(),
  riskEvidence: PumpRiskEvidenceSchema.optional(),
  eligibilityEvidence: PumpEligibilityEvidenceSchema.optional(),
  executionReadiness: PumpExecutionReadinessSchema.optional(),
  finalRevalidation: PumpFinalRevalidationSchema.optional(),
  transactionSigned: z.literal(false),
  broadcastAttempted: z.literal(false),
  simulatedAt: z.string().datetime(),
}).strict();
export type PumpSimulationArtifact = z.infer<typeof PumpSimulationArtifactSchema>;
export const PumpSimulateRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  previewId: z.string().uuid(),
  acknowledgedSimulationOnly: z.literal(true),
}).strict();
export const PumpSimulateResponseSchema = RequestBaseSchema.extend({
  simulation: PumpSimulationArtifactSchema,
}).strict();
export type PumpSimulateRequest = z.infer<typeof PumpSimulateRequestSchema>;
export type PumpSimulateResponse = z.infer<typeof PumpSimulateResponseSchema>;
export const PumpFinalRevalidateRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  previewId: z.string().uuid(),
  acknowledgedNoExecution: z.literal(true),
}).strict();
export const PumpFinalRevalidateResponseSchema = RequestBaseSchema.extend({
  simulation: PumpSimulationArtifactSchema,
}).strict();
export type PumpFinalRevalidateRequest = z.infer<typeof PumpFinalRevalidateRequestSchema>;
export type PumpFinalRevalidateResponse = z.infer<typeof PumpFinalRevalidateResponseSchema>;

export const PumpExecuteRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  previewId: z.string().uuid(),
  masterPassword: z.string().min(1).max(256),
  confirmation: z.literal("EXECUTE PUMP MAINNET"),
  acknowledgedIrreversibleExecution: z.literal(true),
}).strict();
export const PumpExecuteResponseSchema = RequestBaseSchema.extend({
  receipt: PumpExecutionReceiptSchema,
}).strict();
export type PumpExecuteRequest = z.infer<typeof PumpExecuteRequestSchema>;
export type PumpExecuteResponse = z.infer<typeof PumpExecuteResponseSchema>;


export const SessionMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(12_000),
  at: z.string().datetime(),
  toolsUsed: z.array(z.enum(["wallet_portfolio", "wallet_activity", "jupiter_prices", "jupiter_token_search", "jupiter_swap_quote", "pump_token_analysis", "pump_recent_candidates", "pump_trade_contract_preview", "mission_contract_preview", "limit_order_contract_preview", "tavily_search"])).max(8).optional(),
  missionPreview: MissionContractPreviewSchema.optional(),
  pumpTradePreview: PumpTradeContractPreviewSchema.optional(),
  pumpSimulation: PumpSimulationArtifactSchema.optional(),
  pumpTokenIntelligence: PumpTokenIntelligenceSchema.optional(),
  pumpDiscoverySnapshot: PumpDiscoverySnapshotSchema.optional(),
  limitOrderPreview: LimitOrderContractPreviewSchema.optional(),
  limitOrderSimulation: LimitOrderSimulationPreviewSchema.optional(),
  limitOrderExecution: LimitOrderExecutionReceiptSchema.optional(),
  limitOrderCancelSimulation: LimitOrderCancelSimulationSchema.optional(),
  limitOrderCancelReceipt: LimitOrderCancelReceiptSchema.optional(),
  missionSimulation: MissionSimulationPreviewSchema.optional(),
  missionExecution: MissionExecutionReceiptSchema.optional(),
}).strict();
export const SessionRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  mode: z.enum(["agent", "mission"]),
  permission: z.enum(["restricted", "full"]),
  workspace: z.enum(["general", "pump"]).optional(),
  pumpConfig: z.object({
    scope: z.enum(["exact-mint", "watchlist", "discovery"]),
    objective: z.enum(["monitor", "trade-proposal"]),
    tokenMint: z.string().min(32).max(44).nullable(),
    watchlistMints: z.array(z.string().min(32).max(44)).min(1).max(10).optional(),
    analysisBuyLamports: z.string().regex(/^[1-9]\d*$/u).optional(),
    lifecycle: z.literal("proposal-only"),
  }).strict().optional(),
  walletAddress: z.string().min(32).max(44).nullable(),
  messages: z.array(SessionMessageSchema).max(200),
  startedAt: z.string().datetime(),
  usage: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    cost: z.number().finite().nonnegative().nullable(),
  }).strict(),
}).strict().superRefine((session, context) => {
  if (session.workspace === "pump" && session.pumpConfig === undefined) {
    context.addIssue({ code: "custom", path: ["pumpConfig"], message: "Pump workspace configuration is required" });
  }
  if (session.workspace === "pump" && session.mode !== "mission") {
    context.addIssue({ code: "custom", path: ["mode"], message: "Pump workspaces require Mission mode" });
  }
  if (session.workspace === "pump" && session.permission !== "restricted") {
    context.addIssue({ code: "custom", path: ["permission"], message: "Pump workspaces are restricted" });
  }
  if (session.workspace !== "pump" && session.pumpConfig !== undefined) {
    context.addIssue({ code: "custom", path: ["pumpConfig"], message: "Pump configuration requires a Pump workspace" });
  }
  if (session.pumpConfig?.scope === "exact-mint" && session.pumpConfig.tokenMint === null) {
    context.addIssue({ code: "custom", path: ["pumpConfig", "tokenMint"], message: "Exact-mint Pump sessions require a token mint" });
  }
  if (session.pumpConfig?.scope === "exact-mint" && session.pumpConfig.watchlistMints !== undefined) {
    context.addIssue({ code: "custom", path: ["pumpConfig", "watchlistMints"], message: "Exact-mint Pump sessions cannot include a watchlist" });
  }
  if (session.pumpConfig?.scope === "watchlist") {
    if (session.pumpConfig.tokenMint !== null || session.pumpConfig.watchlistMints === undefined) {
      context.addIssue({ code: "custom", path: ["pumpConfig"], message: "Watchlist Pump sessions require a bounded mint list and no execution mint" });
    } else if (new Set(session.pumpConfig.watchlistMints).size !== session.pumpConfig.watchlistMints.length) {
      context.addIssue({ code: "custom", path: ["pumpConfig", "watchlistMints"], message: "Watchlist Pump mints must be unique" });
    }
  }
  if (session.pumpConfig?.scope === "discovery" && (session.pumpConfig.tokenMint !== null || session.pumpConfig.watchlistMints !== undefined)) {
    context.addIssue({ code: "custom", path: ["pumpConfig"], message: "Discovery Pump sessions cannot pre-authorize a token scope" });
  }
});
export const SessionListResponseSchema = z.object({ schemaVersion: z.literal(1), sessions: z.array(SessionRecordSchema).max(100) }).strict();
export const SessionUpsertRequestSchema = RequestBaseSchema.extend({ session: SessionRecordSchema }).strict();
export const SessionUpsertResponseSchema = RequestBaseSchema.extend({ saved: z.literal(true) }).strict();
export type SessionRecord = z.infer<typeof SessionRecordSchema>;
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;
export type SessionUpsertRequest = z.infer<typeof SessionUpsertRequestSchema>;
export type SessionUpsertResponse = z.infer<typeof SessionUpsertResponseSchema>;

export const ClipboardWriteWalletAddressRequestSchema = RequestBaseSchema.extend({ address: z.string().min(32).max(44) }).strict();
export const ClipboardWriteWalletAddressResponseSchema = RequestBaseSchema.extend({ copied: z.literal(true) }).strict();
export type ClipboardWriteWalletAddressRequest = z.infer<typeof ClipboardWriteWalletAddressRequestSchema>;
export type ClipboardWriteWalletAddressResponse = z.infer<typeof ClipboardWriteWalletAddressResponseSchema>;
const TransactionSignatureSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,128}$/u);
export const ClipboardWriteTransactionSignatureRequestSchema = RequestBaseSchema.extend({ signature: TransactionSignatureSchema }).strict();
export const ClipboardWriteTransactionSignatureResponseSchema = RequestBaseSchema.extend({ copied: z.literal(true) }).strict();
export const ExternalOpenTransactionRequestSchema = RequestBaseSchema.extend({ signature: TransactionSignatureSchema }).strict();
export const ExternalOpenTransactionResponseSchema = RequestBaseSchema.extend({ opened: z.literal(true) }).strict();
export type ClipboardWriteTransactionSignatureRequest = z.infer<typeof ClipboardWriteTransactionSignatureRequestSchema>;
export type ClipboardWriteTransactionSignatureResponse = z.infer<typeof ClipboardWriteTransactionSignatureResponseSchema>;
export type ExternalOpenTransactionRequest = z.infer<typeof ExternalOpenTransactionRequestSchema>;
export type ExternalOpenTransactionResponse = z.infer<typeof ExternalOpenTransactionResponseSchema>;

const WalletOnboardingBaseSchema = RequestBaseSchema.extend({ acknowledgedHotWalletRisk: z.literal(true) });
export const WalletCreateRequestSchema = WalletOnboardingBaseSchema.strict();
export const WalletCreateResponseSchema = RequestBaseSchema.extend({
  address: z.string().min(32).max(44),
  recoveryMnemonic: z.string().min(32).max(512),
  derivationPath: z.literal("m/44'/501'/0'/0'"),
}).strict();
export const WalletImportMnemonicRequestSchema = WalletOnboardingBaseSchema.extend({ mnemonic: z.string().min(32).max(512) }).strict();
export const WalletImportPrivateKeyRequestSchema = WalletOnboardingBaseSchema.extend({ privateKey: z.string().min(32).max(1024) }).strict();
export const WalletImportResponseSchema = RequestBaseSchema.extend({ address: z.string().min(32).max(44) }).strict();
export const WalletListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  wallets: z.array(z.object({ address: z.string().min(32).max(44), primary: z.boolean() }).strict()).max(20),
}).strict();
export type WalletCreateRequest = z.infer<typeof WalletCreateRequestSchema>;
export type WalletCreateResponse = z.infer<typeof WalletCreateResponseSchema>;
export type WalletImportMnemonicRequest = z.infer<typeof WalletImportMnemonicRequestSchema>;
export type WalletImportPrivateKeyRequest = z.infer<typeof WalletImportPrivateKeyRequestSchema>;
export type WalletImportResponse = z.infer<typeof WalletImportResponseSchema>;
export type WalletListResponse = z.infer<typeof WalletListResponseSchema>;

export const PortfolioGetRequestSchema = RequestBaseSchema.extend({
  address: z.string().min(32).max(44),
}).strict();
export const PortfolioAssetSchema = z.object({
  mint: z.string().min(32).max(44),
  amount: z.string().regex(/^\d+$/u),
  decimals: z.number().int().min(0).max(18),
  uiAmount: z.string().min(1).max(128),
  usdPrice: z.number().finite().nonnegative().nullable(),
  usdValue: z.number().finite().nonnegative().nullable(),
}).strict();
export const PortfolioSnapshotSchema = z.object({
  address: z.string().min(32).max(44),
  slot: z.number().int().nonnegative(),
  solBalance: z.string().min(1).max(128),
  solUsdPrice: z.number().finite().nonnegative().nullable(),
  totalUsd: z.number().finite().nonnegative().nullable(),
  assets: z.array(PortfolioAssetSchema).max(100),
  verifiedAt: z.string().datetime(),
}).strict();
export const PortfolioGetResponseSchema = RequestBaseSchema.extend({ snapshot: PortfolioSnapshotSchema }).strict();
export type PortfolioGetRequest = z.infer<typeof PortfolioGetRequestSchema>;
export type PortfolioAsset = z.infer<typeof PortfolioAssetSchema>;
export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;
export type PortfolioGetResponse = z.infer<typeof PortfolioGetResponseSchema>;

export const WalletActivityGetRequestSchema = RequestBaseSchema.extend({
  address: z.string().min(32).max(44),
  limit: z.number().int().min(1).max(20).default(10),
}).strict();
export const WalletActivityEntrySchema = z.object({
  signature: z.string().min(64).max(128),
  slot: z.number().int().nonnegative(),
  status: z.enum(["success", "failed"]),
  blockTime: z.string().datetime().nullable(),
  memo: z.string().max(280).nullable(),
  explorerUrl: z.string().url().max(512),
}).strict();
export const WalletActivitySnapshotSchema = z.object({
  address: z.string().min(32).max(44),
  entries: z.array(WalletActivityEntrySchema).max(20),
  verifiedAt: z.string().datetime(),
}).strict();
export const WalletActivityGetResponseSchema = RequestBaseSchema.extend({ activity: WalletActivitySnapshotSchema }).strict();
export type WalletActivityGetRequest = z.infer<typeof WalletActivityGetRequestSchema>;
export type WalletActivityEntry = z.infer<typeof WalletActivityEntrySchema>;
export type WalletActivitySnapshot = z.infer<typeof WalletActivitySnapshotSchema>;
export type WalletActivityGetResponse = z.infer<typeof WalletActivityGetResponseSchema>;

export const JupiterSwapQuotePreviewSchema = z.object({
  inputMint: z.string().min(32).max(44),
  outputMint: z.string().min(32).max(44),
  inAmount: z.string().regex(/^[1-9]\d*$/u),
  outAmount: z.string().regex(/^\d+$/u),
  router: z.string().min(1).max(64),
  mode: z.string().min(1).max(32),
  feeBps: z.number().int().min(0).max(10_000).nullable(),
  feeMint: z.string().min(32).max(44).nullable(),
  quoteOnly: z.literal(true),
  verifiedAt: z.string().datetime(),
}).strict();
export type JupiterSwapQuotePreview = z.infer<typeof JupiterSwapQuotePreviewSchema>;

export const AiProviderSchema = z.literal("openrouter");
export type AiProvider = z.infer<typeof AiProviderSchema>;
export const AiProviderSettingSchema = z.object({
  provider: AiProviderSchema,
  configured: z.boolean(),
  model: z.string().min(1).max(192),
}).strict();
export type AiProviderSetting = z.infer<typeof AiProviderSettingSchema>;
export const AiSettingsResponseSchema = z.object({ schemaVersion: z.literal(1), providers: z.array(AiProviderSettingSchema).max(1) }).strict();
export type AiSettingsResponse = z.infer<typeof AiSettingsResponseSchema>;
export const AiSaveProviderRequestSchema = RequestBaseSchema.extend({
  provider: AiProviderSchema,
  apiKey: z.string().trim().min(8).max(512),
  model: z.string().trim().min(1).max(192),
  acknowledgedExternalProcessing: z.literal(true),
}).strict();
export const AiProviderMutationResponseSchema = RequestBaseSchema.extend({ setting: AiProviderSettingSchema }).strict();
export type AiSaveProviderRequest = z.infer<typeof AiSaveProviderRequestSchema>;
export type AiProviderMutationResponse = z.infer<typeof AiProviderMutationResponseSchema>;

export const OpenRouterModelViewSchema = z.object({
  id: z.string().min(1).max(192),
  name: z.string().min(1).max(192),
  contextLength: z.number().int().positive(),
  promptPrice: z.string().max(64),
  completionPrice: z.string().max(64),
  supportsStructuredOutput: z.boolean(),
  supportsTools: z.boolean(),
}).strict();
export type OpenRouterModelView = z.infer<typeof OpenRouterModelViewSchema>;
export const AiPreviewOpenRouterModelsRequestSchema = RequestBaseSchema.extend({
  apiKey: z.string().trim().min(8).max(512),
  acknowledgedExternalProcessing: z.literal(true),
}).strict();
export const AiPreviewOpenRouterModelsResponseSchema = RequestBaseSchema.extend({ models: z.array(OpenRouterModelViewSchema).max(500) }).strict();
export type AiPreviewOpenRouterModelsRequest = z.infer<typeof AiPreviewOpenRouterModelsRequestSchema>;
export type AiPreviewOpenRouterModelsResponse = z.infer<typeof AiPreviewOpenRouterModelsResponseSchema>;

export const AiChatRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(12_000),
  mode: z.enum(["agent", "mission"]),
  permission: z.literal("restricted"),
  walletAddress: z.string().min(32).max(44).nullable(),
  acknowledgedExternalProcessing: z.literal(true),
}).strict();
export const AiChatResponseSchema = RequestBaseSchema.extend({
  model: z.string().min(1).max(192),
  text: z.string().min(1).max(12_000),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().nullable(),
  }).strict(),
  toolsUsed: z.array(z.enum(["wallet_portfolio", "wallet_activity", "jupiter_prices", "jupiter_token_search", "jupiter_swap_quote", "pump_token_analysis", "pump_recent_candidates", "pump_trade_contract_preview", "mission_contract_preview", "limit_order_contract_preview", "tavily_search"])).max(8),
  missionPreview: MissionContractPreviewSchema.nullable(),
  pumpTradePreview: PumpTradeContractPreviewSchema.nullable(),
  pumpTokenIntelligence: PumpTokenIntelligenceSchema.nullable(),
  pumpDiscoverySnapshot: PumpDiscoverySnapshotSchema.nullable(),
  limitOrderPreview: LimitOrderContractPreviewSchema.nullable(),
}).strict();
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;

export const JupiterSettingsResponseSchema = z.object({ schemaVersion: z.literal(1), configured: z.boolean() }).strict();
export const JupiterSaveKeyRequestSchema = RequestBaseSchema.extend({
  apiKey: z.string().trim().min(8).max(512),
  acknowledgedMainnetMarketData: z.literal(true),
}).strict();
export const JupiterKeyMutationResponseSchema = RequestBaseSchema.extend({ configured: z.boolean() }).strict();
export type JupiterSettingsResponse = z.infer<typeof JupiterSettingsResponseSchema>;
export type JupiterSaveKeyRequest = z.infer<typeof JupiterSaveKeyRequestSchema>;
export type JupiterKeyMutationResponse = z.infer<typeof JupiterKeyMutationResponseSchema>;

export const TavilySettingsResponseSchema = z.object({ schemaVersion: z.literal(1), configured: z.boolean() }).strict();
export const TavilySaveKeyRequestSchema = RequestBaseSchema.extend({
  apiKey: z.string().trim().min(8).max(512),
  acknowledgedExternalProcessing: z.literal(true),
}).strict();
export const TavilyKeyMutationResponseSchema = RequestBaseSchema.extend({ configured: z.boolean() }).strict();
export type TavilySettingsResponse = z.infer<typeof TavilySettingsResponseSchema>;
export type TavilySaveKeyRequest = z.infer<typeof TavilySaveKeyRequestSchema>;

export const SolanaRpcSettingsResponseSchema = z.object({ schemaVersion: z.literal(1), rpcUrl: z.string().nullable() }).strict();
export const SolanaRpcSaveUrlRequestSchema = RequestBaseSchema.extend({
  rpcUrl: z.string().trim().url().nullable(),
}).strict();
export const SolanaRpcMutationResponseSchema = RequestBaseSchema.extend({ rpcUrl: z.string().nullable() }).strict();
export type SolanaRpcSettingsResponse = z.infer<typeof SolanaRpcSettingsResponseSchema>;
export type SolanaRpcSaveUrlRequest = z.infer<typeof SolanaRpcSaveUrlRequestSchema>;
export type SolanaRpcMutationResponse = z.infer<typeof SolanaRpcMutationResponseSchema>;

export type TavilyKeyMutationResponse = z.infer<typeof TavilyKeyMutationResponseSchema>;
