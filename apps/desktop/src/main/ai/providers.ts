import { AiDcaIntentV1Schema, type AiDcaIntentV1, type AiProvider } from "@silfable/contracts";

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  openai: "gpt-5.6-luna",
  anthropic: "claude-haiku-4-5-20251001",
};

export type AiProviderRequest = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  prompt: string;
};

export type AiProviderTransport = (request: AiProviderRequest) => Promise<AiDcaIntentV1>;

const intentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", description: "Always 1" },
    intentType: { type: "string", description: "Always auto-dca-draft" },
    amountPerCycleSol: { type: "string", description: "Positive base-10 SOL amount, at most 9 decimals" },
    intervalHours: { type: "integer", description: "Whole hours from 1 through 8760" },
    maxCycles: { type: "integer", description: "Whole number from 1 through 10000" },
    dailyLimitSol: { type: "string", description: "Positive base-10 SOL amount, at most 9 decimals" },
    minimumWalletReserveSol: { type: "string", description: "Non-negative base-10 SOL amount, at most 9 decimals" },
    maxSlippageBps: { type: "integer", description: "Basis points from 0 through 10000" },
    maxPriceImpactBps: { type: "integer", description: "Basis points from 0 through 10000" },
    rationale: { type: "string", description: "Concise rationale, no more than 600 characters" },
    assumptions: {
      type: "array",
      description: "At most 8 concise assumptions",
      items: { type: "string" },
    },
  },
  required: [
    "schemaVersion",
    "intentType",
    "amountPerCycleSol",
    "intervalHours",
    "maxCycles",
    "dailyLimitSol",
    "minimumWalletReserveSol",
    "maxSlippageBps",
    "maxPriceImpactBps",
    "rationale",
    "assumptions",
  ],
} as const;

const SYSTEM_PROMPT = `You convert a user's natural-language strategy into a conservative Auto DCA draft for Silfable Devnet Simulation.
Return only the requested structured object. Never request or emit private keys, seed phrases, wallet addresses, balances, URLs, code, commands, or transaction instructions. Never claim that a trade was executed. Use at least a one-hour interval. The output is an untrusted draft that a human must review and separately authorize through deterministic Desk Rules.`;

export const callAiProvider: AiProviderTransport = async (request) => {
  const raw =
    request.provider === "openai"
      ? await callOpenAi(request.apiKey, request.model, request.prompt)
      : await callAnthropic(request.apiKey, request.model, request.prompt);
  return AiDcaIntentV1Schema.parse(JSON.parse(raw) as unknown);
};

async function callOpenAi(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1_200,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "silfable_auto_dca_draft_v1",
          strict: true,
          schema: intentJsonSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(providerError("OpenAI", response.status, body));
  return extractOpenAiText(body);
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1_200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: intentJsonSchema } },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(providerError("Anthropic", response.status, body));
  return extractAnthropicText(body);
}

function extractOpenAiText(body: unknown): string {
  const value = body as {
    status?: unknown;
    output_text?: unknown;
    output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>;
  };
  if (value.status !== "completed") throw new Error("OpenAI response did not complete");
  if (typeof value.output_text === "string" && value.output_text.length > 0) return value.output_text;
  const text = value.output
    ?.flatMap((item) => (item.type === "message" ? item.content ?? [] : []))
    .find((item) => item.type === "output_text")?.text;
  if (typeof text !== "string" || text.length === 0) throw new Error("OpenAI returned no structured output");
  return text;
}

function extractAnthropicText(body: unknown): string {
  const value = body as { stop_reason?: unknown; content?: Array<{ type?: unknown; text?: unknown }> };
  if (value.stop_reason === "refusal" || value.stop_reason === "max_tokens") {
    throw new Error("Anthropic response did not produce a complete draft");
  }
  const text = value.content?.find((item) => item.type === "text")?.text;
  if (typeof text !== "string" || text.length === 0) throw new Error("Anthropic returned no structured output");
  return text;
}

function providerError(provider: string, status: number, body: unknown): string {
  const value = body as { error?: { type?: unknown } };
  const type = typeof value.error?.type === "string" ? ` (${value.error.type})` : "";
  return `${provider} request failed with status ${status}${type}`;
}

export const AI_INTENT_JSON_SCHEMA = intentJsonSchema;
