import { z } from "zod";

export const KAMINO_API_BASE_URL = "https://api.kamino.finance" as const;
export const KLEND_PROGRAM_ID = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD" as const;
export const KAMINO_RWA_SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as const;
export const KAMINO_RWA_USDC_DECIMALS = 6 as const;
export const KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC = "50000000" as const; // 50 USDC
export const KAMINO_RWA_GLOBAL_MAX_SUPPLY_ATOMIC = "500000000" as const; // 500 USDC
export const KAMINO_RWA_HIGH_UTILIZATION_WARNING = 0.85 as const;

const SolanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u);
const AtomicAmountSchema = z.string().regex(/^\d+$/u).refine((value) => BigInt(value) > 0n, "Amount must be positive");

export type KaminoRwaMarketCatalogEntry = {
  lendingMarket: string;
  name: string;
  rwaReason: string;
};

// Manually curated. Every entry here has been individually verified to be backed by a
// real-world asset (not a liquid-staking or perp-collateral market — `isCurated` on the
// Kamino API alone does not distinguish those). See the design spec for how this was
// verified.
export const KAMINO_RWA_MARKET_CATALOG: readonly KaminoRwaMarketCatalogEntry[] = [
  {
    lendingMarket: "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH",
    name: "Obligate Market",
    rwaReason: "Backed by oTFY — tokenized corporate bonds and commercial paper via Obligate",
  },
  {
    lendingMarket: "7G9hUEyKbxLdRmvNwpe5V1D23gXdcXoSuwoFRCBa2c2j",
    name: "PAXG Market",
    rwaReason: "Backed by PAXG — tokenized physical gold",
  },
] as const;

export const KaminoRwaReserveMetricsSchema = z.object({
  reserve: SolanaAddressSchema,
  liquidityTokenMint: SolanaAddressSchema,
  supplyApy: z.string(),
  totalBorrowUsd: z.string(),
  totalSupplyUsd: z.string(),
});
export type KaminoRwaReserveMetrics = z.infer<typeof KaminoRwaReserveMetricsSchema>;

export const KaminoRwaPoolSchema = z.object({
  lendingMarket: SolanaAddressSchema,
  name: z.string().min(1).max(160),
  rwaReason: z.string().min(1).max(300),
  isCurated: z.boolean(),
  usdcReserve: SolanaAddressSchema,
  supplyApy: z.number().nonnegative(),
  totalSupplyUsd: z.number().nonnegative(),
  totalBorrowUsd: z.number().nonnegative(),
  utilization: z.number().min(0).max(1),
  highUtilizationWarning: z.boolean(),
  discoveredAt: z.string().datetime(),
}).strict();
export type KaminoRwaPool = z.infer<typeof KaminoRwaPoolSchema>;

export const KaminoRwaSupplyPlanSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  lendingMarket: SolanaAddressSchema,
  usdcReserve: SolanaAddressSchema,
  amountAtomic: AtomicAmountSchema,
  supplyApyAtPrepare: z.number().nonnegative(),
  requirementsDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  transactionBase64: z.string().min(32).max(16_000),
  blockhash: SolanaAddressSchema,
  lastValidBlockHeight: z.string().regex(/^\d+$/u),
  estimatedNetworkFeeLamports: z.string().regex(/^\d+$/u),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
}).strict();
export type KaminoRwaSupplyPlan = z.infer<typeof KaminoRwaSupplyPlanSchema>;

export const KaminoRwaPositionStatusSchema = z.enum(["SUBMITTED", "CONFIRMED", "UNKNOWN", "FAILED"]);
export type KaminoRwaPositionStatus = z.infer<typeof KaminoRwaPositionStatusSchema>;

export const KaminoRwaPositionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  lendingMarket: SolanaAddressSchema,
  marketName: z.string().min(1).max(160),
  usdcReserve: SolanaAddressSchema,
  amountSuppliedAtomic: AtomicAmountSchema,
  supplyApyAtEntry: z.number().nonnegative(),
  signature: z.string().min(64).max(128).nullable(),
  status: KaminoRwaPositionStatusSchema,
  errorMessage: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type KaminoRwaPosition = z.infer<typeof KaminoRwaPositionSchema>;

const RequestBaseSchema = z.object({ schemaVersion: z.literal(1), requestId: z.string().uuid() });

export const KaminoRwaDiscoverRequestSchema = RequestBaseSchema.strict();
export const KaminoRwaDiscoverResponseSchema = RequestBaseSchema.extend({
  pools: z.array(KaminoRwaPoolSchema).max(20),
}).strict();

export const KaminoRwaPrepareRequestSchema = RequestBaseSchema.extend({
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  lendingMarket: SolanaAddressSchema,
  amountAtomic: AtomicAmountSchema,
  maxSupplyAtomic: AtomicAmountSchema.default(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC),
}).strict();
export const KaminoRwaPrepareResponseSchema = RequestBaseSchema.extend({
  plan: KaminoRwaSupplyPlanSchema,
}).strict();

export const KaminoRwaExecuteRequestSchema = RequestBaseSchema.extend({
  planId: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  walletAddress: SolanaAddressSchema,
  approved: z.literal(true),
  masterPassword: z.string().min(1).max(256).optional(),
}).strict();
export const KaminoRwaExecuteResponseSchema = RequestBaseSchema.extend({
  position: KaminoRwaPositionSchema,
}).strict();

export const KaminoRwaPositionsResponseSchema = RequestBaseSchema.extend({
  positions: z.array(KaminoRwaPositionSchema).max(500),
}).strict();

export type KaminoRwaDiscoverRequest = z.infer<typeof KaminoRwaDiscoverRequestSchema>;
export type KaminoRwaDiscoverResponse = z.infer<typeof KaminoRwaDiscoverResponseSchema>;
export type KaminoRwaPrepareRequest = z.infer<typeof KaminoRwaPrepareRequestSchema>;
export type KaminoRwaPrepareResponse = z.infer<typeof KaminoRwaPrepareResponseSchema>;
export type KaminoRwaExecuteRequest = z.infer<typeof KaminoRwaExecuteRequestSchema>;
export type KaminoRwaExecuteResponse = z.infer<typeof KaminoRwaExecuteResponseSchema>;
export type KaminoRwaPositionsResponse = z.infer<typeof KaminoRwaPositionsResponseSchema>;
