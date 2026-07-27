import { NextRequest, NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";
import {
  buildWalletAuthMessage,
  createOpaqueToken,
  normalizeWalletAddress,
  sha256,
  WALLET_CHALLENGE_TTL_MS,
} from "@/lib/wallet-auth";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Wallet authentication storage is unavailable.", code: "AUTH_STORAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { walletAddress?: unknown };
    const walletAddress = normalizeWalletAddress(body.walletAddress);
    const recentCount = await safeDbQuery(
      () =>
        cloudDb.walletAuthChallenge.count({
          where: {
            walletAddress,
            createdAt: { gte: new Date(Date.now() - 60_000) },
          },
        }),
      0,
    );
    if (recentCount >= 5) {
      return NextResponse.json(
        { error: "Too many authentication requests. Try again in one minute.", code: "AUTH_RATE_LIMITED" },
        { status: 429 },
      );
    }

    const nonce = createOpaqueToken(24);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + WALLET_CHALLENGE_TTL_MS);
    const domain = request.nextUrl.host;
    const uri = request.nextUrl.origin;
    const message = buildWalletAuthMessage({
      domain,
      uri,
      walletAddress,
      nonce,
      issuedAt,
      expiresAt,
    });
    const challenge = await cloudDb.walletAuthChallenge.create({
      data: {
        walletAddress,
        nonceHash: sha256(nonce),
        message,
        expiresAt,
      },
    });

    return NextResponse.json({
      challengeId: challenge.id,
      walletAddress,
      message,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create wallet challenge.";
    return NextResponse.json({ error: message, code: "AUTH_CHALLENGE_FAILED" }, { status: 400 });
  }
}
