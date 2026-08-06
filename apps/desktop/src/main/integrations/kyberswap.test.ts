import assert from "node:assert/strict";
import test from "node:test";

import { getEvmChain, listEvmChains } from "./evm-chains.js";
import { KyberSwapQuoteService } from "./kyberswap.js";
import { KyberSwapPreflightService } from "../execution/kyberswap-preflight.js";

const tokenIn = "0x1111111111111111111111111111111111111111";
const tokenOut = "0x2222222222222222222222222222222222222222";
const router = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";

test("EVM registry pins released chains and routes Robinhood through Uniswap", () => {
  assert.equal(getEvmChain("base").chainId, 8_453);
  assert.equal(getEvmChain("arbitrum").kyberSlug, "arbitrum");
  assert.equal(getEvmChain("robinhood").quoteProvider, "uniswap");
  assert.equal(getEvmChain("robinhood").kyberSlug, "robinhood");
  assert.equal(getEvmChain("robinhood").explorerUrl, "https://robinhoodchain.blockscout.com");
  assert.equal(listEvmChains().length, 8);
});

test("KyberSwap quote returns bounded evidence and keeps route summary private", async () => {
  const service = new KyberSwapQuoteService(async (url, init) => {
    assert.match(String(url), /\/base\/api\/v1\/routes/u);
    assert.match(String(url), /amountIn=1000000/u);
    assert.equal(new Headers(init?.headers).get("x-client-id"), "Silfable");
    return new Response(JSON.stringify({
      data: {
        routerAddress: router,
        routeSummary: {
          amountIn: "1000000",
          amountOut: "2000000",
          route: [[{ exchange: "uniswap-v3" }]],
        },
      },
    }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  assert.equal(quote.minimumAmountOut, "1990000");
  assert.deepEqual(quote.routeNames, ["uniswap-v3"]);
  const stored = service.consumeRoute(quote.quoteId);
  assert.equal(stored.routeSummary.amountOut, "2000000");
  assert.throws(() => service.consumeRoute(quote.quoteId), /already consumed/u);
});

test("KyberSwap quote rejects mismatches and unsafe input", async () => {
  const service = new KyberSwapQuoteService(async () => new Response(JSON.stringify({
    data: { routerAddress: router, routeSummary: { amountIn: "999", amountOut: "1", route: [] } },
  }), { status: 200 }));
  await assert.rejects(() => service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000", slippageBps: 50 }), /mismatched/u);
  await assert.rejects(() => service.quote({ chainKey: "base", tokenIn, tokenOut: tokenIn, amountIn: "1000", slippageBps: 50 }), /different/u);
});

test("KyberSwap build retains private calldata and Base preflight produces bounded unsigned evidence", async () => {
  let buildBody: Record<string, unknown> | undefined;
  const service = new KyberSwapQuoteService(async (url, init) => {
    if (String(url).endsWith("/route/build")) {
      buildBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ data: {
        routerAddress: router,
        data: "0x12345678",
        amountIn: "1000000",
        value: "0",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: {
      routerAddress: router,
      routeSummary: { amountIn: "1000000", amountOut: "2000000", route: [] },
    } }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  const preflight = new KyberSwapPreflightService();
  const evidence = await preflight.prepare({
    quotes: service,
    quoteId: quote.quoteId,
    wallet: tokenIn,
    slippageBps: 50,
    engine: {
      async assertExpectedChain() { return 8453; },
      async getBalance() { return { wei: 10_000_000n }; },
      async getErc20Balance() { return 10_000_000n; },
      async getBytecode() { return "0x01" as const; },
      async getErc20Allowance() { return 1_000_000n; },
      async simulateTransaction(input) {
        assert.equal(input.to, router);
        assert.equal(input.data, "0x12345678");
        return { gasLimit: 120_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n };
      },
    },
  });
  assert.equal(buildBody?.sender, tokenIn);
  assert.equal(buildBody?.recipient, tokenIn);
  assert.equal(buildBody?.slippageTolerance, 0.5);
  assert.equal(evidence.chainKey, "base");
  assert.equal(evidence.maximumNetworkFeeWei, "240000");
  assert.equal(evidence.routerAddress, router);
  assert.equal(Object.hasOwn(evidence, "calldata"), false);
  assert.throws(() => service.consumeRoute(quote.quoteId), /already consumed/u);
  assert.equal(preflight.consume({
    id: evidence.id,
    chainKey: "base",
    walletAddress: tokenIn,
    action: evidence.action,
  }).build.calldata, "0x12345678");
});

test("KyberSwap Base preflight rejects a chain mismatch before simulation", async () => {
  const service = new KyberSwapQuoteService(async (url) => {
    if (String(url).endsWith("/route/build")) {
      return new Response(JSON.stringify({ data: { routerAddress: router, data: "0x", amountIn: "1000000" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { routerAddress: router, routeSummary: { amountIn: "1000000", amountOut: "2000000", route: [] } } }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  await assert.rejects(() => new KyberSwapPreflightService().prepare({
    quotes: service,
    quoteId: quote.quoteId,
    wallet: tokenIn,
    slippageBps: 50,
    engine: {
      async assertExpectedChain() { return 1; },
      async getBalance() { throw new Error("must not run"); },
      async getErc20Balance() { throw new Error("must not run"); },
      async getBytecode() { throw new Error("must not run"); },
      async getErc20Allowance() { throw new Error("must not run"); },
      async simulateTransaction() { throw new Error("must not run"); },
    },
  }), /expected 8453, received 1/u);
});

test("KyberSwap preflight creates a separate exact ERC-20 approval review when allowance is insufficient", async () => {
  const service = new KyberSwapQuoteService(async (url) => {
    if (String(url).endsWith("/route/build")) {
      return new Response(JSON.stringify({ data: {
        routerAddress: router,
        data: "0x12345678",
        amountIn: "1000000",
        value: "0",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: {
      routerAddress: router,
      routeSummary: { amountIn: "1000000", amountOut: "2000000", route: [] },
    } }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "arbitrum", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  const evidence = await new KyberSwapPreflightService().prepare({
    quotes: service,
    quoteId: quote.quoteId,
    wallet: tokenOut,
    slippageBps: 50,
    engine: {
      async assertExpectedChain() { return 42_161; },
      async getBalance() { return { wei: 10_000_000n }; },
      async getErc20Balance() { return 10_000_000n; },
      async getBytecode() { return "0x01" as const; },
      async getErc20Allowance() { return 0n; },
      async simulateTransaction(input) {
        assert.equal(input.to, tokenIn);
        assert.equal(input.valueWei, 0n);
        assert.match(input.data ?? "", /^0x095ea7b3/u);
        return { gasLimit: 50_000n, maxFeePerGas: 3n, maxPriorityFeePerGas: 1n };
      },
    },
  });
  assert.equal(evidence.action, "approval");
  assert.equal(evidence.allowanceRequired, true);
  assert.equal(evidence.approvalSpender, router);
  assert.equal(evidence.maximumNetworkFeeWei, "150000");
});

test("KyberSwap preflight rejects insufficient ERC-20 input balance", async () => {
  const service = new KyberSwapQuoteService(async (url) => {
    if (String(url).endsWith("/route/build")) {
      return new Response(JSON.stringify({ data: {
        routerAddress: router,
        data: "0x12345678",
        amountIn: "1000000",
        value: "0",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: {
      routerAddress: router,
      routeSummary: { amountIn: "1000000", amountOut: "2000000", route: [] },
    } }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  await assert.rejects(() => new KyberSwapPreflightService().prepare({
    quotes: service,
    quoteId: quote.quoteId,
    wallet: tokenOut,
    slippageBps: 50,
    engine: {
      async assertExpectedChain() { return 8_453; },
      async getBalance() { return { wei: 10_000_000n }; },
      async getErc20Balance() { return 999_999n; },
      async getBytecode() { return "0x01" as const; },
      async getErc20Allowance() { return 1_000_000n; },
      async simulateTransaction() {
        return { gasLimit: 50_000n, maxFeePerGas: 3n, maxPriorityFeePerGas: 1n };
      },
    },
  }), /balance cannot cover the reviewed input amount/u);
});

test("KyberSwap preflight rejects insufficient native gas balance", async () => {
  const service = new KyberSwapQuoteService(async (url) => {
    if (String(url).endsWith("/route/build")) {
      return new Response(JSON.stringify({ data: {
        routerAddress: router,
        data: "0x12345678",
        amountIn: "1000000",
        value: "0",
      } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: {
      routerAddress: router,
      routeSummary: { amountIn: "1000000", amountOut: "2000000", route: [] },
    } }), { status: 200 });
  });
  const quote = await service.quote({ chainKey: "base", tokenIn, tokenOut, amountIn: "1000000", slippageBps: 50 });
  await assert.rejects(() => new KyberSwapPreflightService().prepare({
    quotes: service,
    quoteId: quote.quoteId,
    wallet: tokenOut,
    slippageBps: 50,
    engine: {
      async assertExpectedChain() { return 8_453; },
      async getBalance() { return { wei: 149_999n }; },
      async getErc20Balance() { return 1_000_000n; },
      async getBytecode() { return "0x01" as const; },
      async getErc20Allowance() { return 1_000_000n; },
      async simulateTransaction() {
        return { gasLimit: 50_000n, maxFeePerGas: 3n, maxPriorityFeePerGas: 1n };
      },
    },
  }), /native balance cannot cover/u);
});
