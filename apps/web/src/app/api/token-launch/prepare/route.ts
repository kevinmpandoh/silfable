import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { cloudDb } from "@/lib/cloud-db";
import {
  assertAllowedPrograms,
  buildPumpLaunchTransaction,
  buildPumpLaunchWithCreatorBuyTransaction,
  invokedPrograms,
  PUMP_PROGRAM_ID,
  transactionDigest,
} from "@/lib/pump-launch-core";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { selectSolanaRpc } from "@/lib/server-solana-rpc";
import { describePumpLaunchSimulationError } from "@/lib/solana-simulation-error";
import { automaticLaunchLimits } from "@/lib/token-launch-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTFLOW = BigInt("10000000000");
const MAX_PRIORITY_FEE = BigInt("10000000");
const RequestSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{24}$/iu),
  walletAddress: z.string().min(32).max(44),
  mintAddress: z.string().min(32).max(44),
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/u),
  metadataUri: z.string().trim().max(512).refine(isMetadataUri, "Metadata URI must use HTTPS or IPFS."),
  maxCreatorOutflowLamports: z.string().regex(/^[1-9]\d*$/u),
  maxPriorityFeeLamports: z.string().regex(/^\d+$/u),
  creatorBuyLamports: z.string().regex(/^\d+$/u),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = RequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request, body.walletAddress);
    if (isAuthFailure(auth)) return auth;
    const walletAddress = new PublicKey(body.walletAddress).toBase58();
    const mintAddress = new PublicKey(body.mintAddress).toBase58();
    await assertSolanaSession(auth.userId, body.sessionId, walletAddress);
    const creatorBuy = BigInt(body.creatorBuyLamports);
    const automaticLimits = automaticLaunchLimits(creatorBuy);
    const maxOutflow = BigInt(automaticLimits.maxCreatorOutflowLamports);
    const priorityFee = BigInt(automaticLimits.maxPriorityFeeLamports);
    if (maxOutflow > MAX_OUTFLOW) throw new Error("Maximum creator outflow exceeds the guarded 10 SOL ceiling.");
    if (priorityFee > MAX_PRIORITY_FEE || priorityFee > maxOutflow) throw new Error("Priority fee cap exceeds the guarded limit.");
    if (creatorBuy + priorityFee >= maxOutflow) throw new Error("Maximum wallet outflow must leave room for creator buy, priority fee, network fee, and account rent.");

    const rpcUrl = selectSolanaRpc();
    const connection = new Connection(rpcUrl, "confirmed");
    const [globalAddress] = PublicKey.findProgramAddressSync([Buffer.from("global")], PUMP_PROGRAM_ID);
    const [globalAccount, blockhash] = await Promise.all([
      connection.getAccountInfo(globalAddress, { commitment: "finalized" }),
      connection.getLatestBlockhash("finalized"),
    ]);
    if (!globalAccount || !globalAccount.owner.equals(PUMP_PROGRAM_ID)) {
      throw new Error("Finalized Pump.fun global Mainnet state is unavailable or invalid.");
    }
    const buildInput = {
      creatorWallet: walletAddress,
      mintAddress,
      name: body.name,
      symbol: body.symbol,
      metadataUri: body.metadataUri,
      recentBlockhash: blockhash.blockhash,
      priorityFeeLamports: priorityFee,
    };
    const built = creatorBuy > 0n
      ? await buildPumpLaunchWithCreatorBuyTransaction({ ...buildInput, connection, creatorBuyLamports: creatorBuy })
      : buildPumpLaunchTransaction(buildInput);
    const preAccounts = await connection.getMultipleAccountsInfo(
      built.writableAddresses.map((address) => new PublicKey(address)),
      { commitment: "finalized" },
    );
    const [simulation, fee, balance, blockHeight] = await Promise.all([
      connection.simulateTransaction(built.transaction, {
        commitment: "confirmed",
        sigVerify: false,
        replaceRecentBlockhash: false,
        innerInstructions: true,
        accounts: { encoding: "base64", addresses: built.writableAddresses },
      }),
      connection.getFeeForMessage(built.transaction.message, "confirmed"),
      connection.getBalance(new PublicKey(walletAddress), "finalized"),
      connection.getBlockHeight("confirmed"),
    ]);
    if (simulation.value.err) {
      throw new Error(describePumpLaunchSimulationError(simulation.value.err, simulation.value.logs));
    }
    if (fee.value === null) throw new Error("Token launch network fee could not be verified.");
    const programs = invokedPrograms(simulation.value.logs);
    assertAllowedPrograms(programs);
    const rentLamports = createdAccountFunding(preAccounts, simulation.value.accounts, built.writableAddresses.length);
    const simulatedCreatorOutflow = creatorWalletOutflow(
      built.writableAddresses,
      preAccounts,
      simulation.value.accounts,
      walletAddress,
    );
    if (creatorBuy > 0n && simulatedCreatorOutflow === null) {
      throw new Error("Creator-buy simulation did not return exact creator wallet outflow evidence.");
    }
    const totalOutflow = simulatedCreatorOutflow ?? BigInt(fee.value) + BigInt(rentLamports);
    if (totalOutflow > maxOutflow) throw new Error("Simulated network fee and account rent exceed the approved creator outflow cap.");
    if (BigInt(balance) < totalOutflow) {
      throw new Error(`Insufficient SOL. Launch preflight requires about ${(Number(totalOutflow) / 1_000_000_000).toFixed(6)} SOL, but the wallet has ${(balance / 1_000_000_000).toFixed(6)} SOL.`);
    }
    if (blockHeight > blockhash.lastValidBlockHeight) throw new Error("The launch blockhash expired during preflight.");

    return NextResponse.json({
      transactionBase64: Buffer.from(built.transaction.serialize()).toString("base64"),
      transactionDigest: transactionDigest(built.transaction),
      creatorWallet: walletAddress,
      mintAddress,
      programId: PUMP_PROGRAM_ID.toBase58(),
      instructionName: "create_v2",
      sdkVersion: "1.36.0",
      simulationSlot: simulation.context.slot,
      computeUnitsConsumed: simulation.value.unitsConsumed ?? null,
      networkFeeLamports: String(fee.value),
      priorityFeeLamports: priorityFee.toString(),
      rentLamports: String(rentLamports),
      totalEstimatedOutflowLamports: totalOutflow.toString(),
      creatorBuyLamports: creatorBuy.toString(),
      maximumCreatorBuyLamports: "maximumCreatorBuyLamports" in built ? built.maximumCreatorBuyLamports : "0",
      expectedCreatorTokensRaw: "expectedCreatorTokensRaw" in built ? built.expectedCreatorTokensRaw : "0",
      creatorBuySlippageBps: "creatorBuySlippageBps" in built ? built.creatorBuySlippageBps : 0,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
      invokedPrograms: programs,
      balanceLamports: String(balance),
      // A Solana blockhash is valid only for a short, block-height-bound window.
      // Use a conservative UI deadline instead of implying the transaction is safe
      // for a fixed two minutes. Broadcast still independently verifies it with RPC.
      expiresAt: Date.now() + conservativeBlockhashLifetimeMs(blockhash.lastValidBlockHeight, blockHeight),
      checks: [
        "Session and creator wallet are bound.",
        "Metadata is pinned to an immutable HTTPS/IPFS URI.",
        "Pump.fun create_v2 account layout is pinned.",
        "Only allowlisted Solana programs were invoked.",
        "Unsigned Mainnet simulation completed successfully.",
        creatorBuy > 0n ? "SOL balance covers creator buy, simulated fee, and rent." : "SOL balance covers the simulated fee and rent.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token launch preflight failed safely.";
    return NextResponse.json({ error: message, code: "TOKEN_LAUNCH_PREFLIGHT_FAILED" }, { status: 400 });
  }
}

function conservativeBlockhashLifetimeMs(lastValidBlockHeight: number, currentBlockHeight: number): number {
  const remainingBlocks = Math.max(0, lastValidBlockHeight - currentBlockHeight);
  // Solana slots are commonly around 400ms. Keep the displayed deadline within
  // a conservative 15–75 second window because slot timing and RPC lag vary.
  return Math.min(75_000, Math.max(15_000, remainingBlocks * 400));
}

async function assertSolanaSession(userId: string, sessionId: string, walletAddress: string): Promise<void> {
  const session = await cloudDb.chatSession.findFirst({
    where: { id: sessionId, userId, workspace: "solana", sessionWalletAddress: walletAddress },
    select: { id: true },
  });
  if (!session) throw new Error("A Solana session bound to this creator wallet is required.");
}

function isMetadataUri(value: string): boolean {
  if (/^ipfs:\/\/[A-Za-z0-9]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)?$/u.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function createdAccountFunding(
  pre: Array<{ lamports: number } | null>,
  post: Array<{ lamports: number } | null> | null | undefined,
  expected: number,
): number {
  if (!post || pre.length !== expected || post.length !== expected) throw new Error("Simulation account evidence is incomplete.");
  return post.reduce((sum, account, index) => pre[index] === null && account ? sum + account.lamports : sum, 0);
}

function creatorWalletOutflow(
  addresses: string[],
  pre: Array<{ lamports: number } | null>,
  post: Array<{ lamports: number } | null> | null | undefined,
  creatorWallet: string,
): bigint | null {
  const index = addresses.indexOf(creatorWallet);
  const before = index >= 0 ? pre[index]?.lamports : undefined;
  const after = index >= 0 ? post?.[index]?.lamports : undefined;
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) || before === undefined || after === undefined || after > before) return null;
  return BigInt(before - after);
}
