import { Keypair } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { encryptAgentKey } from "@/lib/cloud-crypto";
import { cloudDb } from "@/lib/cloud-db";
import { tradingQueue } from "@/lib/cloud-queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      maxAllocationLamports = "1000000000",
      maxSingleTxLamports = "100000000",
      maxDrawdownBps = 1000,
      maxTxPerHour = 10,
    } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    // 1. Find or create user record in MongoDB
    let user = await cloudDb.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await cloudDb.user.create({
        data: { walletAddress },
      });
    }

    // 2. Generate new ephemeral Agent Keypair
    const agentKeypair = Keypair.generate();
    const secretKeyBase58 = Buffer.from(agentKeypair.secretKey).toString("hex");

    // 3. Encrypt key for zero-knowledge storage
    const { ciphertext, iv } = encryptAgentKey(secretKeyBase58);

    // 4. Revoke any previous ACTIVE sessions for this user
    await cloudDb.agentSession.updateMany({
      where: { userId: user.id, status: "ACTIVE" },
      data: { status: "PAUSED", revokeReason: "New session started" },
    });

    // 5. Create new ACTIVE AgentSession in MongoDB
    const session = await cloudDb.agentSession.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        encryptedAgentKey: ciphertext,
        iv,
        maxAllocationLamports: String(maxAllocationLamports),
        maxSingleTxLamports: String(maxSingleTxLamports),
        maxDrawdownBps: Number(maxDrawdownBps),
        maxTxPerHour: Number(maxTxPerHour),
        peakBalanceLamports: String(maxAllocationLamports),
        currentBalanceLamports: String(maxAllocationLamports),
      },
    });

    // 6. Enqueue job into Redis Cloud BullMQ queue
    const job = await tradingQueue.add("process-trading", {
      sessionId: session.id,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      jobId: job.id,
      agentPublicKey: agentKeypair.publicKey.toBase58(),
    });
  } catch (err: any) {
    console.error("Failed to start cloud agent session:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
