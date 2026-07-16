import assert from "node:assert/strict";
import { after, test } from "node:test";

import { callAiProvider } from "./providers.js";

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

test("OpenAI uses Responses structured output with storage and tools disabled", { concurrency: false }, async () => {
  const captures: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    captures.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return Response.json({ status: "completed", output_text: JSON.stringify(intent()) });
  };

  const result = await callAiProvider({
    provider: "openai",
    apiKey: "sk-secret-value",
    model: "gpt-5.6-luna",
    prompt: "Create a conservative plan",
  });

  assert.equal(result.maxCycles, 30);
  const captured = captures[0];
  assert.ok(captured);
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(String(captured.init?.body)) as {
    store: boolean;
    tools?: unknown;
    text: { format: { type: string; strict: boolean } };
  };
  assert.equal(body.store, false);
  assert.equal(body.tools, undefined);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(String(captured.init?.body).includes("sk-secret-value"), false);
});

test("Anthropic uses Messages structured output without tools", { concurrency: false }, async () => {
  const captures: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    captures.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(intent()) }] });
  };

  await callAiProvider({
    provider: "anthropic",
    apiKey: "sk-ant-secret-value",
    model: "claude-haiku-4-5-20251001",
    prompt: "Create a conservative plan",
  });

  const captured = captures[0];
  assert.ok(captured);
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  const body = JSON.parse(String(captured.init?.body)) as {
    tools?: unknown;
    output_config: { format: { type: string } };
  };
  assert.equal(body.tools, undefined);
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(String(captured.init?.body).includes("sk-ant-secret-value"), false);
});

function intent() {
  return {
    schemaVersion: 1,
    intentType: "auto-dca-draft",
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
