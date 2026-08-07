import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

const API_URL = "https://trade-api.gateway.uniswap.org/v1/quote";
const CHAIN_ID = 4_663;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const ADDRESS = /^0x[0-9a-f]{40}$/iu;
const RAW = /^[1-9]\d*$/u;

function tokenAddress(symbol: unknown): string | null {
  if (symbol === "ETH") return NATIVE_ETH;
  if (symbol === "USDG") return USDG;
  return null;
}

function decimalToRaw(amount: unknown, decimals: number): string | null {
  if (typeof amount !== "string" || !/^\d+(?:\.\d+)?$/u.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) return null;
  const raw = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+/u, "");
  return RAW.test(raw) ? raw : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as { walletAddress?: unknown; apiKey?: unknown; sellToken?: unknown; buyToken?: unknown; amount?: unknown; slippageBps?: unknown };
    const auth = await requireWalletAuth(request, input.walletAddress);
    if (isAuthFailure(auth)) return auth;
    if (typeof input.walletAddress !== "string" || !ADDRESS.test(input.walletAddress)) return NextResponse.json({ error: "A valid bound EVM wallet is required." }, { status: 400 });
    if (typeof input.apiKey !== "string" || input.apiKey.trim().length < 8) return NextResponse.json({ error: "Configure and verify a Uniswap Trading API key in Settings before preparing a Robinhood swap." }, { status: 400 });
    const tokenIn = tokenAddress(input.sellToken);
    const tokenOut = tokenAddress(input.buyToken);
    if (!tokenIn || !tokenOut || tokenIn === tokenOut) return NextResponse.json({ error: "Only USDG ↔ ETH Robinhood swaps are supported." }, { status: 400 });
    const amountIn = decimalToRaw(input.amount, input.sellToken === "ETH" ? 18 : 6);
    if (!amountIn) return NextResponse.json({ error: "Swap amount must be a positive value with supported token precision." }, { status: 400 });
    const slippageBps = Math.max(1, Math.min(500, Number(input.slippageBps) || 100));
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { Accept: "application/json", "content-type": "application/json", "x-api-key": input.apiKey.trim(), "x-permit2-disabled": "true", "x-universal-router-version": "2.1.1" },
      body: JSON.stringify({ type: "EXACT_INPUT", amount: amountIn, tokenInChainId: CHAIN_ID, tokenOutChainId: CHAIN_ID, tokenIn, tokenOut, swapper: input.walletAddress, recipient: input.walletAddress, slippageTolerance: slippageBps / 100, routingPreference: "BEST_PRICE", protocols: ["V2", "V3", "V4"] }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: `Uniswap quote failed: ${response.status}` }, { status: 502 });
    const result = asRecord(body);
    const quote = asRecord(result?.quote);
    const quoteInput = asRecord(quote?.input);
    const quoteOutput = asRecord(quote?.output);
    if (result?.routing !== "CLASSIC" || result?.permitData != null || quoteInput?.amount !== amountIn || String(quoteInput?.token).toLowerCase() !== tokenIn || String(quoteOutput?.token).toLowerCase() !== tokenOut || !RAW.test(String(quoteOutput?.amount ?? ""))) {
      return NextResponse.json({ error: "Uniswap returned a route that does not meet Silfable's Robinhood safety policy." }, { status: 502 });
    }
    if (!quoteOutput) return NextResponse.json({ error: "Uniswap did not return an output amount." }, { status: 502 });
    const outputAmount = String(quoteOutput.amount);
    const minimumOutputAmount = RAW.test(String(quoteOutput.minimumAmount ?? "")) ? String(quoteOutput.minimumAmount) : ((BigInt(outputAmount) * BigInt(10_000 - slippageBps)) / BigInt(10_000)).toString();
    return NextResponse.json({ quote, amountIn, outputAmount, minimumOutputAmount, tokenIn, tokenOut, expiresAt: Date.now() + 300_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare the Uniswap quote.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
