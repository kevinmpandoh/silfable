import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { AccountRole } from "@solana/instructions";
import { address } from "@solana/kit";
import { toWeb3Instruction } from "./instructionBridge.js";

test("toWeb3Instruction maps program address, account roles, and data correctly", () => {
  const programAddress = address("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
  const writableSigner = address("4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM");
  const readonly = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const result = toWeb3Instruction({
    programAddress,
    accounts: [
      { address: writableSigner, role: AccountRole.WRITABLE_SIGNER },
      { address: readonly, role: AccountRole.READONLY },
    ],
    data: new Uint8Array([1, 2, 3]),
  });
  assert.equal(result.programId.toBase58(), programAddress);
  assert.equal(result.keys.length, 2);
  assert.equal(result.keys[0].pubkey.toBase58(), writableSigner);
  assert.equal(result.keys[0].isSigner, true);
  assert.equal(result.keys[0].isWritable, true);
  assert.equal(result.keys[1].pubkey.toBase58(), readonly);
  assert.equal(result.keys[1].isSigner, false);
  assert.equal(result.keys[1].isWritable, false);
  assert.deepEqual([...result.data], [1, 2, 3]);
  assert.ok(result.programId instanceof PublicKey);
});

test("toWeb3Instruction rejects an address-lookup-table account (unsupported in this MVP)", () => {
  const programAddress = address("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
  assert.throws(() => toWeb3Instruction({
    programAddress,
    accounts: [{ address: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), role: 1, lookupTableAddress: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") } as never],
    data: new Uint8Array([]),
  }), /lookup table/i);
});
