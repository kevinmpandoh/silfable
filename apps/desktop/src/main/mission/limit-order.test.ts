import assert from "node:assert/strict";
import test from "node:test";

import { address, appendTransactionMessageInstruction, blockhash, compileTransaction, createKeyPairSignerFromPrivateKeyBytes, createTransactionMessage, getTransactionDecoder, getTransactionEncoder, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash } from "@solana/kit";
import type { LimitOrderContractPreview } from "@silfable/contracts";

import type { MainnetReadService } from "../integrations/read-only.js";
import type { JupiterTriggerV2Client } from "../integrations/trigger-v2.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";
import { LimitOrderService } from "./limit-order.js";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

test("limit-order deposit is simulated unsigned and the exact cached transaction is signed once", async () => {
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const transaction = unsignedTransaction(signer.address, "11111111111111111111111111111111");
  const preview = previewFor(signer.address);
  let signed = false;
  const reads = {
    portfolio: async () => ({ address: signer.address, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }),
    prices: async () => new Map([[SOL, { usdPrice: 150, createdAt: null, blockId: 1 }]]),
    simulateUnsignedTransaction: async () => ({ slot: 2, err: null, logs: [], unitsConsumed: 400, feeLamports: 5000 }),
    verifyTransactionSignature: async () => ({ state: "finalized" as const, slot: 9, error: null, verifiedAt: new Date().toISOString() }),
  } as unknown as MainnetReadService;
  const wallets = { withWalletSigner: async <T>(_address: string, operation: (value: typeof signer) => Promise<T>) => operation(signer) } as unknown as WalletOnboardingService;
  const trigger = {
    getOrRegisterVault: async () => ({ userPubkey: signer.address, vaultPubkey: SOL, privyVaultId: "vault-id" }),
    craftSingleDeposit: async () => ({ transaction, requestId: "deposit-request", receiverAddress: SOL, mint: SOL, amount: "100000000", tokenDecimals: 9, inputTokenAccount: USDC }),
    createSingleOrder: async (input: { depositSignedTx: string }) => { signed = getTransactionDecoder().decode(Buffer.from(input.depositSignedTx, "base64")).signatures[signer.address] !== null; return { id: "order-123456", txSignature: "1".repeat(64), depositConfirmed: true }; },
  } as unknown as JupiterTriggerV2Client;
  const service = new LimitOrderService({ reads, wallets, trigger });
  const simulation = await service.simulate(preview);
  assert.equal(simulation.status, "passed"); assert.equal(simulation.transactionSigned, false); assert.equal(simulation.broadcastAttempted, false);
  const receipt = await service.execute(preview, simulation.id);
  assert.equal(receipt.status, "active"); assert.equal(receipt.chainVerification, "finalized"); assert.equal(signed, true);
  await assert.rejects(() => service.execute(preview, simulation.id), /expired/u);
});

test("limit-order simulation blocks a deposit whose receiver is not the authenticated vault", async () => {
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
  const reads = { portfolio: async () => ({ address: signer.address, slot: 1, solBalance: "1", solUsdPrice: 150, totalUsd: 150, assets: [], verifiedAt: new Date().toISOString() }), prices: async () => new Map([[SOL, { usdPrice: 150, createdAt: null, blockId: 1 }]]) } as unknown as MainnetReadService;
  const trigger = { getOrRegisterVault: async () => ({ userPubkey: signer.address, vaultPubkey: SOL, privyVaultId: "vault-id" }), craftSingleDeposit: async () => ({ transaction: "unused", requestId: "deposit-request", receiverAddress: USDC, mint: SOL, amount: "100000000", tokenDecimals: 9, inputTokenAccount: USDC }) } as unknown as JupiterTriggerV2Client;
  const service = new LimitOrderService({ reads, wallets: {} as WalletOnboardingService, trigger });
  const simulation = await service.simulate(previewFor(signer.address));
  assert.equal(simulation.status, "blocked"); assert.match(simulation.error ?? "", /not bound/u);
});

function previewFor(walletAddress: string): LimitOrderContractPreview { return { id: "00000000-0000-4000-8000-000000000020", status: "ready-for-review", goal: "Sell 0.1 SOL above $200", walletAddress, inputMint: SOL, outputMint: USDC, inputAmount: "100000000", triggerMint: SOL, triggerCondition: "above", triggerPriceUsd: 200, maxSlippageBps: 100, expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), estimatedInputValueUsd: 15, checks: [{ code: "minimum_order_value", status: "pass", message: "Minimum met" }], executionAllowed: false, lifecycle: "preview-only", createdAt: new Date().toISOString() }; }
function unsignedTransaction(walletValue: string, program: string): string { const wallet = address(walletValue); const message = pipe(createTransactionMessage({ version: 0 }), (value) => setTransactionMessageFeePayer(wallet, value), (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 1n }, value), (value) => appendTransactionMessageInstruction({ programAddress: address(program) }, value)); return Buffer.from(getTransactionEncoder().encode(compileTransaction(message))).toString("base64"); }
