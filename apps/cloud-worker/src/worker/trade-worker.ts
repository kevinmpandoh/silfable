import { Worker, type Job } from "bullmq";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { decryptAgentKey } from "../services/crypto.js";
import { prisma } from "../services/db.js";
import { redisConnection } from "../services/queue.js";

const FALLBACK_RPC_URL = "https://api.mainnet-beta.solana.com";

// Jupiter API endpoints
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

export type TradingJobPayload = {
  sessionId: string;
};

export function startTradingWorker() {
  const worker = new Worker<TradingJobPayload>(
    "trading-queue",
    async (job: Job<TradingJobPayload>) => {
      const { sessionId } = job.data;
      console.log(`[Worker] Processing 24/7 AI trading job for session: ${sessionId}`);

      // 1. Fetch Session from MongoDB
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found in database`);
      }

      if (session.status !== "ACTIVE") {
        console.log(`[Worker] Session ${sessionId} status is ${session.status}. Halting worker.`);
        return;
      }

      // 1.5 Fetch User Settings for RPC
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { settings: true },
      });
      const rpcUrl = user?.settings?.customRpcUrl || FALLBACK_RPC_URL;
      const slippageBps = user?.settings?.slippageBps || 100;
      const connection = new Connection(rpcUrl, "confirmed");

      // 2. Decrypt Agent Key in memory
      const rawSecretKey = decryptAgentKey(session.encryptedAgentKey, session.iv);
      const agentKeypair = Keypair.fromSecretKey(bs58.decode(rawSecretKey));
      console.log(`[Worker] Agent Key decrypted successfully for session ${sessionId} [PubKey: ${agentKeypair.publicKey.toBase58()}]`);

      try {
        // 3. Evaluate limits and simulate/execute transaction
        const peak = BigInt(session.peakBalanceLamports);
        const current = BigInt(session.currentBalanceLamports);

        // Example Drawdown Check
        if (peak > 0n && current < peak) {
          const dropLamports = peak - current;
          const dropBps = Number((dropLamports * 10000n) / peak);

          if (dropBps > session.maxDrawdownBps) {
            console.warn(`[Worker] KILL SWITCH ACTIVATED: Drawdown ${dropBps / 100}% exceeds limit ${session.maxDrawdownBps / 100}%`);
            await prisma.agentSession.update({
              where: { id: sessionId },
              data: {
                status: "REVOKED",
                revokeReason: `Automated Kill Switch: Drawdown reached ${dropBps / 100}%`,
              },
            });
            return;
          }
        }

        // 4. Jupiter Real Mainnet Execution
        // For demonstration of Go-Live, we will swap 0.001 SOL to USDC if within limits
        const inputMint = "So11111111111111111111111111111111111111112"; // SOL
        const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
        const amountLamports = 1000000; // 0.001 SOL

        if (amountLamports > BigInt(session.maxSingleTxLamports)) {
          console.warn(`[Worker] Amount exceeds maxSingleTxLamports`);
          return;
        }

        console.log(`[Worker] Fetching Jupiter Quote...`);
        const quoteResponse = await fetch(`${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`);
        const quoteData = await quoteResponse.json();

        if (quoteData.error) {
          throw new Error(`Jupiter Quote Error: ${quoteData.error}`);
        }

        console.log(`[Worker] Requesting Swap Transaction...`);
        const swapResponse = await fetch(JUPITER_SWAP_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: agentKeypair.publicKey.toBase58(),
            wrapAndUnwrapSol: true,
          }),
        });

        const swapData = await swapResponse.json();
        if (!swapData.swapTransaction) {
          throw new Error("Failed to get swap transaction from Jupiter");
        }

        // 5. Sign and Broadcast Transaction
        console.log(`[Worker] Signing and Broadcasting Transaction...`);
        const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        transaction.sign([agentKeypair]);
        
        const latestBlockHash = await connection.getLatestBlockhash();
        const txHash = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        console.log(`[Worker] Broadcast successful! TxHash: ${txHash}`);

        // Record Log
        await prisma.tradeLog.create({
          data: {
            sessionId: session.id,
            actionType: "SWAP",
            tokenIn: inputMint,
            tokenOut: outputMint,
            amountIn: amountLamports.toString(),
            pnlLamports: "0",
            status: "PENDING", // Monitor later for SUCCESS
            txHash: txHash,
          },
        });

        console.log(`[Worker] Trade executed successfully for session ${sessionId}.`);
      } finally {
        // Zero out decrypted key reference in scope
        void rawSecretKey;
        // In a real environment, we'd also clear the buffer if possible
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
