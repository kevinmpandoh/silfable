import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { JupiterOrderQuote, JupiterShadowQuoteRequest } from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import {
  fetchJupiterOrderQuote,
  JupiterShadowService,
  MAINNET_MINTS,
  validateShadowQuote,
} from "./shadow";

const request: JupiterShadowQuoteRequest = {
  schemaVersion: 1,
  requestId: "00000000-0000-4000-8000-000000000001",
  direction: "sol-to-usdc",
  amountAtomic: "100000000",
  slippageBps: 50,
  maxPriceImpactBps: 100,
  maxFeeBps: 50,
  acknowledgedQuoteOnly: true,
};

const validQuote: JupiterOrderQuote = {
  mode: "quote",
  inputMint: MAINNET_MINTS.sol,
  outputMint: MAINNET_MINTS.usdc,
  inAmount: request.amountAtomic,
  outAmount: "15000000",
  otherAmountThreshold: "14925000",
  swapMode: "ExactIn",
  slippageBps: 50,
  priceImpact: 0.001,
  feeBps: 5,
  router: "metis",
  transaction: null,
  routePlan: [{ swapInfo: { label: "Raydium CLMM" }, percent: 100 }],
};

test("a bounded quote is observable but can never sign or broadcast", () => {
  const quote = validateShadowQuote(request, validQuote, new Date("2026-07-17T00:00:00.000Z"));
  assert.equal(quote.allowed, true);
  assert.deepEqual(quote.denialCodes, []);
  assert.equal(quote.transactionReturned, false);
  assert.equal(quote.signingAttempted, false);
  assert.equal(quote.broadcastAttempted, false);
  assert.equal(quote.expiresAt, "2026-07-17T00:00:10.000Z");
});

test("untrusted transaction and risk violations are denied", () => {
  const quote = validateShadowQuote(request, {
    ...validQuote,
    transaction: "base64-transaction-must-never-be-used",
    priceImpact: 0.02,
    feeBps: 75,
    routePlan: [{ swapInfo: { label: "Bad allocation" }, percent: 90 }],
  });
  assert.equal(quote.allowed, false);
  assert.ok(quote.denialCodes.includes("transaction-returned"));
  assert.ok(quote.denialCodes.includes("price-impact-exceeded"));
  assert.ok(quote.denialCodes.includes("fee-exceeded"));
  assert.ok(quote.denialCodes.includes("route-allocation-invalid"));
  assert.equal(quote.signingAttempted, false);
  assert.equal(quote.broadcastAttempted, false);
});

test("transport omits taker and keeps the API key out of the URL", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, "https://api.jup.ag/swap/v2/order");
    assert.equal(url.searchParams.get("taker"), null);
    assert.equal(url.searchParams.get("swapMode"), "ExactIn");
    assert.equal(url.searchParams.get("amount"), request.amountAtomic);
    assert.equal(url.toString().includes("jupiter-secret"), false);
    assert.equal(new Headers(init?.headers).get("x-api-key"), "jupiter-secret");
    return new Response(JSON.stringify(validQuote), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const quote = await fetchJupiterOrderQuote({
      apiKey: "jupiter-secret",
      inputMint: MAINNET_MINTS.sol,
      outputMint: MAINNET_MINTS.usdc,
      amountAtomic: request.amountAtomic,
      slippageBps: 50,
    });
    assert.equal(quote.transaction, null);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

class MemorySecretStore {
  readonly secrets = new Map<string, string>();

  async getSecret(name: string) { return this.secrets.get(name) ?? null; }
  async setSecret(name: string, value: string) { this.secrets.set(name, value); }
  async deleteSecret(name: string) { this.secrets.delete(name); }
}

test("API key stays in the keystore and the SQLite journal is encrypted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-jupiter-test-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const keystore = new MemorySecretStore();
  const cipher = new LocalDataCipher(keystore);
  const service = new JupiterShadowService({
    database,
    keystore,
    cipher,
    transport: async (input) => {
      assert.equal(input.apiKey, "jupiter-secret");
      return validQuote;
    },
  });
  try {
    await service.saveKey("jupiter-secret");
    const quote = await service.quote(request);
    const stored = database.listJupiterShadowQuotes(20)[0];
    assert.ok(stored);
    assert.equal(keystore.secrets.get("jupiter-api-key"), "jupiter-secret");
    assert.equal(stored.encryptedPayload.includes(quote.outAmount), false);
    assert.equal(stored.encryptedPayload.includes("Raydium"), false);
    assert.deepEqual((await service.list())[0], quote);
    await service.deleteKey();
    assert.equal(await service.isConfigured(), false);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
