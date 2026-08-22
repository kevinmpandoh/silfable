import { NextRequest, NextResponse } from "next/server";

import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { getPerpCandles } from "@/lib/phoenix-perps-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireWalletAuth(request);
    if (isAuthFailure(auth)) return auth;
    const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
    const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "1h";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 120);
    const candles = await getPerpCandles(symbol, timeframe, limit);
    return NextResponse.json({ candles });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Candle data is unavailable.";
    return NextResponse.json(
      { error: message, code: "PERPS_CANDLES_UNAVAILABLE" },
      { status: 400 }
    );
  }
}
