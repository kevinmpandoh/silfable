import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateKeyPairSigner } from "@solana/kit";

import { NetworkHealthMonitor } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import { FixtureTransferApprovalService } from "./fixture-transfer-approval";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";

class MemoryKeystore {
  value: string | null = null;
  isLocked() { return false; }
  async getSecret() { return this.value; }
  async setSecret(_name: "database-data-key", value: string) { this.value = value; }
}

test("operator approval rechecks confirmation and stores only encrypted approval evidence", async () => {
  const fixture = await setup();
  try {
    const approval = await fixture.service.approve(fixture.transferId);
    assert.equal(approval.fixtureManifestDigest, fixture.manifestDigest);
    assert.equal(approval.encryptedPayload.includes(fixture.signature), false);
    assert.equal(fixture.confirmationChecks, 1);
    const payload = JSON.parse(await fixture.cipher.decryptString({
      ciphertext: approval.encryptedPayload,
      nonce: approval.payloadNonce,
      keyId: "local-data-key-v1",
    })) as { automaticTradingEnabled: boolean; transferId: string };
    assert.equal(payload.automaticTradingEnabled, false);
    assert.equal(payload.transferId, fixture.transferId);
    await assert.rejects(fixture.service.approve(fixture.transferId), /already approved/u);
  } finally {
    await fixture.close();
  }
});

test("tampered evidence and missing fresh confirmation cannot create an approval", async () => {
  const tampered = await setup({ evidenceManifestDigest: "f".repeat(64) });
  try {
    await assert.rejects(tampered.service.approve(tampered.transferId), /does not match/u);
    assert.equal(tampered.database.getGuardedFixtureTransferApproval(), null);
  } finally {
    await tampered.close();
  }

  const unconfirmed = await setup({ confirmedOnChain: false });
  try {
    await assert.rejects(unconfirmed.service.approve(unconfirmed.transferId), /not confirmed on-chain/u);
    assert.equal(unconfirmed.database.getGuardedFixtureTransferApproval(), null);
  } finally {
    await unconfirmed.close();
  }
});

async function setup(options: { evidenceManifestDigest?: string; confirmedOnChain?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "silfable-fixture-approval-"));
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
  const provisionId = "00000000-0000-4000-8000-000000000801";
  const transferId = "00000000-0000-4000-8000-000000000802";
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
    instructionFingerprint: "a".repeat(64),
    reviewedAt: new Date().toISOString(),
  };
  const manifestDigest = getGuardedFixtureManifestDigest(manifest);
  database.createFixtureProvision({
    id: provisionId,
    mintAddress: mint.address,
    messageHash: "b".repeat(64),
    lastValidBlockHeight: "1000",
    now: new Date().toISOString(),
  });
  const reviewEnvelope = await cipher.encryptString(JSON.stringify({ manifest }));
  database.insertFixtureReview({
    provisionId,
    manifestDigest,
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
  const signature = "s".repeat(64);
  const evidenceDigest = options.evidenceManifestDigest ?? manifestDigest;
  const validation = { allowed: true, manifestDigest: evidenceDigest, denialCodes: [] };
  const evidenceEnvelope = await cipher.encryptString(JSON.stringify({
    schemaVersion: 1,
    manifestDigest: evidenceDigest,
    amountAtomic: manifest.transferAmountAtomic,
    initialValidation: validation,
    preSignValidation: validation,
    wireTransaction: "signed-wire",
    signature,
  }));
  let transfer = database.createGuardedFixtureTransfer({
    id: transferId,
    fixtureManifestDigest: manifestDigest,
    messageHash: "c".repeat(64),
    lastValidBlockHeight: "1000",
    now: new Date().toISOString(),
  });
  transfer = database.updateGuardedFixtureTransfer({
    id: transfer.id,
    expectedState: "proposed",
    state: "simulated",
    simulationUnits: "500",
    now: new Date().toISOString(),
  });
  transfer = database.updateGuardedFixtureTransfer({
    id: transfer.id,
    expectedState: "simulated",
    state: "signed",
    encryptedPayload: evidenceEnvelope.ciphertext,
    payloadNonce: evidenceEnvelope.nonce,
    keyId: evidenceEnvelope.keyId,
    signingAttempted: true,
    now: new Date().toISOString(),
  });
  transfer = database.updateGuardedFixtureTransfer({
    id: transfer.id,
    expectedState: "signed",
    state: "broadcast",
    broadcastAttempted: true,
    now: new Date().toISOString(),
  });
  database.updateGuardedFixtureTransfer({
    id: transfer.id,
    expectedState: "broadcast",
    state: "confirmed",
    now: new Date().toISOString(),
  });
  let confirmationChecks = 0;
  const service = new FixtureTransferApprovalService({
    database,
    cipher,
    health,
    keystore,
    fixtureReview: { loadActiveManifest: async () => manifest },
    chain: {
      getSignatureStatus: async () => {
        confirmationChecks += 1;
        return options.confirmedOnChain === false
          ? { found: false, error: false, confirmationStatus: null }
          : { found: true, error: false, confirmationStatus: "confirmed" as const };
      },
    },
  });
  return {
    database,
    cipher,
    service,
    signature,
    transferId,
    manifestDigest,
    get confirmationChecks() { return confirmationChecks; },
    async close() {
      health.stop();
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
