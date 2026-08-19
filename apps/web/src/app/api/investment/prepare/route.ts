import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import {
  getInvestmentQuote,
  getUsdPrice,
  loadOwnedRecommendation,
  SOL_MINT,
  USDC_MINT,
} from "@/lib/investment-recommendation";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";

const FUNDING = {
  SOL: { mint: SOL_MINT, decimals: 9 },
  USDC: { mint: USDC_MINT, decimals: 6 },
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      walletAddress?: string;
      recommendationId?: string;
      profileId?: string;
      allocationIndex?: number;
      fundingSymbol?: string;
      tokenizedStockAcknowledged?: boolean;
    };
    const auth = await requireWalletAuth(request, body.walletAddress);
    if (isAuthFailure(auth)) return auth;
    if (typeof body.walletAddress !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(body.walletAddress)) {
      return NextResponse.json({ error: "A valid bound Solana wallet is required." }, { status: 400 });
    }
    if (typeof body.recommendationId !== "string" || typeof body.profileId !== "string" || !Number.isInteger(body.allocationIndex)) {
      return NextResponse.json({ error: "The recommendation selection is invalid." }, { status: 400 });
    }
    const recommendation = await loadOwnedRecommendation(auth.userId, body.recommendationId);
    if (!recommendation) return NextResponse.json({ error: "This recommendation expired. Ask Mirae to analyze the market again." }, { status: 410 });
    const profile = recommendation.profiles.find((item) => item.id === body.profileId);
    const allocation = profile?.allocations.find((item) => item.index === body.allocationIndex);
    if (!profile || !allocation) return NextResponse.json({ error: "The selected allocation is not part of this recommendation." }, { status: 400 });
    if (allocation.assetClass.startsWith("tokenized") && body.tokenizedStockAcknowledged !== true) {
      return NextResponse.json({ error: "Acknowledge the tokenized-stock disclosure before preparing this route." }, { status: 400 });
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
      getUsdPrice(SOL_MINT),
    ]);
    const requiredUsdc = BigInt(Math.floor(allocation.amountUsd * 1_000_000));
    const requiredSol = BigInt(Math.floor((allocation.amountUsd / solPrice) * 1_000_000_000));
    const solFeeReserve = 10_000_000n;
    const funding = usdcBalance >= requiredUsdc
      ? FUNDING.USDC
      : solBalance >= requiredSol + solFeeReserve
        ? FUNDING.SOL
        : null;
    if (!funding) {
      return NextResponse.json({ error: "The wallet does not have enough USDC or SOL for this allocation after reserving 0.01 SOL for network fees." }, { status: 409 });
    }
    const fundingSymbol = funding.mint === SOL_MINT ? "SOL" : "USDC";
    if (funding.mint === allocation.mint) {
      return NextResponse.json({ hold: true, content: `${allocation.amountUsd.toFixed(2)} USD remains in ${allocation.symbol}; Mirae automatically selected ${fundingSymbol}, so no swap or wallet approval is required.` });
    }

    const fundingPrice = funding.mint === SOL_MINT ? solPrice : 1;
    const fundingAmount = allocation.amountUsd / fundingPrice;
    const amountRaw = BigInt(Math.floor(fundingAmount * (10 ** funding.decimals))).toString();
    if (BigInt(amountRaw) <= 0n) return NextResponse.json({ error: "The allocation is too small to quote." }, { status: 400 });
    const availableRaw = funding.mint === SOL_MINT ? solBalance : usdcBalance;
    const feeReserve = funding.mint === SOL_MINT ? 10_000_000n : 0n;
    if (availableRaw < BigInt(amountRaw) + feeReserve) {
      return NextResponse.json({ error: `The connected wallet does not have enough ${fundingSymbol}${feeReserve ? " after reserving 0.01 SOL for network fees" : ""}.` }, { status: 409 });
    }
    const quote = await getInvestmentQuote({ inputMint: funding.mint, outputMint: allocation.mint, amountRaw, slippageBps: 100 });
    const priceImpactPct = Number(quote.priceImpactPct ?? 0);
    if (!Number.isFinite(priceImpactPct) || Math.abs(priceImpactPct) > 5) {
      return NextResponse.json({ error: "The refreshed route exceeds Mirae's 5% price-impact ceiling." }, { status: 409 });
    }
    return NextResponse.json({
      content: `${profile.label} allocation ${allocation.index + 1} is re-quoted and ready for separate wallet review.`,
      proposal: {
        id: `investment_swap_${Date.now()}`,
        type: "jupiter_swap",
        mint: allocation.mint,
        inputMint: funding.mint,
        outputMint: allocation.mint,
        inputSymbol: fundingSymbol,
        outputSymbol: allocation.symbol,
        inputDecimals: funding.decimals,
        outputDecimals: allocation.decimals,
        solAmount: fundingSymbol === "SOL" ? String(fundingAmount) : "0",
        inputAmount: amountRaw,
        outputAmount: String(quote.outAmount ?? "0"),
        minimumOutputAmount: String(quote.otherAmountThreshold ?? "0"),
        priceImpactPct: String(quote.priceImpactPct ?? "0"),
        slippageBps: "100",
        estimatedTokens: String(quote.outAmount ?? "0"),
        status: "ready_for_user_signature",
        mode: "restricted_browser_wallet",
        venue: "Jupiter Swap API",
        explanation: `Allocation ${allocation.index + 1} of ${profile.label}. This quote was refreshed after selection and requires an independent wallet approval.`,
        checks: [
          { code: "snapshot_bound", status: "pass", message: "Mint and allocation match the unexpired server-side recommendation." },
          { code: "funding_selected", status: "pass", message: `Mirae selected ${fundingSymbol} from the connected wallet after checking live balances.` },
          { code: "route_refreshed", status: "pass", message: "Jupiter route was refreshed immediately before wallet review." },
          { code: "price_impact", status: "pass", message: `Price impact ${String(quote.priceImpactPct ?? "0")}% is within the 5% ceiling.` },
          ...(allocation.assetClass.startsWith("tokenized") ? [{ code: "disclosure_acknowledged", status: "pass", message: "Tokenized-stock disclosure was acknowledged; legal eligibility was not verified." }] : []),
        ],
        quoteResponse: quote,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown preparation error.";
    return NextResponse.json({ error: `${message} No transaction was created.` }, { status: 500 });
  }
}
