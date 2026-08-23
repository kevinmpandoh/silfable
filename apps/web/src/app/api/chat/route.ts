import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { resolveSolanaBridgeIntent } from "@/lib/bridge-intent";
import { assertSolanaBridgeBalance } from "@/lib/solana-bridge-preflight";
import { resolveRobinhoodSwapIntent, shouldHandleRobinhoodSwap } from "@/lib/evm-swap-intent";
import { resolveRobinhoodTokenReference, type RobinhoodTokenReferenceResult } from "@/lib/robinhood-token";
import { resolveEvmToSolanaBridgeIntent } from "@/lib/evm-bridge-intent";
import { resolvePumpAnalysisIntent } from "@/lib/pump-analysis-utils";
import { runPumpAnalysisAiTool } from "@/lib/pump-ai-tool";
import { runSolanaAutomationAiTool } from "@/lib/solana-automation-ai-tool";
import { runEvmAutomationAiTool } from "@/lib/evm-automation-ai-tool";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";
import { createInvestmentRecommendation } from "@/lib/investment-recommendation";
import { isInvestmentRecommendationRequest, parseInvestmentBudget } from "@/lib/investment-intent";
import { resolveStockAnalysisIntent } from "@/lib/stock-intent";
import { runStockAnalysisAiTool, runStockScreeningAiTool } from "@/lib/stock-ai-tool";
import { analyzeStock, fetchTopStockMarketScreening, findTokenizedStockOnSolana } from "@/lib/finnhub-stock";
import { resolveSolanaSwapIntent } from "@/lib/solana-swap-intent";
import { parsePerpIntent, type PerpIntent } from "@/lib/perps-intent";
import {
  MAX_PERP_NOTIONAL_USD,
  MIRAE_PERP_SYMBOLS,
  derivePerpCollateralUsdc,
  getPerpAccount,
  isAllowedSymbol,
  normalizeSymbol,
  type PerpAccountSnapshot,
} from "@/lib/phoenix-perps-core";
import { formatPerpsSummary, loadSnapshot, runPerpsAiTool } from "@/lib/perps-ai-tool";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LAMPORTS_PER_SOL = 1_000_000_000;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || selectSolanaRpc();
const JUPITER_API_KEY = process.env.JUPITER_API_KEY?.trim() || undefined;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim() || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";

type ChatSettings = {
  maxSlippageBps?: string;
  outputLimit?: string;
  temperature?: string;
};

type ChatMessage = {
  role?: "user" | "assistant";
  content?: string;
};

function parseSolAmount(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*sol/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function isSolToUsdcSwap(text: string): boolean {
  return /\bswap\b|\btukar\b|\bconvert\b|\bbeli\b/i.test(text)
    && /\bsol\b/i.test(text)
    && /\busdc\b/i.test(text);
}

function findPumpMint(text: string): string | null {
  const matches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
  return matches?.find((value) => value.toLowerCase().endsWith("pump")) ?? null;
}

function isLimitOrder(text: string): boolean {
  return /\blimit\b|\border\b|\bdip buy\b|\btake profit\b/i.test(text);
}

function isTokenLaunchIntent(text: string): boolean {
  return /\btoken launch\b|\blaunch (?:a )?token\b|\bcreate (?:a )?(?:token|coin)\b|\bbuat(?:kan)? (?:token|koin)\b|\bluncurkan (?:token|koin)\b/iu.test(text);
}

function isSolanaAutomationIntent(text: string): boolean {
  return /\bdca\b|\bautomation\b|\botomasi\b|\btake[ -]?profit\b|\bstop[ -]?loss\b|\b(?:tp|sl)\b/iu.test(text);
}

async function getJupiterQuote(inputAmountLamports: number, slippageBps: number, apiKey?: string) {
  const url = new URL("https://lite-api.jup.ag/swap/v1/quote");
  url.searchParams.set("inputMint", SOL_MINT);
  url.searchParams.set("outputMint", USDC_MINT);
  url.searchParams.set("amount", String(inputAmountLamports));
  url.searchParams.set("slippageBps", String(slippageBps));
  url.searchParams.set("restrictIntermediateTokens", "true");

  const headers: HeadersInit = apiKey ? { "x-api-key": apiKey } : {};
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Jupiter quote failed with status ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function callOpenRouter(input: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  sessionMode: "agent" | "mission";
  walletAddress: string | null;
  maxTokens: number;
  temperature: number;
  workspace: "solana" | "evm";
  chainKey: string | null;
  sessionWalletAddress: string | null;
}) {
  const history = input.messages
    .slice(-12)
    .flatMap((message) =>
      (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
        ? [{ role: message.role, content: message.content.slice(0, 8_000) }]
        : [],
    );

  const capabilityBoundary =
    `You are Mirae Web's institutional-grade AI trading & financial market research assistant (${input.workspace.toUpperCase()} workspace). ` +
    "You have real-time access to US equities market data (NYSE/NASDAQ), technical indicators, and Solana/EVM crypto markets. " +
    "MANDATORY INSTRUCTION FOR STOCK SCREENING & MARKET REQUESTS: " +
    "When the user asks for stock screening, top stocks for short-term trading, market analysis, or technical setups, YOU MUST DIRECTLY PROVIDE the concrete setups. NEVER refuse or say you cannot provide real-time analysis, and NEVER output generic textbook advice. " +
    "Directly select 3 to 5 top liquid US stocks (such as NVDA, AAPL, MSFT, TSLA, AMZN, META, GOOGL, AMD, SPY, QQQ). For each stock, use the get_stock_market_data tool to inspect live market metrics, and deliver the complete requested breakdown: Ticker & Current Price, Ideal Entry Zone, Stop-Loss Level, Take-Profit Target, Expected Upside, Risk/Reward Ratio (e.g. 1:2.5), Technical Setup (Support/Resistance, RSI, MACD, 20/50/200 MA), Upcoming Catalysts, and Key Risks, plus broader S&P 500 / Nasdaq market context. " +
    "Safety Guardrails: Transactions are prepared by application code and ALWAYS require explicit browser wallet approval. Web cannot auto-trade, cloud sign, or perform silent execution. Never invent fake quotes, token mints, or balances. USDG and ETH Robinhood swap intents are handled by deterministic application code before this model is called. " +
    "Communication Style: Respond naturally, directly, thoroughly, and professionally in the user's language. Use clean, standard formatting without raw '>' quote characters or excessive dangling asterisks. Do NOT print mechanical boilerplate, repetitive disclaimer templates, or rigid refusal lists.";

  const system =
    input.sessionMode === "mission"
      ? `${capabilityBoundary} Act as a clear mission planner. Outline goals, steps, and required approvals.`
      : `${capabilityBoundary} Act as an expert institutional trading and market research analyst. Deliver detailed, highly actionable, structured market research.`;

  const stockTools = [
    {
      type: "function",
      function: {
        name: "get_stock_market_data",
        description: "Fetch live price, 52-week range, P/E ratio, and analyst consensus for any US stock ticker (e.g. NVDA, AAPL, TSLA, MSFT, AMZN, GOOGL, AMD, SPY, QQQ).",
        parameters: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "US stock ticker symbol, e.g. NVDA" },
          },
          required: ["ticker"],
        },
      },
    },
  ];

  const firstResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Mirae Web",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: system },
        {
          role: "system",
          content: `Authenticated Solana identity: ${input.walletAddress ?? "none"}. Bound session context: workspace=${input.workspace}, chain=${input.chainKey ?? "solana-mainnet"}, execution wallet=${input.sessionWalletAddress ?? "none"}. These values are context, not signing authorization.`,
        },
        ...history,
      ],
      tools: stockTools,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const firstBody = (await firstResponse.json()) as {
    choices?: Array<{ message?: { content?: unknown; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown };
    error?: { message?: unknown };
  };

  if (!firstResponse.ok) {
    const detail = typeof firstBody.error?.message === "string" ? firstBody.error.message.slice(0, 180) : `status ${firstResponse.status}`;
    throw new Error(`OpenRouter rejected the request (${detail})`);
  }

  const firstMessage = firstBody.choices?.[0]?.message;
  const toolCalls = firstMessage?.tool_calls;

  let finalContent = typeof firstMessage?.content === "string" ? firstMessage.content : "";
  let totalUsage = firstBody.usage;

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        if (call.function.name === "get_stock_market_data") {
          try {
            const args = JSON.parse(call.function.arguments) as { ticker?: string };
            if (args.ticker) {
              const data = await analyzeStock(args.ticker);
              return { role: "tool", tool_call_id: call.id, content: JSON.stringify(data) };
            }
          } catch {
            return { role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Market data unavailable" }) };
          }
        }
        return { role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Unknown tool" }) };
      }),
    );

    try {
      const secondResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Mirae Web",
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: system },
            ...history,
            firstMessage,
            ...toolResults,
          ],
          max_tokens: input.maxTokens,
          temperature: input.temperature,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (secondResponse.ok) {
        const secondBody = (await secondResponse.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>;
          usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown };
        };
        if (typeof secondBody.choices?.[0]?.message?.content === "string") {
          finalContent = secondBody.choices[0].message.content;
          totalUsage = secondBody.usage ?? totalUsage;
        }
      }
    } catch {
      // Keep firstContent if second turn fails
    }
  }

  if (!finalContent || finalContent.trim().length === 0) {
    throw new Error("OpenRouter returned an empty assistant message");
  }

  const asFiniteNumber = (value: unknown) => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };
  const inputTokens = asFiniteNumber(totalUsage?.prompt_tokens);
  const outputTokens = asFiniteNumber(totalUsage?.completion_tokens);
  return {
    content: finalContent.slice(0, 16_000),
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: asFiniteNumber(totalUsage?.total_tokens) || inputTokens + outputTokens,
      costUsd: totalUsage?.cost == null ? null : asFiniteNumber(totalUsage.cost),
      model: input.model,
    },
  };
}

/**
 * Turns a parsed perpetuals intent into either a typed, preview-only proposal or
 * a read-only market answer. No size, direction, or market is ever invented
 * here: anything the user did not state is asked back for. The unsigned
 * transaction is built later by /api/perps/prepare.
 */
async function resolvePerpsReply(input: {
  intent: Extract<PerpIntent, { requested: true }>;
  workspace: "solana" | "evm";
  sessionWalletAddress: string | null;
  messages: ChatMessage[];
  settings?: ChatSettings;
}): Promise<Record<string, unknown> | null> {
  const { intent } = input;
  if (input.workspace !== "solana" || !input.sessionWalletAddress) {
    return { role: "assistant", content: "Perpetuals are available only from a Solana session bound to a Phantom/Solflare wallet. Open or create one first; no order was prepared." };
  }
  const walletAddress = input.sessionWalletAddress;

  if (intent.action === "overview") {
    if (!OPENROUTER_API_KEY) {
      const snapshot = await loadSnapshot(walletAddress);
      return { role: "assistant", content: formatPerpsSummary(snapshot) };
    }
    const result = await runPerpsAiTool({
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      messages: input.messages,
      walletAddress,
      maxTokens: Math.max(512, Math.min(4_096, Number(input.settings?.outputLimit ?? "1200") || 1_200)),
      temperature: Math.max(0, Math.min(1, Number(input.settings?.temperature ?? "0.3") || 0.3)),
    });
    return { role: "assistant", content: result.content, usage: result.usage };
  }

  const symbol = intent.baseAssetSymbol ? normalizeSymbol(intent.baseAssetSymbol) : null;
  const market = symbol && isAllowedSymbol(symbol) ? { symbol: `${symbol}-PERP`, baseAssetSymbol: symbol, marketIndex: 0 } : null;
  if (!market) {
    const allowed = MIRAE_PERP_SYMBOLS.map((entry) => `${entry}-PERP`).join(", ");
    return {
      role: "assistant",
      content: intent.baseAssetSymbol
        ? `${intent.baseAssetSymbol}-PERP is not an allowlisted Mirae market. Available markets: ${allowed}. No order was prepared.`
        : `Name the perpetual market you want to trade. Available markets: ${allowed}.`,
    };
  }

  const account = await getPerpAccount(walletAddress);
  if (intent.action === "close") {
    const position = account.positions.find((entry) => entry.symbol === market.symbol);
    if (!position) {
      return { role: "assistant", content: `There is no open ${market.symbol} position on this wallet's perpetuals account, so nothing can be closed.` };
    }
    return {
      role: "assistant",
      content: `A reduce-only close for your ${position.direction} ${position.baseAmount} ${market.symbol} position is ready to prepare. Select Prepare order to build and simulate the unsigned transaction; nothing has been signed or broadcast.`,
      proposal: perpProposal({
        market: market.symbol,
        marketIndex: market.marketIndex,
        direction: position.direction === "long" ? "short" : "long",
        reduceOnly: true,
        baseAmount: String(position.baseAmount),
        notionalUsd: position.notionalUsd.toFixed(2),
        oraclePriceUsd: position.markPriceUsd.toFixed(4),
        limitPriceUsd: null,
        account,
        explanation: "Closing is a reduce-only order, so it can only shrink the existing position and can never flip it into the opposite direction.",
      }),
    };
  }

  if (!intent.direction) {
    // The side is never guessed, but when the size is already known the choice
    // can be offered as two buttons that go straight into preflight.
    if (intent.baseAmount || intent.notionalUsd) {
      return {
        role: "assistant",
        content: `Choose the side for ${market.symbol}. Selecting one builds and simulates the order immediately, then your wallet asks for the single approval that opens the position.`,
        proposal: perpProposal({
          market: market.symbol,
          marketIndex: market.marketIndex,
          direction: undefined,
          reduceOnly: false,
          baseAmount: intent.baseAmount,
          notionalUsd: intent.notionalUsd,
          oraclePriceUsd: null,
          limitPriceUsd: intent.limitPrice,
          account,
          explanation: "Mirae never picks a direction for you. Either button prepares the order under the same guards: live mark price, notional ceiling, unsigned simulation, and your wallet as the only signer.",
        }),
      };
    }
    return { role: "assistant", content: `State the side explicitly for ${market.symbol}: long or short, and the size. Mirae never picks a direction for you.` };
  }
  if (!intent.baseAmount && !intent.notionalUsd) {
    return { role: "assistant", content: `Provide the position size for ${market.symbol}, either in base units (\`0.5 ${market.baseAssetSymbol}\`) or USD notional (\`$250\`). No order was prepared.` };
  }
  if (!account.accountExists) {
    return { role: "assistant", content: `This wallet has no perpetuals account yet. Open the PERPS panel and set the collateral for your first order; the account is opened in the same transaction. No order was prepared.` };
  }

  return {
    role: "assistant",
    content: `A ${intent.direction} ${market.symbol} proposal is ready to prepare${intent.leverage ? ` (you mentioned ${intent.leverage}x; Mirae sizes from your stated amount and shows the resulting account leverage after preflight)` : ""}. Select Prepare order to build and simulate the unsigned transaction; nothing has been signed or broadcast.`,
    proposal: perpProposal({
      market: market.symbol,
      marketIndex: market.marketIndex,
      direction: intent.direction,
      reduceOnly: false,
      baseAmount: intent.baseAmount,
      notionalUsd: intent.notionalUsd,
      collateralUsdc: intent.notionalUsd
        ? derivePerpCollateralUsdc(Number(intent.notionalUsd), intent.leverage ?? 3)
        : undefined,
      oraclePriceUsd: null,
      limitPriceUsd: intent.limitPrice,
      account,
      explanation: "The AI only produced a typed intent. Application code resolves the size against the live oracle, enforces the notional ceiling, simulates the transaction unsigned, and your wallet performs the only signature.",
    }),
  };
}

function perpProposal(input: {
  market: string;
  marketIndex: number;
  direction: "long" | "short" | undefined;
  reduceOnly: boolean;
  baseAmount?: string | null;
  notionalUsd?: string | null;
  collateralUsdc?: string;
  oraclePriceUsd: string | null;
  limitPriceUsd: string | null;
  account: PerpAccountSnapshot;
  explanation: string;
}): Record<string, unknown> {
  return {
    id: `perp_${Date.now()}`,
    type: "perp_order",
    mint: "",
    solAmount: "0",
    estimatedTokens: input.reduceOnly ? "Reduce-only close" : "Preflight pending",
    status: "preview_only",
    mode: "restricted_browser_wallet",
    venue: "Solana Perpetuals",
    explanation: input.explanation,
    perpMarket: input.market,
    perpMarketIndex: input.marketIndex,
    perpDirection: input.direction,
    perpReduceOnly: input.reduceOnly,
    perpBaseAmount: input.baseAmount ?? undefined,
    perpNotionalUsd: input.notionalUsd ?? undefined,
    perpCollateralUsdc: input.collateralUsdc,
    perpLimitPriceUsd: input.limitPriceUsd ?? undefined,
    perpOraclePriceUsd: input.oraclePriceUsd ?? undefined,
    perpFreeCollateralUsd: input.account.freeCollateralUsd.toFixed(2),
    perpAccountHealthPct: input.account.healthPct,
    perpStage: "draft",
    checks: [
      { code: "market_allowlisted", status: "pass", message: `Market is pinned to the allowlisted market ${input.market}.` },
      { code: "size_ceiling", status: "pass", message: `A single order is capped at $${MAX_PERP_NOTIONAL_USD} notional.` },
      { code: "unsigned_preflight", status: "pass", message: "The transaction is simulated unsigned on Mainnet before your wallet is asked." },
      { code: "wallet_approval", status: "pass", message: "Phantom/Solflare approval is required; Mirae never signs a perpetuals order." },
      { code: "liquidation_risk", status: "block", message: "Perpetual positions carry liquidation risk. Monitor account health after opening." },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, settings, sessionMode, walletAddress, workspace, chainKey, sessionWalletAddress, sessionId } = (await req.json()) as {
      messages?: ChatMessage[];
      settings?: ChatSettings;
      sessionMode?: "agent" | "mission";
      walletAddress?: string | null;
      workspace?: "solana" | "evm";
      chainKey?: string;
      sessionWalletAddress?: string;
      sessionId?: string;
    };
    const auth = await requireWalletAuth(req, walletAddress);
    if (isAuthFailure(auth)) return auth;
    const lastUserMessage = messages?.[messages.length - 1]?.content ?? "";
    const maxSlippageBps = Math.max(1, Math.min(500, Number(settings?.maxSlippageBps ?? "100") || 100));

    const selectedWorkspace = workspace === "evm" ? "evm" : "solana";

    const investmentBudget = parseInvestmentBudget(lastUserMessage);
    if (investmentBudget === null && isInvestmentRecommendationRequest(lastUserMessage) && /(?:\$|\busd\b|\bdollars?\b)/iu.test(lastUserMessage)) {
      return NextResponse.json({ role: "assistant", content: "Provide an investment research budget between $1 and $1,000,000 USD. No transaction was created." });
    }
    if (investmentBudget !== null) {
      if (selectedWorkspace !== "solana" || typeof sessionWalletAddress !== "string") {
        return NextResponse.json({ role: "assistant", content: "Investment recommendations are available from a wallet-bound Solana session." });
      }
      try {
        const recommendation = await createInvestmentRecommendation({ userId: auth.userId, walletAddress: sessionWalletAddress, budgetUsd: investmentBudget });
        return NextResponse.json({
          role: "assistant",
          content: `I analyzed current Solana tokenized-stock markets for a $${investmentBudget.toFixed(2)} budget. Pump.fun and ordinary crypto tokens are excluded. Review the recommended profile below; no transaction or wallet request has been created.`,
          proposal: {
            id: `investment_${Date.now()}`,
            type: "investment_recommendation",
            mint: USDC_MINT,
            solAmount: "0",
            estimatedTokens: "Three research profiles",
            status: "preview_only",
            mode: "read_only_market_research",
            venue: "Jupiter tokenized stocks + DexScreener",
            explanation: "Deterministic market filters selected the assets. Choosing a profile only enables separately refreshed Jupiter proposals; it never executes trades automatically.",
            investmentRecommendation: recommendation,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Market research is unavailable.";
        return NextResponse.json({ role: "assistant", content: `Mirae could not produce a complete recommendation from current verified market data: ${message} No transaction was created.` });
      }
    }

    const stockIntent = resolveStockAnalysisIntent(lastUserMessage);
    if (stockIntent.requested) {
      const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim() || "";
      if (!finnhubApiKey) {
        return NextResponse.json({
          role: "assistant",
          content: "Finnhub stock market integration is not configured on the server. Please check FINNHUB_API_KEY in your environment.",
        });
      }

      if (stockIntent.ticker) {
        try {
          const result = await runStockAnalysisAiTool({
            apiKey: OPENROUTER_API_KEY || undefined,
            model: OPENROUTER_MODEL,
            messages: messages ?? [],
            ticker: stockIntent.ticker,
            finnhubApiKey,
            maxTokens: Math.max(256, Math.min(2_048, Number(settings?.outputLimit ?? "1200") || 1_200)),
            temperature: Math.max(0, Math.min(1, Number(settings?.temperature ?? "0.3") || 0.3)),
          });

          return NextResponse.json({
            role: "assistant",
            content: result.content,
            usage: result.usage,
            proposal: {
              id: `stock_${stockIntent.ticker}_${Date.now()}`,
              type: "stock_analysis",
              mint: "",
              solAmount: "0",
              estimatedTokens: "Live equity quote",
              status: "preview_only",
              mode: "read_only_stock_research",
              venue: "Finnhub US Equities",
              explanation: "Real-time stock quotes, valuation metrics, and analyst consensus fetched from Finnhub. Informational purpose only.",
              stockIntelligence: result.intelligence,
            },
          });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Stock analysis failed.";
          return NextResponse.json({
            role: "assistant",
            content: `Mirae could not complete the stock analysis: ${message}`,
          });
        }
      } else {
        // Broad screening / watchlist request without a single ticker
        try {
          const topStocks = await fetchTopStockMarketScreening(["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"], finnhubApiKey);
          const screeningResult = await runStockScreeningAiTool({
            apiKey: OPENROUTER_API_KEY || undefined,
            model: OPENROUTER_MODEL,
            messages: messages ?? [],
            stocks: topStocks,
            maxTokens: Math.max(512, Math.min(3_000, Number(settings?.outputLimit ?? "1600") || 1_600)),
            temperature: Math.max(0, Math.min(1, Number(settings?.temperature ?? "0.3") || 0.3)),
          });

          return NextResponse.json({
            role: "assistant",
            content: screeningResult.content,
            usage: screeningResult.usage,
          });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Stock screening failed.";
          return NextResponse.json({
            role: "assistant",
            content: `Mirae could not complete the stock screening: ${message}`,
          });
        }
      }
    }

    const addressOnlyReply = /^\s*(0x[0-9a-f]{40})\s*$/iu.exec(lastUserMessage);
    const previousSwapRequest = addressOnlyReply
      ? [...(messages ?? []).slice(0, -1)].reverse().find((message) => message.role === "user" && /\b(?:swap|tukar|convert|jual|beli)\b/iu.test(message.content ?? ""))?.content
      : null;
    const contextualSwapMessage = previousSwapRequest && addressOnlyReply
      ? previousSwapRequest.replace(/((?:ke|to|->|→)\s*)[A-Za-z][A-Za-z0-9_-]{1,31}\b/iu, `$1${addressOnlyReply[1]}`)
      : lastUserMessage;
    const evmSwapIntent = resolveRobinhoodSwapIntent(contextualSwapMessage);
    if (shouldHandleRobinhoodSwap(selectedWorkspace, evmSwapIntent)) {
      if (chainKey !== "robinhood") {
        return NextResponse.json({ role: "assistant", content: "Open a Robinhood EVM session bound to your EVM wallet first. No quote or transaction was prepared." });
      }
      if (!evmSwapIntent.amount || !evmSwapIntent.sellToken || !evmSwapIntent.buyToken) {
        return NextResponse.json({ role: "assistant", content: "Provide a positive input amount and token pair. Example: `swap 0.001 ETH to WETH`. A contract address is only required when a symbol cannot be resolved uniquely." });
      }
      if (evmSwapIntent.sellToken === evmSwapIntent.buyToken || Number(evmSwapIntent.amount) <= 0) {
        return NextResponse.json({ role: "assistant", content: "The source and destination tokens must differ, with a positive amount." });
      }
      if (typeof sessionWalletAddress !== "string" || !/^0x[0-9a-f]{40}$/iu.test(sessionWalletAddress)) {
        return NextResponse.json({ role: "assistant", content: "The Robinhood session is not bound to a valid EVM wallet." });
      }
      let references: [RobinhoodTokenReferenceResult, RobinhoodTokenReferenceResult];
      try {
        references = await Promise.all([
          resolveRobinhoodTokenReference(evmSwapIntent.sellToken),
          resolveRobinhoodTokenReference(evmSwapIntent.buyToken),
        ]);
      } catch {
        return NextResponse.json({ role: "assistant", content: "Token discovery is temporarily unavailable. No route was requested. You can retry or provide the exact Robinhood Chain contract address." });
      }
      const requestedSymbols = [evmSwapIntent.sellToken, evmSwapIntent.buyToken];
      const ambiguousIndex = references.findIndex((reference) => reference.status === "ambiguous");
      if (ambiguousIndex >= 0) {
        const ambiguous = references[ambiguousIndex];
        if (ambiguous.status === "ambiguous") {
          const options = ambiguous.candidates.map((token) => `- ${token.symbol} · \`${token.address}\``).join("\n");
          return NextResponse.json({ role: "assistant", content: `I found multiple validated contracts for ${requestedSymbols[ambiguousIndex]}. Choose the intended Robinhood Chain contract and resend the swap request:\n${options}` });
        }
      }
      const missingIndex = references.findIndex((reference) => reference.status === "not_found");
      if (missingIndex >= 0) {
        return NextResponse.json({ role: "assistant", content: `I could not find one exact, validated Robinhood Chain contract for ${requestedSymbols[missingIndex]}. Provide its contract address, then Mirae will validate it before requesting a quote.` });
      }
      const [sellReference, buyReference] = references;
      if (sellReference.status !== "resolved" || buyReference.status !== "resolved") {
        return NextResponse.json({ role: "assistant", content: "The token pair could not be resolved safely. No route was requested." });
      }
      const sellToken = sellReference.token;
      const buyToken = buyReference.token;
      if (sellToken.address === buyToken.address) {
        return NextResponse.json({ role: "assistant", content: "The source and destination resolve to the same Robinhood Chain token. Choose two different assets." });
      }
      return NextResponse.json({
        role: "assistant",
        content: `A ${evmSwapIntent.amount} ${sellToken.symbol} → ${buyToken.symbol} swap proposal is ready. Mirae is loading a live Robinhood Chain route; no signature or broadcast has occurred.`,
        proposal: { id: `evm_swap_${Date.now()}`, type: "evm_swap", mint: "", solAmount: "0", estimatedTokens: "Quote pending", sellToken: sellToken.symbol, buyToken: buyToken.symbol, sellTokenAddress: sellToken.address, buyTokenAddress: buyToken.address, sellTokenDecimals: sellToken.decimals, buyTokenDecimals: buyToken.decimals, sellAmount: evmSwapIntent.amount, status: "preview_only", mode: "restricted_browser_wallet", venue: "Uniswap Trading API", explanation: "The contract addresses and token metadata were validated on Robinhood Chain. Wallet confirmation remains required.", checks: [{ code: "wallet_bound", status: "pass", message: `Session EVM wallet: ${sessionWalletAddress}` }, { code: "token_contracts", status: "pass", message: "Token contracts and decimals were read from Robinhood Chain." }, { code: "chain_pinned", status: "pass", message: "Chain is pinned to Robinhood Chain (4663)." }, { code: "wallet_approval", status: "pass", message: "Your browser wallet will request explicit approval before broadcast." }] },
      });
    }

    const evmBridgeIntent = resolveEvmToSolanaBridgeIntent(messages ?? []);
    if (evmBridgeIntent.requested) {
      if (selectedWorkspace !== "evm" || chainKey !== "robinhood") {
        return NextResponse.json({
          role: "assistant",
          content: "Open a Robinhood Chain session bound to the source EVM wallet first. No quote or transaction was prepared.",
        });
      }
      if (!evmBridgeIntent.amountUsdg) {
        return NextResponse.json({
          role: "assistant",
          content: "Provide the USDG amount to bridge from Robinhood Chain. Example: Bridge 1 USDG to Solana.",
        });
      }
      if (!evmBridgeIntent.destinationRecipient) {
        return NextResponse.json({
          role: "assistant",
          content: "The amount was found. Now provide the full destination Solana wallet address; the USDG amount from your previous message will be retained.",
        });
      }
      const amount = Number(evmBridgeIntent.amountUsdg);
      if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000) {
        return NextResponse.json({ role: "assistant", content: "The bridge amount must be between 0.01 and 1,000 USDG. No transaction was prepared." });
      }
      try {
        new PublicKey(evmBridgeIntent.destinationRecipient);
      } catch {
        return NextResponse.json({ role: "assistant", content: "The destination Solana address is invalid. No quote or transaction was prepared." });
      }
      if (typeof sessionWalletAddress !== "string" || !/^0x[0-9a-f]{40}$/iu.test(sessionWalletAddress)) {
        return NextResponse.json({ role: "assistant", content: "The Robinhood session is not bound to a valid source EVM wallet." });
      }
      return NextResponse.json({
        role: "assistant",
        content: `A bridge proposal for ${evmBridgeIntent.amountUsdg} USDG from Robinhood Chain to Solana USDC is ready. Select Prepare quote to obtain a Relay route; no approval, signature, or broadcast has occurred.`,
        proposal: {
          id: `evm_bridge_${Date.now()}`,
          type: "evm_bridge",
          mint: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
          solAmount: "0",
          estimatedTokens: "Quote pending",
          amountUsdg: evmBridgeIntent.amountUsdg,
          destination: "solana",
          destinationRecipient: evmBridgeIntent.destinationRecipient,
          outputSymbol: "USDC",
          status: "preview_only",
          mode: "restricted_browser_wallet",
          venue: "Relay",
          explanation: "AI only creates the typed bridge intent. Deterministic application code validates Relay calldata, balances, network fees, source receipt, and destination settlement.",
          checks: [
            { code: "source_workspace", status: "pass", message: `Source wallet is pinned to Robinhood Chain: ${sessionWalletAddress}.` },
            { code: "destination_chain", status: "pass", message: "Destination is pinned to Solana Mainnet USDC." },
            { code: "recipient_bound", status: "pass", message: `Exact Solana recipient: ${evmBridgeIntent.destinationRecipient}.` },
            { code: "wallet_approval", status: "pass", message: "Any USDG approval and bridge deposit require separate MetaMask/Rabby confirmations." },
          ],
        },
      });
    }

    const bridgeIntent = resolveSolanaBridgeIntent(messages ?? []);
    if (bridgeIntent.requested) {
      if (selectedWorkspace !== "solana") {
        return NextResponse.json({
          role: "assistant",
          content: "Use this format: Bridge 1 USDG from Robinhood to Solana <Solana address>. No transaction was prepared from the incomplete request.",
        });
      }
      const { amountUsdc, destinationRecipient } = bridgeIntent;
      if (!amountUsdc) {
        return NextResponse.json({
          role: "assistant",
          content: "Provide the USDC amount to bridge. A maximum amount is not selected automatically because balance and fees must be reviewed first. Example: 0.5 USDC.",
        });
      }
      if (!destinationRecipient) {
        return NextResponse.json({
          role: "assistant",
          content: "The amount was found. Now provide the full Robinhood EVM destination address in 0x... format; the amount from your previous message will be retained.",
        });
      }
      if (amountUsdc < 0.01 || amountUsdc > 1_000) {
        return NextResponse.json({ role: "assistant", content: "The web bridge amount must be between 0.01 and 1,000 USDC. No transaction was prepared." });
      }
      if (typeof sessionWalletAddress !== "string" || !sessionWalletAddress) {
        return NextResponse.json({ role: "assistant", content: "The bridge cannot be prepared because the session is not bound to the source Solana wallet." });
      }
      let balancePreflight;
      try {
        const requiredUsdc = BigInt(Math.round(amountUsdc * 1_000_000));
        balancePreflight = await assertSolanaBridgeBalance(new Connection(SOLANA_RPC, "confirmed"), sessionWalletAddress, requiredUsdc);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Source wallet balance could not be verified.";
        return NextResponse.json({ role: "assistant", content: `The bridge was not prepared. ${message} No quote, signature, or wallet popup was created.` });
      }
      return NextResponse.json({
        role: "assistant",
        content: `A bridge proposal for ${amountUsdc} USDC from Solana to Robinhood USDG is ready for review. No executable quote, signature, or broadcast has occurred.`,
        proposal: {
          id: `bridge_${Date.now()}`,
          type: "solana_bridge",
          mint: USDC_MINT,
          solAmount: "0",
          estimatedTokens: "Quote obtained during deterministic preparation",
          amountUsdc: String(amountUsdc),
          destination: "robinhood",
          destinationRecipient,
          outputSymbol: "USDG",
          status: "ready_for_user_signature",
          mode: "restricted_browser_wallet",
          venue: "Relay",
          explanation: "AI only creates the typed intent. Deterministic application code obtains and validates the route before wallet approval.",
          checks: [
            { code: "source_workspace", status: "pass", message: "Source session is bound to one Solana wallet." },
            { code: "destination_chain", status: "pass", message: "Destination is pinned to Robinhood Chain." },
            { code: "recipient_bound", status: "pass", message: "The exact EVM recipient is shown before preparation." },
            { code: "source_usdc_balance", status: "pass", message: `Live source balance verified: ${balancePreflight.availableUsdc} USDC for this ${amountUsdc} USDC bridge.` },
            { code: "source_sol_fee", status: "pass", message: `Live SOL fee reserve verified: ${balancePreflight.availableSol} SOL available; minimum reserve ${balancePreflight.feeReserveSol} SOL.` },
          ],
        },
      });
    }

    if (isTokenLaunchIntent(lastUserMessage)) {
      return NextResponse.json({
        role: "assistant",
        content: selectedWorkspace === "solana"
          ? "Token Launch is available in this Solana session. Select **TOKEN LAUNCH** beneath the conversation, enter metadata and fee limits, then follow unsigned preflight → final Mainnet checks → Phantom/Solflare approval. No transaction is created from this chat message alone."
          : "Pump.fun Token Launch must be created from a Solana session bound to a Phantom/Solflare wallet. Open or create a Solana session first; no transaction can be prepared from this EVM session.",
      });
    }

    // Perps are resolved before automation because a perp instruction can also
    // mention a stop loss or take profit, which the automation matcher claims.
    const perpIntent = parsePerpIntent(lastUserMessage);
    if (perpIntent.requested) {
      const perpReply = await resolvePerpsReply({
        intent: perpIntent,
        workspace: selectedWorkspace,
        sessionWalletAddress: typeof sessionWalletAddress === "string" ? sessionWalletAddress : null,
        messages: messages ?? [],
        settings,
      });
      if (perpReply) return NextResponse.json(perpReply);
    }

    if (isSolanaAutomationIntent(lastUserMessage)) {
      if (typeof sessionId !== "string" || !/^[0-9a-f]{24}$/iu.test(sessionId) || typeof sessionWalletAddress !== "string") {
        return NextResponse.json({ role: "assistant", content: "Create automation from a wallet-bound Solana or Robinhood session." });
      }
      const openRouterApiKey = OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        return NextResponse.json({ role: "assistant", content: "The Mirae AI provider is temporarily unavailable because OPENROUTER_API_KEY is not configured on the server." });
      }
      try {
        if (selectedWorkspace === "evm") {
          if (chainKey !== "robinhood" || !/^0x[0-9a-f]{40}$/iu.test(sessionWalletAddress)) return NextResponse.json({ role: "assistant", content: "Robinhood automation requires a Robinhood Chain session bound to the connected MetaMask/Rabby wallet." });
          const result = await runEvmAutomationAiTool({ userId: auth.userId, sessionId, walletAddress: sessionWalletAddress, text: lastUserMessage });
          return NextResponse.json({ role: "assistant", content: result.content, automationCreated: result.created });
        }
        if (selectedWorkspace !== "solana") return NextResponse.json({ role: "assistant", content: "Automation is available only in a Solana or Robinhood Chain session." });
        const result = await runSolanaAutomationAiTool({
          apiKey: openRouterApiKey,
          model: OPENROUTER_MODEL,
          messages: messages ?? [],
          userId: auth.userId,
          sessionId,
          walletAddress: sessionWalletAddress,
          maxTokens: Math.max(256, Math.min(2_048, Number(settings?.outputLimit ?? "1200") || 1_200)),
          temperature: Math.max(0, Math.min(1, Number(settings?.temperature ?? "0.3") || 0.3)),
        });
        return NextResponse.json({ role: "assistant", content: result.content, usage: result.usage, automationCreated: result.created });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Automation AI tool failed.";
        return NextResponse.json({ role: "assistant", content: `Automation was not created: ${message}` });
      }
    }

    const solanaSwap = selectedWorkspace === "solana" ? resolveSolanaSwapIntent(lastUserMessage) : null;
    if (selectedWorkspace === "solana" && solanaSwap && solanaSwap.requested) {
      const inputSymbol = solanaSwap.inputSymbol === "SOL" ? "SOL" : "USDC";
      const inputMint = inputSymbol === "SOL" ? SOL_MINT : USDC_MINT;
      const inputDecimals = inputSymbol === "SOL" ? 9 : 6;
      const inputAmountNum = solanaSwap.amount ?? (inputSymbol === "SOL" ? 0.05 : 1);
      const inputAmountRaw = BigInt(Math.floor(inputAmountNum * Math.pow(10, inputDecimals))).toString();

      let outputSymbol = solanaSwap.outputSymbol ?? (inputSymbol === "SOL" ? "USDC" : "SOL");
      let outputMint = outputSymbol === "USDC" ? USDC_MINT : outputSymbol === "SOL" ? SOL_MINT : "";
      let outputDecimals = outputSymbol === "USDC" ? 6 : outputSymbol === "SOL" ? 9 : 9;

      if (!outputMint) {
        const onChainStock = await findTokenizedStockOnSolana(outputSymbol);
        if (onChainStock) {
          outputMint = onChainStock.mint;
          outputSymbol = onChainStock.symbol;
          outputDecimals = onChainStock.decimals;
        } else {
          try {
            const searchRes = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(outputSymbol)}`, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
            if (searchRes.ok) {
              const items = (await searchRes.json()) as Array<{ id?: string; address?: string; symbol?: string; decimals?: number }>;
              const matched = items.find((i) => (i.symbol?.toUpperCase() === outputSymbol.toUpperCase() || i.symbol?.toUpperCase() === `X${outputSymbol.toUpperCase()}`) && !i.id?.toLowerCase().endsWith("pump"));
              if (matched && (matched.id || matched.address)) {
                outputMint = matched.id || matched.address || "";
                outputSymbol = matched.symbol || outputSymbol;
                outputDecimals = matched.decimals ?? 9;
              }
            }
          } catch {
          }
        }
      }

      if (!outputMint) {
        return NextResponse.json({
          role: "assistant",
          content: `Could not find an active Solana SPL token or tokenized stock for **${outputSymbol}**. Please ensure the symbol is valid on Solana Mainnet or provide its mint address.`,
        });
      }

      const quoteUrl = new URL("https://lite-api.jup.ag/swap/v1/quote");
      quoteUrl.searchParams.set("inputMint", inputMint);
      quoteUrl.searchParams.set("outputMint", outputMint);
      quoteUrl.searchParams.set("amount", inputAmountRaw);
      quoteUrl.searchParams.set("slippageBps", String(maxSlippageBps));

      const headers: HeadersInit = JUPITER_API_KEY ? { "x-api-key": JUPITER_API_KEY } : {};
      const quoteRes = await fetch(quoteUrl.toString(), { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });

      if (!quoteRes.ok) {
        return NextResponse.json({
          role: "assistant",
          content: `No active Jupiter liquidity route found to swap **${inputAmountNum} ${inputSymbol}** for **${outputSymbol}** on Solana Mainnet. The asset may currently lack active DEX trading pools.`,
        });
      }

      const quote = (await quoteRes.json()) as Record<string, unknown>;
      const outputAmount = String(quote.outAmount ?? "0");
      const priceImpactPct = String(quote.priceImpactPct ?? "0");
      const outTokensFormatted = (Number(outputAmount) / Math.pow(10, outputDecimals)).toFixed(4);

      return NextResponse.json({
        role: "assistant",
        content:
          `A restricted Mainnet swap proposal for **${inputAmountNum} ${inputSymbol} → ${outputSymbol}** is ready.\n\n` +
          `A live Jupiter quote is available with estimated output **${outTokensFormatted} ${outputSymbol}**, maximum slippage **${maxSlippageBps} bps**, and **${priceImpactPct}%** price impact. ` +
          "No transaction has been signed or broadcast. Click **Review in Wallet** to inspect and approve in Phantom / Solflare.",
        proposal: {
          id: `swap_${Date.now()}`,
          type: "jupiter_swap",
          mint: outputMint,
          inputMint,
          outputMint,
          inputSymbol,
          outputSymbol,
          inputDecimals,
          outputDecimals,
          solAmount: inputSymbol === "SOL" ? String(inputAmountNum) : "0",
          inputAmount: inputAmountRaw,
          outputAmount,
          minimumOutputAmount: String(quote.otherAmountThreshold ?? "0"),
          priceImpactPct,
          slippageBps: maxSlippageBps,
          estimatedTokens: `${outTokensFormatted} ${outputSymbol}`,
          status: "ready_for_user_signature",
          mode: "restricted_browser_wallet",
          venue: "Jupiter Swap API",
          explanation:
            "Restricted web mode: the AI only creates quotes and unsigned transactions. Your browser wallet remains the final signer.",
          checks: [
            { code: "mainnet_only", status: "pass", message: "Only Solana Mainnet is enabled." },
            { code: "quote_only", status: "pass", message: "Jupiter returned verified route evidence before any signature." },
            { code: "user_wallet_required", status: "pass", message: "Execution requires explicit Phantom/Solflare approval." },
          ],
          quoteResponse: quote,
        },
      });
    }

    const pumpAnalysisIntent = resolvePumpAnalysisIntent(lastUserMessage);
    if (pumpAnalysisIntent.requested) {
      if (selectedWorkspace !== "solana") {
        return NextResponse.json({ role: "assistant", content: "Pump.fun analysis is available only in a Solana session. Open or create a bound Solana session first." });
      }
      if (!pumpAnalysisIntent.mint) {
        return NextResponse.json({ role: "assistant", content: "Provide the full Solana mint address to analyze. Example: Analyze Pump.fun token <mint>." });
      }
      const openRouterApiKey = OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        return NextResponse.json({ role: "assistant", content: "Pump.fun AI analysis is temporarily unavailable because OPENROUTER_API_KEY is not configured on the server." });
      }
      try {
        const model = OPENROUTER_MODEL;
        const result = await runPumpAnalysisAiTool({
          apiKey: openRouterApiKey,
          model,
          messages: messages ?? [],
          exactMint: pumpAnalysisIntent.mint,
          referenceBuyLamports: pumpAnalysisIntent.referenceBuyLamports,
          rpcUrl: selectSolanaRpc(),
          maxTokens: Math.max(512, Math.min(4_096, Number(settings?.outputLimit ?? "1200") || 1_200)),
          temperature: Math.max(0, Math.min(1, Number(settings?.temperature ?? "0.3") || 0.3)),
        });
        return NextResponse.json({
          role: "assistant",
          content: result.content,
          usage: result.usage,
          proposal: {
            id: `pump_analysis_${Date.now()}`,
            type: "pump_analysis",
            mint: result.intelligence.mint,
            solAmount: String(Number(result.intelligence.metrics.referenceBuyInputLamports) / LAMPORTS_PER_SOL),
            estimatedTokens: "Finalized read-only intelligence",
            status: "preview_only",
            mode: "read_only_ai_tool",
            venue: result.intelligence.venue,
            explanation: "The AI selected a scoped read-only tool. Deterministic server code independently verified finalized Pump/PumpSwap evidence; no transaction was built, signed, or broadcast.",
            checks: result.intelligence.researchEligibility?.checks.map((check) => ({ code: check.id, status: check.passed ? "pass" : "block", message: check.message })),
            pumpIntelligence: result.intelligence,
          },
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Pump analysis failed.";
        return NextResponse.json({ role: "assistant", content: `Pump.fun analysis failed safely: ${message} No transaction was created or broadcast.` });
      }
    }

    const pumpMint = findPumpMint(lastUserMessage);
    if (pumpMint) {
      const solAmount = parseSolAmount(lastUserMessage) ?? 0.001;
      return NextResponse.json({
        role: "assistant",
        content:
          `I found Pump.fun mint ${pumpMint.slice(0, 6)}...${pumpMint.slice(-6)} and created a restricted preview for ${solAmount} SOL.\n\n` +
          "Pump.fun on web is currently limited to analysis and preview. Pump.fun signing and broadcast remain disabled until guards, fee ceilings, and final revalidation match the desktop implementation.",
        proposal: {
          id: `pump_${Date.now()}`,
          type: "pump_fun_buy",
          mint: pumpMint,
          solAmount: String(solAmount),
          estimatedTokens: "Preview only",
          status: "preview_only",
          mode: "restricted_preview_only",
          venue: "Pump.fun",
          explanation:
            "Pump.fun web trading is not live. Use this proposal for review, not execution.",
        },
      });
    }

    if (isLimitOrder(lastUserMessage)) {
      const solAmount = parseSolAmount(lastUserMessage) ?? 0.001;
      return NextResponse.json({
        role: "assistant",
        content:
          `I reviewed the Limit Order instruction for ${solAmount} SOL and created a restricted preview proposal.\n\n` +
          "On web, Jupiter v2 Limit Order is currently preview-only. Deposit execution and headless reconciliation require an encrypted local keystore, available in Mirae Desktop.",
        proposal: {
          id: `limit_${Date.now()}`,
          type: "limit_order",
          mint: USDC_MINT,
          solAmount: String(solAmount),
          estimatedTokens: `${(solAmount * 150).toFixed(2)} USDC`,
          status: "preview_only",
          mode: "restricted_preview_only",
          venue: "Jupiter Trigger V2",
          explanation:
            "Limit order web trading berada dalam mode preview-only.",
        },
      });
    }

    const openRouterApiKey = OPENROUTER_API_KEY;
    if (openRouterApiKey) {
      const model = OPENROUTER_MODEL;
      const maxTokens = Math.max(256, Math.min(4_096, Number(settings?.outputLimit ?? "1200") || 1_200));
      const temperature = Math.max(0, Math.min(2, Number(settings?.temperature ?? "0.7") || 0.7));
      const result = await callOpenRouter({
        apiKey: openRouterApiKey,
        model,
        messages: messages ?? [],
        sessionMode: sessionMode === "mission" ? "mission" : "agent",
        walletAddress: typeof walletAddress === "string" ? walletAddress.slice(0, 64) : null,
        maxTokens,
        temperature,
        workspace: selectedWorkspace,
        chainKey: typeof chainKey === "string" ? chainKey.slice(0, 32) : null,
        sessionWalletAddress: typeof sessionWalletAddress === "string" ? sessionWalletAddress.slice(0, 64) : null,
      });
      return NextResponse.json({
        role: "assistant",
        content: result.content,
        usage: result.usage,
      });
    }

    return NextResponse.json({
      role: "assistant",
      content: "Mirae AI is temporarily unavailable because OPENROUTER_API_KEY is not configured on the server. No browser setup is required.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { role: "assistant", content: `AI trading request failed safely. No Mainnet action was taken. Details: ${message}` },
      { status: 200 },
    );
  }
}
