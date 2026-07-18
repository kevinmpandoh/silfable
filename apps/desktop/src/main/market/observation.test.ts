import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JupiterShadowQuoteViewSchema, type JupiterShadowQuoteView } from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database";
import { MarketObservationService, priceMicrosForQuote } from "./observation";

const primaryId = "00000000-0000-4000-8000-000000000101";
const historicalId = "00000000-0000-4000-8000-000000000102";

test("market observation derives provenance and volatility without AI or execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-market-observation-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    for (const quote of quotes()) {
      database.insertJupiterShadowQuote({
        id: quote.id,
        encryptedPayload: `encrypted-${quote.id}`,
        payloadNonce: "quote-nonce",
        keyId: "local-data-key-v1",
        allowed: quote.allowed,
        createdAt: quote.observedAt,
      });
    }
    const service = new MarketObservationService({
      database,
      cipher: reversibleCipher,
      quotes: { list: async () => quotes() },
      now: () => new Date("2026-07-18T00:00:05.000Z"),
    });

    const observation = await service.create(primaryId);
    assert.equal(observation.market.priceMicros, "150000000");
    assert.equal(observation.market.volatility.status, "available");
    assert.equal(observation.market.volatility.sampleCount, 2);
    assert.equal(observation.market.volatility.rangeBps, 67);
    assert.equal(observation.walletContext.reason, "mainnet-wallet-not-configured");
    assert.equal(observation.provenance.sourceSlot, null);
    assert.equal(observation.provenance.sourceBlock, null);
    assert.equal(observation.modelCallsAttempted, false);
    assert.equal(observation.signingAttempted, false);
    assert.equal(observation.executionAttempted, false);
    assert.equal(database.listMarketObservations()[0]?.encryptedPayload.includes(primaryId), false);

    const listedFresh = await service.list();
    assert.equal(listedFresh[0]?.freshnessStatus, "fresh");
    const staleService = new MarketObservationService({
      database,
      cipher: reversibleCipher,
      quotes: { list: async () => quotes() },
      now: () => new Date("2026-07-18T00:00:11.000Z"),
    });
    assert.equal((await staleService.list())[0]?.freshnessStatus, "stale");
    await assert.rejects(() => staleService.create(primaryId), /stale or temporally invalid/u);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("market observation rejects denied quotes and normalizes reverse prices", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-market-observation-denied-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    const denied = quote({ id: primaryId, allowed: false, denialCodes: ["fee-exceeded"] });
    database.insertJupiterShadowQuote({
      id: denied.id,
      encryptedPayload: "encrypted-quote",
      payloadNonce: "quote-nonce",
      keyId: "local-data-key-v1",
      allowed: false,
      createdAt: denied.observedAt,
    });
    const service = new MarketObservationService({
      database,
      cipher: reversibleCipher,
      quotes: { list: async () => [denied] },
      now: () => new Date("2026-07-18T00:00:05.000Z"),
    });
    await assert.rejects(() => service.create(denied.id), /Denied quote/u);
    assert.equal(database.listMarketObservations().length, 0);
    assert.equal(priceMicrosForQuote(quote({
      direction: "usdc-to-sol",
      inAmount: "150000000",
      outAmount: "1000000000",
    })), 150000000n);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const reversibleCipher = {
  async encryptString(plaintext: string) {
    return {
      ciphertext: Buffer.from(plaintext, "utf8").toString("base64"),
      nonce: "test-nonce",
      keyId: "local-data-key-v1" as const,
    };
  },
  async decryptString(input: { ciphertext: string }) {
    return Buffer.from(input.ciphertext, "base64").toString("utf8");
  },
};

function quotes(): JupiterShadowQuoteView[] {
  return [
    quote({ id: primaryId, outAmount: "150000000", observedAt: "2026-07-18T00:00:00.000Z" }),
    quote({ id: historicalId, outAmount: "149000000", observedAt: "2026-07-17T23:59:00.000Z", expiresAt: "2026-07-17T23:59:10.000Z" }),
  ];
}

function quote(overrides: Partial<JupiterShadowQuoteView> = {}): JupiterShadowQuoteView {
  return JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: primaryId,
    profile: "mainnet-shadow",
    direction: "sol-to-usdc",
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    inAmount: "1000000000",
    outAmount: "150000000",
    otherAmountThreshold: "149000000",
    slippageBps: 50,
    priceImpactBps: 25,
    feeBps: 10,
    router: "metis",
    routeLabels: ["Raydium"],
    allowed: true,
    denialCodes: [],
    transactionReturned: false,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-18T00:00:10.000Z",
    ...overrides,
  });
}
