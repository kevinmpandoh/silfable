import assert from "node:assert/strict";
import test from "node:test";

import { parseCreateAccountInstruction, SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  AuthorityType,
  parseCreateAssociatedTokenIdempotentInstruction,
  parseInitializeMint2Instruction,
  parseMintToCheckedInstruction,
  parseSetAuthorityInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  isNone,
  isSome,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type InstructionWithAccounts,
  type InstructionWithData,
  type AccountMeta,
  type ReadonlyUint8Array,
} from "@solana/kit";

import { parseGuardedFixtureManifest } from "./fixture-provenance";
import { buildDevnetFixtureProvisioningPlan } from "./fixture-provisioning";

test("fixture provisioning is one atomic bounded transaction that permanently revokes authorities", async () => {
  const [payer, mint, destinationOwner] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const plan = await buildDevnetFixtureProvisioningPlan({
    payer,
    mint,
    destinationOwner: destinationOwner.address,
    decimals: 6,
    supplyAtomic: 1_000_000n,
    transferAmountAtomic: 100n,
    mintRentLamports: 1_461_600n,
  });
  assert.equal(plan.instructions.length, 7);
  assert.deepEqual(plan.instructions.map((instruction) => instruction.programAddress), [
    SYSTEM_PROGRAM_ADDRESS,
    TOKEN_PROGRAM_ADDRESS,
    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    TOKEN_PROGRAM_ADDRESS,
    TOKEN_PROGRAM_ADDRESS,
    TOKEN_PROGRAM_ADDRESS,
  ]);

  const create = parseCreateAccountInstruction(narrow(plan.instructions[0]!));
  assert.equal(create.accounts.newAccount.address, mint.address);
  assert.equal(create.data.lamports, 1_461_600n);
  assert.equal(create.data.programAddress, TOKEN_PROGRAM_ADDRESS);
  const initialize = parseInitializeMint2Instruction(narrow(plan.instructions[1]!));
  assert.equal(initialize.data.decimals, 6);
  assert.equal(initialize.data.mintAuthority, payer.address);
  assert.equal(isSome(initialize.data.freezeAuthority), true);

  const sourceAta = parseCreateAssociatedTokenIdempotentInstruction(narrow(plan.instructions[2]!));
  const destinationAta = parseCreateAssociatedTokenIdempotentInstruction(narrow(plan.instructions[3]!));
  assert.equal(sourceAta.accounts.owner.address, payer.address);
  assert.equal(destinationAta.accounts.owner.address, destinationOwner.address);
  assert.notEqual(sourceAta.accounts.ata.address, destinationAta.accounts.ata.address);

  const mintTo = parseMintToCheckedInstruction(narrow(plan.instructions[4]!));
  assert.equal(mintTo.data.amount, 1_000_000n);
  assert.equal(mintTo.accounts.token.address, plan.sourceTokenAccount);
  const revokeMint = parseSetAuthorityInstruction(narrow(plan.instructions[5]!));
  const revokeFreeze = parseSetAuthorityInstruction(narrow(plan.instructions[6]!));
  assert.equal(revokeMint.data.authorityType, AuthorityType.MintTokens);
  assert.equal(revokeFreeze.data.authorityType, AuthorityType.FreezeAccount);
  assert.equal(isNone(revokeMint.data.newAuthority), true);
  assert.equal(isNone(revokeFreeze.data.newAuthority), true);

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayerSigner(payer, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: 1000n,
    }, value),
    (value) => appendTransactionMessageInstructions(plan.instructions, value),
  );
  const transaction = await signTransactionMessageWithSigners(message);
  const wireBytes = Buffer.from(getBase64EncodedWireTransaction(transaction), "base64");
  assert.ok(wireBytes.length <= 1232, `Provisioning transaction is ${wireBytes.length} bytes`);

  const manifest = parseGuardedFixtureManifest(plan.toManifest({
    fixtureId: "00000000-0000-4000-8000-000000000301",
    reviewedAt: "2026-07-17T02:00:00.000Z",
  }));
  assert.equal(manifest.mintAddress, mint.address);
  assert.equal(manifest.instructionFingerprint, plan.transferFixture.fingerprint);
  assert.equal(manifest.transferAmountAtomic, "100");
});

test("fixture provisioning rejects unsafe amounts and a self-owned destination", async () => {
  const [payer, mint] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner()]);
  await assert.rejects(buildDevnetFixtureProvisioningPlan({
    payer,
    mint,
    destinationOwner: payer.address,
    decimals: 6,
    supplyAtomic: 1_000n,
    transferAmountAtomic: 100n,
    mintRentLamports: 1_461_600n,
  }), /must be distinct/u);
  await assert.rejects(buildDevnetFixtureProvisioningPlan({
    payer,
    mint,
    destinationOwner: mint.address,
    decimals: 10,
    supplyAtomic: 100n,
    transferAmountAtomic: 101n,
    mintRentLamports: 0n,
  }), /decimals are invalid/u);
});

function narrow(instruction: Instruction): Instruction & InstructionWithAccounts<readonly AccountMeta[]> & InstructionWithData<ReadonlyUint8Array> {
  assertIsInstructionWithAccounts(instruction);
  assertIsInstructionWithData(instruction);
  return instruction;
}
