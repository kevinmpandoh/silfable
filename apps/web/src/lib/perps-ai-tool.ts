import "server-only";

import {
  MAX_PERP_NOTIONAL_USD,
  getPerpAccount,
  listPerpMarkets,
  type PerpAccountSnapshot,
  type PerpMarketSnapshot,
} from "@/lib/phoenix-perps-core";

type ToolMessage = { role: "user" | "assistant"; content?: string | null; tool_calls?: unknown };
type Usage = { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number | null; model: string };

export type PerpsSnapshot = {
  markets: PerpMarketSnapshot[];
  account: PerpAccountSnapshot;
  /** Chain slot the quoted prices were read at, so the model can state how fresh they are. */
  chainSlot: number;
};

const TOOL_NAME = "perp_market_overview";

/**
 * A read-only research tool over live perpetual market state. It deliberately cannot
 * size, place, or cancel an order: order parameters come from the deterministic
 * intent parser, and the transaction itself is built and simulated by
 * phoenix-perps-core. The model only explains verified numbers.
 */
export async function runPerpsAiTool(input: {
  apiKey: string;
  model: string;
  messages: Array<{ role?: "user" | "assistant"; content?: string }>;
  walletAddress: string;
  maxTokens: number;
  temperature: number;
}): Promise<{ content: string; snapshot: PerpsSnapshot; usage: Usage }> {
  const snapshot = await loadSnapshot(input.walletAddress);
  const history = input.messages.slice(-10).flatMap((message) =>
    (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
      ? [{ role: message.role, content: message.content.slice(0, 8_000) } satisfies ToolMessage]
      : [],
  );
  const system =
    "You are Mirae Web's read-only perpetuals analyst. Call perp_market_overview exactly once and treat the returned Mainnet state as authoritative. " +
    "Explain oracle price, hourly funding (positive means longs pay shorts), open interest, free collateral, account health, and any open position. " +
    `Mirae caps a single perp order at $${MAX_PERP_NOTIONAL_USD} notional. ` +
    "You cannot size, place, modify, or cancel an order, and you never claim signing or broadcast authority: every order is built by application code, simulated unsigned, and approved in the user's browser wallet. " +
    "Never promise a profit, never call a position safe, and always mention liquidation risk when a position is open. Reply concisely in the user's language.";

  const tools = [{
    type: "function",
    function: {
      name: TOOL_NAME,
      description: "Read live perpetual market state and the authenticated wallet's perpetuals account. This tool cannot sign, place, or broadcast anything.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          walletAddress: { type: "string", description: `Exact scoped wallet: ${input.walletAddress}` },
        },
        required: ["walletAddress"],
      },
    },
  }];

  let first: Awaited<ReturnType<typeof openRouterRequest>>;
  try {
    first = await openRouterRequest(input, {
      messages: [{ role: "system", content: system }, ...history],
      tools,
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    });
  } catch {
    return { content: formatPerpsSummary(snapshot), snapshot, usage: emptyUsage(input.model) };
  }

  const firstMessage = first.message;
  const toolCall = Array.isArray(firstMessage.tool_calls)
    ? firstMessage.tool_calls.find((candidate) => isOverviewToolCall(candidate)) as { id: string } | undefined
    : undefined;
  if (!toolCall) {
    return { content: formatPerpsSummary(snapshot), snapshot, usage: usage(first.usage, input.model) };
  }

  let second: Awaited<ReturnType<typeof openRouterRequest>>;
  try {
    second = await openRouterRequest(input, {
      messages: [
        { role: "system", content: system },
        ...history,
        firstMessage,
        { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(snapshot) },
      ],
    });
  } catch {
    return { content: formatPerpsSummary(snapshot), snapshot, usage: usage(first.usage, input.model) };
  }

  const content = typeof second.message.content === "string" && second.message.content.trim()
    ? second.message.content.slice(0, 12_000)
    : formatPerpsSummary(snapshot);
  return { content, snapshot, usage: combineUsage(usage(first.usage, input.model), usage(second.usage, input.model)) };
}

export async function loadSnapshot(walletAddress: string): Promise<PerpsSnapshot> {
  const [feed, account] = await Promise.all([
    listPerpMarkets(),
    getPerpAccount(walletAddress),
  ]);
  return { markets: feed.markets, account, chainSlot: feed.chainSlot };
}

/** Used whenever the model is unavailable, so perps still answer with verified numbers. */
export function formatPerpsSummary(snapshot: PerpsSnapshot): string {
  const markets = snapshot.markets
    .map((market) => `${market.symbol} $${market.oraclePriceUsd.toFixed(market.oraclePriceUsd >= 100 ? 2 : 4)} (funding ${market.fundingRateHourlyPctLong >= 0 ? "+" : ""}${market.fundingRateHourlyPctLong.toFixed(4)}%/h)`)
    .join(" · ");
  if (!snapshot.account.accountExists) {
    return `Perpetual markets: ${markets}. This wallet has no perpetuals account yet, so the first order must carry USDC collateral. No transaction was created.`;
  }
  const positions = snapshot.account.positions.length === 0
    ? "No open perpetual position."
    : snapshot.account.positions
        .map((position) => `${position.symbol} ${position.direction} ${position.baseAmount} @ $${position.entryPriceUsd.toFixed(4)} (unrealized ${position.unrealizedPnlUsd >= 0 ? "+" : ""}$${position.unrealizedPnlUsd.toFixed(2)})`)
        .join("; ");
  return `Perpetual markets: ${markets}. Account collateral $${snapshot.account.collateralUsd.toFixed(2)} with $${snapshot.account.freeCollateralUsd.toFixed(2)} free, health ${snapshot.account.healthPct}%, leverage ${snapshot.account.leverage.toFixed(2)}x. ${positions} Perpetual positions can be liquidated. No transaction was created.`;
}

function isOverviewToolCall(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const call = value as { id?: unknown; type?: unknown; function?: { name?: unknown; arguments?: unknown } };
  return typeof call.id === "string" && call.type === "function" && call.function?.name === TOOL_NAME;
}

async function openRouterRequest(
  input: { apiKey: string; model: string; maxTokens: number; temperature: number },
  body: Record<string, unknown>,
): Promise<{ message: { role: "assistant"; content?: unknown; tool_calls?: unknown }; usage?: unknown }> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", "X-Title": "Mirae Web" },
    body: JSON.stringify({ model: input.model, max_tokens: input.maxTokens, temperature: input.temperature, ...body }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json() as {
    choices?: Array<{ message?: { role?: unknown; content?: unknown; tool_calls?: unknown } }>;
    usage?: unknown;
    error?: { message?: unknown };
  };
  if (!response.ok) {
    const detail = typeof payload.error?.message === "string" ? payload.error.message.slice(0, 180) : `status ${response.status}`;
    throw new Error(`OpenRouter rejected the perps tool request (${detail}).`);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("OpenRouter returned no perps tool message.");
  return { message: { role: "assistant", content: message.content, tool_calls: message.tool_calls }, usage: payload.usage };
}

function usage(value: unknown, model: string): Usage {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const number = (entry: unknown) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0 ? entry : 0;
  const inputTokens = number(raw.prompt_tokens);
  const outputTokens = number(raw.completion_tokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: number(raw.total_tokens) || inputTokens + outputTokens,
    costUsd: raw.cost == null ? null : number(raw.cost),
    model,
  };
}

function combineUsage(first: Usage, second: Usage): Usage {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    totalTokens: first.totalTokens + second.totalTokens,
    costUsd: first.costUsd === null && second.costUsd === null ? null : (first.costUsd ?? 0) + (second.costUsd ?? 0),
    model: second.model,
  };
}

function emptyUsage(model: string): Usage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: null, model };
}
