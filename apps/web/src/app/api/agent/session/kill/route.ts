import { NextResponse } from "next/server";
import { cloudDb } from "@/lib/cloud-db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, walletAddress } = body;

    if (!sessionId && !walletAddress) {
      return NextResponse.json(
        { error: "sessionId or walletAddress is required" },
        { status: 400 }
      );
    }

    if (sessionId) {
      await cloudDb.agentSession.update({
        where: { id: sessionId },
        data: {
          status: "REVOKED",
          revokeReason: "User manual kill switch trigger",
        },
      });
    } else if (walletAddress) {
      const user = await cloudDb.user.findUnique({
        where: { walletAddress },
      });

      if (user) {
        await cloudDb.agentSession.updateMany({
          where: { userId: user.id, status: "ACTIVE" },
          data: {
            status: "REVOKED",
            revokeReason: "User manual kill switch trigger",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Agent session revoked successfully",
    });
  } catch (err: any) {
    console.error("Failed to revoke agent session:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
