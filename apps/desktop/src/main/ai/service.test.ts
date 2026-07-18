import assert from "node:assert/strict";
import test from "node:test";

import type { SecretName } from "../storage/keystore.js";
import { JupiterShadowQuoteViewSchema } from "@silfable/contracts";
import { AiDraftService } from "./service.js";

class MemorySecrets {
  readonly values = new Map<SecretName, string>();

  async getSecret(name: SecretName): Promise<string | null> {
    return this.values.get(name) ?? null;
  }

  async setSecret(name: SecretName, plaintext: string): Promise<void> {
    this.values.set(name, plaintext);
  }

  async deleteSecret(name: SecretName): Promise<void> {
    this.values.delete(name);
  }
}

class MemorySettings {
  readonly values = new Map<string, unknown>();

  getSetting(key: string): unknown | null {
    return this.values.get(key) ?? null;
  }

  setSetting(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  deleteSetting(key: string): void {
    this.values.delete(key);
  }
}

test("provider keys remain secret while settings expose configuration status only", async () => {
  const keystore = new MemorySecrets();
  const settings = new MemorySettings();
  let receivedKey = "";
  const service = new AiDraftService({
    keystore,
    settings,
    transport: async (request) => {
      receivedKey = request.apiKey;
      return intent();
    },
  });

  await service.saveProvider("openai", "sk-private-test-value", "gpt-5.6-luna");
  const publicSettings = await service.listSettings();
  assert.deepEqual(publicSettings[0], { provider: "openai", configured: true, model: "gpt-5.6-luna" });
  assert.equal(JSON.stringify(publicSettings).includes("sk-private"), false);

  const draft = await service.draftDca("openai", "Create a conservative DCA plan");
  assert.equal(receivedKey, "sk-private-test-value");
  assert.equal(draft.intent.intentType, "auto-dca-draft");

  await service.deleteProvider("openai");
  assert.equal((await service.listSettings())[0]?.configured, false);
});

test("invalid provider output is rejected before it reaches IPC", async () => {
  const keystore = new MemorySecrets();
  const settings = new MemorySettings();
  const service = new AiDraftService({
    keystore,
    settings,
    transport: async () => ({ ...intent(), intervalHours: 0 }),
  });
  await service.saveProvider("anthropic", "sk-ant-private-test", "claude-haiku-4-5-20251001");
  await assert.rejects(() => service.draftDca("anthropic", "Create a conservative DCA plan"));
});

test("shadow trade proposals receive only the selected sanitized quote", async () => {
  const keystore = new MemorySecrets();
  const settings = new MemorySettings();
  const quote = shadowQuote();
  let receivedQuoteId = "";
  const service = new AiDraftService({
    keystore,
    settings,
    tradeTransport: async (request) => {
      receivedQuoteId = request.quote.id;
      return {
        schemaVersion: 1,
        intentType: "shadow-trade-proposal",
        quoteId: request.quote.id,
        action: "hold",
        direction: request.quote.direction,
        inAmount: request.quote.inAmount,
        confidenceBps: 4_000,
        rationale: "Wait for a stronger observation.",
        riskFlags: ["Quote expires quickly"],
      };
    },
  });
  await service.saveProvider("openai", "sk-private-test-value", "gpt-5.6-luna");

  const result = await service.proposeShadowTrade("openai", "Protect capital unless the route is compelling", quote);
  assert.equal(receivedQuoteId, quote.id);
  assert.equal(result.proposal.action, "hold");
});

function intent() {
  return {
    schemaVersion: 1 as const,
    intentType: "auto-dca-draft" as const,
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
