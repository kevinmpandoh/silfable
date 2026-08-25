import { NextRequest, NextResponse } from "next/server";
import { X402ReceiptSchema, X402_SOLANA_USDC_MINT } from "@mirae/contracts";
import { cloudDb } from "@/lib/cloud-db";
import { readWalletAuth } from "@/lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await readWalletAuth(request);
  if (!auth) return NextResponse.json({ error: "Wallet authentication is required", code: "WALLET_AUTH_REQUIRED" }, { status: 401 });
  const { id } = await context.params;
  const row = await cloudDb.x402Receipt.findFirst({ where: { publicId: id, userId: auth.userId } });
  if (!row) return NextResponse.json({ error: "x402 receipt was not found", code: "X402_RECEIPT_NOT_FOUND" }, { status: 404 });
  const receipt = X402ReceiptSchema.parse({ id: row.publicId, planId: row.planId, sessionId: row.sessionId, walletAddress: row.walletAddress, resourceId: row.resourceId, resourceUrl: row.resourceUrl, providerOrigin: row.providerOrigin, requestDigest: row.requestDigest, requirementsDigest: row.requirementsDigest, idempotencyKey: row.idempotencyKey, amount: row.amount, asset: X402_SOLANA_USDC_MINT, payTo: row.payTo, signature: row.signature, status: row.status, settlement: row.settlementJson ? JSON.parse(row.settlementJson) : null, resourceResponse: row.resourceResponseJson ? JSON.parse(row.resourceResponseJson) : null, errorCode: row.errorCode, errorMessage: row.errorMessage, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  return NextResponse.json({ schemaVersion: 1, receipt });
}
