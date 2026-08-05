// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { cloudDb, isDbConfigured, safeDbQuery } from "@/lib/cloud-db";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";

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
    const auth = await requireWalletAuth(req, walletAddress);
    if (isAuthFailure(auth)) return auth;

    const user = await safeDbQuery(
      () =>
        cloudDb.user.findUnique({
          where: { walletAddress },
          include: {
            chatSessions: {
              orderBy: { updatedAt: "desc" },
            },
          },
        }),
      null
    );

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
    console.warn("GET /api/chat/session error:", error);
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { walletAddress, session, action, sessionId } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }
    const auth = await requireWalletAuth(req, walletAddress);
    if (isAuthFailure(auth)) return auth;

    let user = await safeDbQuery(() => cloudDb.user.findUnique({ where: { walletAddress } }), null);
    if (!user) {
      user = await safeDbQuery(() => cloudDb.user.create({ data: { walletAddress } }), null);
    }

    if (!user) {
      return NextResponse.json({ error: "Failed to connect to user database" }, { status: 500 });
    }

    if (action === "delete") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required for delete" }, { status: 400 });
      }
      if (isValidObjectId(sessionId)) {
        const owned = await safeDbQuery(
          () => cloudDb.chatSession.findFirst({ where: { id: sessionId, userId: user.id } }),
          null,
        );
        if (!owned) {
          return NextResponse.json({ error: "Session not found." }, { status: 404 });
        }
        await safeDbQuery(() => cloudDb.chatMessage.deleteMany({ where: { sessionId: owned.id } }), null);
        await safeDbQuery(() => cloudDb.chatSession.delete({ where: { id: owned.id } }), null);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "delete_all") {
      const userSessions = await safeDbQuery(
        () =>
          cloudDb.chatSession.findMany({
            where: { userId: user.id },
            select: { id: true },
          }),
        []
      );
      const sessionIds = userSessions.map((s) => s.id);
      await safeDbQuery(() => cloudDb.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } }), null);
      await safeDbQuery(() => cloudDb.chatSession.deleteMany({ where: { userId: user.id } }), null);
      return NextResponse.json({ success: true });
    }

    if (!session) {
      return NextResponse.json({ error: "session data is required" }, { status: 400 });
    }

    let savedSession;

    if (isValidObjectId(session.id)) {
      const owned = await safeDbQuery(
        () => cloudDb.chatSession.findFirst({ where: { id: session.id, userId: user.id } }),
        null,
      );
      if (!owned) {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }
      savedSession = await safeDbQuery(
        () =>
          cloudDb.chatSession.update({
            where: { id: owned.id },
            data: {
              title: session.title,
              filter: session.filter,
              updatedAt: new Date(),
            },
          }),
        null,
      );
    } else {
      savedSession = await safeDbQuery(
        () =>
          cloudDb.chatSession.create({
            data: {
              userId: user.id,
              title: session.title || "New Chat",
              filter: session.filter || "all",
            },
          }),
        null
      );
    }

    if (!savedSession) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
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
