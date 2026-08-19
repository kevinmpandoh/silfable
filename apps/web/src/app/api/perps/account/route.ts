import { NextRequest, NextResponse } from "next/server";

import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { getPerpAccount } from "@/lib/phoenix-perps-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.nextUrl.searchParams.get("walletAddress");
    const auth = await requireWalletAuth(request, walletAddress ?? undefined);
    if (isAuthFailure(auth)) return auth;
    const account = await getPerpAccount(walletAddress ?? auth.walletAddress);
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The perpetuals account could not be read.";
    return NextResponse.json({ error: message, code: "PERPS_ACCOUNT_UNAVAILABLE" }, { status: 400 });
  }
}
