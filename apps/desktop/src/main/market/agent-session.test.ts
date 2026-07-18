import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AgentIntentProposalV1Schema,
  JupiterShadowQuoteViewSchema,
  MarketObservationViewSchema,
} from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database";
import { AgentSessionService } from "./agent-session";

test("restricted agent session persists an approvable intent without execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-session-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    const quote = fixtureQuote();
    const observation = fixtureObservation(quote.id);
    seedSources(database, quote.id, observation.id);
    let modelCalls = 0;
    const service = new AgentSessionService({
      database,
      cipher,
      ai: {
        async listSettings() { return providerSettings; },
        async proposeAgentIntent({ session }) {
          modelCalls += 1;
          return {
            model: "test-model",
            proposal: AgentIntentProposalV1Schema.parse({
              schemaVersion: 1,
              intentType: "restricted-agent-intent",
              sessionId: session.id,
              observationId: observation.id,
              quoteId: quote.id,
              action: "sell-sol",
              notionalUsdcMicros: quote.outAmount,
              confidenceBps: 8_000,
              rationale: "Bounded intent from the supplied observation.",
              riskFlags: ["Fresh quote required later"],
            }),
          };
        },
      },
      observations: { async list() { return [observation]; } },
      quotes: { async list() { return [quote]; } },
      now: () => new Date("2026-07-18T00:00:05.000Z"),
    });
    const session = await service.create(createRequest());
    const evaluation = await service.evaluate(session.id, observation.id);
    assert.equal(modelCalls, 1);
    assert.equal(evaluation.receipt.outcome, "pending-approval");
    assert.equal(evaluation.approval.state, "pending");
    assert.equal(evaluation.approval.executionEnabled, false);
    assert.equal(evaluation.receipt.signingAttempted, false);
    assert.equal(evaluation.receipt.executionAttempted, false);

    await assert.rejects(() => service.approve(evaluation.receipt.id, "b".repeat(64)));
    const approved = await service.approve(evaluation.receipt.id, evaluation.receipt.proposalDigest);
    assert.equal(approved.approval.state, "approved");
    const revoked = await service.reject(evaluation.receipt.id, evaluation.receipt.proposalDigest);
    assert.equal(revoked.approval.state, "rejected");
    await assert.rejects(() => service.approve(evaluation.receipt.id, evaluation.receipt.proposalDigest));
    const openIntent = await service.evaluate(session.id, observation.id);
    await service.halt(session.id);
    assert.equal((await service.list()).evaluations.find((item) => item.receipt.id === openIntent.receipt.id)?.approval.state, "expired");
    assert.equal(database.listAgentIntentEvaluations()[0]?.executionAttempted, false);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("AI halt is a safe terminal action and stale observations avoid model calls", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-halt-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    const quote = fixtureQuote();
    const observation = fixtureObservation(quote.id);
    seedSources(database, quote.id, observation.id);
    let modelCalls = 0;
    const service = new AgentSessionService({
      database,
      cipher,
      ai: {
        async listSettings() { return providerSettings; },
        async proposeAgentIntent({ session }) {
          modelCalls += 1;
          return {
            model: "test-model",
            proposal: AgentIntentProposalV1Schema.parse({
              schemaVersion: 1,
              intentType: "restricted-agent-intent",
              sessionId: session.id,
              observationId: observation.id,
              quoteId: quote.id,
              action: "halt",
              notionalUsdcMicros: "0",
              confidenceBps: 9_000,
              rationale: "Stop conservatively.",
              riskFlags: [],
            }),
          };
        },
      },
      observations: { async list() { return [observation]; } },
      quotes: { async list() { return [quote]; } },
      now: () => new Date("2026-07-18T00:00:05.000Z"),
    });
    const session = await service.create(createRequest());
    const evaluation = await service.evaluate(session.id, observation.id);
    assert.equal(evaluation.receipt.outcome, "halted");
    assert.equal(evaluation.session.state, "halted");
    assert.equal(evaluation.session.haltReason, "ai-halt");
    assert.equal(evaluation.approval.state, "not-actionable");
    assert.equal(modelCalls, 1);

    const staleService = new AgentSessionService({
      database,
      cipher,
      ai: {
        async listSettings() { return providerSettings; },
        async proposeAgentIntent() { modelCalls += 1; throw new Error("must not be called"); },
      },
      observations: { async list() { return [{ ...observation, freshnessStatus: "stale" as const }]; } },
      quotes: { async list() { return [quote]; } },
      now: () => new Date("2026-07-18T00:00:05.000Z"),
    });
    const second = await staleService.create(createRequest());
    await assert.rejects(() => staleService.evaluate(second.id, observation.id), /Fresh main-owned/u);
    assert.equal(modelCalls, 1);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("provider latency triggers a second freshness check and blocks a late intent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-late-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    const quote = fixtureQuote();
    const observation = fixtureObservation(quote.id);
    seedSources(database, quote.id, observation.id);
    let now = new Date("2026-07-18T00:00:05.000Z");
    const service = new AgentSessionService({
      database,
      cipher,
      ai: {
        async listSettings() { return providerSettings; },
        async proposeAgentIntent({ session }) {
          now = new Date("2026-07-18T00:00:11.000Z");
          return {
            model: "slow-model",
            proposal: AgentIntentProposalV1Schema.parse({
              schemaVersion: 1,
              intentType: "restricted-agent-intent",
              sessionId: session.id,
              observationId: observation.id,
              quoteId: quote.id,
              action: "sell-sol",
              notionalUsdcMicros: quote.outAmount,
              confidenceBps: 8_000,
              rationale: "This response arrived after quote expiry.",
              riskFlags: [],
            }),
          };
        },
      },
      observations: { async list() { return [observation]; } },
      quotes: { async list() { return [quote]; } },
      now: () => now,
    });
    const session = await service.create(createRequest());
    const evaluation = await service.evaluate(session.id, observation.id);
    assert.equal(evaluation.receipt.outcome, "blocked");
    assert.ok(evaluation.receipt.denialCodes.includes("observation-stale"));
    assert.ok(evaluation.receipt.denialCodes.includes("quote-expired"));
    assert.equal(evaluation.session.haltReason, "policy-denial");
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const providerSettings = [
  { provider: "openai" as const, configured: true, model: "test-model" },
  { provider: "anthropic" as const, configured: false, model: "test-model" },
];

const cipher = {
  async encryptString(plaintext: string) {
    return { ciphertext: Buffer.from(plaintext).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const };
  },
  async decryptString(input: { ciphertext: string }) {
    return Buffer.from(input.ciphertext, "base64").toString("utf8");
  },
};

function createRequest() {
  return {
    schemaVersion: 1 as const,
    requestId: "00000000-0000-4000-8000-000000000201",
    provider: "openai" as const,
    objective: "Protect capital and propose only conservative SOL actions.",
    maxActionNotionalUsdcMicros: "20000000",
    maxPriceImpactBps: 50,
    maxVolatilityBps: 100,
    deadlineAt: "2026-07-18T01:00:00.000Z",
    acknowledgedExternalAiProcessing: true as const,
    acknowledgedPerActionApproval: true as const,
    acknowledgedNoExecution: true as const,
  };
}

function fixtureQuote() {
  return JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000202",
    profile: "mainnet-shadow",
    direction: "sol-to-usdc",
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    inAmount: "100000000",
    outAmount: "15000000",
    otherAmountThreshold: "14900000",
    slippageBps: 50,
    priceImpactBps: 20,
    feeBps: 5,
    router: "metis",
    routeLabels: ["Raydium"],
    allowed: true,
    denialCodes: [],
    transactionReturned: false,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-18T00:00:10.000Z",
  });
}

function fixtureObservation(quoteId: string) {
  return MarketObservationViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000203",
    profile: "mainnet-shadow",
    pair: "SOL/USDC",
    primaryQuoteId: quoteId,
    market: {
      priceMicros: "150000000",
      priceImpactBps: 20,
      feeBps: 5,
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
      capturedAt: "2026-07-18T00:00:05.000Z",
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

function seedSources(database: RuntimeDatabase, quoteId: string, observationId: string): void {
  database.insertJupiterShadowQuote({
    id: quoteId, encryptedPayload: "encrypted-quote", payloadNonce: "nonce",
    keyId: "local-data-key-v1", allowed: true, createdAt: "2026-07-18T00:00:00.000Z",
  });
  database.insertMarketObservation({
    id: observationId, sourceQuoteId: quoteId, observationDigest: "a".repeat(64),
    encryptedPayload: "encrypted-observation", payloadNonce: "nonce", keyId: "local-data-key-v1",
    observedAt: "2026-07-18T00:00:00.000Z", capturedAt: "2026-07-18T00:00:05.000Z",
    expiresAt: "2026-07-18T00:00:10.000Z", modelCallsAttempted: false,
    signingAttempted: false, executionAttempted: false,
  });
}
