import "server-only";

export const DEFAULT_SOLANA_RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function selectSolanaRpc(): string {
  return DEFAULT_SOLANA_RPC;
}
