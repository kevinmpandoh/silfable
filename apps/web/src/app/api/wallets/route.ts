import { NextRequest, NextResponse } from "next/server";
import { cloudDb, isDbConfigured } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Wallet storage is unavailable.", code: "WALLET_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  const auth = await requireWalletAuth(request);
  if (isAuthFailure(auth)) return auth;
  const user = await cloudDb.user.findUnique({
    where: { walletAddress: auth.walletAddress },
    include: { linkedWallets: { orderBy: { createdAt: "asc" } } },
  });
  if (!user) return NextResponse.json({ error: "Authenticated user was not found." }, { status: 404 });
  return NextResponse.json({
    wallets: [
      { id: `solana:${user.walletAddress}`, namespace: "solana", address: user.walletAddress, label: "Primary Solana", verifiedAt: user.createdAt.toISOString() },
      ...user.linkedWallets.map((wallet) => ({
        id: wallet.id,
        namespace: wallet.namespace,
        address: wallet.address,
        label: wallet.label,
        verifiedAt: wallet.verifiedAt.toISOString(),
      })),
    ],
  });
}

