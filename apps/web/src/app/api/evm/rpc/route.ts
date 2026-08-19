import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

const ALLOWED_METHODS = new Set([
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getCode",
]);

export async function POST(request: NextRequest) {
  const auth = await requireWalletAuth(request);
  if (isAuthFailure(auth)) return auth;
  const input = await request.json().catch(() => null) as { method?: unknown; params?: unknown } | null;
  if (!input || typeof input.method !== "string" || !ALLOWED_METHODS.has(input.method) || !Array.isArray(input.params)) {
    return NextResponse.json({ error: "Unsupported Robinhood RPC request." }, { status: 400 });
  }
  const rpcUrl = process.env.ROBINHOOD_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "mirae-web", method: input.method, params: input.params }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => null) as { result?: unknown; error?: { message?: string } } | null;
    if (!response.ok || !payload || payload.error) return NextResponse.json({ error: payload?.error?.message || `Robinhood RPC returned HTTP ${response.status}.` }, { status: 502 });
    return NextResponse.json({ result: payload.result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Robinhood RPC request failed." }, { status: 502 });
  }
}
