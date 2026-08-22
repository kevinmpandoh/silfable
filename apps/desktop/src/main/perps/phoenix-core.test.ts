import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { PerpOrderPlan } from "@mirae/contracts";

import { normalizeSymbol, validatePerpOrderPlanForSigning } from "./phoenix-core.js";

const PHOENIX_PROGRAM_ID = new PublicKey("EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function fixture(programId = PHOENIX_PROGRAM_ID): { wallet: Keypair; transaction: VersionedTransaction; plan: PerpOrderPlan } {
  const wallet = Keypair.generate();
  const blockhash = Keypair.generate().publicKey.toBase58();
  const transaction = new VersionedTransaction(new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [new TransactionInstruction({ programId, keys: [], data: Buffer.from([1, 2, 3]) })],
  }).compileToV0Message());
  const digest = createHash("sha256").update(transaction.message.serialize()).digest("hex");
  return {
    wallet,
    transaction,
    plan: {
      action: "place_order",
      transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
      transactionDigest: digest,
      walletAddress: wallet.publicKey.toBase58(),
      symbol: "SOL-PERP",
      direction: "long",
      orderKind: "market",
      reduceOnly: false,
      baseAmount: "0.1",
      notionalUsd: "10.00",
      oraclePriceUsd: "100.0000",
      limitPriceUsd: null,
      networkFeeLamports: "5000",
      simulationSlot: 1,
      computeUnitsConsumed: 1000,
      invokedPrograms: [programId.toBase58()],
      lastValidBlockHeight: 500,
      expiresAt: 10_000,
      checks: ["verified"],
    },
  };
}

test("normalizes supported perpetual symbols without changing their identity", () => {
  assert.equal(normalizeSymbol(" sol-perp "), "SOL");
  assert.equal(normalizeSymbol("BTC/USDC"), "BTC");
});

test("accepts an unsigned, wallet-bound, unexpired transaction for the verified exchange program", () => {
  const { wallet, transaction, plan } = fixture();
  assert.doesNotThrow(() => validatePerpOrderPlanForSigning(plan, transaction, wallet.publicKey.toBase58(), 9_000, 499));
});

test("accepts a verified USDC collateral transfer without requiring an order instruction", () => {
  const funding = fixture(TOKEN_PROGRAM_ID);
  funding.plan.action = "fund_collateral";
  assert.doesNotThrow(() => validatePerpOrderPlanForSigning(
    funding.plan,
    funding.transaction,
    funding.wallet.publicKey.toBase58(),
    9_000,
    499,
  ));
});

test("accepts official builder onboarding with the pinned venue co-signer", () => {
  const wallet = Keypair.generate();
  const onboarder = Keypair.generate();
  const transaction = new VersionedTransaction(new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [new TransactionInstruction({
      programId: PHOENIX_PROGRAM_ID,
      keys: [{ pubkey: onboarder.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from([1, 2, 3]),
    })],
  }).compileToV0Message());
  const plan = fixture().plan;
  Object.assign(plan, {
    action: "register_account",
    walletAddress: wallet.publicKey.toBase58(),
    transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
    transactionDigest: createHash("sha256").update(transaction.message.serialize()).digest("hex"),
    onboarderAddress: onboarder.publicKey.toBase58(),
    maxPositions: 32,
  });
  assert.doesNotThrow(() => validatePerpOrderPlanForSigning(plan, transaction, wallet.publicKey.toBase58(), 9_000, 499));
});

test("rejects expired, wallet-mismatched, signed, and unapproved perpetual transactions", () => {
  const expired = fixture();
  assert.throws(() => validatePerpOrderPlanForSigning(expired.plan, expired.transaction, expired.wallet.publicKey.toBase58(), 10_000, 499), /expired/u);

  const mismatch = fixture();
  assert.throws(() => validatePerpOrderPlanForSigning(mismatch.plan, mismatch.transaction, Keypair.generate().publicKey.toBase58(), 9_000, 499), /does not match/u);

  const signed = fixture();
  signed.transaction.sign([signed.wallet]);
  assert.throws(() => validatePerpOrderPlanForSigning(signed.plan, signed.transaction, signed.wallet.publicKey.toBase58(), 9_000, 499), /changed after preflight|already contains a signature/u);

  const unapproved = fixture(Keypair.generate().publicKey);
  assert.throws(() => validatePerpOrderPlanForSigning(unapproved.plan, unapproved.transaction, unapproved.wallet.publicKey.toBase58(), 9_000, 499), /unapproved program/u);
});
