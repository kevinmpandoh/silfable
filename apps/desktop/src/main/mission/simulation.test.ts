import assert from "node:assert/strict";
import test from "node:test";

import {
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  createKeyPairSignerFromPrivateKeyBytes,
  getTransactionDecoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import type { MissionContractPreview } from "@silfable/contracts";

import type { MainnetReadService } from "../integrations/read-only.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";
import { MissionSimulationService } from "./simulation.js";

const WALLET = "11111111111111111111111111111111";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SELECTED_WALLET = "SysvarRent111111111111111111111111111111111";
const WALLETS = {} as WalletOnboardingService;

test("mission simulation revalidates policy and never builds an order after balance evidence changes", async () => {
  let orderBuildAttempted = false;
  const reads = {
    portfolio: async () => ({ address: WALLET, slot: 1, solBalance: "0", solUsdPrice: 150, totalUsd: 0, assets: [], verifiedAt: new Date().toISOString() }),
    swapQuote: async () => ({ inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true as const, verifiedAt: new Date().toISOString() }),
    buildUnsignedSwapOrder: async () => {
      orderBuildAttempted = true;
      throw new Error("must not build");
    },
  } as unknown as MainnetReadService;
  const mission: MissionContractPreview = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "ready-for-review",
    goal: "Preview selling 0.1 SOL for USDC",
    walletAddress: WALLET,
    inputMint: SOL,
    outputMint: USDC,
    inputAmount: "100000000",
    maxSlippageBps: 100,
    deadlineAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    stopConditions: ["Stop if any policy check fails"],
    quote: { inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true, verifiedAt: new Date().toISOString() },
    checks: [{ code: "balance_sufficient", status: "pass", message: "Previously sufficient" }],
    executionAllowed: false,
    createdAt: new Date().toISOString(),
  };
  const result = await new MissionSimulationService(reads, WALLETS).simulate(mission);
  assert.equal(result.status, "blocked");
  assert.equal(result.transactionSigned, false);
  assert.equal(result.broadcastAttempted, false);
  assert.equal(orderBuildAttempted, false);
});

test("mission simulation accepts an unsigned sole-signer transaction with an allowlisted program", async () => {
  const transaction = unsignedTransaction("11111111111111111111111111111111");
  const reads = passingReads(transaction, {
    slot: 2,
    err: null,
    logs: ["Program 11111111111111111111111111111111 success"],
    unitsConsumed: 500,
    feeLamports: 5000,
  });
  const result = await new MissionSimulationService(reads, WALLETS).simulate(missionFor(SELECTED_WALLET));
  assert.equal(result.status, "passed");
  assert.deepEqual(result.programIds, ["11111111111111111111111111111111"]);
  assert.equal(result.transactionSigned, false);
  assert.equal(result.broadcastAttempted, false);
});

test("mission simulation accepts the explicitly allowlisted OKX Aggregator V6 route", async () => {
  const program = "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u";
  const transaction = unsignedTransaction(program);
  const reads = passingReads(transaction, {
    slot: 2,
    err: null,
    logs: [`Program ${program} success`],
    unitsConsumed: 700,
    feeLamports: 5000,
  });
  const result = await new MissionSimulationService(reads, WALLETS).simulate(missionFor(SELECTED_WALLET));
  assert.equal(result.status, "passed");
  assert.deepEqual(result.programIds, [program]);
  assert.equal(result.transactionSigned, false);
  assert.equal(result.broadcastAttempted, false);
});

test("fee guard blocks an excessive simulated fee before the signer can be reached", async () => {
  const transaction = unsignedTransaction("11111111111111111111111111111111");
  const reads = passingReads(transaction, { slot: 2, err: null, logs: [], unitsConsumed: 500, feeLamports: 250_000 });
  const settings = { get: () => ({ maxNetworkFeeLamports: 200_000, maxFeePercent: 5, defaultSlippageBps: 50, defaultDeadlineMinutes: 30, priority: "standard" as const }) };
  const result = await new MissionSimulationService(reads, WALLETS, settings).simulate(missionFor(SELECTED_WALLET));
  assert.equal(result.status, "blocked");
  assert.equal(result.feeRisk, "extreme");
  assert.equal(result.feeGuardPassed, false);
  assert.match(result.feeGuardMessage ?? "", /exceeds the configured limit/u);
  assert.equal(result.transactionSigned, false);
  assert.equal(result.broadcastAttempted, false);
});

test("mission simulation blocks a transaction containing a non-allowlisted program before RPC simulation", async () => {
  let simulated = false;
  const transaction = unsignedTransaction("Vote111111111111111111111111111111111111111");
  const reads = passingReads(transaction, null, () => { simulated = true; });
  const result = await new MissionSimulationService(reads, WALLETS).simulate(missionFor(SELECTED_WALLET));
  assert.equal(result.status, "blocked");
  assert.match(result.error ?? "", /non-allowlisted program/u);
  assert.equal(simulated, false);
  assert.equal(result.broadcastAttempted, false);
});

test("approved execution signs the exact simulated transaction once and returns a confirmed receipt", async () => {
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const mission = missionFor(signer.address);
  const transaction = unsignedTransactionFor(signer.address, "11111111111111111111111111111111");
  let submittedSignaturePresent = false;
  const reads = {
    portfolio: async () => ({ address: signer.address, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }),
    swapQuote: async () => ({ inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true as const, verifiedAt: new Date().toISOString() }),
    buildUnsignedSwapOrder: async () => ({ transaction, requestId: "private-order-id", lastValidBlockHeight: "12345", outAmount: "15000000", router: "metis", mode: "ultra" }),
    simulateUnsignedTransaction: async () => ({ slot: 2, err: null, logs: [], unitsConsumed: 500, feeLamports: 5000 }),
    executeSignedSwap: async (signed: string) => {
      submittedSignaturePresent = getTransactionDecoder().decode(Buffer.from(signed, "base64")).signatures[signer.address] !== null;
      return { status: "Success" as const, signature: "1".repeat(64), code: 0, totalInputAmount: "100000000", totalOutputAmount: "15000000", error: null };
    },
    verifyTransactionSignature: async () => ({ state: "finalized" as const, slot: 77, error: null, verifiedAt: new Date().toISOString() }),
    transactionSettlement: async () => ({ slot: 77, feeLamports: 5000, walletPreLamports: "1000000000", walletPostLamports: "899995000" }),
  } as unknown as MainnetReadService;
  const wallets = {
    withWalletSigner: async <T>(addressValue: string, operation: (value: typeof signer) => Promise<T>) => {
      assert.equal(addressValue, signer.address);
      return operation(signer);
    },
  } as unknown as WalletOnboardingService;
  const service = new MissionSimulationService(reads, wallets);
  const simulation = await service.simulate(mission);
  assert.equal(simulation.status, "passed");
  const receipt = await service.execute(mission, simulation.id);
  assert.equal(receipt.status, "confirmed");
  assert.equal(receipt.signature, "1".repeat(64));
  assert.equal(receipt.chainVerification, "finalized");
  assert.equal(receipt.chainSlot, 77);
  assert.equal(receipt.actualNetworkFeeLamports, 5000);
  assert.equal(receipt.totalWalletOutflowLamports, "100005000");
  assert.equal(receipt.accountFundingLamports, "0");
  assert.equal(receipt.actualSlippageBps, 0);
  assert.equal(submittedSignaturePresent, true);
  await assert.rejects(() => service.execute(mission, simulation.id), /expired/u);
});

test("execution re-simulates immediately and blocks a stale OKX route before signing", async () => {
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const mission = missionFor(signer.address);
  const transaction = unsignedTransactionFor(signer.address, "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u");
  let simulations = 0;
  let signerOpened = false;
  let broadcastAttempted = false;
  const reads = {
    portfolio: async () => ({ address: signer.address, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }),
    swapQuote: async () => ({ inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "okx", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true as const, verifiedAt: new Date().toISOString() }),
    buildUnsignedSwapOrder: async () => ({ transaction, requestId: "private-order-id", lastValidBlockHeight: "12345", outAmount: "15000000", router: "okx", mode: "ultra" }),
    simulateUnsignedTransaction: async () => {
      simulations += 1;
      return simulations === 1
        ? { slot: 2, err: null, logs: [], unitsConsumed: 500, feeLamports: 5000 }
        : { slot: 3, err: { InstructionError: [7, { Custom: 6010 }] }, logs: ["Error Code: MinReturnNotReached"], unitsConsumed: 500, feeLamports: 5000 };
    },
    executeSignedSwap: async () => { broadcastAttempted = true; throw new Error("must not broadcast"); },
  } as unknown as MainnetReadService;
  const wallets = {
    withWalletSigner: async <T>(_address: string, operation: (value: typeof signer) => Promise<T>) => {
      signerOpened = true;
      return operation(signer);
    },
  } as unknown as WalletOnboardingService;
  const service = new MissionSimulationService(reads, wallets);
  const simulation = await service.simulate(mission);
  await assert.rejects(() => service.execute(mission, simulation.id), /minimum output.*No transaction was signed or broadcast/iu);
  assert.equal(simulations, 2);
  assert.equal(signerOpened, false);
  assert.equal(broadcastAttempted, false);
});

test("a successful router response remains unknown until Solana RPC confirms its signature", async () => {
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const mission = missionFor(signer.address);
  const transaction = unsignedTransactionFor(signer.address, "11111111111111111111111111111111");
  const reads = {
    portfolio: async () => ({ address: signer.address, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }),
    swapQuote: async () => ({ inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true as const, verifiedAt: new Date().toISOString() }),
    buildUnsignedSwapOrder: async () => ({ transaction, requestId: "private-order-id", lastValidBlockHeight: "12345", outAmount: "15000000", router: "metis", mode: "ultra" }),
    simulateUnsignedTransaction: async () => ({ slot: 2, err: null, logs: [], unitsConsumed: 500, feeLamports: 5000 }),
    executeSignedSwap: async () => ({ status: "Success" as const, signature: "1".repeat(64), code: 0, totalInputAmount: "100000000", totalOutputAmount: "15000000", error: null }),
    verifyTransactionSignature: async () => ({ state: "not-found" as const, slot: null, error: null, verifiedAt: new Date().toISOString() }),
  } as unknown as MainnetReadService;
  const wallets = { withWalletSigner: async <T>(_address: string, operation: (value: typeof signer) => Promise<T>) => operation(signer) } as unknown as WalletOnboardingService;
  const service = new MissionSimulationService(reads, wallets);
  const simulation = await service.simulate(mission);
  const receipt = await service.execute(mission, simulation.id);
  assert.equal(receipt.status, "unknown");
  assert.equal(receipt.chainVerification, "not-found");
  assert.match(receipt.error ?? "", /not yet|not independently/u);
});

function missionFor(walletAddress: string): MissionContractPreview {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    status: "ready-for-review",
    goal: "Preview selling 0.1 SOL for USDC",
    walletAddress,
    inputMint: SOL,
    outputMint: USDC,
    inputAmount: "100000000",
    maxSlippageBps: 100,
    deadlineAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    stopConditions: ["Stop if any policy check fails"],
    quote: { inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true, verifiedAt: new Date().toISOString() },
    checks: [{ code: "balance_sufficient", status: "pass", message: "Sufficient" }],
    executionAllowed: false,
    createdAt: new Date().toISOString(),
  };
}

function passingReads(transaction: string, simulation: { slot: number; err: unknown; logs: string[]; unitsConsumed: number; feeLamports: number } | null, onSimulate?: () => void): MainnetReadService {
  return {
    portfolio: async () => ({ address: SELECTED_WALLET, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }),
    swapQuote: async () => ({ inputMint: SOL, outputMint: USDC, inAmount: "100000000", outAmount: "15000000", router: "metis", mode: "ultra", feeBps: 2, feeMint: SOL, quoteOnly: true as const, verifiedAt: new Date().toISOString() }),
    buildUnsignedSwapOrder: async () => ({ transaction, requestId: "private-order-id", lastValidBlockHeight: "12345", outAmount: "15000000", router: "metis", mode: "ultra" }),
    simulateUnsignedTransaction: async () => {
      onSimulate?.();
      if (simulation === null) throw new Error("must not simulate");
      return simulation;
    },
  } as unknown as MainnetReadService;
}

function unsignedTransaction(program: string): string {
  return unsignedTransactionFor(SELECTED_WALLET, program);
}

function unsignedTransactionFor(walletValue: string, program: string): string {
  const wallet = address(walletValue);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayer(wallet, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 1n }, value),
    (value) => appendTransactionMessageInstruction({ programAddress: address(program) }, value),
  );
  return Buffer.from(getTransactionEncoder().encode(compileTransaction(message))).toString("base64");
}
