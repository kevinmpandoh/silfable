import assert from "node:assert/strict";
import test from "node:test";

import { fetchEvmUsdPrices } from "./evm-price-provider.js";

const WETH_BASE = "0x4200000000000000000000000000000000000006";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

test("fetches chain-aware EVM prices and pins the official GeckoTerminal origin", async () => {
  let requestedUrl = "";
  const result = await fetchEvmUsdPrices({
    chainKey: "base",
    tokenAddresses: [USDC_BASE, USDC_BASE.toUpperCase().replace("0X", "0x")],
  }, {
    now: () => new Date("2026-07-30T03:00:00.000Z"),
    fetchFn: async (input) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify({
        data: {
          attributes: {
            token_prices: {
              [WETH_BASE]: "1900.50",
              [USDC_BASE]: "1.0001",
            },
          },
        },
      }), { status: 200 });
    },
  });

  assert.match(requestedUrl, /^https:\/\/api\.geckoterminal\.com\/api\/v2\/simple\/networks\/base\//u);
  assert.equal(result?.prices.get(WETH_BASE), 1900.5);
  assert.equal(result?.prices.get(USDC_BASE), 1.0001);
  assert.equal(result?.fetchedAt, "2026-07-30T03:00:00.000Z");
});

test("uses ETH spot pricing for Robinhood Chain when onchain pricing is unavailable", async () => {
  let requestedUrl = "";
  const result = await fetchEvmUsdPrices({
    chainKey: "robinhood",
    tokenAddresses: [],
  }, {
    now: () => new Date("2026-08-03T00:00:00.000Z"),
    fetchFn: async (input) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify({ ethereum: { usd: 3500 } }), { status: 200 });
    },
  });
  assert.equal(requestedUrl, "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  assert.equal(result?.source, "coingecko-spot");
  assert.equal(result?.prices.get("0x0bd7d308f8e1639fab988df18a8011f41eacad73"), 3500);
});

test("rejects malformed provider evidence instead of fabricating a price", async () => {
  await assert.rejects(
    fetchEvmUsdPrices({ chainKey: "ethereum", tokenAddresses: [] }, {
      fetchFn: async () => new Response(JSON.stringify({ data: {} }), { status: 200 }),
    }),
    /missing attributes/u,
  );
});
