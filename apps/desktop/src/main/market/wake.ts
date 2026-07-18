import { randomUUID } from "node:crypto";

import {
  JupiterShadowQuoteRequestSchema,
  MarketCreateWatchRequestSchema,
  MarketWakeReceiptViewSchema,
  MarketWatchViewSchema,
  type JupiterShadowQuoteRequest,
  type JupiterShadowQuoteView,
  type MarketCreateWatchRequest,
  type MarketObservationView,
  type MarketWakeReceiptView,
  type MarketWatchView,
} from "@silfable/contracts";

import {
  RuntimeDatabase,
  type MarketWakeReceiptStorageRecord,
  type MarketWatchStorageRecord,
} from "../storage/database.js";

type WakeCipher = {
  encryptString(plaintext: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};

type ScheduledQuoteSource = {
  isConfigured(): Promise<boolean>;
  quote(request: JupiterShadowQuoteRequest): Promise<JupiterShadowQuoteView>;
};

type ObservationSource = {
  create(quoteId: string): Promise<MarketObservationView>;
};

type WakeConfig = {
  schemaVersion: 1;
  id: string;
  direction: MarketCreateWatchRequest["direction"];
  condition: MarketCreateWatchRequest["condition"];
  thresholdPriceMicros: string;
  maxPriceImpactBps: number;
  intervalSeconds: number;
  fixedProbeAmountAtomic: string;
  createdAt: string;
};

export class MarketWakeScheduler {
  readonly #database: RuntimeDatabase;
  readonly #cipher: WakeCipher;
  readonly #quotes: ScheduledQuoteSource;
  readonly #observations: ObservationSource;
  readonly #now: () => Date;
  readonly #onTriggered: (watch: MarketWatchView, receipt: MarketWakeReceiptView) => void;
  #timer: ReturnType<typeof setInterval> | null = null;
  #ticking = false;
  #generation = 0;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: WakeCipher;
    quotes: ScheduledQuoteSource;
    observations: ObservationSource;
    now?: () => Date;
    onTriggered?: (watch: MarketWatchView, receipt: MarketWakeReceiptView) => void;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#quotes = input.quotes;
    this.#observations = input.observations;
    this.#now = input.now ?? (() => new Date());
    this.#onTriggered = input.onTriggered ?? (() => undefined);
  }

  async create(untrustedRequest: MarketCreateWatchRequest): Promise<MarketWatchView> {
    const request = MarketCreateWatchRequestSchema.parse(untrustedRequest);
    if (!(await this.#quotes.isConfigured())) throw new Error("Jupiter API key is required for background market data");
    const now = this.#now().toISOString();
    const config: WakeConfig = {
      schemaVersion: 1,
      id: randomUUID(),
      direction: request.direction,
      condition: request.condition,
      thresholdPriceMicros: request.thresholdPriceMicros,
      maxPriceImpactBps: request.maxPriceImpactBps,
      intervalSeconds: request.intervalSeconds,
      fixedProbeAmountAtomic: fixedProbeAmount(request.direction),
      createdAt: now,
    };
    const envelope = await this.#cipher.encryptString(JSON.stringify(config));
    const record: MarketWatchStorageRecord = {
      id: config.id,
      state: "active",
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      nextCheckAt: now,
      lastCheckedAt: null,
      triggeredAt: null,
      pausedAt: null,
      lastObservationId: null,
      consecutiveFailures: 0,
      modelCallsAttempted: false,
      executionEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    this.#database.insertMarketWatch(record);
    return this.#hydrateWatch(record);
  }

  async pause(id: string): Promise<MarketWatchView> {
    return this.#hydrateWatch(this.#database.pauseMarketWatch(id, this.#now().toISOString()));
  }

  async list(): Promise<{ watches: MarketWatchView[]; wakeReceipts: MarketWakeReceiptView[] }> {
    return {
      watches: await Promise.all(this.#database.listMarketWatches().map((record) => this.#hydrateWatch(record))),
      wakeReceipts: await Promise.all(this.#database.listMarketWakeReceipts().map((record) => this.#hydrateReceipt(record))),
    };
  }

  start(): void {
    if (this.#timer !== null) return;
    this.#timer = setInterval(() => void this.tick(), 5_000);
    void this.tick();
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
    this.#generation += 1;
  }

  async tick(): Promise<void> {
    if (this.#ticking) return;
    this.#ticking = true;
    const generation = this.#generation;
    try {
      const checkedAt = this.#now();
      const record = this.#database.getDueMarketWatch(checkedAt.toISOString());
      if (record === null) return;
      const watch = await this.#hydrateWatch(record);
      try {
        const quote = await this.#quotes.quote(JupiterShadowQuoteRequestSchema.parse({
          schemaVersion: 1,
          requestId: randomUUID(),
          direction: watch.direction,
          amountAtomic: watch.fixedProbeAmountAtomic,
          slippageBps: 50,
          maxPriceImpactBps: 10_000,
          maxFeeBps: 10_000,
          acknowledgedQuoteOnly: true,
        }));
        if (generation !== this.#generation) return;
        const observation = await this.#observations.create(quote.id);
        if (generation !== this.#generation) return;
        if (this.#database.getMarketWatch(watch.id)?.state !== "active") return;
        const triggered = evaluateWake(watch, observation);
        const receipt = await this.#makeReceipt({
          watchId: watch.id,
          observationId: observation.id,
          outcome: triggered ? "triggered" : "waiting",
          observedPriceMicros: observation.market.priceMicros,
          priceImpactBps: observation.market.priceImpactBps,
          failureCode: null,
          evaluatedAt: checkedAt.toISOString(),
        });
        const updated = this.#database.recordMarketWake({
          watchId: watch.id,
          state: triggered ? "triggered" : "active",
          nextCheckAt: new Date(checkedAt.getTime() + watch.intervalSeconds * 1_000).toISOString(),
          checkedAt: checkedAt.toISOString(),
          triggeredAt: triggered ? checkedAt.toISOString() : null,
          pausedAt: null,
          observationId: observation.id,
          consecutiveFailures: 0,
          receipt: receipt.storage,
        });
        if (triggered) this.#onTriggered(await this.#hydrateWatch(updated), receipt.view);
      } catch (error) {
        if (generation !== this.#generation) return;
        if (this.#database.getMarketWatch(watch.id)?.state !== "active") return;
        const failures = Math.min(5, record.consecutiveFailures + 1);
        const paused = failures >= 5;
        const receipt = await this.#makeReceipt({
          watchId: watch.id,
          observationId: null,
          outcome: "failed",
          observedPriceMicros: null,
          priceImpactBps: null,
          failureCode: error instanceof Error && /observation|Denied quote|stale/u.test(error.message)
            ? "observation-rejected"
            : "quote-unavailable",
          evaluatedAt: checkedAt.toISOString(),
        });
        this.#database.recordMarketWake({
          watchId: watch.id,
          state: paused ? "paused" : "active",
          nextCheckAt: new Date(checkedAt.getTime() + watch.intervalSeconds * 1_000).toISOString(),
          checkedAt: checkedAt.toISOString(),
          triggeredAt: null,
          pausedAt: paused ? checkedAt.toISOString() : null,
          observationId: null,
          consecutiveFailures: failures,
          receipt: receipt.storage,
        });
      }
    } finally {
      this.#ticking = false;
    }
  }

  async #hydrateWatch(record: MarketWatchStorageRecord): Promise<MarketWatchView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Market watch key is unsupported");
    const config = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as Partial<WakeConfig>;
    return MarketWatchViewSchema.parse({
      ...config,
      state: record.state,
      nextCheckAt: record.nextCheckAt,
      lastCheckedAt: record.lastCheckedAt,
      triggeredAt: record.triggeredAt,
      pausedAt: record.pausedAt,
      lastObservationId: record.lastObservationId,
      consecutiveFailures: record.consecutiveFailures,
      modelCallsAttempted: false,
      executionEnabled: false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async #makeReceipt(input: Omit<MarketWakeReceiptView, "schemaVersion" | "id" | "modelCallsAttempted" | "signingAttempted" | "executionAttempted">) {
    const view = MarketWakeReceiptViewSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      ...input,
      modelCallsAttempted: false,
      signingAttempted: false,
      executionAttempted: false,
    });
    const envelope = await this.#cipher.encryptString(JSON.stringify(view));
    const storage: MarketWakeReceiptStorageRecord = {
      id: view.id,
      watchId: view.watchId,
      observationId: view.observationId,
      outcome: view.outcome,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      evaluatedAt: view.evaluatedAt,
      modelCallsAttempted: false,
      signingAttempted: false,
      executionAttempted: false,
    };
    return { view, storage };
  }

  async #hydrateReceipt(record: MarketWakeReceiptStorageRecord): Promise<MarketWakeReceiptView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Market wake receipt key is unsupported");
    const view = MarketWakeReceiptViewSchema.parse(JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as unknown);
    if (
      view.id !== record.id || view.watchId !== record.watchId
      || view.observationId !== record.observationId || view.outcome !== record.outcome
      || view.evaluatedAt !== record.evaluatedAt
    ) throw new Error("Market wake receipt metadata mismatch");
    return view;
  }
}

export function evaluateWake(watch: MarketWatchView, observation: MarketObservationView): boolean {
  if (observation.freshnessStatus !== "fresh") return false;
  if (observation.market.priceImpactBps > watch.maxPriceImpactBps) return false;
  const price = BigInt(observation.market.priceMicros);
  const threshold = BigInt(watch.thresholdPriceMicros);
  return watch.condition === "price-at-or-below" ? price <= threshold : price >= threshold;
}

function fixedProbeAmount(direction: MarketCreateWatchRequest["direction"]): string {
  return direction === "sol-to-usdc" ? "100000000" : "10000000";
}
