import { NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";

export async function GET(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ schedules: [] });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const schedules = await safeDbQuery(
      () =>
        cloudDb.dcaSchedule.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
        }),
      []
    );

    return NextResponse.json({ schedules });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch DCA schedules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { sessionId, mintAddress, totalBudgetLamports, orderAmountLamports, intervalSeconds } = body;

    if (!sessionId || !mintAddress || !totalBudgetLamports || !orderAmountLamports || !intervalSeconds) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, mintAddress, totalBudgetLamports, orderAmountLamports, intervalSeconds" },
        { status: 400 }
      );
    }

    // 1. Verify session exists and is ACTIVE
    const session = await safeDbQuery(
      () => cloudDb.agentSession.findUnique({ where: { id: sessionId } }),
      null
    );

    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Active Agent Session not found" }, { status: 404 });
    }

    // 2. Validate numerical inputs
    const budgetBig = BigInt(totalBudgetLamports);
    const orderBig = BigInt(orderAmountLamports);
    const intervalNum = Number(intervalSeconds);

    if (orderBig <= BigInt(0) || budgetBig <= BigInt(0)) {
      return NextResponse.json({ error: "Budget and order amounts must be greater than zero" }, { status: 400 });
    }

    if (orderBig > budgetBig) {
      return NextResponse.json({ error: "Order amount cannot exceed total budget" }, { status: 400 });
    }

    if (intervalNum < 5) {
      return NextResponse.json({ error: "Interval seconds must be at least 5 seconds" }, { status: 400 });
    }

    // 3. Calculate first execution time
    const nextExecutionAt = new Date(Date.now() + intervalNum * 1000);

    const dcaSchedule = await safeDbQuery(
      () =>
        cloudDb.dcaSchedule.create({
          data: {
            sessionId,
            mintAddress,
            totalBudgetLamports: totalBudgetLamports.toString(),
            orderAmountLamports: orderAmountLamports.toString(),
            intervalSeconds: intervalNum,
            nextExecutionAt,
            status: "ACTIVE",
          },
        }),
      null
    );

    if (!dcaSchedule) {
      return NextResponse.json({ error: "Failed to persist DCA schedule to database" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "24/7 Cloud Auto DCA Schedule created successfully",
      dcaSchedule,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create DCA schedule" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
    }

    const updated = await safeDbQuery(
      () =>
        cloudDb.dcaSchedule.update({
          where: { id: scheduleId },
          data: { status: "CANCELLED" },
        }),
      null
    );

    if (!updated) {
      return NextResponse.json({ error: "Schedule not found or failed to cancel" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "DCA Schedule cancelled successfully", schedule: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to cancel DCA schedule" }, { status: 500 });
  }
}
