import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";

import {
  assertExactSimulatedMessage,
  buildGuardedSplTransferFixture,
  getTransactionMessageHash,
} from "./spl-fixture";

test("official SPL TransferChecked fixture is deterministic and decoded before use", async () => {
  const [authority, source, mint, destination] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const input = {
    source: source.address,
    mint: mint.address,
    destination: destination.address,
    authority,
    amount: 1_000_000n,
    decimals: 6,
  };
  const first = buildGuardedSplTransferFixture(input);
  const second = buildGuardedSplTransferFixture(input);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.decoded.amount, "1000000");
  assert.equal(first.decoded.decimals, 6);
  assert.equal(first.decoded.authority, authority.address);
  assert.deepEqual(first.programIds, ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"]);
});

test("exact-message binding rejects any post-simulation transaction change", async () => {
  const [authority, source, mint, destination] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const fixture = buildGuardedSplTransferFixture({
    source: source.address,
    mint: mint.address,
    destination: destination.address,
    authority,
    amount: 100n,
    decimals: 6,
  });
  const lifetime = { blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 1000n };
  const transaction = compileTransaction(pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(authority, message),
    (message) => setTransactionMessageLifetimeUsingBlockhash(lifetime, message),
    (message) => appendTransactionMessageInstruction(fixture.instruction, message),
  ));
  const messageHash = getTransactionMessageHash(transaction);
  assert.doesNotThrow(() => assertExactSimulatedMessage(messageHash, transaction));

  const changedFixture = buildGuardedSplTransferFixture({
    source: source.address,
    mint: mint.address,
    destination: destination.address,
    authority,
    amount: 101n,
    decimals: 6,
  });
  const changed = compileTransaction(pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(authority, message),
    (message) => setTransactionMessageLifetimeUsingBlockhash(lifetime, message),
    (message) => appendTransactionMessageInstruction(changedFixture.instruction, message),
  ));
  assert.throws(() => assertExactSimulatedMessage(messageHash, changed), /differs from the simulated message/u);
});
