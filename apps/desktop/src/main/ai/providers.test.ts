import assert from "node:assert/strict";
import { after, test } from "node:test";

import { callOpenRouterChat, callOpenRouterX402Selection, previewOpenRouterModels } from "./providers.js";
import type { PumpDiscoverySnapshot, PumpTokenIntelligence } from "@mirae/contracts";

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test("Full Access x402 selection returns only the AI's structured candidate IDs", { concurrency: false }, async () => {
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ resourceIds: ["sha256:" + "a".repeat(64)], rationale: "Funding and open-interest data covers the requested perpetual analysis." }) } }] });
  };
  const result = await callOpenRouterX402Selection({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    originalRequest: "Analyze ETH through x402",
    resources: [{ id: "sha256:" + "a".repeat(64), name: "Perps", description: "Funding and open interest", tags: ["eth", "perps"], amount: "10000" }],
  });
  assert.deepEqual(result.resourceIds, ["sha256:" + "a".repeat(64)]);
  assert.match(result.rationale, /Funding/u);
  assert.equal(((body.tool_choice as { function?: { name?: unknown } }).function?.name), "select_x402_resources");
  assert.equal(JSON.stringify(body).includes("sk-or-private-value"), false);
});

test("Full Access x402 selection accepts a forced OpenRouter tool call with null content", { concurrency: false }, async () => {
  const id = "sha256:" + "b".repeat(64);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "selection-1", type: "function", function: { name: "select_x402_resources", arguments: JSON.stringify({ resourceIds: [id], rationale: "This source directly covers live perpetual funding." }) } }] } }] });
  const result = await callOpenRouterX402Selection({ apiKey: "sk-or-private-value", model: "vendor/tools", originalRequest: "Analyze SOL", resources: [{ id, name: "Perps", description: "Funding", tags: ["sol"], amount: "10000" }] });
  assert.deepEqual(result.resourceIds, [id]);
});

test("Full Access x402 selection accepts object tool arguments", { concurrency: false }, async () => {
  const id = "sha256:" + "c".repeat(64);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "selection-2", type: "function", function: { name: "select_x402_resources", arguments: { resourceIds: [id], rationale: "The provider covers the requested market." } } }] } }] });
  const result = await callOpenRouterX402Selection({ apiKey: "sk-or-private-value", model: "vendor/tools", originalRequest: "Analyze ETH", resources: [{ id, name: "Perps", description: "Funding", tags: ["eth"], amount: "10000" }] });
  assert.deepEqual(result.resourceIds, [id]);
});

test("Full Access x402 selection uses one bounded relevant fallback when the provider returns no selection", { concurrency: false }, async () => {
  const perpsId = "sha256:" + "d".repeat(64);
  const midsId = "sha256:" + "e".repeat(64);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: null } }] });
  const result = await callOpenRouterX402Selection({
    apiKey: "sk-or-private-value",
    model: "vendor/nonconforming",
    originalRequest: "Analyze SOL and open a long only if bullish",
    resources: [
      { id: midsId, name: "Mid Prices", description: "Current price", tags: ["sol", "price"], amount: "5000" },
      { id: perpsId, name: "Perpetual Market", description: "Funding and open interest", tags: ["sol", "perps"], amount: "10000" },
    ],
  });
  assert.deepEqual(result.resourceIds, [perpsId]);
  assert.match(result.rationale, /bounded local relevance policy/u);
});

test("OpenRouter model preview keeps only compatible text models", { concurrency: false }, async () => {
  globalThis.fetch = async () => Response.json({ data: [
    { id: "vendor/safe", name: "Safe", context_length: 128000, pricing: { prompt: "0.1", completion: "0.2" }, supported_parameters: ["structured_outputs", "tools"] },
    { id: "vendor/chat-only", name: "Chat", context_length: 8000, pricing: {}, supported_parameters: ["temperature"] },
  ] });
  const models = await previewOpenRouterModels("sk-or-private-value");
  assert.deepEqual(models.map((model) => model.id), ["vendor/safe"]);
  assert.equal(models[0]?.supportsTools, true);
});

test("restricted Mainnet chat exposes no tool surface when none is configured", { concurrency: false }, async () => {
  let bodyText = "";
  globalThis.fetch = async (_input, init) => {
    bodyText = String(init?.body);
    return Response.json({
      choices: [{ message: { content: "I will prepare a plan for review." } }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, cost: 0.001 },
    });
  };
  const result = await callOpenRouterChat({ apiKey: "sk-or-private-value", model: "vendor/safe", prompt: "Plan a swap", mode: "mission", walletAddress: null });
  assert.equal(result.text, "I will prepare a plan for review.");
  assert.equal(result.totalTokens, 20);
  assert.equal(result.costUsd, 0.001);
  assert.equal("tools" in (JSON.parse(bodyText) as Record<string, unknown>), false);
  assert.equal(bodyText.includes("sk-or-private-value"), false);
  assert.match(bodyText, /desktop app can execute a restricted Jupiter swap, or one exact verified Pump active-curve/u);
  assert.match(bodyText, /canonical PumpSwap buy\/sell/u);
  assert.match(bodyText, /autonomous trading, and unattended signing are not enabled/u);
  assert.match(bodyText, /UNSAVED TOKEN LAUNCH DRAFT/u);
  assert.match(bodyText, /never publish metadata, create a mint, construct a launch transaction, sign, or broadcast/u);
  assert.match(bodyText, /Token Launch form/u);
  assert.match(bodyText, /You cannot sign, execute, broadcast, approve, or bypass/u);
  assert.match(bodyText, /explicitly asks to create a swap mission/u);
  assert.match(bodyText, /Do not invent missing token, wallet, amount, trigger, or Pump fields/u);
  assert.match(bodyText, /only slippage and deadline\/expiry may be omitted/u);
});

test("restricted Mainnet chat executes an allowlisted read-only tool once", { concurrency: false }, async () => {
  const requestBodies: Array<Record<string, unknown>> = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    calls += 1;
    if (calls === 1) return Response.json({
      choices: [{ message: { content: null, tool_calls: [{ id: "tool-1", type: "function", function: { name: "wallet_portfolio", arguments: "{}" } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });
    return Response.json({
      choices: [{ message: { content: "The verified balance is 1 SOL." } }],
      usage: { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 },
    });
  };
  let executions = 0;
  const result = await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    prompt: "Check my wallet",
    mode: "agent",
    walletAddress: "11111111111111111111111111111111",
    tools: [{ name: "wallet_portfolio", description: "read", parameters: { type: "object" }, execute: async () => { executions += 1; return { solBalance: "1" }; } }],
  });
  assert.equal(executions, 1);
  assert.deepEqual(result.toolsUsed, ["wallet_portfolio"]);
  assert.equal(result.totalTokens, 41);
  assert.equal(requestBodies.length, 2);
  assert.equal(JSON.stringify(requestBodies[0]).includes("wallet_portfolio"), true);
  assert.equal(JSON.stringify(requestBodies[1]).includes("solBalance"), true);
  assert.equal(JSON.stringify(requestBodies).includes("sk-or-private-value"), false);
});

test("provider XML for an allowlisted parameterless tool is executed instead of shown to the user", { concurrency: false }, async () => {
  let completions = 0;
  globalThis.fetch = async () => {
    completions += 1;
    if (completions === 1) return Response.json({
      choices: [{ message: { content: "<tool_call> <function=wallet_portfolio> </function> </tool_call>" } }],
      usage: {},
    });
    return Response.json({ choices: [{ message: { content: "Your verified portfolio contains 1 SOL." } }], usage: {} });
  };
  let executions = 0;
  const result = await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/xml-tools",
    prompt: "Show my portfolio",
    mode: "agent",
    walletAddress: "11111111111111111111111111111111",
    tools: [{
      name: "wallet_portfolio",
      description: "read",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: async (argumentsValue) => {
        executions += 1;
        assert.deepEqual(argumentsValue, {});
        return { solBalance: "1" };
      },
    }],
  });
  assert.equal(executions, 1);
  assert.equal(completions, 2);
  assert.deepEqual(result.toolsUsed, ["wallet_portfolio"]);
  assert.equal(result.text, "Your verified portfolio contains 1 SOL.");
  assert.doesNotMatch(result.text, /tool_call/u);
});

test("Robinhood quote tool output is returned as typed EVM session evidence", { concurrency: false }, async () => {
  let calls = 0;
  const walletAddress = `0x${"11".repeat(20)}`;
  const sellToken = `0x${"22".repeat(20)}`;
  const buyToken = `0x${"33".repeat(20)}`;
  const proposal = {
    id: crypto.randomUUID(),
    chainId: 4663 as const,
    walletAddress,
    slippageBps: 50,
    quote: {
      sellToken,
      buyToken,
      sellAmount: "1000000",
      buyAmount: "990000",
      minBuyAmount: "985050",
      blockNumber: "123",
      zeroExFeeAmount: null,
      zeroExFeeToken: null,
      liquidityAvailable: true,
      sellTokenSymbol: "AAPL",
      buyTokenSymbol: "TSLA",
      sellTokenMultiplier: "1000000",
      buyTokenMultiplier: "1000000",
    },
    status: "quote-only" as const,
    createdAt: new Date().toISOString(),
  };
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({
      choices: [{ message: { content: null, tool_calls: [{
        id: "evm-quote",
        type: "function",
        function: { name: "robinhood_swap_quote", arguments: JSON.stringify({ sellToken, buyToken, sellAmount: "1000000" }) },
      }] } }],
      usage: {},
    });
    return Response.json({ choices: [{ message: { content: "Quote prepared for review." } }], usage: {} });
  };
  const result = await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    prompt: "Quote this EVM swap",
    mode: "mission",
    walletAddress,
    tools: [{ name: "robinhood_swap_quote", description: "quote", parameters: { type: "object" }, execute: async () => proposal }],
  });
  assert.deepEqual(result.evmSwapProposal, proposal);
  assert.deepEqual(result.toolsUsed, ["robinhood_swap_quote"]);
});

test("Pump token intelligence is returned as typed session evidence", { concurrency: false }, async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({
      choices: [{ message: { content: null, tool_calls: [{ id: "pump-tool", type: "function", function: { name: "pump_token_analysis", arguments: JSON.stringify({ mint: "So11111111111111111111111111111111111111112" }) } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });
    return Response.json({ choices: [{ message: { content: "Verified read-only Pump evidence." } }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } });
  };
  const evidence = pumpIntelligenceFixture();
  const result = await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    prompt: "Analyze this exact mint",
    mode: "mission",
    walletAddress: null,
    tools: [{ name: "pump_token_analysis", description: "read", parameters: { type: "object" }, execute: async () => evidence }],
  });
  assert.deepEqual(result.pumpTokenIntelligence, evidence);
  assert.deepEqual(result.toolsUsed, ["pump_token_analysis"]);
});

test("bounded Pump discovery is returned as typed read-only session evidence", { concurrency: false }, async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "scanner", type: "function", function: { name: "pump_recent_candidates", arguments: "{}" } }] } }], usage: {} });
    return Response.json({ choices: [{ message: { content: "No verified candidates were found in this bounded scan." } }], usage: {} });
  };
  const snapshot: PumpDiscoverySnapshot = {
    source: "recent-program-transactions", programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", commitment: "finalized",
      scannedSignatures: 3, observedMints: 0, decodedEvents: 0, cursorSignature: "1".repeat(64), candidates: [], executionAllowed: false,
    disclosure: "Bounded manual finalized scan only.", scannedAt: "2026-07-22T00:00:00.000Z",
  };
  const result = await callOpenRouterChat({
    apiKey: "sk-or-private-value", model: "vendor/safe", prompt: "Scan now", mode: "mission", walletAddress: null,
    tools: [{ name: "pump_recent_candidates", description: "read", parameters: { type: "object" }, execute: async () => snapshot }],
  });
  assert.deepEqual(result.pumpDiscoverySnapshot, snapshot);
  assert.deepEqual(result.toolsUsed, ["pump_recent_candidates"]);
});

test("chat places bounded persisted session history before the current prompt", { concurrency: false }, async () => {
  let body: { messages?: Array<{ role?: string; content?: string }> } = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as typeof body;
    return Response.json({ choices: [{ message: { content: "Context retained." } }], usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 } });
  };
  await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    prompt: "What did we decide?",
    mode: "agent",
    walletAddress: null,
    sessionContext: "Pump.fun proposal-only workspace; exact token mint So11111111111111111111111111111111111111112",
    history: [{ role: "user", text: "Use conservative limits." }, { role: "assistant", text: "I will keep the plan read-only." }],
  });
  assert.deepEqual(body.messages?.slice(1).map((message) => message.role), ["user", "assistant", "user"]);
  assert.equal(body.messages?.[1]?.content, "Use conservative limits.");
  assert.match(body.messages?.[3]?.content ?? "", /What did we decide\?/u);
  assert.match(body.messages?.[3]?.content ?? "", /Pump\.fun proposal-only workspace/u);
  assert.match(body.messages?.[3]?.content ?? "", /So11111111111111111111111111111111111111112/u);
});

test("chat anchors relative deadlines to the exact current UTC time", { concurrency: false }, async () => {
  let body: { messages?: Array<{ content?: string }> } = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as typeof body;
    return Response.json({ choices: [{ message: { content: "Preview prepared." } }], usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 } });
  };
  await callOpenRouterChat({
    apiKey: "sk-or-private-value",
    model: "vendor/safe",
    prompt: "Deadline 30 minutes from now.",
    mode: "mission",
    walletAddress: null,
    currentTime: new Date("2026-07-21T14:30:00.000Z"),
  });
  const system = body.messages?.[0]?.content ?? "";
  assert.match(system, /exact current UTC time for this request is 2026-07-21T14:30:00\.000Z/u);
  assert.match(system, /Resolve relative times such as "30 minutes from now"/u);
  assert.match(system, /Never infer the current date from training data/u);
});

function pumpIntelligenceFixture(): PumpTokenIntelligence {
  return {
    mint: "So11111111111111111111111111111111111111112",
    programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    pumpSwapProgramId: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
    bondingCurveAddress: "11111111111111111111111111111111",
    pumpSwapPoolAddress: "11111111111111111111111111111111",
    venue: "bonding-curve-active", bondingCurveExists: true, accountVerified: true, pumpSwapPoolVerified: false, complete: false,
    virtualTokenReserves: "1000000000", virtualQuoteReserves: "30000000000", realTokenReserves: "700000000", realQuoteReserves: "1000000000", tokenTotalSupply: "1000000000",
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", decimals: 6, mintSupply: "1000000000", mintAuthority: null, freezeAuthority: null, top10ConcentrationPercent: 20,
    poolBaseTokenAccount: null, poolQuoteTokenAccount: null, poolBaseReserves: null, poolQuoteReserves: null, pumpSwapVirtualQuoteReserves: null, pumpSwapEffectiveQuoteReserves: null,
    metrics: { quoteMint: "So11111111111111111111111111111111111111112", quoteSymbol: "SOL", spotPriceQuotePerToken: 30, estimatedMarketCapQuote: 30000, curveProgressPercent: 11.74, quoteReservesUi: 1, referenceBuyInputLamports: "1000000", referenceBuyPriceImpactBps: 0.333, referencePath: { venue: "bonding-curve", buyInputQuoteAmount: "1000000", buyOutputTokenAmount: "35765000", buyPriceImpactBps: 0.333, sellInputTokenAmount: "35765000", sellOutputQuoteAmount: "999998", sellPriceImpactBps: 0.333, roundTripLossBps: 0.02, estimateKind: "reserve-only", networkFeeLamports: null, rentLamports: null, disclosure: "Reserve-only evidence; effective fees and transaction costs require simulation." }, priceImpactNote: "Estimated reserve impact for a 0.001 SOL buy; fees are excluded.", baseProtocolFeeBps: 100, baseCreatorFeeBps: 50, feeNote: "Base configuration only; final fees require simulation." },
    slot: 123, warnings: ["Read-only evidence never authorizes a transaction."], verifiedAt: "2026-07-22T00:00:00.000Z",
  };
}
