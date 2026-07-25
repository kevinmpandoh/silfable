import { NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";

export async function GET(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({
      allowAutonomousDiscovery: false,
      maxSpendPerDiscovery: "10000000",
      maxDailyDiscoverySpend: "100000000",
      dailyDiscoverySpent: "0",
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await safeDbQuery(
      () =>
        cloudDb.agentSession.findUnique({
          where: { id: sessionId },
          select: {
            allowAutonomousDiscovery: true,
            maxSpendPerDiscovery: true,
            maxDailyDiscoverySpend: true,
            dailyDiscoverySpent: true,
          },
        }),
      null
    );

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ settings: session });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch discovery settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { sessionId, allowAutonomousDiscovery, maxSpendPerDiscovery, maxDailyDiscoverySpend } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const updated = await safeDbQuery(
      () =>
        cloudDb.agentSession.update({
          where: { id: sessionId },
          data: {
            ...(allowAutonomousDiscovery !== undefined && { allowAutonomousDiscovery: Boolean(allowAutonomousDiscovery) }),
            ...(maxSpendPerDiscovery !== undefined && { maxSpendPerDiscovery: maxSpendPerDiscovery.toString() }),
            ...(maxDailyDiscoverySpend !== undefined && { maxDailyDiscoverySpend: maxDailyDiscoverySpend.toString() }),
          },
        }),
      null
    );

    if (!updated) {
      return NextResponse.json({ error: "Session not found or failed to update" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Autonomous Discovery (Degen Mode) settings updated successfully",
      session: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update discovery settings" }, { status: 500 });
  }
}
