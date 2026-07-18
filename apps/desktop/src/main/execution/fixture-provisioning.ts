import { getCreateAccountInstruction } from "@solana-program/system";
import {
  AuthorityType,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToCheckedInstruction,
  getSetAuthorityInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  address,
  lamports,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

import type { GuardedFixtureManifest } from "./fixture-provenance.js";
import { buildGuardedSplTransferFixture, type GuardedSplTransferFixture } from "./spl-fixture.js";

export type DevnetFixtureProvisioningPlan = {
  cluster: "devnet";
  mintAddress: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  destinationOwner: string;
  decimals: number;
  supplyAtomic: string;
  transferAmountAtomic: string;
  instructions: readonly Instruction[];
  transferFixture: GuardedSplTransferFixture;
  toManifest(input: { fixtureId: string; reviewedAt: string }): GuardedFixtureManifest;
};

export async function buildDevnetFixtureProvisioningPlan(input: {
  payer: TransactionSigner;
  mint: TransactionSigner;
  destinationOwner: string;
  decimals: number;
  supplyAtomic: bigint;
  transferAmountAtomic: bigint;
  mintRentLamports: bigint;
}): Promise<DevnetFixtureProvisioningPlan> {
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 9) {
    throw new Error("Fixture mint decimals are invalid");
  }
  if (
    input.supplyAtomic <= 0n ||
    input.transferAmountAtomic <= 0n ||
    input.transferAmountAtomic > input.supplyAtomic ||
    input.mintRentLamports <= 0n
  ) throw new Error("Fixture provisioning amount is invalid");
  const destinationOwner = address(input.destinationOwner);
  if (destinationOwner === input.payer.address) throw new Error("Fixture destination owner must be distinct");
  const [sourceTokenAccount] = await findAssociatedTokenPda({
    owner: input.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: input.mint.address,
  });
  const [destinationTokenAccount] = await findAssociatedTokenPda({
    owner: destinationOwner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: input.mint.address,
  });
  const instructions: Instruction[] = [
    getCreateAccountInstruction({
      payer: input.payer,
      newAccount: input.mint,
      lamports: lamports(input.mintRentLamports),
      space: getMintSize(),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({
      mint: input.mint.address,
      decimals: input.decimals,
      mintAuthority: input.payer.address,
      freezeAuthority: input.payer.address,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: sourceTokenAccount,
      owner: input.payer.address,
      mint: input.mint.address,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: destinationTokenAccount,
      owner: destinationOwner,
      mint: input.mint.address,
    }),
    getMintToCheckedInstruction({
      mint: input.mint.address,
      token: sourceTokenAccount,
      mintAuthority: input.payer,
      amount: input.supplyAtomic,
      decimals: input.decimals,
    }),
    getSetAuthorityInstruction({
      owned: input.mint.address,
      owner: input.payer,
      authorityType: AuthorityType.MintTokens,
      newAuthority: null,
    }),
    getSetAuthorityInstruction({
      owned: input.mint.address,
      owner: input.payer,
      authorityType: AuthorityType.FreezeAccount,
      newAuthority: null,
    }),
  ];
  const transferFixture = buildGuardedSplTransferFixture({
    source: sourceTokenAccount,
    mint: input.mint.address,
    destination: destinationTokenAccount,
    authority: input.payer,
    amount: input.transferAmountAtomic,
    decimals: input.decimals,
  });
  return {
    cluster: "devnet",
    mintAddress: input.mint.address,
    sourceTokenAccount,
    destinationTokenAccount,
    destinationOwner,
    decimals: input.decimals,
    supplyAtomic: input.supplyAtomic.toString(),
    transferAmountAtomic: input.transferAmountAtomic.toString(),
    instructions: Object.freeze(instructions),
    transferFixture,
    toManifest({ fixtureId, reviewedAt }) {
      return {
        schemaVersion: 1,
        fixtureId,
        cluster: "devnet",
        mintAddress: input.mint.address,
        mintDecimals: input.decimals,
        sourceTokenAccount,
        destinationTokenAccount,
        walletAuthority: input.payer.address,
        destinationOwner,
        transferAmountAtomic: input.transferAmountAtomic.toString(),
        instructionFingerprint: transferFixture.fingerprint,
        reviewedAt,
      };
    },
  };
}
