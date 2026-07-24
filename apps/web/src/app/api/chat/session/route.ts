import { NextRequest, NextResponse } from "next/server";
import { cloudDb, isDbConfigured } from "@/lib/cloud-db";

function isValidObjectId(id?: string): boolean {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

export async function GET(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json({ sessions: [] });
  }

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
      if (isValidObjectId(sessionId)) {
        await cloudDb.chatMessage.deleteMany({ where: { sessionId } });
        await cloudDb.chatSession.delete({ where: { id: sessionId } }).catch(() => null);
      }
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

    let savedSession;

    if (isValidObjectId(session.id)) {
      savedSession = await cloudDb.chatSession.upsert({
        where: { id: session.id },
        create: {
          userId: user.id,
          title: session.title || "New Chat",
          filter: session.filter || "all",
        },
        update: {
          title: session.title,
          filter: session.filter,
          updatedAt: new Date(),
        },
      });
    } else {
      savedSession = await cloudDb.chatSession.create({
        data: {
          userId: user.id,
          title: session.title || "New Chat",
          filter: session.filter || "all",
        },
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: savedSession.id,
        title: savedSession.title,
        filter: savedSession.filter,
        createdAt: savedSession.createdAt.getTime(),
        updatedAt: savedSession.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error("POST /api/chat/session error:", error);
    return NextResponse.json({ error: "Failed to save chat session" }, { status: 500 });
  }
}
