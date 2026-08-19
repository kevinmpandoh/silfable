import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { getUsdPrice, SOL_MINT, USDC_MINT } from "@/lib/investment-recommendation";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";

const FUNDING = {
  SOL: { mint: SOL_MINT, decimals: 9, symbol: "SOL" },
  USDC: { mint: USDC_MINT, decimals: 6, symbol: "USDC" },
} as const;

type FundingOption = typeof FUNDING.SOL | typeof FUNDING.USDC;

async function requestJupiterQuote(inputMint: string, outputMint: string, amount: string, slippageBps: number = 100) {
  const url = new URL("https://lite-api.jup.ag/swap/v1/quote");
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  url.searchParams.set("slippageBps", String(slippageBps));

  const headers: HeadersInit = process.env.JUPITER_API_KEY?.trim()
    ? { "x-api-key": process.env.JUPITER_API_KEY.trim() }
    : {};

  const response = await fetch(url.toString(), {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as Record<string, unknown>;
  if (!data || !data.outAmount || data.outAmount === "0") {
    return null;
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string;
      tokenMint?: string;
      tokenSymbol?: string;
      tokenDecimals?: number;
      tokenName?: string;
      targetAmountUsd?: number;
    };

    const auth = await requireWalletAuth(request, body.walletAddress);
    if (isAuthFailure(auth)) return auth;

    if (!body.walletAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(body.walletAddress)) {
      return NextResponse.json({ error: "A valid bound Solana wallet is required." }, { status: 400 });
    }

    if (!body.tokenMint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(body.tokenMint)) {
      return NextResponse.json({ error: "A valid Solana token mint address is required." }, { status: 400 });
    }

    const owner = new PublicKey(body.walletAddress);
    const connection = new Connection(selectSolanaRpc(), "confirmed");

    const usdcBalancePromise = (async () => {
      try {
        const account = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), owner);
        return BigInt((await connection.getTokenAccountBalance(account, "confirmed")).value.amount);
      } catch {
        return 0n;
      }
    })();

    const [usdcBalance, solBalance, solPrice] = await Promise.all([
      usdcBalancePromise,
      connection.getBalance(owner, "confirmed").then(BigInt),
      getUsdPrice(SOL_MINT).catch(() => 150),
    ]);

    const targetUsd = typeof body.targetAmountUsd === "number" && body.targetAmountUsd > 0 ? body.targetAmountUsd : 10;
    const requiredUsdc = BigInt(Math.floor(targetUsd * 1_000_000));
    const requiredSol = BigInt(Math.floor((targetUsd / solPrice) * 1_000_000_000));
    const solFeeReserve = 10_000_000n; // 0.01 SOL

    // Select primary funding source
    let funding: FundingOption = FUNDING.USDC;
    let fundingAmount = targetUsd;
    let amountRaw = requiredUsdc.toString();

    if (usdcBalance >= requiredUsdc && requiredUsdc > 0n) {
      funding = FUNDING.USDC;
      fundingAmount = targetUsd;
      amountRaw = requiredUsdc.toString();
    } else if (solBalance >= requiredSol + solFeeReserve && requiredSol > 0n) {
      funding = FUNDING.SOL;
      fundingAmount = targetUsd / solPrice;
      amountRaw = requiredSol.toString();
    } else {
      // Fallback to smaller spendable balance
      const maxSpendableSol = solBalance > solFeeReserve ? solBalance - solFeeReserve : 0n;
      if (maxSpendableSol >= 10_000_000n) {
        funding = FUNDING.SOL;
        const chosenLamports = maxSpendableSol > 50_000_000n ? 50_000_000n : maxSpendableSol;
        amountRaw = chosenLamports.toString();
        fundingAmount = Number(chosenLamports) / 1_000_000_000;
      } else if (usdcBalance >= 1_000_000n) {
        funding = FUNDING.USDC;
        const chosenUsdc = usdcBalance > 5_000_000n ? 5_000_000n : usdcBalance;
        amountRaw = chosenUsdc.toString();
        fundingAmount = Number(chosenUsdc) / 1_000_000;
      } else {
        return NextResponse.json(
          { error: "Insufficient wallet balance. Please maintain at least 0.02 SOL or 5 USDC to execute on-chain swaps." },
          { status: 409 },
        );
      }
    }

    // Try quote with chosen funding
    let quote = await requestJupiterQuote(funding.mint, body.tokenMint, amountRaw, 100);

    // If failed and funding was USDC, try SOL (or vice-versa)
    if (!quote) {
      const alternateFunding: FundingOption = funding.mint === USDC_MINT ? FUNDING.SOL : FUNDING.USDC;
      const altAmountRaw =
        alternateFunding.mint === SOL_MINT
          ? BigInt(Math.floor((targetUsd / solPrice) * 1_000_000_000)).toString()
          : BigInt(Math.floor(targetUsd * 1_000_000)).toString();

      quote = await requestJupiterQuote(alternateFunding.mint, body.tokenMint, altAmountRaw, 100);
      if (quote) {
        funding = alternateFunding;
        amountRaw = altAmountRaw;
        fundingAmount = alternateFunding.mint === SOL_MINT ? targetUsd / solPrice : targetUsd;
      }
    }

    if (!quote) {
      return NextResponse.json(
        {
          error: `No live Jupiter liquidity route was found for ${body.tokenSymbol ?? "this token"} on Solana Mainnet. The asset may currently lack active DEX trading pools.`,
        },
        { status: 400 },
      );
    }

    const priceImpactPct = Number(quote.priceImpactPct ?? 0);
    const tokenSymbol = body.tokenSymbol ?? "TOKEN";
    const tokenDecimals = typeof body.tokenDecimals === "number" ? body.tokenDecimals : 9;

    const proposal = {
      id: `stock_swap_${Date.now()}`,
      type: "jupiter_swap",
      mint: body.tokenMint,
      inputMint: funding.mint,
      outputMint: body.tokenMint,
      inputSymbol: funding.symbol,
      outputSymbol: tokenSymbol,
      inputDecimals: funding.decimals,
      outputDecimals: tokenDecimals,
      solAmount: funding.symbol === "SOL" ? String(fundingAmount) : "0",
      inputAmount: amountRaw,
      outputAmount: String(quote.outAmount ?? "0"),
      minimumOutputAmount: String(quote.otherAmountThreshold ?? "0"),
      priceImpactPct: String(quote.priceImpactPct ?? "0"),
      slippageBps: "100",
      estimatedTokens: String(quote.outAmount ?? "0"),
      status: "ready_for_user_signature" as const,
      mode: "restricted_browser_wallet",
      venue: "Jupiter Swap API",
      quoteResponse: quote,
      explanation: `Live Jupiter swap route to acquire ${tokenSymbol} (${body.tokenName ?? "Tokenized Stock"}) on Solana. Transaction requires explicit approval in Phantom / Solflare.`,
      checks: [
        { code: "mint_verified", status: "pass" as const, message: `Output mint pinned: ${body.tokenMint}` },
        { code: "funding_selected", status: "pass" as const, message: `Selected ${funding.symbol} (${fundingAmount.toFixed(4)} ${funding.symbol}) from connected wallet.` },
        { code: "price_impact", status: (Math.abs(priceImpactPct) < 5 ? "pass" : "block") as "pass" | "block", message: `Price impact: ${priceImpactPct.toFixed(2)}% (ceiling 5%).` },
        { code: "wallet_approval", status: "pass" as const, message: "No silent trade execution. Browser wallet signature required." },
      ],
    };

    return NextResponse.json({
      content: `A live Jupiter route to swap **${funding.symbol}** for **${tokenSymbol}** is ready. Review details below and click **Review in Wallet** to execute.`,
      proposal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to obtain Jupiter swap quote.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
