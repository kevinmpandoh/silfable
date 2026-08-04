import assert from "node:assert/strict";
import test from "node:test";

import {
  BRIDGE_ARBITRUM_CHAIN_ID,
  BRIDGE_ARBITRUM_USDC_ADDRESS,
  BRIDGE_BASE_CHAIN_ID,
  BRIDGE_BASE_USDC_ADDRESS,
  BRIDGE_ETHEREUM_CHAIN_ID,
  BRIDGE_ETHEREUM_USDC_ADDRESS,
  BRIDGE_OPTIMISM_CHAIN_ID,
  BRIDGE_POLYGON_CHAIN_ID,
  BRIDGE_AVALANCHE_CHAIN_ID,
  BRIDGE_ROBINHOOD_CHAIN_ID,
  BRIDGE_ROBINHOOD_USDG_ADDRESS,
  BRIDGE_SOLANA_CHAIN_ID,
  BRIDGE_SOLANA_USDC_MINT,
  BridgeContractSchema,
  type BridgeContract,
} from "@silfable/contracts";
import { BRIDGE_ROUTES, bridgeProviderCandidates, resolveEnabledBridgeRoute } from "./bridge-routes.js";

test("registry exposes only release-controlled executable routes", () => {
  const contract = BridgeContractSchema.parse({
    id: "7f280762-97e7-4a88-b1ad-dd5e924dc096",
    provider: "debridge-dln",
    sourceChainId: BRIDGE_SOLANA_CHAIN_ID,
    destinationChainId: BRIDGE_BASE_CHAIN_ID,
    sourceAsset: { address: BRIDGE_SOLANA_USDC_MINT, symbol: "USDC", decimals: 6 },
    destinationAsset: { address: BRIDGE_BASE_USDC_ADDRESS, symbol: "USDC", decimals: 6 },
    sourceWallet: "2r2pXUspsXamwzNWc8dQn52GK2BJJWmr63MPzDDxjTcg",
    destinationRecipient: "0x462e05D112DE35a42a8F0EaB5e0F4A898C9D4913",
    amountIn: "5000000",
    minimumDestinationAmount: "4000000",
    maximumTotalFeeUsd: 3,
    createdAt: "2026-08-02T00:00:00.000Z",
    deadline: "2026-08-02T00:30:00.000Z",
    timeoutSeconds: 3600,
    refundPolicy: "provider-cancel-only",
  });
  assert.equal(BRIDGE_ROUTES.length, 7);
  assert.deepEqual(BRIDGE_ROUTES.map((route) => route.destination.chainId), [
    BRIDGE_BASE_CHAIN_ID,
    BRIDGE_ARBITRUM_CHAIN_ID,
    BRIDGE_ETHEREUM_CHAIN_ID,
    BRIDGE_OPTIMISM_CHAIN_ID,
    BRIDGE_POLYGON_CHAIN_ID,
    BRIDGE_AVALANCHE_CHAIN_ID,
    BRIDGE_ROBINHOOD_CHAIN_ID,
  ]);
  assert.equal(BRIDGE_ROUTES.slice(0, 6).every((route) => route.providers.map((provider) => provider.id).join(",") === "debridge-dln,relay"), true);
  assert.deepEqual(BRIDGE_ROUTES.at(-1)?.providers.map((provider) => provider.id), ["relay"]);
  assert.equal(resolveEnabledBridgeRoute(contract).id, "solana-usdc-base-usdc");

  const arbitrumContract = BridgeContractSchema.parse({
    ...contract,
    destinationChainId: BRIDGE_ARBITRUM_CHAIN_ID,
    destinationAsset: { address: BRIDGE_ARBITRUM_USDC_ADDRESS, symbol: "USDC", decimals: 6 },
  });
  assert.equal(resolveEnabledBridgeRoute(arbitrumContract).id, "solana-usdc-arbitrum-usdc");

  const ethereumContract = BridgeContractSchema.parse({
    ...contract,
    destinationChainId: BRIDGE_ETHEREUM_CHAIN_ID,
    destinationAsset: { address: BRIDGE_ETHEREUM_USDC_ADDRESS, symbol: "USDC", decimals: 6 },
  });
  assert.equal(resolveEnabledBridgeRoute(ethereumContract).id, "solana-usdc-ethereum-usdc");

  const robinhoodContract = BridgeContractSchema.parse({
    ...contract,
    provider: "auto",
    destinationChainId: BRIDGE_ROBINHOOD_CHAIN_ID,
    destinationAsset: { address: BRIDGE_ROBINHOOD_USDG_ADDRESS, symbol: "USDG", decimals: 6 },
  });
  assert.equal(resolveEnabledBridgeRoute(robinhoodContract).id, "solana-usdc-robinhood-usdg");
  assert.deepEqual(bridgeProviderCandidates(robinhoodContract), ["relay"]);

  assert.throws(() => resolveEnabledBridgeRoute({
    ...arbitrumContract,
    destinationAsset: { address: BRIDGE_BASE_USDC_ADDRESS, symbol: "USDC", decimals: 6 },
  } as BridgeContract), /not enabled/u);
});
