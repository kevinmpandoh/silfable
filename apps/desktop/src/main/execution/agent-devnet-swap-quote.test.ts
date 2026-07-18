import assert from "node:assert/strict";
import test from "node:test";

import type { AgentIntentEvaluationView } from "@silfable/contracts";

import { AgentDevnetSwapQuoteService, DEVNET_SWAP_MINTS, RAYDIUM_DEVNET_QUOTE_ENDPOINT, fetchRaydiumDevnetQuote, type RaydiumDevnetQuoteTransport } from "./agent-devnet-swap-quote";
import type { AgentDevnetSwapQuoteStorageRecord, RuntimeDatabase } from "../storage/database";

test("Raydium transport uses only the fixed Devnet quote endpoint", async () => {
  const original = globalThis.fetch; let requested = "";
  globalThis.fetch = (async (input) => { requested = String(input); return new Response(JSON.stringify(rawQuote()), { status: 200 }); }) as typeof fetch;
  try {
    const quote = await fetchRaydiumDevnetQuote({ inputMint: DEVNET_SWAP_MINTS.sol, outputMint: DEVNET_SWAP_MINTS.usdc,
      amount: "1000000", slippageBps: 50 });
    const url = new URL(requested); assert.equal(url.origin + url.pathname, RAYDIUM_DEVNET_QUOTE_ENDPOINT);
    assert.equal(url.searchParams.get("txVersion"), "V0"); assert.equal(quote.quote.inputAmount, "1000000");
  } finally { globalThis.fetch = original; }
});

test("approved sell direction creates one encrypted low-value economic quote without building", async () => {
  const database = new FakeDatabase(); const evaluation = evaluationFixture();
  const service = createService(database, () => [evaluation]);
  const quote = await service.quote(evaluation.receipt.id);
  assert.equal(quote.action, "sell-sol"); assert.equal(quote.inputMint, DEVNET_SWAP_MINTS.sol);
  assert.equal(quote.inputAmount, "1000000"); assert.equal(quote.economicValueMapping, "direction-only-capped-devnet");
  assert.equal(quote.allowed, true); assert.equal(quote.transactionBuilt, false); assert.equal(quote.signingAttempted, false);
  assert.ok(database.record); assert.equal(database.record.encryptedPayload.includes(DEVNET_SWAP_MINTS.sol), false);
  await assert.rejects(() => service.quote(evaluation.receipt.id), /already has/u);
});

test("high impact and route mutation are denied, while approval race stores nothing", async () => {
  const deniedDb = new FakeDatabase(); const evaluation = evaluationFixture();
  const denied = await createService(deniedDb, () => [evaluation], async () => ({ rawResponse: rawQuote(), quote: { ...rawQuote().data,
    priceImpactPct: 2, routePlan: [{ poolId: "C4UR6mqrdSzQQow6nJLq2zNMVh2DmMhw4ieanAvegWs6",
      inputMint: DEVNET_SWAP_MINTS.usdc, outputMint: DEVNET_SWAP_MINTS.usdc }] } }))
    .quote(evaluation.receipt.id);
  assert.equal(denied.allowed, false); assert.deepEqual(denied.denialCodes.sort(), ["price-impact-exceeded", "route-invalid"]);

  const raceDb = new FakeDatabase(); let calls = 0;
  const raceService = createService(raceDb, () => [{ ...evaluation,
    approval: { ...evaluation.approval, state: (++calls > 1 ? "rejected" : "approved") as "approved" | "rejected" } }]);
  await assert.rejects(() => raceService.quote(evaluation.receipt.id), /approved/u);
  assert.equal(raceDb.record, null);
});

function createService(database: FakeDatabase, evaluations: () => AgentIntentEvaluationView[],
  transport: RaydiumDevnetQuoteTransport = async () => ({ quote: rawQuote().data, rawResponse: rawQuote() })) {
  return new AgentDevnetSwapQuoteService({ database: database as unknown as RuntimeDatabase, cipher,
    keystore: { isLocked: () => false }, agents: { async list() { return { evaluations: evaluations() }; } },
    transport, now: () => new Date("2026-07-19T00:00:10.000Z") });
}
function rawQuote() { return { success: true, data: { inputMint: DEVNET_SWAP_MINTS.sol, inputAmount: "1000000",
  outputMint: DEVNET_SWAP_MINTS.usdc, outputAmount: "92717", otherAmountThreshold: "92253", slippageBps: 50,
  priceImpactPct: 0.2, routePlan: [{ poolId: "C4UR6mqrdSzQQow6nJLq2zNMVh2DmMhw4ieanAvegWs6",
    inputMint: DEVNET_SWAP_MINTS.sol, outputMint: DEVNET_SWAP_MINTS.usdc }] } }; }
function evaluationFixture(): AgentIntentEvaluationView { return { schemaVersion: 1, provider: "openai", model: "test",
  session: { schemaVersion: 1, id: "00000000-0000-4000-8000-000000000903", state: "active", provider: "openai",
    objective: "Map an approved SOL direction to a fixed low-value Devnet quote.", venue: "jupiter-swap-v2",
    maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100,
    deadlineAt: "2026-07-19T01:00:00.000Z", haltedAt: null, haltReason: null, executionEnabled: false,
    createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" },
  observation: {} as AgentIntentEvaluationView["observation"], quote: {} as AgentIntentEvaluationView["quote"],
  proposal: { schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: "00000000-0000-4000-8000-000000000903",
    observationId: "00000000-0000-4000-8000-000000000902", quoteId: "00000000-0000-4000-8000-000000000900",
    action: "sell-sol", notionalUsdcMicros: "1000000", confidenceBps: 8000, rationale: "Bounded", riskFlags: [] },
  receipt: { schemaVersion: 1, id: "00000000-0000-4000-8000-000000000904", sessionId: "00000000-0000-4000-8000-000000000903",
    observationId: "00000000-0000-4000-8000-000000000902", proposalDigest: "d".repeat(64), outcome: "pending-approval",
    denialCodes: [], evaluatedAt: "2026-07-19T00:00:00.000Z", modelCallsAttempted: true, signingAttempted: false,
    executionAttempted: false, persistedLocally: true }, approval: { state: "approved", expiresAt: "2026-07-19T00:30:00.000Z",
    decidedAt: "2026-07-19T00:00:00.000Z", executionEnabled: false } }; }
class FakeDatabase {
  record: AgentDevnetSwapQuoteStorageRecord | null = null;
  getAgentDevnetSwapQuoteByEvaluation() { return this.record; }
  insertAgentDevnetSwapQuote(record: AgentDevnetSwapQuoteStorageRecord) { this.record = record; }
  listAgentDevnetSwapQuotes() { return this.record === null ? [] : [this.record]; }
}
const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; },
  async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };
