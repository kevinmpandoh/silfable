import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";

import { NetworkHealthMonitor } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import {
  GuardedFixtureTransferExecutionService,
  type GuardedFixtureTransferChainPort,
  type GuardedTransferPreparation,
} from "./guarded-fixture-transfer";
import {
  getGuardedFixtureManifestDigest,
  type FixtureProvenanceValidation,
  type GuardedFixtureManifest,
} from "./fixture-provenance";
import { buildGuardedSplTransferFixture } from "./spl-fixture";

class MemoryKeystore {
  value: string | null = null;
  isLocked() { return false; }
  async getSecret() { return this.value; }
  async setSecret(_name: "database-data-key", value: string) { this.value = value; }
}

class FakeTransferChain implements GuardedFixtureTransferChainPort {
  signCalls = 0;
  broadcastCalls = 0;
  preSignAllowed = true;
  invalidInitialDigest = false;
  throwAfterBroadcast = false;

  async prepare(_payer: KeyPairSigner, manifest: GuardedFixtureManifest): Promise<GuardedTransferPreparation> {
    return {
      messageHash: "e".repeat(64),
      simulationWireTransaction: "unsigned-transfer-wire",
      lastValidBlockHeight: 1000n,
      initialValidation: validation(
        true,
        this.invalidInitialDigest ? "f".repeat(64) : getGuardedFixtureManifestDigest(manifest),
      ),
      sign: async () => {
        this.signCalls += 1;
        return { wireTransaction: "signed-transfer-wire", signature: `signature-${manifest.transferAmountAtomic}` };
      },
    };
  }

  async simulate(preparation: GuardedTransferPreparation) {
    assert.equal(preparation.simulationWireTransaction, "unsigned-transfer-wire");
    assert.equal(this.signCalls, 0);
    return { unitsConsumed: 500n };
  }

  async revalidate(manifest: GuardedFixtureManifest) {
    return validation(this.preSignAllowed, getGuardedFixtureManifestDigest(manifest));
  }

  async broadcast() {
    this.broadcastCalls += 1;
    if (this.throwAfterBroadcast) throw new Error("network-dropped");
  }

  async getSignatureStatus() {
    return { found: true, error: false, confirmationStatus: "confirmed" as const };
  }

  async getBlockHeight() { return 900n; }
}

test("active fixture transfer revalidates, signs once, and confirms one encrypted execution", async () => {
  const fixture = await setup();
  try {
    const record = await fixture.service.execute();
    assert.equal(record.state, "confirmed");
    assert.equal(record.signingAttempted, true);
    assert.equal(record.broadcastAttempted, true);
    assert.equal(fixture.chain.signCalls, 1);
    assert.equal(fixture.chain.broadcastCalls, 1);
    assert.ok(record.encryptedPayload);
    assert.equal(record.encryptedPayload.includes("signed-transfer-wire"), false);
    const payload = JSON.parse(await fixture.cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce!,
      keyId: "local-data-key-v1",
    })) as { amountAtomic: string; preSignValidation: { allowed: boolean } };
    assert.equal(payload.amountAtomic, fixture.manifest.transferAmountAtomic);
    assert.equal(payload.preSignValidation.allowed, true);
    await assert.rejects(fixture.service.execute(), /UNIQUE constraint failed/u);
  } finally {
    await fixture.close();
  }
});

test("failed pre-sign provenance never signs, while post-broadcast failure remains ambiguous", async () => {
  const denied = await setup();
  try {
    denied.chain.preSignAllowed = false;
    const record = await denied.service.execute();
    assert.equal(record.state, "failed");
    assert.equal(denied.chain.signCalls, 0);
    assert.equal(denied.chain.broadcastCalls, 0);
  } finally {
    await denied.close();
  }

  const uncertain = await setup();
  try {
    uncertain.chain.throwAfterBroadcast = true;
    const record = await uncertain.service.execute();
    assert.equal(record.state, "ambiguous");
    assert.equal(record.failureCode, "network-dropped");
    assert.equal(uncertain.chain.broadcastCalls, 1);
  } finally {
    await uncertain.close();
  }
});

test("a provenance result for a different manifest is rejected before journaling or signing", async () => {
  const fixture = await setup();
  try {
    fixture.chain.invalidInitialDigest = true;
    await assert.rejects(fixture.service.execute(), /guarded-transfer-initial-provenance-denied/u);
    assert.equal(fixture.chain.signCalls, 0);
    assert.equal(fixture.chain.broadcastCalls, 0);
    assert.deepEqual(fixture.database.listGuardedFixtureTransfers(), []);
  } finally {
    await fixture.close();
  }
});

test("restart reconciliation confirms a broadcast journal without rebroadcasting", async () => {
  const fixture = await setup();
  try {
    const digest = getGuardedFixtureManifestDigest(fixture.manifest);
    const envelope = await fixture.cipher.encryptString(JSON.stringify({ signature: "existing-signature" }));
    let record = fixture.database.createGuardedFixtureTransfer({
      id: "00000000-0000-4000-8000-000000000701",
      fixtureManifestDigest: digest,
      messageHash: "e".repeat(64),
      lastValidBlockHeight: "1000",
      now: new Date().toISOString(),
    });
    record = fixture.database.updateGuardedFixtureTransfer({
      id: record.id,
      expectedState: "proposed",
      state: "simulated",
      simulationUnits: "500",
      now: new Date().toISOString(),
    });
    record = fixture.database.updateGuardedFixtureTransfer({
      id: record.id,
      expectedState: "simulated",
      state: "signed",
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      signingAttempted: true,
      now: new Date().toISOString(),
    });
    fixture.database.updateGuardedFixtureTransfer({
      id: record.id,
      expectedState: "signed",
      state: "broadcast",
      broadcastAttempted: true,
      now: new Date().toISOString(),
    });

    await fixture.service.reconcilePending();

    assert.equal(fixture.database.getGuardedFixtureTransfer(record.id)?.state, "confirmed");
    assert.equal(fixture.chain.broadcastCalls, 0);
    assert.equal(fixture.chain.signCalls, 0);
  } finally {
    await fixture.close();
  }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-guarded-transfer-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const keystore = new MemoryKeystore();
  const cipher = new LocalDataCipher(keystore);
  const health = new NetworkHealthMonitor({ probeHealth: async () => ({ latencyMs: 1 }) });
  await health.checkNow();
  const [wallet, mint, source, destination, destinationOwner] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const instruction = buildGuardedSplTransferFixture({
    source: source.address,
    mint: mint.address,
    destination: destination.address,
    authority: wallet,
    amount: 1_000_000n,
    decimals: 6,
  });
  const provisionId = "00000000-0000-4000-8000-000000000601";
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1,
    fixtureId: provisionId,
    cluster: "devnet",
    mintAddress: mint.address,
    mintDecimals: 6,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: wallet.address,
    destinationOwner: destinationOwner.address,
    transferAmountAtomic: "1000000",
    instructionFingerprint: instruction.fingerprint,
    reviewedAt: new Date().toISOString(),
  };
  const digest = getGuardedFixtureManifestDigest(manifest);
  database.createFixtureProvision({
    id: provisionId,
    mintAddress: mint.address,
    messageHash: "a".repeat(64),
    lastValidBlockHeight: "1000",
    now: new Date().toISOString(),
  });
  const reviewEnvelope = await cipher.encryptString(JSON.stringify({ manifest }));
  database.insertFixtureReview({
    provisionId,
    manifestDigest: digest,
    mintAddress: mint.address,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: wallet.address,
    destinationOwner: destinationOwner.address,
    observedSlot: "1",
    encryptedPayload: reviewEnvelope.ciphertext,
    payloadNonce: reviewEnvelope.nonce,
    keyId: reviewEnvelope.keyId,
    active: true,
    createdAt: new Date().toISOString(),
  });
  const chain = new FakeTransferChain();
  const service = new GuardedFixtureTransferExecutionService({
    database,
    cipher,
    health,
    keystore,
    wallet: { withWalletSigner: async (operation) => operation(wallet) },
    fixtureReview: { loadActiveManifest: async () => manifest },
    chain,
    confirmationTimeoutMs: 20,
    confirmationPollMs: 1,
  });
  return {
    service,
    chain,
    cipher,
    database,
    manifest,
    async close() {
      health.stop();
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function validation(allowed: boolean, manifestDigest: string): FixtureProvenanceValidation {
  return {
    allowed,
    manifestDigest,
    denialCodes: allowed ? [] : ["delegate-active"],
    validatedAt: new Date().toISOString(),
  };
}
