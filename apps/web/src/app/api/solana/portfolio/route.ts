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
    throw new Error("RPC URL tidak valid.");
  }
  if (url.protocol !== "https:") throw new Error("RPC URL harus menggunakan HTTPS.");
  if (url.username || url.password || url.port) throw new Error("RPC URL tidak boleh memakai credential URL atau port khusus.");
  if (url.hostname === "mainnet-helius-rpc.com") {
    throw new Error("Hostname Helius salah. Gunakan mainnet.helius-rpc.com, bukan mainnet-helius-rpc.com.");
  }
  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_RPC_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("Provider RPC belum didukung oleh proxy web Silfable.");
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
    throw new Error(typeof body.error.message === "string" ? body.error.message : "RPC menolak permintaan saldo.");
  }
  const lamports = body.result?.value;
  const slot = body.result?.context?.slot;
  if (typeof lamports !== "number" || !Number.isSafeInteger(lamports) || lamports < 0) {
    throw new Error("RPC mengembalikan saldo yang tidak valid.");
  }
  return { lamports, slot: typeof slot === "number" ? slot : null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { address?: unknown; customRpcUrl?: unknown };
    const auth = await requireWalletAuth(request, body.address);
    if (isAuthFailure(auth)) return auth;
    if (typeof body.address !== "string") throw new Error("Alamat wallet diperlukan.");
    const address = new PublicKey(body.address).toBase58();
    const customRpcUrl = validateCustomRpcUrl(body.customRpcUrl);
    const result = await readBalance(customRpcUrl ?? DEFAULT_MAINNET_RPC, address);
    return NextResponse.json({
      address,
      lamports: result.lamports,
      sol: result.lamports / 1_000_000_000,
      slot: result.slot,
      source: customRpcUrl ? "custom" : "default",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saldo Mainnet tidak dapat dimuat.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
