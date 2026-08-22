import bs58 from "bs58";
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { z } from "zod";

import { cloudDb } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";
import { messageDigest } from "@/lib/phoenix-perps-core";
import { verifyPerpPreflightToken } from "@/lib/perp-preflight-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{24}$/iu),
  walletAddress: z.string().min(32).max(44),
  signedTransaction: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/u).max(32_768),
  preflightToken: z.string().max(4_096).optional(),
}).strict();

export async function POST(request: NextRequest) {
  let localSignature: string | null = null;
  try {
    const body = RequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request, body.walletAddress);
    if (isAuthFailure(auth)) return auth;
    const walletAddress = new PublicKey(body.walletAddress).toBase58();
    const session = await cloudDb.chatSession.findFirst({
      where: { id: body.sessionId, userId: auth.userId, workspace: "solana", sessionWalletAddress: walletAddress },
      select: { id: true },
    });
    if (!session) throw new Error("A Solana session bound to this wallet is required for perpetuals.");

    const bytes = Buffer.from(body.signedTransaction, "base64");
    if (bytes.length === 0 || bytes.length > 16_384) throw new Error("Signed transaction size is invalid.");
    const transaction = VersionedTransaction.deserialize(bytes);

    if (transaction.message.staticAccountKeys[0]?.toBase58() !== walletAddress) {
      throw new Error("The transaction fee payer is not the authenticated wallet.");
    }
    if (!transaction.signatures.every((signature) => signature.some((byte) => byte !== 0))) {
      throw new Error("The transaction is missing the wallet signature.");
    }
    // The instruction bytes are built by the exchange, so instead of re-deriving
    // a program allowlist here, the signed message is matched against the digest
    // this server stored when it prepared and simulated the order. Anything the
    // browser altered — or built elsewhere — no longer matches and is refused.
    const digest = messageDigest(transaction);
    const validDirectProof = Boolean(
      body.preflightToken &&
        verifyPerpPreflightToken(body.preflightToken, {
          sessionId: body.sessionId,
          walletAddress,
          digest,
        }),
    );
    if (!validDirectProof) await assertPreparedHere(body.sessionId, digest);

    localSignature = bs58.encode(transaction.signatures[0]!);
    const connection = new Connection(selectSolanaRpc(), "confirmed");
    const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 2 });
    if (signature !== localSignature) throw new Error("RPC signature does not match the locally derived transaction signature.");
    try {
      const receipt = await connection.confirmTransaction(signature, "confirmed");
      return NextResponse.json({
        signature,
        status: receipt.value.err ? "failed" : "confirmed",
        error: receipt.value.err ? "Solana rejected the perpetuals transaction." : undefined,
        explorerUrl: `https://solscan.io/tx/${signature}`,
      });
    } catch (cause) {
      return NextResponse.json({
        signature,
        status: "unknown",
        error: cause instanceof Error ? cause.message : "Broadcast succeeded but confirmation is unavailable.",
        explorerUrl: `https://solscan.io/tx/${signature}`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The transaction could not be broadcast.";
    return NextResponse.json({
      error: localSignature
        ? "Broadcast status is unknown. Verify the locally derived signature before preparing another order."
        : message,
      signature: localSignature,
      status: localSignature ? "unknown" : "failed",
      explorerUrl: localSignature ? `https://solscan.io/tx/${localSignature}` : null,
    }, { status: localSignature ? 200 : 400 });
  }
}

async function assertPreparedHere(sessionId: string, digest: string): Promise<void> {
  const prepared = await cloudDb.chatMessage.findFirst({
    where: {
      sessionId,
      role: { in: ["preflight", "assistant"] },
      proposalJson: { contains: digest },
      createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    select: { id: true },
  });
  if (!prepared) {
    throw new Error("This transaction was not prepared by Mirae for this session. Run preflight again before approving.");
  }
}
