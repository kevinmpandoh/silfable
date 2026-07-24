import { NextRequest, NextResponse } from "next/server";
import { cloudDb } from "@/lib/cloud-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress parameter is required" }, { status: 400 });
    }

    const user = await cloudDb.user.findUnique({
      where: { walletAddress },
      include: {
        chatSessions: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = user.chatSessions.map((s) => ({
      id: s.id,
      title: s.title,
      filter: s.filter,
      createdAt: s.createdAt.getTime(),
      updatedAt: s.updatedAt.getTime(),
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("GET /api/chat/session error:", error);
    return NextResponse.json({ error: "Failed to fetch chat sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, session, action, sessionId } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    let user = await cloudDb.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await cloudDb.user.create({ data: { walletAddress } });
    }

    if (action === "delete") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required for delete" }, { status: 400 });
      }
      // Delete messages first, then session
      await cloudDb.chatMessage.deleteMany({ where: { sessionId } });
      await cloudDb.chatSession.delete({ where: { id: sessionId } });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_all") {
      const userSessions = await cloudDb.chatSession.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const sessionIds = userSessions.map((s) => s.id);
      await cloudDb.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await cloudDb.chatSession.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ success: true });
    }

    if (!session) {
      return NextResponse.json({ error: "session data is required" }, { status: 400 });
    }

    const upserted = await cloudDb.chatSession.upsert({
      where: { id: session.id || "000000000000000000000000" },
      create: {
        userId: user.id,
        title: session.title || "New Chat",
        filter: session.filter || "all",
      },
      update: {
        title: session.title,
        filter: session.filter,
      },
    });

    return NextResponse.json({
      success: true,
      session: {
        id: upserted.id,
        title: upserted.title,
        filter: upserted.filter,
        createdAt: upserted.createdAt.getTime(),
        updatedAt: upserted.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error("POST /api/chat/session error:", error);
    return NextResponse.json({ error: "Failed to save chat session" }, { status: 500 });
  }
}
