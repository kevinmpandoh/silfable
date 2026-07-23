import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { quoteResponse, userPublicKey, jupiterApiKey } = (await req.json()) as {
      quoteResponse?: unknown;
      userPublicKey?: string;
      jupiterApiKey?: string;
    };

    if (!quoteResponse || typeof userPublicKey !== "string" || userPublicKey.length < 32) {
      return NextResponse.json(
        { error: "Missing quote response or wallet public key. No transaction was created." },
        { status: 400 },
      );
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(jupiterApiKey ? { "x-api-key": jupiterApiKey } : {}),
    };

    const response = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            priorityLevel: "normal",
            maxLamports: 500_000,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok || typeof data.swapTransaction !== "string") {
      return NextResponse.json(
        {
          error:
            typeof data.error === "string"
              ? data.error
              : `Jupiter swap transaction request failed with status ${response.status}.`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      swapTransaction: data.swapTransaction,
      lastValidBlockHeight: data.lastValidBlockHeight ?? null,
      prioritizationFeeLamports: data.prioritizationFeeLamports ?? null,
      computeUnitLimit: data.computeUnitLimit ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Jupiter swap failed safely: ${message}` }, { status: 500 });
  }
}
