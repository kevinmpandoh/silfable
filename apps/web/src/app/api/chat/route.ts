import { NextResponse } from "next/server";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LAMPORTS_PER_SOL = 1_000_000_000;

type ChatSettings = {
  maxSlippageBps?: string;
  jupiterApiKey?: string;
  openRouterApiKey?: string;
  aiModel?: string;
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
}) {
  const history = input.messages
    .slice(-12)
    .flatMap((message) =>
      (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
        ? [{ role: message.role, content: message.content.slice(0, 8_000) }]
        : [],
    );
  const capabilityBoundary =
    "You are Silfable Web's restricted Solana Mainnet assistant. " +
    "You may explain wallet data, research, plan trades, and set up 24/7 Cloud Auto DCA schedules via Cloud Worker. The web runtime can prepare a Jupiter SOL-to-USDC quote, 24/7 recurring DCA tasks, and unsigned transactions. " +
    "Pump.fun is preview-only on web. The web vault may hold one encrypted same-address Solana signer, but it is not yet authorized for Pump.fun signing or broadcast. Bridge, EVM, Hyperliquid, autonomous signing, silent broadcast, and full access are unavailable. " +
    "Never request a private key, seed phrase, password, or API key. Never claim a transaction succeeded without a structured on-chain receipt from the application. " +
    "Answer in the user's language, use short headings and bullets when useful, and do not wrap the whole answer in a JSON object.";
  const system =
    input.sessionMode === "mission"
      ? `${capabilityBoundary} Act as a cautious mission planner. State the goal, explicit limits, required evidence, stop conditions, and which final user approval is still needed.`
      : `${capabilityBoundary} Act as an interactive trading assistant. Be concise and distinguish analysis from executable actions.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Silfable Web",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: system },
        {
          role: "system",
          content: `Connected wallet context: ${input.walletAddress ?? "none (chat only)"}. This address is context, not authorization.`,
        },
        ...history,
      ],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown };
    error?: { message?: unknown };
  };
  if (!response.ok) {
    const detail = typeof body.error?.message === "string" ? body.error.message.slice(0, 180) : `status ${response.status}`;
    throw new Error(`OpenRouter rejected the request (${detail})`);
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter returned an empty assistant message");
  }
  const asFiniteNumber = (value: unknown) => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };
  const rawUsage = body.usage;
  const inputTokens = asFiniteNumber(rawUsage?.prompt_tokens);
  const outputTokens = asFiniteNumber(rawUsage?.completion_tokens);
  return {
    content: content.slice(0, 12_000),
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: asFiniteNumber(rawUsage?.total_tokens) || inputTokens + outputTokens,
      costUsd: rawUsage?.cost == null ? null : asFiniteNumber(rawUsage.cost),
      model: input.model,
    },
  };
}

export async function POST(req: Request) {
  try {
    const { messages, settings, sessionMode, walletAddress } = (await req.json()) as {
      messages?: ChatMessage[];
      settings?: ChatSettings;
      sessionMode?: "agent" | "mission";
      walletAddress?: string | null;
    };
    const lastUserMessage = messages?.[messages.length - 1]?.content ?? "";
    const maxSlippageBps = Math.max(1, Math.min(500, Number(settings?.maxSlippageBps ?? "100") || 100));

    if (isSolToUsdcSwap(lastUserMessage)) {
      const solAmount = parseSolAmount(lastUserMessage) ?? 0.001;
      if (solAmount > 0.05) {
        return NextResponse.json({
          role: "assistant",
          content:
            "Saya menolak membuat proposal otomatis untuk nominal di atas 0.05 SOL di web restricted mode. Turunkan nominal dulu, lalu minta quote ulang.",
        });
      }

      const inputAmount = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const quote = await getJupiterQuote(inputAmount, maxSlippageBps, settings?.jupiterApiKey);
      const outputAmount = String(quote.outAmount ?? "0");
      const priceImpactPct = String(quote.priceImpactPct ?? "0");

      return NextResponse.json({
        role: "assistant",
        content:
          `Saya sudah menyiapkan proposal swap Mainnet restricted untuk ${solAmount} SOL ke USDC.\n\n` +
          `Quote Jupiter tersedia dengan estimasi output ${Number(outputAmount) / 1_000_000} USDC, slippage maksimum ${maxSlippageBps} bps, dan price impact sekitar ${priceImpactPct}%. ` +
          "Belum ada transaksi yang ditandatangani atau dibroadcast. Jika detailnya sesuai, klik tombol approval wallet untuk membuat transaksi swap dan menandatanganinya dari Phantom/Solflare.",
        proposal: {
          id: `swap_${Date.now()}`,
          type: "jupiter_swap",
          mint: USDC_MINT,
          inputMint: SOL_MINT,
          outputMint: USDC_MINT,
          outputSymbol: "USDC",
          solAmount: String(solAmount),
          inputAmount: String(inputAmount),
          outputAmount,
          minimumOutputAmount: String(quote.otherAmountThreshold ?? "0"),
          estimatedTokens: `${Number(outputAmount) / 1_000_000} USDC`,
          status: "ready_for_user_signature",
          mode: "restricted_browser_wallet",
          venue: "Jupiter Swap API",
          explanation:
            "Restricted web mode: AI hanya membuat quote dan transaksi unsigned. Wallet browser Anda tetap menjadi final signer.",
          checks: [
            { code: "mainnet_only", status: "pass", message: "Only Solana Mainnet is enabled." },
            { code: "quote_only", status: "pass", message: "Jupiter returned route evidence before any signature." },
            { code: "user_wallet_required", status: "pass", message: "Execution requires explicit Phantom/Solflare approval." },
          ],
          quoteResponse: quote,
        },
      });
    }

    const pumpMint = findPumpMint(lastUserMessage);
    if (pumpMint) {
      const solAmount = parseSolAmount(lastUserMessage) ?? 0.001;
      return NextResponse.json({
        role: "assistant",
        content:
          `Saya menemukan mint Pump.fun ${pumpMint.slice(0, 6)}...${pumpMint.slice(-6)} dan membuat preview restricted untuk ${solAmount} SOL.\n\n` +
          "Untuk web saat ini Pump.fun masih tahap analisis/preview. Signing dan broadcast Pump.fun belum diaktifkan sampai guard, fee ceiling, dan final revalidation sama kuatnya dengan desktop.",
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
            "Pump.fun web trading belum live. Gunakan proposal ini untuk review, bukan eksekusi.",
        },
      });
    }

    if (isLimitOrder(lastUserMessage)) {
      const solAmount = parseSolAmount(lastUserMessage) ?? 0.001;
      return NextResponse.json({
        role: "assistant",
        content:
          `Saya telah meninjau instruksi Limit Order untuk ${solAmount} SOL dan membuat proposal preview restricted.\n\n` +
          "Untuk web saat ini Limit Order Jupiter v2 berada dalam tahap preview-only. Eksekusi deposit dan rekonsiliasi headless membutuhkan keystore terenkripsi lokal (tersedia pada Silfable Desktop).",
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

    const openRouterApiKey = settings?.openRouterApiKey?.trim();
    if (openRouterApiKey) {
      const model = settings?.aiModel?.trim() || "openai/gpt-4o-mini";
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
      });
      return NextResponse.json({
        role: "assistant",
        content: result.content,
        usage: result.usage,
      });
    }

    return NextResponse.json({
      role: "assistant",
      content:
        "### Silfable Web AI Trading Agent\n\n" +
        "Mode aktif: Mainnet restricted.\n\n" +
        "Yang sudah bisa:\n" +
        "- Membuat quote SOL→USDC lewat Jupiter.\n" +
        "- Menyiapkan transaksi unsigned.\n" +
        "- Meminta approval dari wallet browser sebelum broadcast.\n\n" +
        "OpenRouter belum dikonfigurasi, jadi respons ini berasal dari boundary lokal.\n\n" +
        "Yang belum live di web:\n" +
        "- Pump.fun broadcast.\n" +
        "- Autonomous trading.\n" +
        "- Burner-wallet signing.\n" +
        "- Bridge, EVM, Hyperliquid, dan full access tanpa approval.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { role: "assistant", content: `AI trading request gagal aman. Tidak ada aksi Mainnet dilakukan. Detail: ${message}` },
      { status: 200 },
    );
  }
}
