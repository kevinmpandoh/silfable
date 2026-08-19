const LAMPORTS_PER_SOL = 1_000_000_000n;
// Atomic create + creator buy must stay below Solana's packet-size ceiling.
// A compute-budget price instruction would add another static account key, so
// this path uses the network's default priority fee and relies on simulation.
const DEFAULT_PRIORITY_FEE_LAMPORTS = 0n;
const LAUNCH_COST_RESERVE_LAMPORTS = 50_000_000n;
const CREATOR_BUY_SLIPPAGE_BPS = 100n;
const MAX_AUTOMATIC_OUTFLOW_LAMPORTS = 10n * LAMPORTS_PER_SOL;

export function automaticLaunchLimits(creatorBuyLamportsValue: string | bigint): {
  maxCreatorOutflowLamports: string;
  maxPriorityFeeLamports: string;
} {
  const creatorBuyLamports = BigInt(creatorBuyLamportsValue);
  if (creatorBuyLamports < 0n) throw new Error("Creator buy cannot be negative.");
  const slippageReserve = (creatorBuyLamports * CREATOR_BUY_SLIPPAGE_BPS + 9_999n) / 10_000n;
  const maxCreatorOutflowLamports = creatorBuyLamports + slippageReserve + LAUNCH_COST_RESERVE_LAMPORTS;
  if (maxCreatorOutflowLamports > MAX_AUTOMATIC_OUTFLOW_LAMPORTS) {
    throw new Error("Creator buy is too high for the guarded 10 SOL launch limit. Enter a smaller amount.");
  }
  return {
    maxCreatorOutflowLamports: maxCreatorOutflowLamports.toString(),
    maxPriorityFeeLamports: DEFAULT_PRIORITY_FEE_LAMPORTS.toString(),
  };
}
