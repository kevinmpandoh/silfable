import { createHash } from "node:crypto";

import {
  getTransferCheckedInstruction,
  parseTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  address,
  type Address,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";

export type GuardedSplTransferFixture = {
  instruction: ReturnType<typeof getTransferCheckedInstruction>;
  fingerprint: string;
  programIds: string[];
  decoded: {
    source: string;
    mint: string;
    destination: string;
    authority: string;
    amount: string;
    decimals: number;
  };
};

export function buildGuardedSplTransferFixture(input: {
  source: string;
  mint: string;
  destination: string;
  authority: TransactionSigner | Address;
  amount: bigint;
  decimals: number;
}): GuardedSplTransferFixture {
  if (input.amount <= 0n) throw new Error("SPL fixture amount must be positive");
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 9) {
    throw new Error("SPL fixture decimals are invalid");
  }
  const instruction = getTransferCheckedInstruction({
    source: address(input.source),
    mint: address(input.mint),
    destination: address(input.destination),
    authority: input.authority,
    amount: input.amount,
    decimals: input.decimals,
  });
  const parsed = parseTransferCheckedInstruction(instruction);
  const decoded = {
    source: parsed.accounts.source.address,
    mint: parsed.accounts.mint.address,
    destination: parsed.accounts.destination.address,
    authority: parsed.accounts.authority.address,
    amount: parsed.data.amount.toString(),
    decimals: parsed.data.decimals,
  };
  return {
    instruction,
    fingerprint: hashCanonical({
      programAddress: instruction.programAddress,
      accounts: instruction.accounts?.map((account) => ({ address: account.address, role: account.role })) ?? [],
      data: Buffer.from(instruction.data ?? []).toString("base64"),
    }),
    programIds: [TOKEN_PROGRAM_ADDRESS],
    decoded,
  };
}

export function getTransactionMessageHash(transaction: Pick<Transaction, "messageBytes">): string {
  return createHash("sha256").update(Buffer.from(transaction.messageBytes)).digest("hex");
}

export function assertExactSimulatedMessage(
  expectedMessageHash: string,
  transaction: Pick<Transaction, "messageBytes">,
): void {
  if (!/^[a-f0-9]{64}$/u.test(expectedMessageHash) || getTransactionMessageHash(transaction) !== expectedMessageHash) {
    throw new Error("Guarded transaction differs from the simulated message");
  }
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
