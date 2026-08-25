import { NextRequest, NextResponse } from "next/server";
import { X402ExecuteRequestSchema, X402ExecuteResponseSchema, X402ReceiptSchema, X402ResourceSchema, X402_SOLANA_MAINNET, X402_SOLANA_USDC_MINT, type X402Receipt } from "@mirae/contracts";
import type { X402Receipt as DatabaseX402Receipt } from "@prisma/client";
import { cloudDb } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { assertSignedTransactionMatches, callPaidResource, digest } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = X402ExecuteRequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request, input.walletAddress);
    if (isAuthFailure(auth)) return auth;
    const row = await cloudDb.x402Receipt.findFirst({ where: { planId: input.planId, userId: auth.userId, sessionId: input.sessionId } });
    if (!row || row.walletAddress !== input.walletAddress) throw new Error("Prepared x402 payment is not bound to this wallet session");
    if (row.status !== "AWAITING_SIGNATURE") throw new Error("This x402 payment was already submitted or is no longer usable");
    if (row.expiresAt.getTime() <= Date.now()) { await cloudDb.x402Receipt.update({ where: { id: row.id }, data: { status: "EXPIRED", errorCode: "EXPIRED", errorMessage: "Prepared payment expired" } }); throw new Error("Prepared x402 payment expired"); }
    assertSignedTransactionMatches(row.preparedTransactionBase64, input.signedTransactionBase64, input.walletAddress);
    const storedRequest = JSON.parse(row.requestJson) as { request?: { method: "GET" | "POST"; url: string; body: unknown }; method?: "GET" | "POST"; url?: string; body?: unknown };
    const requestValue = (storedRequest.request ?? storedRequest) as { method: "GET" | "POST"; url: string; body: unknown };
    const requirements = JSON.parse(row.requirementsJson);
    const resource = X402ResourceSchema.parse({ id: row.resourceId, resource: { url: row.resourceUrl }, method: requestValue.method, requirements, quality: { callsLast30Days: null, uniquePayersLast30Days: null, lastCalledAt: null }, discoveredAt: row.createdAt.toISOString() });
    if (digest(requestValue) !== row.requestDigest || digest(requirements) !== row.requirementsDigest) throw new Error("Stored x402 payment binding is invalid");
    await cloudDb.x402Receipt.update({ where: { id: row.id }, data: { status: "SUBMITTED" } });
    try {
      const paid = await callPaidResource({ resource, request: requestValue, signedTransactionBase64: input.signedTransactionBase64 });
      const settlement = { success: true, transaction: String(paid.settlement.transaction), network: X402_SOLANA_MAINNET, ...(typeof paid.settlement.payer === "string" ? { payer: paid.settlement.payer } : {}) };
      const responseValue = { mimeType: paid.mimeType, body: paid.body, receivedAt: new Date().toISOString() };
      const updated = await cloudDb.x402Receipt.update({ where: { id: row.id }, data: { status: "RESOURCE_RECEIVED", signature: settlement.transaction, settlementJson: JSON.stringify(settlement), resourceResponseJson: JSON.stringify(responseValue), errorCode: null, errorMessage: null } });
      return NextResponse.json(X402ExecuteResponseSchema.parse({ schemaVersion: 1, requestId: input.requestId, receipt: toReceipt(updated) }));
    } catch (error) {
      await cloudDb.x402Receipt.update({ where: { id: row.id }, data: { status: "UNKNOWN", errorCode: "RESOURCE_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Provider outcome is unknown" } });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "x402 submission failed safely", code: "X402_SUBMIT_FAILED" }, { status: 400 });
  }
}

function toReceipt(row: DatabaseX402Receipt): X402Receipt {
  return X402ReceiptSchema.parse({ id: row.publicId, planId: row.planId, sessionId: row.sessionId, walletAddress: row.walletAddress, resourceId: row.resourceId, resourceUrl: row.resourceUrl, providerOrigin: row.providerOrigin, requestDigest: row.requestDigest, requirementsDigest: row.requirementsDigest, idempotencyKey: row.idempotencyKey, amount: row.amount, asset: X402_SOLANA_USDC_MINT, payTo: row.payTo, signature: row.signature, status: row.status, settlement: row.settlementJson ? JSON.parse(row.settlementJson) : null, resourceResponse: row.resourceResponseJson ? JSON.parse(row.resourceResponseJson) : null, errorCode: row.errorCode, errorMessage: row.errorMessage, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
}
