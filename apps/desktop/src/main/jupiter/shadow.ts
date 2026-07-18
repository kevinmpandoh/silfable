import {
  JupiterOrderQuoteSchema,
  JupiterShadowQuoteRequestSchema,
  JupiterShadowQuoteViewSchema,
  type JupiterOrderQuote,
  type JupiterShadowDenialCode,
  type JupiterShadowQuoteRequest,
  type JupiterShadowQuoteView,
} from "@silfable/contracts";
import { randomUUID } from "node:crypto";

import { RuntimeDatabase } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import type { SecretName } from "../storage/keystore.js";

export const JUPITER_ORDER_ENDPOINT = "https://api.jup.ag/swap/v2/order" as const;
export const MAINNET_MINTS = {
  sol: "So11111111111111111111111111111111111111112",
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

type SecretStore = {
  getSecret(name: SecretName): Promise<string | null>;
  setSecret(name: SecretName, plaintext: string): Promise<void>;
  deleteSecret(name: SecretName): Promise<void>;
};

export type JupiterQuoteTransport = (input: {
  apiKey: string;
  inputMint: string;
  outputMint: string;
  amountAtomic: string;
  slippageBps: number;
}) => Promise<JupiterOrderQuote>;

export const fetchJupiterOrderQuote: JupiterQuoteTransport = async (input) => {
  const url = new URL(JUPITER_ORDER_ENDPOINT);
  url.searchParams.set("inputMint", input.inputMint);
  url.searchParams.set("outputMint", input.outputMint);
  url.searchParams.set("amount", input.amountAtomic);
  url.searchParams.set("swapMode", "ExactIn");
  url.searchParams.set("slippageBps", String(input.slippageBps));
  const response = await fetch(url, {
    headers: { "x-api-key": input.apiKey },
    signal: AbortSignal.timeout(8_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`Jupiter quote failed with status ${response.status}`);
  return JupiterOrderQuoteSchema.parse(body);
};

export class JupiterShadowService {
  readonly #keystore: SecretStore;
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #transport: JupiterQuoteTransport;

  constructor(input: {
    keystore: SecretStore;
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    transport?: JupiterQuoteTransport;
  }) {
    this.#keystore = input.keystore;
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#transport = input.transport ?? fetchJupiterOrderQuote;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.#keystore.getSecret("jupiter-api-key")) !== null;
  }

  async saveKey(apiKey: string): Promise<void> {
    await this.#keystore.setSecret("jupiter-api-key", apiKey);
  }

  async deleteKey(): Promise<void> {
    await this.#keystore.deleteSecret("jupiter-api-key");
  }

  async quote(untrustedRequest: JupiterShadowQuoteRequest): Promise<JupiterShadowQuoteView> {
    const request = JupiterShadowQuoteRequestSchema.parse(untrustedRequest);
    const apiKey = await this.#keystore.getSecret("jupiter-api-key");
    if (apiKey === null) throw new Error("Jupiter API key is not configured");
    const pair = mintsForDirection(request.direction);
    const raw = await this.#transport({
      apiKey,
      inputMint: pair.inputMint,
      outputMint: pair.outputMint,
      amountAtomic: request.amountAtomic,
      slippageBps: request.slippageBps,
    });
    const quote = validateShadowQuote(request, raw);
    const envelope = await this.#cipher.encryptString(JSON.stringify(quote));
    this.#database.insertJupiterShadowQuote({
      id: quote.id,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      allowed: quote.allowed,
      createdAt: quote.observedAt,
    });
    return quote;
  }

  async list(): Promise<JupiterShadowQuoteView[]> {
    return Promise.all(
      this.#database.listJupiterShadowQuotes(20).map(async (record) => {
        if (record.keyId !== "local-data-key-v1") throw new Error("Shadow quote key is unsupported");
        return JupiterShadowQuoteViewSchema.parse(
          JSON.parse(
            await this.#cipher.decryptString({
              ciphertext: record.encryptedPayload,
              nonce: record.payloadNonce,
              keyId: record.keyId,
            }),
          ) as unknown,
        );
      }),
    );
  }
}

export function validateShadowQuote(
  untrustedRequest: JupiterShadowQuoteRequest,
  untrustedQuote: JupiterOrderQuote,
  now = new Date(),
): JupiterShadowQuoteView {
  const request = JupiterShadowQuoteRequestSchema.parse(untrustedRequest);
  const quote = JupiterOrderQuoteSchema.parse(untrustedQuote);
  const pair = mintsForDirection(request.direction);
  const denialCodes: JupiterShadowDenialCode[] = [];
  if (quote.inputMint !== pair.inputMint || quote.outputMint !== pair.outputMint) denialCodes.push("mint-mismatch");
  if (quote.inAmount !== request.amountAtomic) denialCodes.push("amount-mismatch");
  if (quote.swapMode !== "ExactIn") denialCodes.push("swap-mode-invalid");
  if (quote.transaction !== null) denialCodes.push("transaction-returned");
  if (quote.routePlan.length === 0) denialCodes.push("route-empty");
  if (!hasCompleteRouteAllocation(quote)) denialCodes.push("route-allocation-invalid");
  if (quote.slippageBps > request.slippageBps) denialCodes.push("slippage-exceeded");
  const priceImpactBps = Math.min(10_000, Math.ceil(Math.abs(quote.priceImpact) * 10_000));
  if (priceImpactBps > request.maxPriceImpactBps) denialCodes.push("price-impact-exceeded");
  if (quote.feeBps > request.maxFeeBps) denialCodes.push("fee-exceeded");
  if (BigInt(quote.outAmount) <= 0n || BigInt(quote.otherAmountThreshold) <= 0n || BigInt(quote.otherAmountThreshold) > BigInt(quote.outAmount)) {
    denialCodes.push("amount-threshold-invalid");
  }
  return JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    profile: "mainnet-shadow",
    direction: request.direction,
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    otherAmountThreshold: quote.otherAmountThreshold,
    slippageBps: quote.slippageBps,
    priceImpactBps,
    feeBps: quote.feeBps,
    router: quote.router,
    routeLabels: quote.routePlan.map((route) => route.swapInfo.label),
    allowed: denialCodes.length === 0,
    denialCodes,
    transactionReturned: quote.transaction !== null,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10_000).toISOString(),
  });
}

function mintsForDirection(direction: JupiterShadowQuoteRequest["direction"]) {
  return direction === "sol-to-usdc"
    ? { inputMint: MAINNET_MINTS.sol, outputMint: MAINNET_MINTS.usdc }
    : { inputMint: MAINNET_MINTS.usdc, outputMint: MAINNET_MINTS.sol };
}

function hasCompleteRouteAllocation(quote: JupiterOrderQuote): boolean {
  if (quote.routePlan.length === 0) return false;
  const percents = quote.routePlan.map((route) => route.percent);
  if (percents.every((value) => value !== undefined)) {
    return Math.abs(percents.reduce((sum, value) => sum + (value ?? 0), 0) - 100) < 0.001;
  }
  const bps = quote.routePlan.map((route) => route.bps);
  return bps.every((value) => value !== undefined) && bps.reduce((sum, value) => sum + (value ?? 0), 0) === 10_000;
}
