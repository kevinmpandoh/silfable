import { NextRequest, NextResponse } from "next/server";

import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { MAX_PERP_LEVERAGE, MAX_PERP_NOTIONAL_USD, listPerpMarkets } from "@/lib/phoenix-perps-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireWalletAuth(request);
    if (isAuthFailure(auth)) return auth;
    const feed = await listPerpMarkets();
    return NextResponse.json({
      markets: feed.markets,
      chainSlot: feed.chainSlot,
      updatedAt: feed.updatedAt,
      live: feed.live,
      maxNotionalUsd: MAX_PERP_NOTIONAL_USD,
      maxLeverage: MAX_PERP_LEVERAGE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perpetual market data is unavailable.";
    return NextResponse.json({ error: message, code: "PERPS_MARKETS_UNAVAILABLE" }, { status: 400 });
  }
}
