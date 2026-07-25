import { prisma } from "../services/db.js";
import { tradingQueue } from "../services/queue.js";

const CHECK_INTERVAL_MS = 20_000; // Check every 20 seconds
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

export function startTpSlWorker() {
  console.log("[TP/SL Worker] Starting 24/7 Cloud TP/SL Strategy Ticker...");

  const intervalId = setInterval(async () => {
    try {
      await processActiveTpSlPositions();
    } catch (err: any) {
      console.error(`[TP/SL Worker] Error processing TP/SL positions: ${err?.message || err}`);
    }
  }, CHECK_INTERVAL_MS);

  // Run immediately on startup
  processActiveTpSlPositions().catch((err) => {
    console.error(`[TP/SL Worker] Error processing initial TP/SL positions: ${err?.message || err}`);
  });

  return () => clearInterval(intervalId);
}

async function processActiveTpSlPositions() {
  // 1. Fetch all ACTIVE position strategies
  const activePositions = await prisma.positionStrategy.findMany({
    where: { status: "ACTIVE" },
    include: { session: true },
  });

  if (activePositions.length === 0) {
    return;
  }

  // 2. Extract unique mint addresses
  const uniqueMints = [...new Set(activePositions.map((p) => p.mintAddress))];

  // 3. Fetch real-time price quotes from Jupiter Price API
  const pricesMap = await fetchJupiterPrices(uniqueMints);
  if (pricesMap.size === 0) {
    return;
  }

  // 4. Evaluate each active position strategy against current market prices
  for (const position of activePositions) {
    try {
      // Validate session status
      if (!position.session || position.session.status !== "ACTIVE") {
        console.log(`[TP/SL Worker] Session ${position.sessionId} is not ACTIVE (${position.session?.status}). Cancelling strategy ${position.id}.`);
        await prisma.positionStrategy.update({
          where: { id: position.id },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      const currentPrice = pricesMap.get(position.mintAddress);
      if (currentPrice === undefined || currentPrice <= 0) {
        continue;
      }

      let triggerReason: "TRIGGERED_TP" | "TRIGGERED_SL" | null = null;

      if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
        triggerReason = "TRIGGERED_TP";
      } else if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
        triggerReason = "TRIGGERED_SL";
      }

      if (triggerReason) {
        console.log(`[TP/SL Worker] 🎯 Target hit for Strategy ${position.id} (${position.mintAddress}). Reason: ${triggerReason}. Current Price: $${currentPrice}`);

        // Update strategy status in DB
        await prisma.positionStrategy.update({
          where: { id: position.id },
          data: { status: triggerReason },
        });

        // Enqueue 100% sell execution job to BullMQ trading queue
        await tradingQueue.add(`tpsl-sell-${position.id}-${Date.now()}`, {
          sessionId: position.sessionId,
          targetMint: position.mintAddress,
          amountLamports: Number(position.amountLamports),
          side: "sell",
        });

        console.log(`[TP/SL Worker] Enqueued sell order to trading-queue for session ${position.sessionId}`);
      }
    } catch (err: any) {
      console.error(`[TP/SL Worker] Error evaluating position strategy ${position.id}: ${err?.message || err}`);
    }
  }
}

async function fetchJupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  try {
    const idsParam = mints.join(",");
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${idsParam}`);
    if (!response.ok) {
      console.warn(`[TP/SL Worker] Jupiter Price API responded with status ${response.status}`);
      return priceMap;
    }

    const json: any = await response.json();
    const data = json?.data || {};

    for (const mint of mints) {
      const priceStr = data[mint]?.price;
      if (priceStr) {
        const num = parseFloat(priceStr);
        if (!isNaN(num)) {
          priceMap.set(mint, num);
        }
      }
    }
  } catch (err: any) {
    console.error(`[TP/SL Worker] Failed to fetch Jupiter prices: ${err?.message || err}`);
  }
  return priceMap;
}
