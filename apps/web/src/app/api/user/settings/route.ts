import { NextRequest, NextResponse } from "next/server";
import { cloudDb } from "@/lib/cloud-db";
import { encryptAgentKey, decryptAgentKey } from "@/lib/cloud-crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress parameter is required" }, { status: 400 });
    }

    const user = await cloudDb.user.findUnique({
      where: { walletAddress },
      include: { settings: true },
    });

    if (!user || !user.settings) {
      return NextResponse.json({
        customRpcUrl: "",
        slippageBps: 100,
        priorityFeeLevel: "medium",
        selectedModel: "google/gemini-2.5-flash",
        openRouterKey: "",
        jupiterKey: "",
        tavilyKey: "",
      });
    }

    const s = user.settings;

    // Decrypt keys safely
    let openRouterKey = "";
    if (s.encryptedOpenRouterKey && s.openRouterIv) {
      try {
        openRouterKey = decryptAgentKey(s.encryptedOpenRouterKey, s.openRouterIv);
      } catch (err) {
        console.error("Failed to decrypt OpenRouter key:", err);
      }
    }

    let jupiterKey = "";
    if (s.encryptedJupiterKey && s.jupiterIv) {
      try {
        jupiterKey = decryptAgentKey(s.encryptedJupiterKey, s.jupiterIv);
      } catch (err) {
        console.error("Failed to decrypt Jupiter key:", err);
      }
    }

    let tavilyKey = "";
    if (s.encryptedTavilyKey && s.tavilyIv) {
      try {
        tavilyKey = decryptAgentKey(s.encryptedTavilyKey, s.tavilyIv);
      } catch (err) {
        console.error("Failed to decrypt Tavily key:", err);
      }
    }

    return NextResponse.json({
      customRpcUrl: s.customRpcUrl || "",
      slippageBps: s.slippageBps ?? 100,
      priorityFeeLevel: s.priorityFeeLevel || "medium",
      selectedModel: s.selectedModel || "google/gemini-2.5-flash",
      openRouterKey,
      jupiterKey,
      tavilyKey,
    });
  } catch (error) {
    console.error("GET /api/user/settings error:", error);
    return NextResponse.json({ error: "Failed to fetch user settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, settings } = body;

    if (!walletAddress || !settings) {
      return NextResponse.json({ error: "walletAddress and settings are required" }, { status: 400 });
    }

    // Ensure User exists
    let user = await cloudDb.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await cloudDb.user.create({ data: { walletAddress } });
    }

    // Encrypt keys if provided
    let encryptedOpenRouterKey: string | undefined = undefined;
    let openRouterIv: string | undefined = undefined;
    if (settings.openRouterKey) {
      const enc = encryptAgentKey(settings.openRouterKey);
      encryptedOpenRouterKey = enc.ciphertext;
      openRouterIv = enc.iv;
    }

    let encryptedJupiterKey: string | undefined = undefined;
    let jupiterIv: string | undefined = undefined;
    if (settings.jupiterKey) {
      const enc = encryptAgentKey(settings.jupiterKey);
      encryptedJupiterKey = enc.ciphertext;
      jupiterIv = enc.iv;
    }

    let encryptedTavilyKey: string | undefined = undefined;
    let tavilyIv: string | undefined = undefined;
    if (settings.tavilyKey) {
      const enc = encryptAgentKey(settings.tavilyKey);
      encryptedTavilyKey = enc.ciphertext;
      tavilyIv = enc.iv;
    }

    const updatedSettings = await cloudDb.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        customRpcUrl: settings.customRpcUrl || null,
        slippageBps: settings.slippageBps ? Number(settings.slippageBps) : 100,
        priorityFeeLevel: settings.priorityFeeLevel || "medium",
        selectedModel: settings.selectedModel || "google/gemini-2.5-flash",
        encryptedOpenRouterKey,
        openRouterIv,
        encryptedJupiterKey,
        jupiterIv,
        encryptedTavilyKey,
        tavilyIv,
      },
      update: {
        customRpcUrl: settings.customRpcUrl || null,
        slippageBps: settings.slippageBps ? Number(settings.slippageBps) : 100,
        priorityFeeLevel: settings.priorityFeeLevel || "medium",
        selectedModel: settings.selectedModel || "google/gemini-2.5-flash",
        ...(encryptedOpenRouterKey !== undefined ? { encryptedOpenRouterKey, openRouterIv } : {}),
        ...(encryptedJupiterKey !== undefined ? { encryptedJupiterKey, jupiterIv } : {}),
        ...(encryptedTavilyKey !== undefined ? { encryptedTavilyKey, tavilyIv } : {}),
      },
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error("POST /api/user/settings error:", error);
    return NextResponse.json({ error: "Failed to save user settings" }, { status: 500 });
  }
}
