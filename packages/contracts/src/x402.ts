import { z } from "zod";

export const X402_VERSION = 2 as const;
export const X402_SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;
export const X402_SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as const;
export const X402_USDC_DECIMALS = 6 as const;
export const X402_DEFAULT_MAX_RESOURCE_ATOMIC = "30000" as const;
export const X402_DEFAULT_MAX_MISSION_ATOMIC = "100000" as const;
export const X402_GLOBAL_MAX_RESOURCE_ATOMIC = "100000" as const;
export const X402_GLOBAL_MAX_MISSION_ATOMIC = "1000000" as const;

export const X402_MARKET_PROVIDER_CATALOG = [
  { serviceName: "three.ws Market Derivatives", url: "https://three.ws/api/x402/market-derivatives", method: "GET", description: "Perpetual market data including funding, open interest, volume, and derivatives venues.", tags: ["market-analysis", "derivatives", "perps", "funding", "open-interest", "sol", "eth"] },
  { serviceName: "x402Atlas Hyperliquid Perps", url: "https://hyperliquid.use.x402atlas.com/perps", method: "GET", description: "Live perpetual context with mark and oracle prices, funding, open interest, premium, and volume.", tags: ["market-analysis", "hyperliquid", "perps", "funding", "open-interest", "sol", "eth"] },
  { serviceName: "x402Atlas Hyperliquid Mid Prices", url: "https://hyperliquid.use.x402atlas.com/mids", method: "GET", description: "Current mid-price snapshot for Hyperliquid perpetual and spot assets.", tags: ["market-data", "hyperliquid", "price", "spot", "perps", "sol", "eth"] },
] as const;

const SolanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u);
const AtomicAmountSchema = z.string().regex(/^\d+$/u).refine((value) => BigInt(value) > 0n, "Amount must be positive");
const HttpUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), "HTTPS is required");

export const X402ResourceInfoSchema = z.object({
  url: HttpUrlSchema,
  description: z.string().max(1_000).optional(),
  mimeType: z.string().max(128).optional(),
  serviceName: z.string().max(160).optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  iconUrl: HttpUrlSchema.optional(),
}).strict();

export const X402PaymentRequirementsSchema = z.object({
  scheme: z.literal("exact"),
  network: z.literal(X402_SOLANA_MAINNET),
  amount: AtomicAmountSchema,
  asset: z.literal(X402_SOLANA_USDC_MINT),
  payTo: SolanaAddressSchema,
  resource: HttpUrlSchema.optional(),
  maxTimeoutSeconds: z.number().int().min(15).max(300),
  extra: z.object({
    feePayer: SolanaAddressSchema,
    memo: z.string().min(1).max(256).optional(),
    recentBlockhash: SolanaAddressSchema.optional(),
    lastValidBlockHeight: z.string().regex(/^\d+$/u).optional(),
  }).passthrough(),
}).strict();
export type X402PaymentRequirements = z.infer<typeof X402PaymentRequirementsSchema>;

export const X402ResourceSchema = z.object({
  id: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  resource: X402ResourceInfoSchema,
  method: z.enum(["GET", "POST"]),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  requirements: X402PaymentRequirementsSchema,
  quality: z.object({
    callsLast30Days: z.number().int().nonnegative().nullable(),
    uniquePayersLast30Days: z.number().int().nonnegative().nullable(),
    lastCalledAt: z.string().datetime().nullable(),
  }).strict(),
  discoveredAt: z.string().datetime(),
}).strict();
export type X402Resource = z.infer<typeof X402ResourceSchema>;

export const X402PolicySchema = z.object({
  enabled: z.boolean(),
  maxResourceAmount: AtomicAmountSchema,
  maxMissionAmount: AtomicAmountSchema,
}).strict().superRefine((policy, context) => {
  if (BigInt(policy.maxResourceAmount) > BigInt(X402_GLOBAL_MAX_RESOURCE_ATOMIC)) context.addIssue({ code: "custom", path: ["maxResourceAmount"], message: "Per-resource x402 limit exceeds the hard cap" });
  if (BigInt(policy.maxMissionAmount) > BigInt(X402_GLOBAL_MAX_MISSION_ATOMIC)) context.addIssue({ code: "custom", path: ["maxMissionAmount"], message: "Mission x402 limit exceeds the hard cap" });
  if (BigInt(policy.maxResourceAmount) > BigInt(policy.maxMissionAmount)) context.addIssue({ code: "custom", path: ["maxResourceAmount"], message: "Per-resource limit cannot exceed mission limit" });
});
export type X402Policy = z.infer<typeof X402PolicySchema>;

export const X402PurchaseStatusSchema = z.enum(["DISCOVERED", "SELECTED", "PREPARED", "AWAITING_SIGNATURE", "SUBMITTED", "SETTLED", "RESOURCE_RECEIVED", "FAILED", "EXPIRED", "UNKNOWN", "REJECTED"]);
export type X402PurchaseStatus = z.infer<typeof X402PurchaseStatusSchema>;

export const X402PurchasePlanSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  resource: X402ResourceSchema,
  request: z.object({ method: z.enum(["GET", "POST"]), url: HttpUrlSchema, body: z.unknown().nullable() }).strict(),
  requestDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requirementsDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  idempotencyKey: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  status: X402PurchaseStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
}).strict();
export type X402PurchasePlan = z.infer<typeof X402PurchasePlanSchema>;

export const X402PreparedPaymentSchema = X402PurchasePlanSchema.extend({
  transactionBase64: z.string().min(32).max(16_000),
  blockhash: SolanaAddressSchema,
  lastValidBlockHeight: z.string().regex(/^\d+$/u),
  estimatedNetworkFeeLamports: z.string().regex(/^\d+$/u),
  status: z.literal("AWAITING_SIGNATURE"),
}).strict();
export type X402PreparedPayment = z.infer<typeof X402PreparedPaymentSchema>;

export const X402ReceiptSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  resourceId: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  resourceUrl: HttpUrlSchema,
  providerOrigin: HttpUrlSchema,
  requestDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requirementsDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  idempotencyKey: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  amount: AtomicAmountSchema,
  asset: z.literal(X402_SOLANA_USDC_MINT),
  payTo: SolanaAddressSchema,
  signature: z.string().min(64).max(128).nullable(),
  status: X402PurchaseStatusSchema,
  settlement: z.object({ success: z.boolean(), transaction: z.string().max(128), network: z.literal(X402_SOLANA_MAINNET), payer: SolanaAddressSchema.optional(), errorReason: z.string().max(300).optional() }).strict().nullable(),
  resourceResponse: z.object({ mimeType: z.string().max(128), body: z.string().max(64_000), receivedAt: z.string().datetime() }).strict().nullable(),
  errorCode: z.enum(["INVALID_REQUIREMENTS", "UNSAFE_RESOURCE", "POLICY_BLOCKED", "INSUFFICIENT_FUNDS", "SIMULATION_FAILED", "EXPIRED", "WALLET_MISMATCH", "DUPLICATE", "SETTLEMENT_FAILED", "RESOURCE_FAILED", "PROVIDER_CHANGED", "UNKNOWN"]).nullable(),
  errorMessage: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type X402Receipt = z.infer<typeof X402ReceiptSchema>;

const RequestBaseSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid() });
export const X402DiscoverRequestSchema = RequestBaseSchema.extend({ query: z.string().trim().min(2).max(240), maxUsdPrice: z.number().finite().positive().max(0.1).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict();
export const X402DiscoverResponseSchema = RequestBaseSchema.extend({ resources: z.array(X402ResourceSchema).max(20), rejectedCount: z.number().int().nonnegative() }).strict();
export const X402PrepareRequestSchema = RequestBaseSchema.extend({ sessionId: z.string().min(1).max(128), walletAddress: SolanaAddressSchema, resource: X402ResourceSchema, input: z.unknown().nullable(), maxResourceAmount: AtomicAmountSchema.default(X402_DEFAULT_MAX_RESOURCE_ATOMIC), maxMissionAmount: AtomicAmountSchema.default(X402_DEFAULT_MAX_MISSION_ATOMIC) }).strict();
export const X402PrepareResponseSchema = RequestBaseSchema.extend({ prepared: X402PreparedPaymentSchema }).strict();
export const X402ExecuteRequestSchema = RequestBaseSchema.extend({ planId: z.string().uuid(), sessionId: z.string().min(1).max(128), walletAddress: SolanaAddressSchema, signedTransactionBase64: z.string().min(32).max(16_000), approved: z.literal(true), masterPassword: z.string().min(1).max(256).optional() }).strict();
export const X402ExecuteResponseSchema = RequestBaseSchema.extend({ receipt: X402ReceiptSchema }).strict();
export const X402ReceiptsResponseSchema = RequestBaseSchema.extend({ receipts: z.array(X402ReceiptSchema).max(500) }).strict();
export const X402SelectRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  messageId: z.string().min(1).max(128),
}).strict();
export const X402SelectResponseSchema = RequestBaseSchema.extend({
  resourceIds: z.array(z.string().regex(/^sha256:[a-f0-9]{64}$/u)).min(1).max(10),
  rationale: z.string().min(1).max(500),
  maximumAmount: AtomicAmountSchema,
}).strict();
export const X402AnalyzeRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  messageId: z.string().min(1).max(128),
  receiptIds: z.array(z.string().uuid()).min(1).max(10),
}).strict();
export const X402AnalyzeResponseSchema = RequestBaseSchema.extend({
  model: z.string().min(1).max(192),
  text: z.string().min(1).max(12_000),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().nullable(),
  }).strict(),
}).strict();

export type X402DiscoverRequest = z.infer<typeof X402DiscoverRequestSchema>;
export type X402DiscoverResponse = z.infer<typeof X402DiscoverResponseSchema>;
export type X402PrepareRequest = z.infer<typeof X402PrepareRequestSchema>;
export type X402PrepareResponse = z.infer<typeof X402PrepareResponseSchema>;
export type X402ExecuteRequest = z.infer<typeof X402ExecuteRequestSchema>;
export type X402ExecuteResponse = z.infer<typeof X402ExecuteResponseSchema>;
export type X402SelectRequest = z.infer<typeof X402SelectRequestSchema>;
export type X402SelectResponse = z.infer<typeof X402SelectResponseSchema>;
export type X402AnalyzeRequest = z.infer<typeof X402AnalyzeRequestSchema>;
export type X402AnalyzeResponse = z.infer<typeof X402AnalyzeResponseSchema>;
