import {
  AiDcaIntentV1Schema,
  AiShadowTradeProposalV1Schema,
  AgentIntentProposalV1Schema,
  type AiDcaIntentV1,
  type AiProvider,
  type AiShadowTradeProposalV1,
  type AgentIntentProposalV1,
  type AgentSessionView,
  type JupiterShadowQuoteView,
  type MarketObservationView,
} from "@silfable/contracts";

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

export type AiShadowTradeProviderRequest = Omit<AiProviderRequest, "prompt"> & {
  objective: string;
  quote: JupiterShadowQuoteView;
};

export type AiShadowTradeProviderTransport = (
  request: AiShadowTradeProviderRequest,
) => Promise<AiShadowTradeProposalV1>;

export type AgentIntentProviderRequest = Omit<AiProviderRequest, "prompt"> & {
  session: AgentSessionView;
  observation: MarketObservationView;
  quote: JupiterShadowQuoteView;
};

export type AgentIntentProviderTransport = (request: AgentIntentProviderRequest) => Promise<AgentIntentProposalV1>;

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

const shadowTradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", description: "Always 1" },
    intentType: { type: "string", description: "Always shadow-trade-proposal" },
    quoteId: { type: "string", description: "Copy the exact quote ID from the observation" },
    action: { type: "string", enum: ["execute-quoted-swap", "hold"] },
    direction: { type: "string", enum: ["sol-to-usdc", "usdc-to-sol"] },
    inAmount: { type: "string", description: "Copy the exact atomic input amount from the observation" },
    confidenceBps: { type: "integer", minimum: 0, maximum: 10_000 },
    rationale: { type: "string", description: "Concise reasoning, no more than 600 characters" },
    riskFlags: {
      type: "array",
      description: "At most 8 concise risks",
      items: { type: "string" },
    },
  },
  required: [
    "schemaVersion",
    "intentType",
    "quoteId",
    "action",
    "direction",
    "inAmount",
    "confidenceBps",
    "rationale",
    "riskFlags",
  ],
} as const;

const SHADOW_TRADE_SYSTEM_PROMPT = `You are the proposal layer of Silfable Mainnet Shadow.
Evaluate only the supplied, sanitized Jupiter quote against the user's objective. Return either execute-quoted-swap or hold. Copy quoteId, direction, and inAmount exactly. You cannot request another amount, pair, route, transaction, tool, key, address, balance, URL, or command. Never claim execution. The runtime will independently validate your untrusted proposal, record a local receipt, and will not construct, sign, or broadcast a transaction.`;

const agentIntentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", description: "Always 1" },
    intentType: { type: "string", description: "Always restricted-agent-intent" },
    sessionId: { type: "string", description: "Copy the exact session ID" },
    observationId: { type: "string", description: "Copy the exact observation ID" },
    quoteId: { type: "string", description: "Copy the exact primary quote ID" },
    action: { type: "string", enum: ["buy-sol", "sell-sol", "hold", "halt"] },
    notionalUsdcMicros: { type: "string", description: "For buy/sell copy the supplied expected notional; otherwise 0" },
    confidenceBps: { type: "integer", minimum: 0, maximum: 10_000 },
    rationale: { type: "string", description: "Concise reasoning, no more than 600 characters" },
    riskFlags: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["schemaVersion", "intentType", "sessionId", "observationId", "quoteId", "action", "notionalUsdcMicros", "confidenceBps", "rationale", "riskFlags"],
} as const;

const AGENT_INTENT_SYSTEM_PROMPT = `You are the untrusted proposal layer for a restricted Silfable agent session.
Use only the supplied session policy and sanitized main-owned observation. Return buy-sol, sell-sol, hold, or halt. Copy all IDs exactly. A buy requires the observed usdc-to-sol route and a sell requires sol-to-usdc. Copy expectedNotionalUsdcMicros for buy/sell and use 0 for hold/halt. Never request a different amount, venue, pair, wallet, balance, key, transaction, URL, tool, or command. Never claim execution or authorization. The runtime independently checks every field, and actionable output remains a revocable, expiring, non-executable intent requiring operator approval.`;

export const callAiProvider: AiProviderTransport = async (request) => {
  const raw = await callStructuredProvider(
    request,
    SYSTEM_PROMPT,
    "silfable_auto_dca_draft_v1",
    intentJsonSchema,
  );
  return AiDcaIntentV1Schema.parse(JSON.parse(raw) as unknown);
};

export const callAiShadowTradeProvider: AiShadowTradeProviderTransport = async (request) => {
  const prompt = JSON.stringify({
    objective: request.objective,
    observation: {
      quoteId: request.quote.id,
      direction: request.quote.direction,
      inAmount: request.quote.inAmount,
      outAmount: request.quote.outAmount,
      otherAmountThreshold: request.quote.otherAmountThreshold,
      slippageBps: request.quote.slippageBps,
      priceImpactBps: request.quote.priceImpactBps,
      feeBps: request.quote.feeBps,
      router: request.quote.router,
      routeLabels: request.quote.routeLabels,
      observedAt: request.quote.observedAt,
      expiresAt: request.quote.expiresAt,
      allowed: request.quote.allowed,
    },
  });
  const raw = await callStructuredProvider(
    { ...request, prompt },
    SHADOW_TRADE_SYSTEM_PROMPT,
    "silfable_shadow_trade_proposal_v1",
    shadowTradeJsonSchema,
  );
  return AiShadowTradeProposalV1Schema.parse(JSON.parse(raw) as unknown);
};

export const callAgentIntentProvider: AgentIntentProviderTransport = async (request) => {
  const expectedNotionalUsdcMicros = request.quote.direction === "usdc-to-sol"
    ? request.quote.inAmount
    : request.quote.outAmount;
  const prompt = JSON.stringify({
    session: {
      id: request.session.id,
      objective: request.session.objective,
      venue: request.session.venue,
      maxActionNotionalUsdcMicros: request.session.maxActionNotionalUsdcMicros,
      maxPriceImpactBps: request.session.maxPriceImpactBps,
      maxVolatilityBps: request.session.maxVolatilityBps,
      deadlineAt: request.session.deadlineAt,
    },
    observation: {
      id: request.observation.id,
      primaryQuoteId: request.observation.primaryQuoteId,
      priceMicros: request.observation.market.priceMicros,
      priceImpactBps: request.observation.market.priceImpactBps,
      feeBps: request.observation.market.feeBps,
      liquidityProxy: request.observation.market.liquidityProxy,
      volatility: request.observation.market.volatility,
      freshnessStatus: request.observation.freshnessStatus,
      observedAt: request.observation.provenance.observedAt,
      expiresAt: request.observation.provenance.expiresAt,
      quoteDirection: request.quote.direction,
      expectedNotionalUsdcMicros,
    },
  });
  const raw = await callStructuredProvider(
    { ...request, prompt },
    AGENT_INTENT_SYSTEM_PROMPT,
    "silfable_restricted_agent_intent_v1",
    agentIntentJsonSchema,
  );
  return AgentIntentProposalV1Schema.parse(JSON.parse(raw) as unknown);
};

async function callStructuredProvider(
  request: AiProviderRequest,
  systemPrompt: string,
  schemaName: string,
  schema: object,
): Promise<string> {
  return request.provider === "openai"
    ? callOpenAi(request.apiKey, request.model, request.prompt, systemPrompt, schemaName, schema)
    : callAnthropic(request.apiKey, request.model, request.prompt, systemPrompt, schema);
}

async function callOpenAi(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  schemaName: string,
  schema: object,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1_200,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(providerError("OpenAI", response.status, body));
  return extractOpenAiText(body);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  schema: object,
): Promise<string> {
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
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
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
export const AI_SHADOW_TRADE_JSON_SCHEMA = shadowTradeJsonSchema;
export const AI_AGENT_INTENT_JSON_SCHEMA = agentIntentJsonSchema;
