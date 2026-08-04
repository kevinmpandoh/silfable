import assert from "node:assert/strict";
import test from "node:test";

import {
  BRIDGE_BASE_USDC_ADDRESS,
  BRIDGE_SOLANA_USDC_MINT,
} from "@silfable/contracts";
import {
  CROSS_CHAIN_BRIDGE_ROUTES,
  listCrossChainBridgeDestinations,
  resolveCrossChainBridgeRoute,
} from "./cross-chain-bridge-routes.js";

test("cross-chain registry keeps Solana source routes and adds EVM source route families", () => {
  assert.ok(CROSS_CHAIN_BRIDGE_ROUTES.some((route) =>
    route.source.chainKey === "solana" && route.destination.chainKey === "base" && route.sourceExecution === "solana-live",
  ));
  assert.ok(CROSS_CHAIN_BRIDGE_ROUTES.some((route) =>
    route.source.chainKey === "base" && route.destination.chainKey === "solana" && route.sourceExecution === "evm-release-gated",
  ));
  assert.ok(CROSS_CHAIN_BRIDGE_ROUTES.some((route) =>
    route.source.chainKey === "arbitrum" && route.destination.chainKey === "base" && route.sourceExecution === "evm-release-gated",
  ));
});

test("cross-chain registry resolves exact canonical stablecoin pairs only", () => {
  const route = resolveCrossChainBridgeRoute(
    8_453,
    BRIDGE_BASE_USDC_ADDRESS,
    7_565_164,
    BRIDGE_SOLANA_USDC_MINT,
  );
  assert.equal(route.source.chainKey, "base");
  assert.equal(route.destination.chainKey, "solana");
  assert.throws(() => resolveCrossChainBridgeRoute(8_453, BRIDGE_BASE_USDC_ADDRESS, 1, BRIDGE_SOLANA_USDC_MINT));
});

test("route discovery is source-scoped", () => {
  const fromBase = listCrossChainBridgeDestinations("base");
  assert.ok(fromBase.length > 1);
  assert.ok(fromBase.every((route) => route.source.chainKey === "base"));
});
