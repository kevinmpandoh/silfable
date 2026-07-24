import { config } from "./config/env.js";
import { prisma } from "./services/db.js";
import { redisConnection } from "./services/queue.js";
import { startTradingWorker } from "./worker/trade-worker.js";

async function main() {
  console.log("==================================================");
  console.log("🚀 Starting Silfable 24/7 Cloud AI Trading Worker");
  console.log("==================================================");

  // Test Redis Connection
  try {
    const pong = await redisConnection.ping();
    console.log(`[Redis Cloud] Connection successful: ${pong}`);
  } catch (err: any) {
    console.error(`[Redis Cloud] Connection failed: ${err.message}`);
  }

  // Start BullMQ Worker
  startTradingWorker();
  console.log("[BullMQ Worker] Ready and listening on 'trading-queue'");

  // Graceful Shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down worker...");
    await redisConnection.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error starting Cloud Worker:", err);
  process.exit(1);
});
