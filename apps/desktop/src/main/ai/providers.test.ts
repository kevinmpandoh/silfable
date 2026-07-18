import assert from "node:assert/strict";
import { after, test } from "node:test";

import { AgentSessionViewSchema, JupiterShadowQuoteViewSchema, MarketObservationViewSchema } from "@silfable/contracts";

import { callAgentIntentProvider, callAiProvider, callAiShadowTradeProvider } from "./providers.js";

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

test("OpenAI uses Responses structured output with storage and tools disabled", { concurrency: false }, async () => {
  const captures: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    captures.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return Response.json({ status: "completed", output_text: JSON.stringify(intent()) });
  };

  const result = await callAiProvider({
    provider: "openai",
    apiKey: "sk-secret-value",
    model: "gpt-5.6-luna",
    prompt: "Create a conservative plan",
  });

  assert.equal(result.maxCycles, 30);
  const captured = captures[0];
  assert.ok(captured);
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(String(captured.init?.body)) as {
    store: boolean;
    tools?: unknown;
    text: { format: { type: string; strict: boolean } };
  };
  assert.equal(body.store, false);
  assert.equal(body.tools, undefined);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(String(captured.init?.body).includes("sk-secret-value"), false);
});

test("Anthropic uses Messages structured output without tools", { concurrency: false }, async () => {
  const captures: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    captures.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(intent()) }] });
  };

  await callAiProvider({
    provider: "anthropic",
    apiKey: "sk-ant-secret-value",
    model: "claude-haiku-4-5-20251001",
    prompt: "Create a conservative plan",
  });

  const captured = captures[0];
  assert.ok(captured);
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  const body = JSON.parse(String(captured.init?.body)) as {
    tools?: unknown;
    output_config: { format: { type: string } };
  };
  assert.equal(body.tools, undefined);
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(String(captured.init?.body).includes("sk-ant-secret-value"), false);
});

test("shadow trade provider sends a sanitized quote and no tools", { concurrency: false }, async () => {
  const captures: Array<{ url: string; init?: RequestInit }> = [];
  const quote = shadowQuote();
  globalThis.fetch = async (input, init) => {
    captures.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return Response.json({
      status: "completed",
      output_text: JSON.stringify({
        schemaVersion: 1,
        intentType: "shadow-trade-proposal",
        quoteId: quote.id,
        action: "hold",
        direction: quote.direction,
        inAmount: quote.inAmount,
        confidenceBps: 4_000,
        rationale: "The quote is too short-lived for the objective.",
        riskFlags: ["Quote freshness"],
      }),
    });
  };

  await callAiShadowTradeProvider({
    provider: "openai",
    apiKey: "sk-secret-value",
    model: "gpt-5.6-luna",
    objective: "Preserve capital unless the observed route is compelling",
    quote,
  });

  const bodyText = String(captures[0]?.init?.body);
  const body = JSON.parse(bodyText) as { tools?: unknown; input: Array<{ content: string }> };
  assert.equal(body.tools, undefined);
  assert.equal(bodyText.includes(quote.id), true);
  assert.equal(bodyText.includes(quote.inputMint), false);
  assert.equal(bodyText.includes("sk-secret-value"), false);
});

test("restricted agent provider receives policy and sanitized observation without wallet or mint data", { concurrency: false }, async () => {
  const captures: Array<{ init?: RequestInit }> = [];
  const quote = shadowQuote();
  const session = agentSession();
  const observation = agentObservation(quote.id);
  globalThis.fetch = async (_input, init) => {
    captures.push({ ...(init === undefined ? {} : { init }) });
    return Response.json({
      status: "completed",
      output_text: JSON.stringify({
        schemaVersion: 1,
        intentType: "restricted-agent-intent",
        sessionId: session.id,
        observationId: observation.id,
        quoteId: quote.id,
        action: "sell-sol",
        notionalUsdcMicros: quote.outAmount,
        confidenceBps: 7_000,
        rationale: "The supplied route fits the bounded session.",
        riskFlags: ["Per-action approval required"],
      }),
    });
  };
  await callAgentIntentProvider({
    provider: "openai",
    apiKey: "sk-secret-value",
    model: "gpt-5.6-luna",
    session,
    observation,
    quote,
  });
  const bodyText = String(captures[0]?.init?.body);
  const body = JSON.parse(bodyText) as { tools?: unknown };
  assert.equal(body.tools, undefined);
  assert.equal(bodyText.includes(session.objective), true);
  assert.equal(bodyText.includes(observation.id), true);
  assert.equal(bodyText.includes(quote.inputMint), false);
  assert.equal(bodyText.includes("mainnet-wallet-not-configured"), false);
  assert.equal(bodyText.includes("sk-secret-value"), false);
});

function intent() {
  return {
    schemaVersion: 1,
    intentType: "auto-dca-draft",
    amountPerCycleSol: "0.05",
    intervalHours: 6,
    maxCycles: 30,
    dailyLimitSol: "0.2",
    minimumWalletReserveSol: "0.5",
    maxSlippageBps: 100,
    maxPriceImpactBps: 50,
    rationale: "A conservative draft for human review.",
    assumptions: ["Devnet simulation only"],
  };
}

function shadowQuote() {
  return JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: "1b74b2c6-75d1-4fcb-8b37-bff4a95534a8",
    profile: "mainnet-shadow",
    direction: "sol-to-usdc",
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    inAmount: "100000000",
    outAmount: "15000000",
    otherAmountThreshold: "14900000",
    slippageBps: 100,
    priceImpactBps: 20,
    feeBps: 10,
    router: "metis",
    routeLabels: ["Orca"],
    allowed: true,
    denialCodes: [],
    transactionReturned: false,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-18T00:00:10.000Z",
  });
}

function agentSession() {
  return AgentSessionViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000301",
    state: "active",
    provider: "openai",
    objective: "Protect capital with conservative SOL observations only.",
    venue: "jupiter-swap-v2",
    maxActionNotionalUsdcMicros: "20000000",
    maxPriceImpactBps: 50,
    maxVolatilityBps: 100,
    deadlineAt: "2026-07-18T01:00:00.000Z",
    haltedAt: null,
    haltReason: null,
    executionEnabled: false,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  });
}

function agentObservation(quoteId: string) {
  return MarketObservationViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000302",
    profile: "mainnet-shadow",
    pair: "SOL/USDC",
    primaryQuoteId: quoteId,
    market: {
      priceMicros: "150000000",
      priceImpactBps: 20,
      feeBps: 10,
      routeCount: 1,
      liquidityProxy: "healthy",
      volatility: { status: "available", sampleCount: 2, windowSeconds: 60, rangeBps: 20 },
    },
    walletContext: { status: "unavailable", reason: "mainnet-wallet-not-configured" },
    provenance: {
      provider: "jupiter-swap-v2",
      sourceQuoteIds: [quoteId],
      sourceSlot: null,
      sourceBlock: null,
      observedAt: "2026-07-18T00:00:00.000Z",
      capturedAt: "2026-07-18T00:00:01.000Z",
      freshnessBudgetSeconds: 10,
      expiresAt: "2026-07-18T00:00:10.000Z",
    },
    freshnessStatus: "fresh",
    observationDigest: "a".repeat(64),
    modelCallsAttempted: false,
    signingAttempted: false,
    executionAttempted: false,
  });
}
