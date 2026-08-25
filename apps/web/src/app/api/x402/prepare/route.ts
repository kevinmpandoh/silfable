import { NextRequest, NextResponse } from "next/server";
import { X402PrepareRequestSchema, X402PrepareResponseSchema } from "@mirae/contracts";
import { cloudDb } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { preparePayment } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = X402PrepareRequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request, input.walletAddress);
    if (isAuthFailure(auth)) return auth;
    const session = await cloudDb.chatSession.findFirst({ where: { id: input.sessionId, userId: auth.userId, workspace: "solana", sessionWalletAddress: input.walletAddress }, select: { id: true } });
    if (!session) throw new Error("A Solana chat session bound to this wallet is required");
    const existing = await cloudDb.x402Receipt.findMany({ where: { userId: auth.userId, sessionId: input.sessionId, status: { in: ["SUBMITTED", "SETTLED", "RESOURCE_RECEIVED"] } }, select: { amount: true } });
    const missionSpentAtomic = existing.reduce((total, row) => total + BigInt(row.amount), 0n);
    const prepared = await preparePayment({ sessionId: input.sessionId, walletAddress: input.walletAddress, resource: input.resource, requestInput: input.input, maxResourceAtomic: BigInt(input.maxResourceAmount), maxMissionAtomic: BigInt(input.maxMissionAmount), missionSpentAtomic });
    await cloudDb.x402Receipt.create({ data: {
      publicId: crypto.randomUUID(), planId: prepared.id, userId: auth.userId, sessionId: input.sessionId, walletAddress: input.walletAddress,
      resourceId: prepared.resource.id, resourceUrl: prepared.resource.resource.url, providerOrigin: new URL(prepared.resource.resource.url).origin,
      requestJson: JSON.stringify({ request: prepared.request, input: input.input }), requestDigest: prepared.requestDigest, requirementsJson: JSON.stringify(prepared.resource.requirements), requirementsDigest: prepared.requirementsDigest,
      idempotencyKey: prepared.idempotencyKey, preparedTransactionBase64: prepared.transactionBase64, amount: prepared.resource.requirements.amount, asset: prepared.resource.requirements.asset,
      payTo: prepared.resource.requirements.payTo, status: prepared.status, expiresAt: new Date(prepared.expiresAt),
    } });
    return NextResponse.json(X402PrepareResponseSchema.parse({ schemaVersion: 1, requestId: input.requestId, prepared }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "x402 preparation failed safely", code: "X402_PREPARE_FAILED" }, { status: 400 });
  }
}
