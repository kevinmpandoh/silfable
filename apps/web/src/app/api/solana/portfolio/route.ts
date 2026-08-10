import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

const DEFAULT_MAINNET_RPC =
  process.env.SOLANA_RPC_URL
  || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  || "https://api.mainnet-beta.solana.com";

const ALLOWED_RPC_HOST_SUFFIXES = [
  ".helius-rpc.com",
  ".quiknode.pro",
  ".alchemy.com",
  ".triton.one",
  ".ankr.com",
];

function validateCustomRpcUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The RPC URL is invalid.");
  }
  if (url.protocol !== "https:") throw new Error("The RPC URL must use HTTPS.");
  if (url.username || url.password || url.port) throw new Error("The RPC URL cannot include credentials or a custom port.");
  if (url.hostname === "mainnet-helius-rpc.com") {
    throw new Error("Invalid Helius hostname. Use mainnet.helius-rpc.com, not mainnet-helius-rpc.com.");
  }
  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_RPC_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("This RPC provider is not supported by the Silfable web proxy.");
  }
  return url.toString();
}

async function readBalance(endpoint: string, address: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "silfable-portfolio",
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { address?: unknown; customRpcUrl?: unknown };
    const auth = await requireWalletAuth(request, body.address);
    if (isAuthFailure(auth)) return auth;
    if (typeof body.address !== "string") throw new Error("A wallet address is required.");
    const address = new PublicKey(body.address).toBase58();
    const customRpcUrl = validateCustomRpcUrl(body.customRpcUrl);
    const solResult = await readBalance(customRpcUrl ?? DEFAULT_MAINNET_RPC, address);
    
    // Fetch SPL Tokens
    const tokensResponse = await fetch(customRpcUrl ?? DEFAULT_MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "silfable-portfolio-spl",
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
    
    const assets = [];
    assets.push({ mint: "SOL", symbol: "SOL", amount: solResult.lamports / 1e9, valueUsd: 0 });

    if (tokensBody?.result?.value) {
      for (const item of tokensBody.result.value) {
        const info = item.account?.data?.parsed?.info;
        if (!info) continue;
        const amount = info.tokenAmount?.uiAmount;
        if (amount > 0) {
          // Identify USDC for better display
          const isUsdc = info.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
          assets.push({
            mint: info.mint,
            symbol: isUsdc ? "USDC" : "SPL",
            amount,
            valueUsd: 0
          });
        }
      }
    }

    let totalUsd = 0;
    try {
      const ids = assets.map(a => a.mint).join(",");
      if (ids) {
        const priceResponse = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
        if (priceResponse.ok) {
          const priceRes = await priceResponse.json();
          if (priceRes?.data) {
            for (const asset of assets) {
              const priceData = priceRes.data[asset.mint];
              if (priceData?.price) {
                asset.valueUsd = asset.amount * Number(priceData.price);
                totalUsd += asset.valueUsd;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Jupiter prices", e);
    }

    return NextResponse.json({
      address,
      lamports: solResult.lamports,
      sol: solResult.lamports / 1_000_000_000,
      assets,
      totalUsd,
      slot: solResult.slot,
      source: customRpcUrl ? "custom" : "default",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the Mainnet balance.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
