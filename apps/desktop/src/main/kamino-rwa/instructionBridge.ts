import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { isSignerRole, isWritableRole, type Instruction } from "@solana/instructions";

export function toWeb3Instruction(instruction: Instruction): TransactionInstruction {
  const accounts = instruction.accounts ?? [];
  const keys = accounts.map((account) => {
    if ("lookupTableAddress" in account) throw new Error("Address lookup table accounts are not supported by this MVP's instruction bridge");
    return {
      pubkey: new PublicKey(account.address),
      isSigner: isSignerRole(account.role),
      isWritable: isWritableRole(account.role),
    };
  });
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programAddress),
    keys,
    data: Buffer.from(instruction.data ?? new Uint8Array()),
  });
}
