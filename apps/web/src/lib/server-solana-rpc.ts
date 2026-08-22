const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL,
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://mainnet.helius-rpc.com/?api-key=1a26ad61-c60d-477c-8c51-cd8b07815421",
].filter((url): url is string => Boolean(url && url.trim().length > 0));

let activeIndex = 0;

export const DEFAULT_SOLANA_RPC = RPC_ENDPOINTS[0] || "https://api.mainnet-beta.solana.com";

export function selectSolanaRpc(): string {
  return RPC_ENDPOINTS[activeIndex % RPC_ENDPOINTS.length] || DEFAULT_SOLANA_RPC;
}

export function rotateSolanaRpc(): string {
  activeIndex = (activeIndex + 1) % RPC_ENDPOINTS.length;
  return selectSolanaRpc();
}
