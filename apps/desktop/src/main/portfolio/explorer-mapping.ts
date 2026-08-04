import type { EvmChainKey, UnifiedActivityEntry } from "@silfable/contracts";

import { getEvmChain } from "../integrations/evm-chains.js";

const SOLANA_EXPLORER = "https://explorer.solana.com";
const EVM_HASH = /^0x[0-9a-f]{64}$/iu;
const SOLANA_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/u;

export function explorerBaseUrl(family: "solana" | "evm", chainKey: string): string {
  if (family === "solana") return SOLANA_EXPLORER;
  return getEvmChain(chainKey as EvmChainKey).explorerUrl;
}

export function activityExplorerUrl(input: Pick<
  UnifiedActivityEntry,
  "family" | "chainKey" | "transactionId" | "venue"
>): string | null {
  if (input.transactionId === null) return null;
  if (input.family === "solana" && SOLANA_SIGNATURE.test(input.transactionId)) {
    return `${SOLANA_EXPLORER}/tx/${input.transactionId}`;
  }
  if (input.family === "evm" && input.chainKey !== null && EVM_HASH.test(input.transactionId)) {
    return `${getEvmChain(input.chainKey as EvmChainKey).explorerUrl}/tx/${input.transactionId}`;
  }
  if (
    input.family === "cross-chain"
    && input.chainKey === "solana-to-base"
    && EVM_HASH.test(input.transactionId)
  ) {
    return `${getEvmChain("base").explorerUrl}/tx/${input.transactionId}`;
  }
  return null;
}

export function assertAllowedExplorerUrl(raw: string): URL {
  const url = new URL(raw);
  const allowedHosts = new Set([
    "explorer.solana.com",
    ...(["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "avalanche", "robinhood"] as EvmChainKey[])
      .map((key) => new URL(getEvmChain(key).explorerUrl).hostname),
  ]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || !url.pathname.includes("/tx/")) {
    throw new Error("Explorer URL is not release-controlled.");
  }
  return url;
}
