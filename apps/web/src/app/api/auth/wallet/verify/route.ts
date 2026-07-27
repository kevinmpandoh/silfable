import { NextRequest, NextResponse } from "next/server";
import { cloudDb, isDbConfigured } from "@/lib/cloud-db";
import {
  createOpaqueToken,
  normalizeWalletAddress,
  setWalletSessionCookie,
  sha256,
  verifyWalletSignature,
  WALLET_SESSION_TTL_MS,
} from "@/lib/wallet-auth";

function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/iu.test(value);
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Wallet authentication storage is unavailable.", code: "AUTH_STORAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      challengeId?: unknown;
      walletAddress?: unknown;
      signature?: unknown;
    };
    if (!isObjectId(body.challengeId) || typeof body.signature !== "string") {
      return NextResponse.json(
        { error: "Challenge and signature are required.", code: "INVALID_AUTH_PAYLOAD" },
        { status: 400 },
      );
    }
    const walletAddress = normalizeWalletAddress(body.walletAddress);
    const challenge = await cloudDb.walletAuthChallenge.findUnique({
      where: { id: body.challengeId },
    });
    if (
      !challenge ||
      challenge.walletAddress !== walletAddress ||
      challenge.usedAt ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "The authentication challenge is invalid, expired, or already used.", code: "AUTH_CHALLENGE_INVALID" },
        { status: 401 },
      );
    }
    if (
      !verifyWalletSignature({
        walletAddress,
        message: challenge.message,
        signature: body.signature,
      })
    ) {
      return NextResponse.json(
        { error: "The wallet signature is invalid.", code: "INVALID_WALLET_SIGNATURE" },
        { status: 401 },
      );
    }

    const consumed = await cloudDb.walletAuthChallenge.updateMany({
      where: {
        id: challenge.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      return NextResponse.json(
        { error: "The authentication challenge was already consumed.", code: "AUTH_REPLAY_BLOCKED" },
        { status: 409 },
      );
    }

    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + WALLET_SESSION_TTL_MS);
    const session = await cloudDb.walletAuthSession.create({
      data: {
        walletAddress,
        tokenHash: sha256(token),
        expiresAt,
      },
    });
    await cloudDb.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: {},
    });

    const response = NextResponse.json({
      authenticated: true,
      walletAddress,
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
      authority: "restricted-browser-wallet",
    });
    setWalletSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet authentication failed.";
    return NextResponse.json({ error: message, code: "WALLET_AUTH_FAILED" }, { status: 400 });
  }
}
