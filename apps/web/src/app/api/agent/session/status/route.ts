import { NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";

export async function GET(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ active: false, session: null, message: "DATABASE_URL not configured" });
  }

  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");
    const sessionId = searchParams.get("sessionId");

    if (!walletAddress && !sessionId) {
      return NextResponse.json(
        { error: "walletAddress or sessionId required" },
        { status: 400 }
      );
    }

    let session: any = null;

    if (sessionId) {
      session = await safeDbQuery(
        () =>
          cloudDb.agentSession.findUnique({
            where: { id: sessionId },
            include: {
              tradeLogs: {
                take: 20,
                orderBy: { createdAt: "desc" },
              },
            },
          }),
        null
      );
    } else if (walletAddress) {
      const user = await safeDbQuery(
        () =>
          cloudDb.user.findUnique({
            where: { walletAddress },
          }),
        null
      );

      if (user) {
        session = await safeDbQuery(
          () =>
            cloudDb.agentSession.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
              include: {
                tradeLogs: {
                  take: 20,
                  orderBy: { createdAt: "desc" },
                },
              },
            }),
          null
        );
      }
    }

    if (!session) {
      return NextResponse.json({ active: false, session: null });
    }

    return NextResponse.json({
      active: session.status === "ACTIVE",
      session: {
        id: session.id,
        status: session.status,
        revokeReason: session.revokeReason,
        maxAllocationLamports: session.maxAllocationLamports,
        maxDrawdownBps: session.maxDrawdownBps,
        currentBalanceLamports: session.currentBalanceLamports,
        peakBalanceLamports: session.peakBalanceLamports,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        tradeLogs: session.tradeLogs,
      },
    });
  } catch (err: any) {
    console.warn("Agent session status query skipped:", err?.message || err);
    return NextResponse.json(
      { active: false, session: null },
      { status: 200 }
    );
  }
}
