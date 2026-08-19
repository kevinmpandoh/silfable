import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

const DEFAULT_MAINNET_RPC =
  process.env.SOLANA_RPC_URL
  || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  || "https://api.mainnet-beta.solana.com";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPITER_TOKENS_API = "https://api.jup.ag/tokens/v2";
const JUPITER_TOKENS_LITE_API = "https://lite-api.jup.ag/tokens/v2";

type JupiterTokenRow = {
  id?: unknown;
  address?: unknown;
  mint?: unknown;
  symbol?: unknown;
};

function shortMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function tokenRows(payload: unknown): JupiterTokenRow[] {
  if (Array.isArray(payload)) return payload.filter((row): row is JupiterTokenRow => Boolean(row) && typeof row === "object");
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? data.filter((row): row is JupiterTokenRow => Boolean(row) && typeof row === "object") : [];
}

async function resolveTokenSymbols(mints: string[]): Promise<Map<string, string>> {
  const symbols = new Map<string, string>([[USDC_MINT, "USDC"]]);
  const uniqueMints = [...new Set(mints.filter((mint) => mint !== USDC_MINT))];
  const apiKey = process.env.JUPITER_API_KEY?.trim();

  for (let offset = 0; offset < uniqueMints.length; offset += 20) {
    const batch = uniqueMints.slice(offset, offset + 20);
    const path = `/search?query=${encodeURIComponent(batch.join(","))}`;
    const request = (baseUrl: string) => fetch(`${baseUrl}${path}`, {
      headers: apiKey ? { "x-api-key": apiKey } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).then(async (response) => response.ok ? response.json() : null).catch(() => null);
    const primary = await request(JUPITER_TOKENS_API);
    const payload = tokenRows(primary).length > 0 ? primary : await request(JUPITER_TOKENS_LITE_API);

    for (const row of tokenRows(payload)) {
      const mint = [row.id, row.address, row.mint].find((value): value is string => typeof value === "string");
      const symbol = typeof row.symbol === "string" ? row.symbol.trim() : "";
      if (mint && batch.includes(mint) && symbol) symbols.set(mint, symbol.slice(0, 24));
    }
  }

  return symbols;
}

async function readBalance(endpoint: string, address: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mirae-portfolio",
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RPC merespons HTTP ${response.status}.`);
  const body = await response.json() as {
    result?: { context?: { slot?: unknown }; value?: unknown };
    error?: { message?: unknown };
  };
  if (body.error) {
    throw new Error(typeof body.error.message === "string" ? body.error.message : "The RPC rejected the balance request.");
  }
  const lamports = body.result?.value;
  const slot = body.result?.context?.slot;
  if (typeof lamports !== "number" || !Number.isSafeInteger(lamports) || lamports < 0) {
    throw new Error("The RPC returned an invalid balance.");
  }
  return { lamports, slot: typeof slot === "number" ? slot : null };
}

async function quoteAssetValueUsd(mint: string, rawAmount: string): Promise<number> {
  if (!/^\d+$/u.test(rawAmount) || BigInt(rawAmount) === BigInt(0)) return 0;
  if (mint === USDC_MINT) return Number(BigInt(rawAmount)) / 1_000_000;
  const url = new URL("https://lite-api.jup.ag/swap/v1/quote");
  url.searchParams.set("inputMint", mint);
  url.searchParams.set("outputMint", USDC_MINT);
  url.searchParams.set("amount", rawAmount);
  url.searchParams.set("slippageBps", "100");
  url.searchParams.set("restrictIntermediateTokens", "true");
  const response = await fetch(url, { headers: process.env.JUPITER_API_KEY?.trim() ? { "x-api-key": process.env.JUPITER_API_KEY.trim() } : {}, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const quote = await response.json().catch(() => null) as { outAmount?: unknown } | null;
  return response.ok && typeof quote?.outAmount === "string" && /^\d+$/u.test(quote.outAmount)
    ? Number(BigInt(quote.outAmount)) / 1_000_000
    : 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { address?: unknown };
    const auth = await requireWalletAuth(request, body.address);
    if (isAuthFailure(auth)) return auth;
    if (typeof body.address !== "string") throw new Error("A wallet address is required.");
    const address = new PublicKey(body.address).toBase58();
    const solResult = await readBalance(DEFAULT_MAINNET_RPC, address);

    // Fetch SPL Tokens
    const tokensResponse = await fetch(DEFAULT_MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mirae-portfolio-spl",
        method: "getTokenAccountsByOwner",
        params: [
          address,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed", commitment: "confirmed" }
        ]
      }),
      cache: "no-store",
    }).catch(() => null);

    const tokensBody = tokensResponse ? await tokensResponse.json().catch(() => null) : null;

    const assets: Array<{ mint: string; symbol: string; amount: number; rawAmount: string; valueUsd: number }> = [];
    assets.push({ mint: WRAPPED_SOL_MINT, symbol: "SOL", amount: solResult.lamports / 1e9, rawAmount: String(solResult.lamports), valueUsd: 0 });

    if (tokensBody?.result?.value) {
      for (const item of tokensBody.result.value) {
        const info = item.account?.data?.parsed?.info;
        if (!info) continue;
        const amount = info.tokenAmount?.uiAmount;
        if (amount > 0) {
          assets.push({
            mint: info.mint,
            symbol: shortMint(info.mint),
            amount,
            rawAmount: String(info.tokenAmount?.amount ?? "0"),
            valueUsd: 0
          });
        }
      }
    }

    const tokenSymbols = await resolveTokenSymbols(assets.filter((asset) => asset.mint !== WRAPPED_SOL_MINT).map((asset) => asset.mint));
    for (const asset of assets) {
      asset.symbol = asset.mint === WRAPPED_SOL_MINT ? "SOL" : tokenSymbols.get(asset.mint) ?? shortMint(asset.mint);
    }

    const values = await Promise.all(assets.map((asset) => quoteAssetValueUsd(asset.mint, asset.rawAmount).catch(() => 0)));
    let totalUsd = 0;
    assets.forEach((asset, index) => {
      asset.valueUsd = values[index] ?? 0;
      totalUsd += asset.valueUsd;
    });

    return NextResponse.json({
      address,
      lamports: solResult.lamports,
      sol: solResult.lamports / 1_000_000_000,
      assets: assets.map((asset) => ({ mint: asset.mint, symbol: asset.symbol, amount: asset.amount, valueUsd: asset.valueUsd })),
      totalUsd,
      slot: solResult.slot,
      source: "server-default",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the Mainnet balance.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
