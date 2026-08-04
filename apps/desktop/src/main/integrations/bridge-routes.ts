import {
  BRIDGE_ARBITRUM_CHAIN_ID,
  BRIDGE_ARBITRUM_USDC_ADDRESS,
  BRIDGE_AVALANCHE_CHAIN_ID,
  BRIDGE_AVALANCHE_USDC_ADDRESS,
  BRIDGE_BASE_CHAIN_ID,
  BRIDGE_BASE_USDC_ADDRESS,
  BRIDGE_ETHEREUM_CHAIN_ID,
  BRIDGE_ETHEREUM_USDC_ADDRESS,
  BRIDGE_OPTIMISM_CHAIN_ID,
  BRIDGE_OPTIMISM_USDC_ADDRESS,
  BRIDGE_POLYGON_CHAIN_ID,
  BRIDGE_POLYGON_USDC_ADDRESS,
  BRIDGE_ROBINHOOD_CHAIN_ID,
  BRIDGE_ROBINHOOD_USDG_ADDRESS,
  BRIDGE_SOLANA_CHAIN_ID,
  BRIDGE_SOLANA_USDC_MINT,
  type BridgeContract,
  type BridgeDestinationChain,
  type BridgeProviderId,
} from "@silfable/contracts";

export type ExecutableBridgeProviderId = Exclude<BridgeProviderId, "auto">;
export type BridgeRouteDescriptor = Readonly<{
  id: string;
  label: string;
  confirmation: `BRIDGE USDC TO ${"BASE" | "ARBITRUM" | "ETHEREUM" | "OPTIMISM" | "POLYGON" | "AVALANCHE" | "ROBINHOOD"}`;
  source: { chainId: typeof BRIDGE_SOLANA_CHAIN_ID; chainKey: "solana"; assetAddress: typeof BRIDGE_SOLANA_USDC_MINT; symbol: "USDC"; decimals: 6 };
  destination: { chainId: BridgeContract["destinationChainId"]; chainKey: BridgeDestinationChain; assetAddress: string; symbol: "USDC" | "USDG"; decimals: 6 };
  providers: readonly Readonly<{ id: ExecutableBridgeProviderId; priority: number; executable: true }>[];
}>;

const source = { chainId: BRIDGE_SOLANA_CHAIN_ID, chainKey: "solana" as const, assetAddress: BRIDGE_SOLANA_USDC_MINT, symbol: "USDC" as const, decimals: 6 as const };
const providers = [
  { id: "debridge-dln" as const, priority: 1, executable: true as const },
  { id: "relay" as const, priority: 2, executable: true as const },
] as const;

/**
 * Release-controlled capability registry. Provider selection is dynamic, but
 * chains, stablecoin contracts, approval phrases and provider priority remain
 * pinned in code. Robinhood uses its bridge-native USDG asset and Relay only.
 */
export const BRIDGE_ROUTES: readonly BridgeRouteDescriptor[] = [
  route("base", "Base", BRIDGE_BASE_CHAIN_ID, BRIDGE_BASE_USDC_ADDRESS, "USDC", providers),
  route("arbitrum", "Arbitrum", BRIDGE_ARBITRUM_CHAIN_ID, BRIDGE_ARBITRUM_USDC_ADDRESS, "USDC", providers),
  route("ethereum", "Ethereum", BRIDGE_ETHEREUM_CHAIN_ID, BRIDGE_ETHEREUM_USDC_ADDRESS, "USDC", providers),
  route("optimism", "Optimism", BRIDGE_OPTIMISM_CHAIN_ID, BRIDGE_OPTIMISM_USDC_ADDRESS, "USDC", providers),
  route("polygon", "Polygon", BRIDGE_POLYGON_CHAIN_ID, BRIDGE_POLYGON_USDC_ADDRESS, "USDC", providers),
  route("avalanche", "Avalanche", BRIDGE_AVALANCHE_CHAIN_ID, BRIDGE_AVALANCHE_USDC_ADDRESS, "USDC", providers),
  route("robinhood", "Robinhood", BRIDGE_ROBINHOOD_CHAIN_ID, BRIDGE_ROBINHOOD_USDG_ADDRESS, "USDG", [
    { id: "relay", priority: 1, executable: true },
  ]),
];

function route(
  chainKey: BridgeDestinationChain,
  label: string,
  chainId: BridgeContract["destinationChainId"],
  assetAddress: string,
  symbol: "USDC" | "USDG",
  routeProviders: BridgeRouteDescriptor["providers"],
): BridgeRouteDescriptor {
  return {
    id: `solana-usdc-${chainKey}-${symbol.toLowerCase()}`,
    label: `Solana USDC to ${label} ${symbol}`,
    confirmation: `BRIDGE USDC TO ${chainKey.toUpperCase()}` as BridgeRouteDescriptor["confirmation"],
    source,
    destination: { chainId, chainKey, assetAddress, symbol, decimals: 6 },
    providers: routeProviders,
  };
}

export function getBridgeRoute(destination: BridgeDestinationChain): BridgeRouteDescriptor {
  const result = BRIDGE_ROUTES.find((candidate) => candidate.destination.chainKey === destination);
  if (result === undefined) throw new Error("Bridge destination is not enabled by this release.");
  return result;
}

export function resolveEnabledBridgeRoute(contract: BridgeContract): BridgeRouteDescriptor {
  const result = BRIDGE_ROUTES.find((candidate) =>
    candidate.source.chainId === contract.sourceChainId
    && candidate.destination.chainId === contract.destinationChainId
    && candidate.source.assetAddress === contract.sourceAsset.address
    && candidate.destination.assetAddress.toLowerCase() === contract.destinationAsset.address.toLowerCase()
    && candidate.destination.symbol === contract.destinationAsset.symbol
    && (contract.provider === "auto" || candidate.providers.some((provider) => provider.id === contract.provider && provider.executable)),
  );
  if (result === undefined) throw new Error("Bridge route is not enabled by the release-controlled registry.");
  return result;
}

export function bridgeProviderCandidates(contract: BridgeContract): readonly ExecutableBridgeProviderId[] {
  const result = resolveEnabledBridgeRoute(contract).providers
    .filter((provider) => contract.provider === "auto" || provider.id === contract.provider)
    .sort((a, b) => a.priority - b.priority)
    .map((provider) => provider.id);
  if (result.length === 0) throw new Error("No enabled Bridge provider can serve this route.");
  return result;
}
