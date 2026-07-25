import { prisma } from "../services/db.js";
import { tradingQueue } from "../services/queue.js";

const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

export function startDcaWorker() {
  console.log("[DCA Worker] Starting 24/7 Cloud DCA Schedule Ticker...");

  const intervalId = setInterval(async () => {
    try {
      await processDueDcaSchedules();
    } catch (err: any) {
      console.error(`[DCA Worker] Error processing DCA schedules: ${err?.message || err}`);
    }
  }, CHECK_INTERVAL_MS);

  // Also run immediately on startup
  processDueDcaSchedules().catch((err) => {
    console.error(`[DCA Worker] Error processing initial DCA schedules: ${err?.message || err}`);
  });

  return () => clearInterval(intervalId);
}

async function processDueDcaSchedules() {
  const now = new Date();

  // Find all ACTIVE schedules whose nextExecutionAt is due
  const dueSchedules = await prisma.dcaSchedule.findMany({
    where: {
      status: "ACTIVE",
      nextExecutionAt: { lte: now },
    },
    include: {
      session: true,
    },
  });

  if (dueSchedules.length === 0) {
    return;
  }

  console.log(`[DCA Worker] Found ${dueSchedules.length} due DCA schedule(s) to process.`);

  for (const schedule of dueSchedules) {
    try {
      // 1. Validate Session Status
      if (!schedule.session || schedule.session.status !== "ACTIVE") {
        console.log(`[DCA Worker] Session ${schedule.sessionId} for schedule ${schedule.id} is not ACTIVE (${schedule.session?.status}). Cancelling schedule.`);
        await prisma.dcaSchedule.update({
          where: { id: schedule.id },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      const totalBudget = BigInt(schedule.totalBudgetLamports);
      const totalExecuted = BigInt(schedule.totalExecutedLamports);
      const orderAmount = BigInt(schedule.orderAmountLamports);

      // 2. Check if budget remaining is insufficient
      if (totalExecuted + orderAmount > totalBudget) {
        console.log(`[DCA Worker] Schedule ${schedule.id} reached total budget limit. Marking COMPLETED.`);
        await prisma.dcaSchedule.update({
          where: { id: schedule.id },
          data: { status: "COMPLETED" },
        });
        continue;
      }

      // 3. Dispatch Trading Job to BullMQ
      console.log(`[DCA Worker] Enqueuing DCA Buy order for schedule ${schedule.id} (Token: ${schedule.mintAddress}, Amount: ${orderAmount} lamports)`);

      await tradingQueue.add(`dca-${schedule.id}-${Date.now()}`, {
        sessionId: schedule.sessionId,
        targetMint: schedule.mintAddress,
        amountLamports: Number(orderAmount),
        side: "buy",
      });

      // 4. Update Schedule stats and next execution time
      const nextExec = new Date(now.getTime() + schedule.intervalSeconds * 1000);
      const newTotalExecuted = (totalExecuted + orderAmount).toString();
      const isCompleted = totalExecuted + orderAmount >= totalBudget;

      await prisma.dcaSchedule.update({
        where: { id: schedule.id },
        data: {
          executedCount: schedule.executedCount + 1,
          totalExecutedLamports: newTotalExecuted,
          nextExecutionAt: nextExec,
          status: isCompleted ? "COMPLETED" : "ACTIVE",
        },
      });

      console.log(`[DCA Worker] Schedule ${schedule.id} updated. Next execution at: ${nextExec.toISOString()}`);
    } catch (err: any) {
      console.error(`[DCA Worker] Failed to process schedule ${schedule.id}: ${err?.message || err}`);
    }
  }
}
