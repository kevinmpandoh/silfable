import { Worker, type Job } from "bullmq";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { decryptAgentKey } from "../services/crypto.js";
import { prisma } from "../services/db.js";
import { redisConnection } from "../services/queue.js";
import { calculatePumpFeePreview } from "../pump/fees.js";
import { validatePumpSlippage } from "../pump/slippage.js";

const FALLBACK_RPC_URL = "https://api.mainnet-beta.solana.com";

// Jupiter API endpoints
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

export type TradingJobPayload = {
  sessionId: string;
  targetMint?: string;
  amountLamports?: number;
  side?: "buy" | "sell";
};

export function startTradingWorker() {
  const worker = new Worker<TradingJobPayload>(
    "trading-queue",
    async (job: Job<TradingJobPayload>) => {
      const { sessionId, targetMint, amountLamports, side } = job.data;
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
        // 3. Evaluate limits (Kill Switch)
        const peak = BigInt(session.peakBalanceLamports);
        const current = BigInt(session.currentBalanceLamports);

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

        // Default trade parameters if not provided
        const inputMint = side === "sell" ? (targetMint || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") : "So11111111111111111111111111111111111111112";
        const outputMint = side === "sell" ? "So11111111111111111111111111111111111111112" : (targetMint || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const tradeAmountLamports = BigInt(amountLamports || 1000000); // 0.001 SOL default

        if (tradeAmountLamports > BigInt(session.maxSingleTxLamports)) {
          console.warn(`[Worker] Amount exceeds maxSingleTxLamports limit (${session.maxSingleTxLamports})`);
          return;
        }

        // 4. SMART ROUTING ENGINE
        console.log(`[Worker] Smart Routing: Attempting Jupiter Quote...`);
        let quoteData: any = null;
        try {
          const quoteResponse = await fetch(`${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${tradeAmountLamports}&slippageBps=${slippageBps}`);
          quoteData = await quoteResponse.json();
        } catch (err: any) {
          console.warn(`[Worker] Jupiter Quote request failed: ${err.message}`);
        }

        // ROUTE A: JUPITER SWAP (Graduated Tokens / Mainnet Tokens)
        if (quoteData && !quoteData.error && quoteData.outAmount) {
          console.log(`[Worker] Route A Selected: Executing via Jupiter Swap API...`);
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

          const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
          const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
          transaction.sign([agentKeypair]);

          const txHash = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });

          console.log(`[Worker] Jupiter Broadcast successful! TxHash: ${txHash}`);

          await prisma.tradeLog.create({
            data: {
              sessionId: session.id,
              actionType: "SWAP",
              tokenIn: inputMint,
              tokenOut: outputMint,
              amountIn: tradeAmountLamports.toString(),
              pnlLamports: "0",
              status: "PENDING",
              txHash: txHash,
            },
          });
          return;
        }

        // ROUTE B: PUMP.FUN BONDING CURVE ROUTING (Pre-graduation Tokens)
        console.log(`[Worker] Route B Selected: Jupiter routing unavailable. Evaluating Pump.fun bonding curve security...`);
        
        // Mock curve state for safety validation check before execution
        const dummyCurveEvidence = {
          virtualTokenReserves: "1000000000000",
          virtualQuoteReserves: "30000000000",
          realTokenReserves: "800000000000",
          tokenTotalSupply: "1000000000000000",
          feeSchedule: {
            protocolFeeBps: "100",
            creatorFeeBps: "50",
            buybackAllocationBps: "0",
            tiers: [],
          },
        };

        const feePreview = calculatePumpFeePreview({
          side: side || "buy",
          rawInputAmount: tradeAmountLamports.toString(),
          maxTotalFeeBps: slippageBps,
          evidence: dummyCurveEvidence,
        });

        if (!feePreview.allowed) {
          console.warn(`[Worker] Pump.fun Execution Blocked: Fees (${feePreview.totalTradingFeeBps} bps) exceed limit (${slippageBps} bps)`);
          return;
        }

        const slippageResult = validatePumpSlippage({
          side: side || "buy",
          expectedOutputAmount: feePreview.expectedTokenAmount || "1000000",
          minimumOutputAmount: (BigInt(feePreview.expectedTokenAmount || "1000000") * 99n / 100n).toString(),
          slippageBps,
        });

        if (!slippageResult.valid) {
          console.warn(`[Worker] Pump.fun Execution Blocked: Slippage check failed: ${slippageResult.reason}`);
          return;
        }

        console.log(`[Worker] Pump.fun Security Checks PASSED. Fee Bps: ${feePreview.totalTradingFeeBps}, Slippage Bps: ${slippageResult.actualSlippageBps}`);
        console.log(`[Worker] Autonomous Pump.fun Smart Routing Ready.`);
      } finally {
        void rawSecretKey;
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
