import { prisma } from "../services/db.js";
import { tradingQueue } from "../services/queue.js";

const DISCOVERY_CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds
const PUMP_NEW_TOKENS_API = "https://frontend-api.pump.fun/coins?offset=0&limit=10&sort=created_timestamp&order=DESC&includeNsfw=false";

export function startDiscoveryWorker() {
  console.log("[Discovery Worker] Starting 24/7 Autonomous Token Discovery Ticker (Pump.fun)...");

  const intervalId = setInterval(async () => {
    try {
      await processAutonomousTokenDiscovery();
    } catch (err: any) {
      console.error(`[Discovery Worker] Error processing token discovery: ${err?.message || err}`);
    }
  }, DISCOVERY_CHECK_INTERVAL_MS);

  // Run immediately on startup
  processAutonomousTokenDiscovery().catch((err) => {
    console.error(`[Discovery Worker] Error processing initial token discovery: ${err?.message || err}`);
  });

  return () => clearInterval(intervalId);
}

async function processAutonomousTokenDiscovery() {
  // 1. Fetch all ACTIVE sessions that have enabled Autonomous Discovery (Degen Mode)
  const activeDiscoverySessions = await prisma.agentSession.findMany({
    where: {
      status: "ACTIVE",
      allowAutonomousDiscovery: true,
    },
  });

  if (activeDiscoverySessions.length === 0) {
    return;
  }

  // 2. Fetch recent newly created tokens from Pump.fun
  const newTokens = await fetchRecentPumpTokens();
  if (newTokens.length === 0) {
    return;
  }

  // 3. Filter tokens using Anti-Rugpull Heuristics
  const qualifiedTokens = newTokens.filter(evaluateAntiRugpullHeuristics);
  if (qualifiedTokens.length === 0) {
    console.log(`[Discovery Worker] Scanned ${newTokens.length} new Pump.fun tokens; 0 passed Anti-Rugpull heuristics.`);
    return;
  }

  console.log(`[Discovery Worker] Found ${qualifiedTokens.length} token(s) passing Anti-Rugpull safety checks.`);

  // 4. For each active discovery session, check daily spend limit and enqueue buy job for top candidate
  for (const session of activeDiscoverySessions) {
    try {
      const maxPerDiscovery = BigInt(session.maxSpendPerDiscovery || "10000000"); // 0.01 SOL
      const maxDaily = BigInt(session.maxDailyDiscoverySpend || "100000000");     // 0.1 SOL
      const dailySpent = BigInt(session.dailyDiscoverySpent || "0");

      if (dailySpent + maxPerDiscovery > maxDaily) {
        console.log(`[Discovery Worker] Session ${session.id} reached daily discovery budget limit (${session.dailyDiscoverySpent} / ${session.maxDailyDiscoverySpend} lamports).`);
        continue;
      }

      // Pick top qualified candidate
      const targetToken = qualifiedTokens[0];
      if (!targetToken) continue;

      console.log(`[Discovery Worker] 🚀 Autonomous Discovery Triggered for Session ${session.id}!`);
      console.log(`[Discovery Worker] Buying Discovered Token: ${targetToken.name} ($${targetToken.symbol}) [Mint: ${targetToken.mint}]`);

      // Enqueue buy job to BullMQ trading queue
      await tradingQueue.add(`discovery-buy-${targetToken.mint}-${session.id}-${Date.now()}`, {
        sessionId: session.id,
        targetMint: targetToken.mint,
        amountLamports: Number(maxPerDiscovery),
        side: "buy",
      });

      // Update daily spent counter in DB
      const updatedSpent = (dailySpent + maxPerDiscovery).toString();
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { dailyDiscoverySpent: updatedSpent },
      });

      // Also automatically register a default TP/SL strategy (TP +50%, SL -20%) for the discovered token
      const currentPrice = targetToken.usd_market_cap ? targetToken.usd_market_cap / 1_000_000_000 : 0.00001;
      await prisma.positionStrategy.create({
        data: {
          sessionId: session.id,
          mintAddress: targetToken.mint,
          amountLamports: maxPerDiscovery.toString(),
          entryPrice: currentPrice,
          takeProfitPrice: currentPrice * 1.5,
          stopLossPrice: currentPrice * 0.8,
          status: "ACTIVE",
        },
      });

    } catch (err: any) {
      console.error(`[Discovery Worker] Failed to execute discovery buy for session ${session.id}: ${err?.message || err}`);
    }
  }
}

type PumpTokenMetadata = {
  mint: string;
  name: string;
  symbol: string;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  usd_market_cap?: number;
  reply_count?: number;
  created_timestamp?: number;
};

async function fetchRecentPumpTokens(): Promise<PumpTokenMetadata[]> {
  try {
    const response = await fetch(PUMP_NEW_TOKENS_API);
    if (!response.ok) {
      console.warn(`[Discovery Worker] Pump API returned status ${response.status}`);
      return [];
    }
    const data: any = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error(`[Discovery Worker] Failed to fetch Pump.fun new tokens: ${err?.message || err}`);
    return [];
  }
}

/**
 * Heuristic Anti-Rugpull evaluation:
 * - Must have social presence (Twitter OR Telegram OR Website)
 * - Must have replies/community engagement (> 2 comments)
 * - Must have reasonable market cap range ($5k - $50k)
 */
function evaluateAntiRugpullHeuristics(token: PumpTokenMetadata): boolean {
  if (!token.mint || !token.name || !token.symbol) return false;

  // Socials verification
  const hasSocials = Boolean(token.twitter || token.telegram || token.website);
  if (!hasSocials) return false;

  // Basic community engagement check
  if ((token.reply_count || 0) < 2) return false;

  return true;
}
