import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";

export const dynamic = "force-dynamic";

export const MIRAE_TOKEN_MINT = "A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";
export const REQUIRED_TOKEN_BALANCE = 100_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
  }

  let ownerPubkey: PublicKey;
  try {
    ownerPubkey = new PublicKey(address);
  } catch {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  const rpcUrl = selectSolanaRpc();

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "token-gate-check",
        method: "getTokenAccountsByOwner",
        params: [
          ownerPubkey.toBase58(),
          { mint: MIRAE_TOKEN_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`RPC returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      result?: {
        value?: Array<{
          account?: {
            data?: {
              parsed?: {
                info?: {
                  tokenAmount?: {
                    uiAmount?: number | null;
                    amount?: string;
                    decimals?: number;
                  };
                };
              };
            };
          };
        }>;
      };
      error?: unknown;
    };

    let totalBalance = 0;
    const accounts = json.result?.value || [];
    for (const item of accounts) {
      const info = item.account?.data?.parsed?.info?.tokenAmount;
      if (typeof info?.uiAmount === "number") {
        totalBalance += info.uiAmount;
      } else if (info?.amount && typeof info?.decimals === "number") {
        totalBalance += Number(info.amount) / Math.pow(10, info.decimals);
      }
    }

    const isVerified = totalBalance >= REQUIRED_TOKEN_BALANCE;

    return NextResponse.json({
      address: ownerPubkey.toBase58(),
      mint: MIRAE_TOKEN_MINT,
      balance: totalBalance,
      required: REQUIRED_TOKEN_BALANCE,
      isVerified,
    });
  } catch (err: unknown) {
    console.error("Token gate balance check failed:", err);
    return NextResponse.json(
      {
        address: ownerPubkey.toBase58(),
        mint: MIRAE_TOKEN_MINT,
        balance: 0,
        required: REQUIRED_TOKEN_BALANCE,
        isVerified: false,
        error: "Failed to query on-chain balance. Please retry.",
      },
      { status: 500 }
    );
  }
}