import { NextRequest, NextResponse } from "next/server";
import { VersionedTransaction } from "@solana/web3.js";
import { z } from "zod";

import { cloudDb } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import {
  MAX_PERP_LEVERAGE,
  MAX_PERP_NOTIONAL_USD,
  buildPerpOrderTransaction,
  getPerpAccount,
  isAllowedSymbol,
  normalizeSymbol,
  messageDigestSnapshot,
} from "@/lib/phoenix-perps-core";
import { createPerpPreflightToken } from "@/lib/perp-preflight-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECIMAL = /^\d+(?:\.\d+)?$/u;

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    sessionId: z.string().regex(/^[0-9a-f]{24}$/iu),
    walletAddress: z.string().min(32).max(44),
    symbol: z.string().min(1).max(12),
    direction: z.enum(["long", "short"]),
    baseAmount: z.string().regex(DECIMAL).optional(),
    notionalUsd: z.string().regex(DECIMAL).optional(),
    collateralUsdc: z.string().regex(DECIMAL).optional(),
    leverage: z.number().min(1).max(MAX_PERP_LEVERAGE).optional(),
  }).strict(),
  z.object({
    action: z.literal("close"),
    sessionId: z.string().regex(/^[0-9a-f]{24}$/iu),
    walletAddress: z.string().min(32).max(44),
    symbol: z.string().min(1).max(12),
  }).strict(),
]);

export async function POST(request: NextRequest) {
  try {
    const body = RequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request, body.walletAddress);
    if (isAuthFailure(auth)) return auth;
    await assertSolanaSession(auth.userId, body.sessionId, body.walletAddress);

    const symbol = normalizeSymbol(body.symbol);
    if (!isAllowedSymbol(symbol)) {
      return NextResponse.json(
        { error: `${symbol}-PERP is not an allowlisted Mirae market.`, code: "PERPS_MARKET_NOT_ALLOWED" },
        { status: 400 },
      );
    }

    if (body.action === "close") {
      const account = await getPerpAccount(body.walletAddress);
      const position = account.positions.find((entry) => entry.symbol === `${symbol}-PERP`);
      if (!position) {
        return NextResponse.json(
          { error: `There is no open ${symbol}-PERP position to close.`, code: "PERPS_NO_POSITION" },
          { status: 400 },
        );
      }
      const plan = await buildPerpOrderTransaction({
        walletAddress: body.walletAddress,
        symbol,
        // Closing takes the opposite side, reduce-only so it can only shrink.
        direction: position.direction === "long" ? "short" : "long",
        baseAmount: String(position.baseAmount),
        reduceOnly: true,
      });
      console.log("[perps/prepare] close digest created", {
        digest: plan.transactionDigest,
        sessionId: body.sessionId,
        walletAddress: plan.walletAddress,
        symbol,
        snapshot: messageDigestSnapshot(
          VersionedTransaction.deserialize(Buffer.from(plan.transactionBase64, "base64")),
        ),
      });
      await storePreparedIntent(body.sessionId, plan.walletAddress, plan.transactionDigest, plan.expiresAt);
      return NextResponse.json({
        plan,
        closingPosition: position,
        preflightToken: createPerpPreflightToken({
          sessionId: body.sessionId,
          walletAddress: plan.walletAddress,
          digest: plan.transactionDigest,
          expiresAt: plan.expiresAt,
        }),
      });
    }

    if (!body.baseAmount && !body.notionalUsd) {
      return NextResponse.json(
        { error: "Provide either a base size or a USD notional.", code: "PERPS_SIZE_REQUIRED" },
        { status: 400 },
      );
    }
    const plan = await buildPerpOrderTransaction({
      walletAddress: body.walletAddress,
      symbol,
      direction: body.direction,
      baseAmount: body.baseAmount,
      notionalUsd: body.notionalUsd,
      collateralUsdc: body.collateralUsdc,
      leverage: body.leverage,
    });
    console.log("[perps/prepare] open digest created", {
      digest: plan.transactionDigest,
      sessionId: body.sessionId,
      walletAddress: plan.walletAddress,
      symbol,
      snapshot: messageDigestSnapshot(
        VersionedTransaction.deserialize(Buffer.from(plan.transactionBase64, "base64")),
      ),
    });
    await storePreparedIntent(body.sessionId, plan.walletAddress, plan.transactionDigest, plan.expiresAt);
    return NextResponse.json({
      plan,
      preflightToken: createPerpPreflightToken({
        sessionId: body.sessionId,
        walletAddress: plan.walletAddress,
        digest: plan.transactionDigest,
        expiresAt: plan.expiresAt,
      }),
      maxNotionalUsd: MAX_PERP_NOTIONAL_USD,
      maxLeverage: MAX_PERP_LEVERAGE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The perpetuals preflight failed safely.";
    return NextResponse.json({ error: message, code: "PERPS_PREFLIGHT_FAILED" }, { status: 400 });
  }
}

async function storePreparedIntent(
  sessionId: string,
  walletAddress: string,
  digest: string,
  expiresAt: number,
): Promise<void> {
  await cloudDb.chatMessage.create({
    data: {
      sessionId,
      role: "preflight",
      content: "Internal perpetuals preflight authorization.",
      proposalJson: JSON.stringify({ kind: "perp_preflight", walletAddress, digest, expiresAt }),
    },
  });
}

async function assertSolanaSession(userId: string, sessionId: string, walletAddress: string): Promise<void> {
  const session = await cloudDb.chatSession.findFirst({
    where: { id: sessionId, userId, workspace: "solana", sessionWalletAddress: walletAddress },
    select: { id: true },
  });
  if (!session) throw new Error("A Solana session bound to this wallet is required for perpetuals.");
}
