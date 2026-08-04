import type { EvmChainId, EvmChainKey } from "@silfable/contracts";

export type EvmChainDefinition = Readonly<{
  key: EvmChainKey;
  chainId: EvmChainId;
  name: string;
  nativeSymbol: string;
  explorerUrl: string;
  kyberSlug: string | null;
  priceNetwork: string | null;
  wrappedNativeAddress: `0x${string}` | null;
  defaultRpcUrl: `https://${string}`;
  /**
   * Public read/preflight fallbacks. Every candidate is independently checked
   * against the pinned chain ID before it is used.
   */
  fallbackRpcUrls?: readonly `https://${string}`[];
  rpcSecretName:
    | "ethereum-rpc-url"
    | "base-rpc-url"
    | "arbitrum-rpc-url"
    | "optimism-rpc-url"
    | "polygon-rpc-url"
    | "bsc-rpc-url"
    | "avalanche-rpc-url"
    | "robinhood-rpc-url";
  quoteProvider: "kyberswap" | "uniswap";
  universalRouterAddress?: `0x${string}`;
  universalRouterVersion?: "2.1.1";
  executionStatus: "release-gated";
}>;

const CHAINS: readonly EvmChainDefinition[] = [
  { key: "ethereum", chainId: 1, name: "Ethereum", nativeSymbol: "ETH", explorerUrl: "https://etherscan.io", kyberSlug: "ethereum", priceNetwork: "eth", wrappedNativeAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", defaultRpcUrl: "https://ethereum-rpc.publicnode.com", rpcSecretName: "ethereum-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "base", chainId: 8_453, name: "Base", nativeSymbol: "ETH", explorerUrl: "https://basescan.org", kyberSlug: "base", priceNetwork: "base", wrappedNativeAddress: "0x4200000000000000000000000000000000000006", defaultRpcUrl: "https://mainnet.base.org", rpcSecretName: "base-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "arbitrum", chainId: 42_161, name: "Arbitrum One", nativeSymbol: "ETH", explorerUrl: "https://arbiscan.io", kyberSlug: "arbitrum", priceNetwork: "arbitrum", wrappedNativeAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", defaultRpcUrl: "https://arb1.arbitrum.io/rpc", rpcSecretName: "arbitrum-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "optimism", chainId: 10, name: "Optimism", nativeSymbol: "ETH", explorerUrl: "https://optimistic.etherscan.io", kyberSlug: "optimism", priceNetwork: "optimism", wrappedNativeAddress: "0x4200000000000000000000000000000000000006", defaultRpcUrl: "https://mainnet.optimism.io", rpcSecretName: "optimism-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "polygon", chainId: 137, name: "Polygon", nativeSymbol: "POL", explorerUrl: "https://polygonscan.com", kyberSlug: "polygon", priceNetwork: "polygon_pos", wrappedNativeAddress: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", defaultRpcUrl: "https://polygon-bor-rpc.publicnode.com", rpcSecretName: "polygon-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "bsc", chainId: 56, name: "BNB Chain", nativeSymbol: "BNB", explorerUrl: "https://bscscan.com", kyberSlug: "bsc", priceNetwork: "bsc", wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", defaultRpcUrl: "https://bsc-dataseed.bnbchain.org", rpcSecretName: "bsc-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  { key: "avalanche", chainId: 43_114, name: "Avalanche C-Chain", nativeSymbol: "AVAX", explorerUrl: "https://snowtrace.io", kyberSlug: "avalanche", priceNetwork: "avax", wrappedNativeAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", defaultRpcUrl: "https://api.avax.network/ext/bc/C/rpc", rpcSecretName: "avalanche-rpc-url", quoteProvider: "kyberswap", executionStatus: "release-gated" },
  {
    key: "robinhood",
    chainId: 4_663,
    name: "Robinhood Chain",
    nativeSymbol: "ETH",
    explorerUrl: "https://explorer.mainnet.chain.robinhood.com",
    kyberSlug: "robinhood",
    priceNetwork: null,
    wrappedNativeAddress: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
    defaultRpcUrl: "https://hood-rpc.pastrylabs.cloud/",
    // The official public endpoint can be temporarily unavailable. This is a
    // read/preflight fallback only; the runtime proves chain ID 4663 and a
    // fresh block read before using it for any quote, estimate, simulation,
    // or one-attempt broadcast.
    fallbackRpcUrls: [
      "https://rpc.mainnet.chain.robinhood.com",
      "https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public",
    ],
    rpcSecretName: "robinhood-rpc-url",
    // KyberSwap does not index every Robinhood asset. Robinhood is therefore
    // deliberately pinned to the separately allowlisted Uniswap adapter.
    quoteProvider: "uniswap",
    universalRouterAddress: "0x8876789976decbfcbbbe364623c63652db8c0904",
    universalRouterVersion: "2.1.1",
    executionStatus: "release-gated",
  },
] as const;

const BY_KEY = new Map<EvmChainKey, EvmChainDefinition>(CHAINS.map((chain) => [chain.key, chain]));

export function listEvmChains(): readonly EvmChainDefinition[] {
  return CHAINS;
}

export function getEvmChain(key: EvmChainKey): EvmChainDefinition {
  const chain = BY_KEY.get(key);
  if (chain === undefined) throw new Error(`Unsupported EVM chain: ${key}`);
  return chain;
}
