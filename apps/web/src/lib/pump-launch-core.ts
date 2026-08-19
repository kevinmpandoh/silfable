import { createHash } from "node:crypto";

import { getBuyTokenAmountFromSolAmount, OnlinePumpSdk, PumpSdk, PUMP_FEE_PROGRAM_ID, type FeeConfig, type Global } from "@pump-fun/pump-sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID as SPL_ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_2022_PROGRAM_ID as SPL_TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  type Connection,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const MAYHEM_PROGRAM_ID = new PublicKey("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
export const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111");
export const PUMP_CREATE_V2_DISCRIMINATOR = Uint8Array.from([214, 144, 76, 236, 95, 139, 49, 180]);
export const PUMP_LAUNCH_COMPUTE_LIMIT = 300_000;
export const CREATOR_BUY_SLIPPAGE_BPS = 100;
const PUMP_BUY_DISCRIMINATOR = Uint8Array.from([102, 6, 61, 18, 1, 218, 235, 234]);

export const PUMP_LAUNCH_ALLOWED_PROGRAMS = new Set([
  PUMP_PROGRAM_ID.toBase58(),
  MAYHEM_PROGRAM_ID.toBase58(),
  TOKEN_2022_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
  SYSTEM_PROGRAM_ID.toBase58(),
  COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
  PUMP_FEE_PROGRAM_ID.toBase58(),
  TOKEN_PROGRAM_ID.toBase58(),
]);

export type PumpLaunchBuildInput = {
  creatorWallet: string;
  mintAddress: string;
  name: string;
  symbol: string;
  metadataUri: string;
  recentBlockhash: string;
  priorityFeeLamports: bigint;
};

export function buildPumpLaunchTransaction(input: PumpLaunchBuildInput): {
  transaction: VersionedTransaction;
  writableAddresses: string[];
} {
  const creator = new PublicKey(input.creatorWallet);
  const mint = new PublicKey(input.mintAddress);
  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], PUMP_PROGRAM_ID);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM_ID);
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [bondingCurve.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [global] = PublicKey.findProgramAddressSync([Buffer.from("global")], PUMP_PROGRAM_ID);
  const [globalParams] = PublicKey.findProgramAddressSync([Buffer.from("global-params")], MAYHEM_PROGRAM_ID);
  const [solVault] = PublicKey.findProgramAddressSync([Buffer.from("sol-vault")], MAYHEM_PROGRAM_ID);
  const [mayhemState] = PublicKey.findProgramAddressSync([Buffer.from("mayhem-state"), mint.toBuffer()], MAYHEM_PROGRAM_ID);
  const [mayhemTokenVault] = PublicKey.findProgramAddressSync(
    [solVault.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], PUMP_PROGRAM_ID);

  const createInstruction = new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: global, isSigner: false, isWritable: false },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MAYHEM_PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: globalParams, isSigner: false, isWritable: false },
      { pubkey: solVault, isSigner: false, isWritable: true },
      { pubkey: mayhemState, isSigner: false, isWritable: true },
      { pubkey: mayhemTokenVault, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeCreateV2Data(input),
  });
  const microLamports = priorityMicroLamports(input.priorityFeeLamports);
  const instructions = [ComputeBudgetProgram.setComputeUnitLimit({ units: PUMP_LAUNCH_COMPUTE_LIMIT })];
  if (microLamports > 0) instructions.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
  instructions.push(createInstruction);
  const message = new TransactionMessage({ payerKey: creator, recentBlockhash: input.recentBlockhash, instructions }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  inspectPumpLaunchTransaction(transaction, input.creatorWallet, input.mintAddress);
  return {
    transaction,
    writableAddresses: [...new Set(createInstruction.keys.filter((key) => key.isWritable).map((key) => key.pubkey.toBase58()))],
  };
}

export async function buildPumpLaunchWithCreatorBuyTransaction(input: PumpLaunchBuildInput & {
  connection: Connection;
  creatorBuyLamports: bigint;
}): Promise<{
  transaction: VersionedTransaction;
  writableAddresses: string[];
  expectedCreatorTokensRaw: string;
  maximumCreatorBuyLamports: string;
  creatorBuySlippageBps: number;
}> {
  const onlineSdk = new OnlinePumpSdk(input.connection);
  const [global, feeConfig] = await Promise.all([
    onlineSdk.fetchGlobal(),
    onlineSdk.fetchFeeConfig(),
  ]);
  return buildPumpLaunchWithCreatorBuyFromGlobal({ ...input, global, feeConfig });
}

export async function buildPumpLaunchWithCreatorBuyFromGlobal(input: PumpLaunchBuildInput & {
  creatorBuyLamports: bigint;
  global: Global;
  feeConfig?: FeeConfig | null;
}): Promise<{
  transaction: VersionedTransaction;
  writableAddresses: string[];
  expectedCreatorTokensRaw: string;
  maximumCreatorBuyLamports: string;
  creatorBuySlippageBps: number;
}> {
  if (input.creatorBuyLamports <= 0n) throw new Error("Creator buy must be positive.");
  const creator = new PublicKey(input.creatorWallet);
  const mint = new PublicKey(input.mintAddress);
  const sdk = new PumpSdk();
  const global = input.global;
  const quoteAmount = new BN(input.creatorBuyLamports.toString());
  const expectedTokens = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: input.feeConfig ?? null,
    mintSupply: null,
    bondingCurve: null,
    amount: quoteAmount,
    quoteMint: NATIVE_MINT,
  });
  if (expectedTokens.lte(new BN(0))) throw new Error("Creator buy quote returned no tokens.");
  const launchInstructions = await sdk.createV2AndBuyInstructions({
    global,
    mint,
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    uri: input.metadataUri.trim(),
    creator,
    user: creator,
    amount: expectedTokens,
    solAmount: quoteAmount,
    mayhemMode: global.mayhemModeEnabled,
    cashback: false,
  });
  inspectCreatorBuyInstructions(launchInstructions, creator, mint);
  // The atomic create + buy already approaches Solana's 1,232-byte packet
  // ceiling. Adding compute-budget instructions introduces another static
  // program key and makes valid launches impossible to serialize. Solana's
  // default per-instruction compute allocation covers this three-instruction
  // SDK path; the unsigned Mainnet simulation remains the final gate.
  const message = new TransactionMessage({ payerKey: creator, recentBlockhash: input.recentBlockhash, instructions: launchInstructions }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  if (transaction.message.header.numRequiredSignatures !== 2 || transaction.signatures.length !== 2) {
    throw new Error("Creator-buy launch must require exactly the creator and mint signatures.");
  }
  assertTransactionFitsPacket(transaction);
  const createInstruction = launchInstructions[0]!;
  return {
    transaction,
    writableAddresses: [...new Set([
      input.creatorWallet,
      ...createInstruction.keys.filter((key) => key.isWritable).map((key) => key.pubkey.toBase58()),
    ])],
    expectedCreatorTokensRaw: expectedTokens.toString(),
    maximumCreatorBuyLamports: ((input.creatorBuyLamports * 10_100n + 9_999n) / 10_000n).toString(),
    creatorBuySlippageBps: CREATOR_BUY_SLIPPAGE_BPS,
  };
}

export function inspectPumpLaunchTransaction(
  transaction: VersionedTransaction,
  expectedCreator?: string,
  expectedMint?: string,
): { creatorWallet: string; mintAddress: string } {
  if (transaction.message.version !== 0 || transaction.message.addressTableLookups.length !== 0) {
    throw new Error("Token launch transaction must be a lookup-free v0 transaction.");
  }
  const keys = transaction.message.staticAccountKeys;
  const header = transaction.message.header;
  if (header.numRequiredSignatures !== 2 || transaction.signatures.length !== 2) {
    throw new Error("Token launch must require exactly the creator and mint signatures.");
  }
  const creatorWallet = keys[0]?.toBase58();
  const mintAddress = keys[1]?.toBase58();
  if (!creatorWallet || !mintAddress || (expectedCreator && creatorWallet !== expectedCreator) || (expectedMint && mintAddress !== expectedMint)) {
    throw new Error("Token launch signer binding is invalid.");
  }
  const instructions = transaction.message.compiledInstructions;
  const create = instructions.at(-1);
  if (!create || keys[create.programIdIndex]?.toBase58() !== PUMP_PROGRAM_ID.toBase58()) {
    throw new Error("Token launch is not bound to the pinned Pump.fun program.");
  }
  if (create.accountKeyIndexes.length !== 16 || !equalBytes(create.data.subarray(0, 8), PUMP_CREATE_V2_DISCRIMINATOR)) {
    throw new Error("Pump.fun create_v2 instruction layout changed.");
  }
  const decompiled = TransactionMessage.decompile(transaction.message);
  if (decompiled.instructions.slice(0, -1).some((instruction) => !instruction.programId.equals(COMPUTE_BUDGET_PROGRAM_ID))) {
    throw new Error("Token launch contains a non-allowlisted outer instruction.");
  }
  const decodedCreate = decompiled.instructions.at(-1);
  if (!decodedCreate || decodedCreate.keys.length !== 16) throw new Error("Pump.fun create_v2 account layout changed.");
  const creator = new PublicKey(creatorWallet);
  const mint = new PublicKey(mintAddress);
  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], PUMP_PROGRAM_ID);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM_ID);
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync([bondingCurve.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
  const [global] = PublicKey.findProgramAddressSync([Buffer.from("global")], PUMP_PROGRAM_ID);
  const [globalParams] = PublicKey.findProgramAddressSync([Buffer.from("global-params")], MAYHEM_PROGRAM_ID);
  const [solVault] = PublicKey.findProgramAddressSync([Buffer.from("sol-vault")], MAYHEM_PROGRAM_ID);
  const [mayhemState] = PublicKey.findProgramAddressSync([Buffer.from("mayhem-state"), mint.toBuffer()], MAYHEM_PROGRAM_ID);
  const [mayhemTokenVault] = PublicKey.findProgramAddressSync([solVault.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], PUMP_PROGRAM_ID);
  const expected = [
    [mint, true, true], [mintAuthority, false, false], [bondingCurve, false, true], [associatedBondingCurve, false, true],
    [global, false, false], [creator, true, true], [SYSTEM_PROGRAM_ID, false, false], [TOKEN_2022_PROGRAM_ID, false, false],
    [ASSOCIATED_TOKEN_PROGRAM_ID, false, false], [MAYHEM_PROGRAM_ID, false, true], [globalParams, false, false], [solVault, false, true],
    [mayhemState, false, true], [mayhemTokenVault, false, true], [eventAuthority, false, false], [PUMP_PROGRAM_ID, false, false],
  ] as const;
  if (decodedCreate.keys.some((key, index) => {
    const binding = expected[index]!;
    return !key.pubkey.equals(binding[0]) || key.isSigner !== binding[1] || key.isWritable !== binding[2];
  })) {
    throw new Error("Pump.fun create_v2 account or signer binding changed.");
  }
  return { creatorWallet, mintAddress };
}

export function inspectPumpLaunchBroadcastTransaction(
  transaction: VersionedTransaction,
  expectedCreator: string,
  expectedMint: string,
): { creatorWallet: string; mintAddress: string; creatorBuy: boolean } {
  if (transaction.message.version !== 0 || transaction.message.addressTableLookups.length !== 0) {
    throw new Error("Token launch transaction must be a lookup-free v0 transaction.");
  }
  if (transaction.message.header.numRequiredSignatures !== 2 || transaction.signatures.length !== 2) {
    throw new Error("Token launch must require exactly the creator and mint signatures.");
  }
  const creator = new PublicKey(expectedCreator);
  const mint = new PublicKey(expectedMint);
  const keys = transaction.message.staticAccountKeys;
  if (!keys[0]?.equals(creator) || !keys[1]?.equals(mint)) {
    throw new Error("Token launch signer binding is invalid.");
  }
  const instructions = TransactionMessage.decompile(transaction.message).instructions;
  const isCreatorBuy = instructions.length === 3 && instructions[0]?.programId.equals(PUMP_PROGRAM_ID);
  if (isCreatorBuy) {
    inspectCreatorBuyInstructions(instructions, creator, mint);
    return { creatorWallet: creator.toBase58(), mintAddress: mint.toBase58(), creatorBuy: true };
  }
  const inspected = inspectPumpLaunchTransaction(transaction, expectedCreator, expectedMint);
  return { ...inspected, creatorBuy: false };
}

export function transactionDigest(transaction: VersionedTransaction): string {
  return createHash("sha256").update(transaction.serialize()).digest("hex");
}

export function assertTransactionFitsPacket(transaction: VersionedTransaction): number {
  try {
    return transaction.serialize().length;
  } catch (error) {
    if (error instanceof RangeError && /encoding overruns/iu.test(error.message)) {
      throw new Error("Token launch metadata makes the atomic creator-buy transaction exceed Solana's packet-size limit. Shorten the token name or metadata URI.");
    }
    throw error;
  }
}

export function invokedPrograms(logs: string[] | null | undefined): string[] {
  if (!logs) throw new Error("Token launch simulation logs are unavailable.");
  if (logs.some((line) => /log truncated/iu.test(line))) throw new Error("Token launch simulation logs were truncated.");
  return [...new Set(logs.map((line) => /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[\d+\]$/u.exec(line)?.[1]).filter((id): id is string => Boolean(id)))];
}

export function assertAllowedPrograms(programs: string[]): void {
  if (!programs.includes(PUMP_PROGRAM_ID.toBase58())) throw new Error("Simulation did not invoke the pinned Pump.fun program.");
  const denied = programs.find((program) => !PUMP_LAUNCH_ALLOWED_PROGRAMS.has(program));
  if (denied) throw new Error(`Simulation invoked a non-allowlisted program: ${denied}`);
}

function encodeCreateV2Data(input: Pick<PumpLaunchBuildInput, "creatorWallet" | "name" | "symbol" | "metadataUri">): Buffer {
  return Buffer.concat([
    Buffer.from(PUMP_CREATE_V2_DISCRIMINATOR),
    borshString(input.name.trim(), "name"),
    borshString(input.symbol.trim().toUpperCase(), "symbol"),
    borshString(input.metadataUri.trim(), "metadata URI"),
    new PublicKey(input.creatorWallet).toBuffer(),
    Buffer.from([0, 0]),
  ]);
}

function borshString(value: string, label: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length === 0 || bytes.length > 512) throw new Error(`Token launch ${label} is invalid.`);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function priorityMicroLamports(capLamports: bigint, computeLimit = PUMP_LAUNCH_COMPUTE_LIMIT): number {
  const value = Number((capLamports * BigInt(1_000_000)) / BigInt(computeLimit));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Priority fee cap is invalid.");
  return value;
}

function inspectCreatorBuyInstructions(instructions: TransactionInstruction[], creator: PublicKey, mint: PublicKey): void {
  if (instructions.length !== 3) throw new Error("Pump.fun creator-buy instruction sequence changed.");
  const [create, associatedAccount, buy] = instructions;
  if (!create || !associatedAccount || !buy) throw new Error("Pump.fun creator-buy instructions are incomplete.");
  if (!create.programId.equals(PUMP_PROGRAM_ID) || create.keys.length !== 16 || !equalBytes(create.data.subarray(0, 8), PUMP_CREATE_V2_DISCRIMINATOR)) {
    throw new Error("Pump.fun create_v2 instruction layout changed.");
  }
  if (!associatedAccount.programId.equals(SPL_ASSOCIATED_TOKEN_PROGRAM_ID)) {
    throw new Error("Creator token-account instruction is not the pinned associated-token program.");
  }
  const expectedCreatorTokenAccount = getAssociatedTokenAddressSync(mint, creator, true, SPL_TOKEN_2022_PROGRAM_ID);
  if (associatedAccount.keys.length !== 6
    || !associatedAccount.keys[0]?.pubkey.equals(creator)
    || !associatedAccount.keys[1]?.pubkey.equals(expectedCreatorTokenAccount)
    || !associatedAccount.keys[2]?.pubkey.equals(creator)
    || !associatedAccount.keys[3]?.pubkey.equals(mint)
    || !associatedAccount.keys[5]?.pubkey.equals(SPL_TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Creator token-account binding changed.");
  }
  if (!buy.programId.equals(PUMP_PROGRAM_ID) || buy.keys.length !== 18 || !equalBytes(buy.data.subarray(0, 8), PUMP_BUY_DISCRIMINATOR)) {
    throw new Error(`Pump.fun buy instruction layout changed (program ${buy.programId.toBase58()}, accounts ${buy.keys.length}, discriminator ${[...buy.data.subarray(0, 8)].join(",")}).`);
  }
  if (!create.keys.some((key) => key.pubkey.equals(mint) && key.isSigner && key.isWritable)
    || !create.keys.some((key) => key.pubkey.equals(creator) && key.isSigner && key.isWritable)
    || !buy.keys.some((key) => key.pubkey.equals(creator) && key.isSigner && key.isWritable)
    || !buy.keys.some((key) => key.pubkey.equals(mint))) {
    throw new Error("Creator-buy signer or mint binding changed.");
  }
  if (!create.keys.some((key) => key.pubkey.equals(SPL_TOKEN_2022_PROGRAM_ID))
    || !buy.keys.some((key) => key.pubkey.equals(SPL_TOKEN_2022_PROGRAM_ID))) {
    throw new Error("Creator-buy token program is not pinned to Token-2022.");
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
