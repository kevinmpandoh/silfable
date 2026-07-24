import { encryptAgentKey } from "./services/crypto.js";
import { prisma } from "./services/db.js";
import { tradingQueue } from "./services/queue.js";

async function verifyWorkerWorkflow() {
  console.log("=========================================");
  console.log("🧪 Testing Cloud Worker Enqueue & DB Workflow");
  console.log("=========================================");

  try {
    // 1. Create or Find Test User in MongoDB
    const testWallet = `0xTestWallet_${Date.now()}`;
    const user = await prisma.user.create({
      data: { walletAddress: testWallet },
    });
    console.log(`[DB] Created test user: ${user.id} (${user.walletAddress})`);

    // 2. Encrypt Agent Private Key
    const dummyKey = "5K8_mock_solana_private_key_string";
    const { ciphertext, iv } = encryptAgentKey(dummyKey);

    // 3. Create Active Agent Session in MongoDB
    const session = await prisma.agentSession.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        encryptedAgentKey: ciphertext,
        iv,
        maxAllocationLamports: "1000000000", // 1 SOL
        maxSingleTxLamports: "100000000",   // 0.1 SOL
        maxDrawdownBps: 1000,               // 10%
        maxTxPerHour: 10,
        peakBalanceLamports: "1000000000",
        currentBalanceLamports: "1000000000",
      },
    });
    console.log(`[DB] Created active AgentSession: ${session.id}`);

    // 4. Enqueue Job into Redis Cloud BullMQ Queue
    const job = await tradingQueue.add("process-trading", {
      sessionId: session.id,
    });
    console.log(`[BullMQ] Successfully enqueued job ID: ${job.id} for session ${session.id}`);
    console.log("✅ Worker verification test completed successfully!");
  } catch (err: any) {
    console.error("❌ Verification failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyWorkerWorkflow();
