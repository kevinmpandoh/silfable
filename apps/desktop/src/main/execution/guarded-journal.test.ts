import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type {
  GuardedDevnetProposal,
  GuardedDevnetSimulation,
  GuardedDevnetValidation,
} from "@silfable/contracts";
import {
  appendTransactionMessageInstruction,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";

import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import { GuardedDevnetJournal } from "./guarded-journal";
import { buildGuardedSplTransferFixture, getTransactionMessageHash } from "./spl-fixture";

class MemoryDataKeyStore {
  value: string | null = null;

  async getSecret() {
    return this.value;
  }

  async setSecret(_name: "database-data-key", value: string) {
    this.value = value;
  }
}

const proposal: GuardedDevnetProposal = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000101",
  missionId: "00000000-0000-4000-8000-000000000102",
  missionRevision: 1,
  planDigest: "a".repeat(64),
  fixtureManifestDigest: "c".repeat(64),
  cycle: 1,
  transactionKind: "spl-test-swap-v1",
  inputMint: "11111111111111111111111111111111",
  outputMint: "22222222222222222222222222222222",
  inputAmountAtomic: "100",
  quotedOutputAtomic: "200",
  minimumOutputAtomic: "198",
  slippageBps: 100,
  priceImpactBps: 20,
  observedAt: "2026-07-17T00:00:00.000Z",
  expiresAt: "2026-07-17T00:00:30.000Z",
};

test("guarded journal persists encrypted append-only evidence through receipt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-journal-"));
  const databasePath = join(directory, "runtime.sqlite3");
  const keyStore = new MemoryDataKeyStore();
  let database = await RuntimeDatabase.open(databasePath);
  try {
    let journal = new GuardedDevnetJournal(database, new LocalDataCipher(keyStore));
    const { transaction, changed } = await transactions();
    const simulation = makeSimulation(getTransactionMessageHash(transaction));

    assert.equal((await journal.create(proposal)).state, "proposed");
    const encryptedProposal = database.listGuardedExecutionEvents(proposal.id)[0];
    assert.ok(encryptedProposal);
    assert.equal(encryptedProposal.encryptedPayload.includes(proposal.inputAmountAtomic), false);
    assert.equal(encryptedProposal.encryptedPayload.includes(proposal.inputMint), false);

    assert.equal((await journal.recordValidation(proposal.id, validation("pre-simulation"))).state, "validated");
    assert.equal((await journal.recordSimulation(proposal.id, simulation, transaction)).state, "simulated");
    await assert.rejects(
      journal.recordSigned({
        executionId: proposal.id,
        validation: validation("pre-sign"),
        transaction: changed,
      }),
      /differs from the simulated message/u,
    );
    assert.equal(journal.get(proposal.id)?.state, "simulated");

    const signed = await journal.recordSigned({
      executionId: proposal.id,
      validation: validation("pre-sign"),
      transaction,
    });
    assert.equal(signed.state, "signed");
    assert.equal(signed.signingAttempted, true);
    assert.equal(signed.messageHash, simulation.transactionMessageHash);
    assert.equal((await journal.recordBroadcastAttempt(proposal.id)).state, "broadcast");
    assert.equal((await journal.recordConfirmed(proposal.id, { confirmationStatus: "confirmed" })).state, "confirmed");
    assert.equal((await journal.recordReceipt(proposal.id, { input: "100", output: "198" })).state, "receipted");

    const beforeReopen = await journal.listEvidence(proposal.id);
    assert.deepEqual(beforeReopen.map((event) => event.eventName), [
      "proposal-created",
      "validation-passed",
      "simulation-passed",
      "signed",
      "broadcast-attempted",
      "confirmed",
      "receipt-stored",
    ]);
    database.close();

    database = await RuntimeDatabase.open(databasePath);
    journal = new GuardedDevnetJournal(database, new LocalDataCipher(keyStore));
    assert.equal(journal.get(proposal.id)?.state, "receipted");
    assert.deepEqual(await journal.listEvidence(proposal.id), beforeReopen);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("guarded journal rejects duplicate cycles and records post-broadcast uncertainty", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-ambiguous-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  try {
    const journal = new GuardedDevnetJournal(database, new LocalDataCipher(new MemoryDataKeyStore()));
    const { transaction } = await transactions();
    await journal.create(proposal);
    await assert.rejects(
      journal.create({ ...proposal, id: "00000000-0000-4000-8000-000000000103" }),
      /UNIQUE constraint failed/u,
    );
    await assert.rejects(
      journal.recordValidation(proposal.id, { ...validation("pre-simulation"), fixtureManifestDigest: "d".repeat(64) }),
      /validation did not pass/u,
    );
    await journal.recordValidation(proposal.id, validation("pre-simulation"));
    await assert.rejects(journal.recordValidation(proposal.id, validation("pre-simulation")), /Invalid guarded execution transition/u);
    const simulation = makeSimulation(getTransactionMessageHash(transaction));
    await assert.rejects(
      journal.recordSimulation(proposal.id, { ...simulation, fixtureManifestDigest: "d".repeat(64) }, transaction),
      /simulation did not pass/u,
    );
    await journal.recordSimulation(proposal.id, simulation, transaction);
    await journal.recordSigned({
      executionId: proposal.id,
      validation: validation("pre-sign"),
      transaction,
    });
    await journal.recordBroadcastAttempt(proposal.id);
    const ambiguous = await journal.recordFailure(proposal.id, "network-dropped");
    assert.equal(ambiguous.state, "ambiguous");
    assert.equal(ambiguous.broadcastAttempted, true);
    assert.equal(ambiguous.failureCode, "network-dropped");
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

function validation(stage: "pre-simulation" | "pre-sign"): GuardedDevnetValidation {
  return {
    schemaVersion: 1,
    stage,
    proposalId: proposal.id,
    fixtureManifestDigest: proposal.fixtureManifestDigest,
    allowed: true,
    signingAllowed: stage === "pre-sign",
    denialCodes: [],
    validatedAt: "2026-07-17T00:00:10.000Z",
  };
}

function makeSimulation(transactionMessageHash: string): GuardedDevnetSimulation {
  return {
    schemaVersion: 1,
    proposalId: proposal.id,
    fixtureManifestDigest: proposal.fixtureManifestDigest,
    succeeded: true,
    feeLamports: "5000",
    unitsConsumed: "100000",
    lastValidBlockHeight: "1000",
    transactionMessageHash,
    programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    inputDebitAtomic: "100",
    outputCreditAtomic: "198",
  };
}

async function transactions() {
  const [authority, source, mint, destination] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const lifetime = { blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 1000n };
  const sign = async (amount: bigint) => {
    const fixture = buildGuardedSplTransferFixture({
      source: source.address,
      mint: mint.address,
      destination: destination.address,
      authority,
      amount,
      decimals: 6,
    });
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (message) => setTransactionMessageFeePayerSigner(authority, message),
      (message) => setTransactionMessageLifetimeUsingBlockhash(lifetime, message),
      (message) => appendTransactionMessageInstruction(fixture.instruction, message),
    );
    return signTransactionMessageWithSigners(message);
  };
  const [transaction, changed] = await Promise.all([sign(100n), sign(101n)]);
  return { transaction, changed };
}
