import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JupiterShadowQuoteViewSchema, type JupiterShadowQuoteRequest, type JupiterShadowQuoteView } from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database";
import { MarketObservationService } from "./observation";
import { MarketWakeScheduler } from "./wake";

test("scheduled market watch waits, survives scheduler restart, and triggers without AI or execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-market-wake-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    let now = new Date("2026-07-18T00:00:00.000Z");
    let priceMicros = 150_000_000n;
    const quotes: JupiterShadowQuoteView[] = [];
    const quoteSource = {
      async isConfigured() { return true; },
      async quote(request: JupiterShadowQuoteRequest) {
        const quote = makeQuote(request, priceMicros, now);
        quotes.unshift(quote);
        database.insertJupiterShadowQuote({
          id: quote.id,
          encryptedPayload: "encrypted-quote",
          payloadNonce: "quote-nonce",
          keyId: "local-data-key-v1",
          allowed: true,
          createdAt: quote.observedAt,
        });
        return quote;
      },
      async list() { return quotes; },
    };
    const observations = new MarketObservationService({ database, cipher, quotes: quoteSource, now: () => now });
    const scheduler = new MarketWakeScheduler({ database, cipher, quotes: quoteSource, observations, now: () => now });
    const watch = await scheduler.create(createRequest("151000000"));

    const first = scheduler.tick();
    const overlap = scheduler.tick();
    await Promise.all([first, overlap]);
    assert.equal(database.listMarketWakeReceipts().length, 1);
    assert.equal((await scheduler.list()).watches[0]?.state, "active");
    assert.equal((await scheduler.list()).wakeReceipts[0]?.outcome, "waiting");

    now = new Date("2026-07-18T00:01:00.000Z");
    priceMicros = 152_000_000n;
    let triggered = 0;
    const restarted = new MarketWakeScheduler({
      database,
      cipher,
      quotes: quoteSource,
      observations,
      now: () => now,
      onTriggered: () => { triggered += 1; },
    });
    await restarted.tick();
    const result = await restarted.list();
    assert.equal(result.watches.find((candidate) => candidate.id === watch.id)?.state, "triggered");
    assert.equal(result.wakeReceipts[0]?.outcome, "triggered");
    assert.equal(result.wakeReceipts[0]?.modelCallsAttempted, false);
    assert.equal(result.wakeReceipts[0]?.signingAttempted, false);
    assert.equal(result.wakeReceipts[0]?.executionAttempted, false);
    assert.equal(triggered, 1);
    const second = await restarted.create(createRequest("200000000"));
    assert.equal((await restarted.pause(second.id)).state, "paused");
    now = new Date("2026-07-18T00:02:00.000Z");
    await restarted.tick();
    assert.equal(database.listMarketWakeReceipts().length, 2);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("five consecutive quote failures pause a market watch fail-closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-market-wake-failure-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    let now = new Date("2026-07-18T00:00:00.000Z");
    const scheduler = new MarketWakeScheduler({
      database,
      cipher,
      quotes: {
        async isConfigured() { return true; },
        async quote() { throw new Error("network unavailable"); },
      },
      observations: { async create() { throw new Error("must not be reached"); } },
      now: () => now,
    });
    const watch = await scheduler.create(createRequest("151000000"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await scheduler.tick();
      now = new Date(now.getTime() + 60_000);
    }
    const result = await scheduler.list();
    const stored = result.watches.find((candidate) => candidate.id === watch.id);
    assert.equal(stored?.state, "paused");
    assert.equal(stored?.consecutiveFailures, 5);
    assert.equal(result.wakeReceipts.length, 5);
    assert.equal(result.wakeReceipts.every((receipt) => receipt.failureCode === "quote-unavailable"), true);
    await scheduler.tick();
    assert.equal(database.listMarketWakeReceipts().length, 5);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const cipher = {
  async encryptString(plaintext: string) {
    return { ciphertext: Buffer.from(plaintext).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const };
  },
  async decryptString(input: { ciphertext: string }) {
    return Buffer.from(input.ciphertext, "base64").toString("utf8");
  },
};

function createRequest(thresholdPriceMicros: string) {
  return {
    schemaVersion: 1 as const,
    requestId: randomUUID(),
    direction: "sol-to-usdc" as const,
    condition: "price-at-or-above" as const,
    thresholdPriceMicros,
    maxPriceImpactBps: 50,
    intervalSeconds: 60,
    acknowledgedBackgroundMarketData: true as const,
    acknowledgedZeroAiCallsWhileSleeping: true as const,
    acknowledgedNoExecution: true as const,
  };
}

function makeQuote(request: JupiterShadowQuoteRequest, priceMicros: bigint, now: Date): JupiterShadowQuoteView {
  const input = BigInt(request.amountAtomic);
  const output = request.direction === "sol-to-usdc"
    ? input * priceMicros / 1_000_000_000n
    : input * 1_000_000_000n / priceMicros;
  return JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    profile: "mainnet-shadow",
    direction: request.direction,
    inputMint: request.direction === "sol-to-usdc"
      ? "So11111111111111111111111111111111111111112"
      : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    outputMint: request.direction === "sol-to-usdc"
      ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      : "So11111111111111111111111111111111111111112",
    inAmount: request.amountAtomic,
    outAmount: output.toString(),
    otherAmountThreshold: output.toString(),
    slippageBps: 50,
    priceImpactBps: 10,
    feeBps: 5,
    router: "metis",
    routeLabels: ["Raydium"],
    allowed: true,
    denialCodes: [],
    transactionReturned: false,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10_000).toISOString(),
  });
}
