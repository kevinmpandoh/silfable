import { createHash, randomUUID } from "node:crypto";

import {
  MarketObservationViewSchema,
  type JupiterShadowQuoteView,
  type MarketObservationView,
} from "@silfable/contracts";

import { RuntimeDatabase, type MarketObservationStorageRecord } from "../storage/database.js";

type ObservationCipher = {
  encryptString(plaintext: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};

type QuoteSource = {
  list(): Promise<JupiterShadowQuoteView[]>;
};

export class MarketObservationService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: ObservationCipher;
  readonly #quotes: QuoteSource;
  readonly #now: () => Date;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: ObservationCipher;
    quotes: QuoteSource;
    now?: () => Date;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#quotes = input.quotes;
    this.#now = input.now ?? (() => new Date());
  }

  async create(quoteId: string): Promise<MarketObservationView> {
    const now = this.#now();
    const quotes = await this.#quotes.list();
    const primary = quotes.find((quote) => quote.id === quoteId);
    if (primary === undefined) throw new Error("Main-owned market quote does not exist");
    if (!primary.allowed || primary.transactionReturned) throw new Error("Denied quote cannot become an observation");
    if (Date.parse(primary.observedAt) > now.getTime() || Date.parse(primary.expiresAt) <= now.getTime()) {
      throw new Error("Market quote is stale or temporally invalid");
    }

    const samples = quotes
      .filter((quote) => quote.allowed && !quote.transactionReturned)
      .filter((quote) => Date.parse(quote.observedAt) <= now.getTime())
      .filter((quote) => Math.abs(Date.parse(primary.observedAt) - Date.parse(quote.observedAt)) <= 3_600_000)
      .map((quote) => ({ quote, priceMicros: priceMicrosForQuote(quote) }));
    const prices = samples.map((sample) => sample.priceMicros);
    const minimum = prices.reduce((current, value) => value < current ? value : current);
    const maximum = prices.reduce((current, value) => value > current ? value : current);
    const rangeBps = samples.length < 2
      ? null
      : Number(((maximum - minimum) * 10_000n / minimum) > 10_000n
        ? 10_000n
        : (maximum - minimum) * 10_000n / minimum);
    const timestamps = samples.map((sample) => Date.parse(sample.quote.observedAt));
    const body = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      profile: "mainnet-shadow" as const,
      pair: "SOL/USDC" as const,
      primaryQuoteId: primary.id,
      market: {
        priceMicros: priceMicrosForQuote(primary).toString(),
        priceImpactBps: primary.priceImpactBps,
        feeBps: primary.feeBps,
        routeCount: primary.routeLabels.length,
        liquidityProxy: liquidityProxy(primary.priceImpactBps),
        volatility: {
          status: samples.length >= 2 ? "available" as const : "insufficient-data" as const,
          sampleCount: samples.length,
          windowSeconds: Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 1_000),
          rangeBps,
        },
      },
      walletContext: {
        status: "unavailable" as const,
        reason: "mainnet-wallet-not-configured" as const,
      },
      provenance: {
        provider: "jupiter-swap-v2" as const,
        sourceQuoteIds: samples.map((sample) => sample.quote.id),
        sourceSlot: null,
        sourceBlock: null,
        observedAt: primary.observedAt,
        capturedAt: now.toISOString(),
        freshnessBudgetSeconds: 10 as const,
        expiresAt: primary.expiresAt,
      },
      modelCallsAttempted: false as const,
      signingAttempted: false as const,
      executionAttempted: false as const,
    };
    const plaintext = JSON.stringify(body);
    const observationDigest = sha256(plaintext);
    const envelope = await this.#cipher.encryptString(plaintext);
    this.#database.insertMarketObservation({
      id: body.id,
      sourceQuoteId: body.primaryQuoteId,
      observationDigest,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      observedAt: body.provenance.observedAt,
      capturedAt: body.provenance.capturedAt,
      expiresAt: body.provenance.expiresAt,
      modelCallsAttempted: false,
      signingAttempted: false,
      executionAttempted: false,
    });
    return MarketObservationViewSchema.parse({
      ...body,
      freshnessStatus: "fresh",
      observationDigest,
    });
  }

  async list(): Promise<MarketObservationView[]> {
    const now = this.#now().getTime();
    return Promise.all(this.#database.listMarketObservations().map(async (record) => this.#hydrate(record, now)));
  }

  async #hydrate(record: MarketObservationStorageRecord, now: number): Promise<MarketObservationView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Market observation key is unsupported");
    const plaintext = await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    });
    if (sha256(plaintext) !== record.observationDigest) throw new Error("Market observation digest mismatch");
    const payload: unknown = JSON.parse(plaintext);
    const observation = MarketObservationViewSchema.parse({
      ...(typeof payload === "object" && payload !== null ? payload : {}),
      freshnessStatus: Date.parse(record.expiresAt) > now ? "fresh" : "stale",
      observationDigest: record.observationDigest,
    });
    if (
      observation.id !== record.id
      || observation.primaryQuoteId !== record.sourceQuoteId
      || observation.provenance.observedAt !== record.observedAt
      || observation.provenance.capturedAt !== record.capturedAt
      || observation.provenance.expiresAt !== record.expiresAt
    ) throw new Error("Market observation metadata mismatch");
    return observation;
  }
}

export function priceMicrosForQuote(quote: JupiterShadowQuoteView): bigint {
  const input = BigInt(quote.inAmount);
  const output = BigInt(quote.outAmount);
  if (input <= 0n || output <= 0n) throw new Error("Market quote amounts must be positive");
  const value = quote.direction === "sol-to-usdc"
    ? output * 1_000_000_000n / input
    : input * 1_000_000_000n / output;
  if (value <= 0n) throw new Error("Market quote price is below supported precision");
  return value;
}

function liquidityProxy(priceImpactBps: number): "healthy" | "caution" | "thin" {
  if (priceImpactBps <= 50) return "healthy";
  if (priceImpactBps <= 200) return "caution";
  return "thin";
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
