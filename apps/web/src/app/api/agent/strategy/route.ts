import { NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";

export async function GET(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ strategies: [] });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const strategies = await safeDbQuery(
      () =>
        cloudDb.positionStrategy.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
        }),
      []
    );

    return NextResponse.json({ strategies });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch Position Strategies" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { sessionId, mintAddress, amountLamports, entryPrice, takeProfitPrice, stopLossPrice } = body;

    if (!sessionId || !mintAddress || amountLamports === undefined || entryPrice === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, mintAddress, amountLamports, entryPrice" },
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

    const amountBig = BigInt(amountLamports);
    if (amountBig <= BigInt(0)) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    // 2. Check if an active strategy already exists for this mint & session
    const existing = await safeDbQuery(
      () =>
        cloudDb.positionStrategy.findFirst({
          where: { sessionId, mintAddress, status: "ACTIVE" },
        }),
      null
    );

    let strategy;
    if (existing) {
      strategy = await safeDbQuery(
        () =>
          cloudDb.positionStrategy.update({
            where: { id: existing.id },
            data: {
              amountLamports: amountLamports.toString(),
              entryPrice: Number(entryPrice),
              takeProfitPrice: takeProfitPrice ? Number(takeProfitPrice) : null,
              stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
            },
          }),
        null
      );
    } else {
      strategy = await safeDbQuery(
        () =>
          cloudDb.positionStrategy.create({
            data: {
              sessionId,
              mintAddress,
              amountLamports: amountLamports.toString(),
              entryPrice: Number(entryPrice),
              takeProfitPrice: takeProfitPrice ? Number(takeProfitPrice) : null,
              stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
              status: "ACTIVE",
            },
          }),
        null
      );
    }

    if (!strategy) {
      return NextResponse.json({ error: "Failed to persist Position Strategy to database" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "24/7 Cloud TP/SL Strategy saved successfully",
      strategy,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save Position Strategy" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get("strategyId");

    if (!strategyId) {
      return NextResponse.json({ error: "strategyId required" }, { status: 400 });
    }

    const updated = await safeDbQuery(
      () =>
        cloudDb.positionStrategy.update({
          where: { id: strategyId },
          data: { status: "CANCELLED" },
        }),
      null
    );

    if (!updated) {
      return NextResponse.json({ error: "Strategy not found or failed to cancel" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Position Strategy cancelled successfully", strategy: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to cancel Position Strategy" }, { status: 500 });
  }
}
