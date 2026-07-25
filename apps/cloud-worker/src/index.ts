import { config } from "./config/env.js";
import { prisma } from "./services/db.js";
import { redisConnection } from "./services/queue.js";
import { startTradingWorker } from "./worker/trade-worker.js";
import { startDcaWorker } from "./worker/dca-worker.js";
import { startTpSlWorker } from "./worker/tpsl-worker.js";

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

  // Start BullMQ Trading Worker, DCA Scheduler Worker & TP/SL Strategy Worker
  startTradingWorker();
  console.log("[BullMQ Worker] Ready and listening on 'trading-queue'");

  startDcaWorker();
  console.log("[DCA Worker] 24/7 DCA Schedule Ticker started.");

  startTpSlWorker();
  console.log("[TP/SL Worker] 24/7 TP/SL Strategy Ticker started.");

  // Start dummy HTTP Server for Railway Health Checks
  import("http").then((http) => {
    const port = process.env.PORT || 8080;
    http.createServer((_, res) => res.end("Silfable Cloud Worker is running 24/7")).listen(port, () => {
      console.log(`[Health Check] HTTP Server listening on port ${port}`);
    });
  });

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
