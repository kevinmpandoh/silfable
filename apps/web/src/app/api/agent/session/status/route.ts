import { NextResponse } from "next/server";
import { cloudDb } from "@/lib/cloud-db";

export async function GET(req: Request) {
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

    let session = null;

    if (sessionId) {
      session = await cloudDb.agentSession.findUnique({
        where: { id: sessionId },
        include: {
          tradeLogs: {
            take: 20,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    } else if (walletAddress) {
      const user = await cloudDb.user.findUnique({
        where: { walletAddress },
      });

      if (user) {
        session = await cloudDb.agentSession.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            tradeLogs: {
              take: 20,
              orderBy: { createdAt: "desc" },
            },
          },
        });
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
    console.error("Failed to get agent session status:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
