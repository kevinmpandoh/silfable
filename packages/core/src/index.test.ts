import assert from "node:assert/strict";
import test from "node:test";

import {
  AiShadowTradeProposalV1Schema,
  AgentIntentProposalV1Schema,
  AgentSessionViewSchema,
  DcaSimulationRequestSchema,
  JupiterShadowQuoteViewSchema,
  MarketObservationViewSchema,
  type DcaSimulationRequest,
} from "@silfable/contracts";

import { evaluateAgentIntent, evaluateAiShadowTradeProposal, simulateDcaCycle } from "./index";

const now = "2026-07-16T00:00:00.000Z";

function request(overrides?: Partial<DcaSimulationRequest>): DcaSimulationRequest {
  const value = {
    schemaVersion: 1,
    requestId: "d71560f7-9f4f-46fe-83b4-f58459ae351f",
    completedCycles: 0,
    lastSchedulerTickAt: "2026-07-15T23:59:59.000Z",
    now,
    plan: {
      schemaVersion: 1,
      id: "507a3841-48e7-43be-95c6-4b287081dcd7",
      profile: "devnet-simulation",
      inputMint: "11111111111111111111111111111111",
      outputMint: "22222222222222222222222222222222",
      amountPerCycleAtomic: "100",
      intervalSeconds: 3_600,
      startAt: now,
      maxCycles: 3,
      minPrice: "0.5",
      maxPrice: "2",
      maxSlippageBps: 100,
      maxPriceImpactBps: 50,
      maxFeeLamports: "5000",
      dailySpendLimitAtomic: "1000",
      minimumWalletReserveAtomic: "500",
      missedCyclePolicy: "skip",
      failurePolicy: "halt",
    },
    snapshot: {
      observedAt: now,
      quoteExpiresAt: "2026-07-16T00:01:00.000Z",
      networkHealth: "healthy",
      keystoreUnlocked: true,
      globalKillSwitch: false,
      missionKillSwitch: false,
      walletBalanceAtomic: "1000",
      spentTodayAtomic: "0",
      price: "1",
      priceImpactBps: 20,
      feeLamports: "1000",
      inputMintAllowed: true,
      outputMintAllowed: true,
      marketEligible: true,
      simulationSucceeded: true,
    },
    ...overrides,
  };

  return DcaSimulationRequestSchema.parse(value);
}

test("healthy Devnet cycle would execute but never signs", () => {
  const result = simulateDcaCycle(request());
  assert.equal(result.outcome, "would-execute");
  assert.equal(result.signingAttempted, false);
  assert.deepEqual(result.denialCodes, []);
});

test("network loss and locked keystore halt fail-closed", () => {
  const base = request();
  const result = simulateDcaCycle(
    request({
      snapshot: { ...base.snapshot, networkHealth: "offline", keystoreUnlocked: false },
    }),
  );
  assert.equal(result.outcome, "halted");
  assert.ok(result.denialCodes.includes("network-unhealthy"));
  assert.ok(result.denialCodes.includes("keystore-locked"));
});

test("daily cap and wallet reserve are enforced with atomic integers", () => {
  const base = request();
  const result = simulateDcaCycle(
    request({
      snapshot: { ...base.snapshot, spentTodayAtomic: "950", walletBalanceAtomic: "550" },
    }),
  );
  assert.equal(result.outcome, "halted");
  assert.ok(result.denialCodes.includes("daily-spend-exceeded"));
  assert.ok(result.denialCodes.includes("wallet-reserve-breached"));
});

test("a cycle missed beyond its interval is skipped, not accumulated", () => {
  const result = simulateDcaCycle(
    request({
      now: "2026-07-16T02:00:01.000Z",
      lastSchedulerTickAt: "2026-07-15T23:59:59.000Z",
    }),
  );
  assert.equal(result.outcome, "skipped");
  assert.equal(result.schedulerAction, "skip");
});

test("a bound AI shadow proposal can only reach would-execute without signing", () => {
  const quote = shadowQuote();
  const proposal = AiShadowTradeProposalV1Schema.parse({
    schemaVersion: 1,
    intentType: "shadow-trade-proposal",
    quoteId: quote.id,
    action: "execute-quoted-swap",
    direction: quote.direction,
    inAmount: quote.inAmount,
    confidenceBps: 7_000,
    rationale: "The observed route fits the stated objective.",
    riskFlags: ["Single short-lived quote"],
  });

  const result = evaluateAiShadowTradeProposal({ proposal, quote, now: new Date(now) });
  assert.equal(result.outcome, "would-execute");
  assert.equal(result.signingAttempted, false);
  assert.equal(result.executionAttempted, false);
  assert.deepEqual(result.denialCodes, []);
});

test("stale or mutated AI shadow proposals fail closed", () => {
  const quote = shadowQuote({ expiresAt: "2026-07-15T23:59:59.000Z" });
  const proposal = AiShadowTradeProposalV1Schema.parse({
    schemaVersion: 1,
    intentType: "shadow-trade-proposal",
    quoteId: quote.id,
    action: "execute-quoted-swap",
    direction: "usdc-to-sol",
    inAmount: quote.inAmount,
    confidenceBps: 9_000,
    rationale: "Attempt to change the observed direction.",
    riskFlags: [],
  });

  const result = evaluateAiShadowTradeProposal({ proposal, quote, now: new Date(now) });
  assert.equal(result.outcome, "blocked");
  assert.ok(result.denialCodes.includes("quote-expired"));
  assert.ok(result.denialCodes.includes("proposal-quote-mismatch"));
});

test("restricted agent buy or sell can only become a pending non-executable intent", () => {
  const quote = shadowQuote();
  const session = agentSession();
  const observation = agentObservation(quote);
  const proposal = AgentIntentProposalV1Schema.parse({
    schemaVersion: 1,
    intentType: "restricted-agent-intent",
    sessionId: session.id,
    observationId: observation.id,
    quoteId: quote.id,
    action: "sell-sol",
    notionalUsdcMicros: quote.outAmount,
    confidenceBps: 7_500,
    rationale: "The bounded sell route fits the session objective.",
    riskFlags: ["Intent only"],
  });
  const result = evaluateAgentIntent({ session, observation, quote, proposal, now: new Date(now) });
  assert.equal(result.outcome, "pending-approval");
  assert.deepEqual(result.denialCodes, []);
  assert.equal(result.signingAttempted, false);
  assert.equal(result.executionAttempted, false);
});

test("restricted agent manipulation and risk violations halt at policy", () => {
  const quote = shadowQuote();
  const session = agentSession({ maxActionNotionalUsdcMicros: "10000000", maxPriceImpactBps: 10 });
  const observation = agentObservation(quote);
  const proposal = AgentIntentProposalV1Schema.parse({
    schemaVersion: 1,
    intentType: "restricted-agent-intent",
    sessionId: session.id,
    observationId: observation.id,
    quoteId: quote.id,
    action: "buy-sol",
    notionalUsdcMicros: "15000000",
    confidenceBps: 9_000,
    rationale: "Attempt to change direction and exceed caps.",
    riskFlags: [],
  });
  const result = evaluateAgentIntent({ session, observation, quote, proposal, now: new Date(now) });
  assert.equal(result.outcome, "blocked");
  assert.ok(result.denialCodes.includes("action-direction-mismatch"));
  assert.ok(result.denialCodes.includes("capital-cap-exceeded"));
  assert.ok(result.denialCodes.includes("price-impact-exceeded"));
});

function shadowQuote(overrides: Record<string, unknown> = {}) {
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
    observedAt: now,
    expiresAt: "2026-07-16T00:01:00.000Z",
    ...overrides,
  });
}

function agentSession(overrides: Record<string, unknown> = {}) {
  return AgentSessionViewSchema.parse({
    schemaVersion: 1,
    id: "3b74b2c6-75d1-4fcb-8b37-bff4a95534a8",
    state: "active",
    provider: "openai",
    objective: "Protect capital and use only conservative SOL/USDC observations.",
    venue: "jupiter-swap-v2",
    maxActionNotionalUsdcMicros: "20000000",
    maxPriceImpactBps: 50,
    maxVolatilityBps: 100,
    deadlineAt: "2026-07-16T01:00:00.000Z",
    haltedAt: null,
    haltReason: null,
    executionEnabled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function agentObservation(quote: ReturnType<typeof shadowQuote>) {
  return MarketObservationViewSchema.parse({
    schemaVersion: 1,
    id: "4b74b2c6-75d1-4fcb-8b37-bff4a95534a8",
    profile: "mainnet-shadow",
    pair: "SOL/USDC",
    primaryQuoteId: quote.id,
    market: {
      priceMicros: "150000000",
      priceImpactBps: quote.priceImpactBps,
      feeBps: quote.feeBps,
      routeCount: 1,
      liquidityProxy: "healthy",
      volatility: { status: "available", sampleCount: 2, windowSeconds: 60, rangeBps: 20 },
    },
    walletContext: { status: "unavailable", reason: "mainnet-wallet-not-configured" },
    provenance: {
      provider: "jupiter-swap-v2",
      sourceQuoteIds: [quote.id],
      sourceSlot: null,
      sourceBlock: null,
      observedAt: now,
      capturedAt: now,
      freshnessBudgetSeconds: 10,
      expiresAt: quote.expiresAt,
    },
    freshnessStatus: "fresh",
    observationDigest: "a".repeat(64),
    modelCallsAttempted: false,
    signingAttempted: false,
    executionAttempted: false,
  });
}
