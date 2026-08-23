import assert from "node:assert/strict";
import test from "node:test";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { derivePerpCollateralUsdc, messageDigest } from "./phoenix-perps-core";

const PHOENIX_PROGRAM_ID = new PublicKey("EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

test("derives the same default isolated collateral as the perps form", () => {
  assert.equal(derivePerpCollateralUsdc(0.5), "0.17");
  assert.equal(derivePerpCollateralUsdc(250, 5), "50.00");
});

function createOrderTx(params?: {
  payer?: Keypair;
  blockhash?: string;
  unitLimit?: number;
  unitPrice?: number;
  programId?: PublicKey;
  data?: Buffer;
  keys?: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
}): { payer: Keypair; transaction: VersionedTransaction } {
  const payer = params?.payer ?? Keypair.generate();
  const blockhash = params?.blockhash ?? Keypair.generate().publicKey.toBase58();
  const instructions: TransactionInstruction[] = [];

  if (params?.unitLimit !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: params.unitLimit }));
  } else {
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  }

  if (params?.unitPrice !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: params.unitPrice }));
  }

  instructions.push(
    new TransactionInstruction({
      programId: params?.programId ?? PHOENIX_PROGRAM_ID,
      keys: params?.keys ?? [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: params?.data ?? Buffer.from([1, 2, 3, 4, 5]),
    })
  );

  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()
  );

  return { payer, transaction };
}

test("messageDigest matches across wallet priority fee additions", () => {
  const payer = Keypair.generate();
  const initial = createOrderTx({ payer });
  const withPriorityFee = createOrderTx({ payer, unitPrice: 50_000 });

  const initialDigest = messageDigest(initial.transaction);
  const withPriorityFeeDigest = messageDigest(withPriorityFee.transaction);

  assert.equal(initialDigest, withPriorityFeeDigest);
});

test("messageDigest matches across wallet compute unit limit adjustments", () => {
  const payer = Keypair.generate();
  const standardLimit = createOrderTx({ payer, unitLimit: 400_000, unitPrice: 10_000 });
  const walletAdjustedLimit = createOrderTx({ payer, unitLimit: 325_000, unitPrice: 100_000 });

  assert.equal(
    messageDigest(standardLimit.transaction),
    messageDigest(walletAdjustedLimit.transaction)
  );
});

test("messageDigest matches across recent blockhash refresh", () => {
  const payer = Keypair.generate();
  const blockhash1 = Keypair.generate().publicKey.toBase58();
  const blockhash2 = Keypair.generate().publicKey.toBase58();

  const tx1 = createOrderTx({ payer, blockhash: blockhash1, unitPrice: 10_000 });
  const tx2 = createOrderTx({ payer, blockhash: blockhash2, unitPrice: 10_000 });

  assert.equal(messageDigest(tx1.transaction), messageDigest(tx2.transaction));
});

test("messageDigest rejects altered instruction data (tampering)", () => {
  const payer = Keypair.generate();
  const original = createOrderTx({ payer, data: Buffer.from([1, 2, 3, 4, 5]) });
  const tampered = createOrderTx({ payer, data: Buffer.from([1, 2, 3, 4, 99]) });

  assert.notEqual(messageDigest(original.transaction), messageDigest(tampered.transaction));
});

test("messageDigest rejects altered instruction program ID", () => {
  const payer = Keypair.generate();
  const original = createOrderTx({ payer, programId: PHOENIX_PROGRAM_ID });
  const tampered = createOrderTx({ payer, programId: TOKEN_PROGRAM_ID });

  assert.notEqual(messageDigest(original.transaction), messageDigest(tampered.transaction));
});

test("messageDigest rejects altered instruction accounts", () => {
  const payer = Keypair.generate();
  const otherAccount = Keypair.generate().publicKey;
  const original = createOrderTx({ payer });
  const tampered = createOrderTx({
    payer,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: otherAccount, isSigner: false, isWritable: false },
    ],
  });

  assert.notEqual(messageDigest(original.transaction), messageDigest(tampered.transaction));
});

test("messageDigest rejects altered payer address", () => {
  const payer1 = Keypair.generate();
  const payer2 = Keypair.generate();
  const tx1 = createOrderTx({ payer: payer1 });
  const tx2 = createOrderTx({ payer: payer2 });

  assert.notEqual(messageDigest(tx1.transaction), messageDigest(tx2.transaction));
});
