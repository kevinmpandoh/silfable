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
  FixtureProvisioningExecutionService,
  type FixtureProvisioningChainPort,
  type FixtureProvisioningPreparation,
} from "./fixture-provisioning-executor";

class MemoryKeystore {
  dataKey: string | null = null;
  locked = false;

  isLocked() {
    return this.locked;
  }

  async getSecret() {
    return this.dataKey;
  }

  async setSecret(_name: "database-data-key", value: string) {
    this.dataKey = value;
  }
}

class FakeProvisioningChain implements FixtureProvisioningChainPort {
  readonly mint: KeyPairSigner;
  readonly health: NetworkHealthMonitor;
  signCalls = 0;
  broadcastCalls = 0;
  stopAfterSimulation = false;
  throwAfterBroadcast = false;
  status: "missing" | "confirmed" | "error" = "confirmed";

  constructor(mint: KeyPairSigner, health: NetworkHealthMonitor) {
    this.mint = mint;
    this.health = health;
  }

  async prepare(_payer: KeyPairSigner, input: { destinationOwner: string; decimals: number; supplyAtomic: bigint; transferAmountAtomic: bigint }) {
    assert.equal(input.decimals, 6);
    const preparation: FixtureProvisioningPreparation = {
      mintAddress: this.mint.address,
      messageHash: "a".repeat(64),
      simulationWireTransaction: "unsigned-wire",
      lastValidBlockHeight: 1000n,
      evidence: {
        walletAuthority: _payer.address,
        sourceTokenAccount: "11111111111111111111111111111111",
        destinationTokenAccount: "22222222222222222222222222222222",
        destinationOwner: input.destinationOwner,
        decimals: input.decimals,
        supplyAtomic: input.supplyAtomic.toString(),
        transferAmountAtomic: input.transferAmountAtomic.toString(),
        instructionFingerprint: "b".repeat(64),
      },
      sign: async () => {
        this.signCalls += 1;
        return { wireTransaction: "signed-wire", signature: "fixture-signature" };
      },
    };
    return preparation;
  }

  async simulate(preparation: FixtureProvisioningPreparation) {
    assert.equal(this.signCalls, 0, "signing must not happen before simulation");
    assert.equal(preparation.simulationWireTransaction, "unsigned-wire");
    if (this.stopAfterSimulation) this.health.stop();
    return { unitsConsumed: 1234n };
  }

  async broadcast(signed: { wireTransaction: string; signature: string }) {
    this.broadcastCalls += 1;
    assert.equal(signed.signature, "fixture-signature");
    if (this.throwAfterBroadcast) throw new Error("network-dropped");
  }

  async getSignatureStatus() {
    return this.status === "confirmed"
      ? { found: true, error: false, confirmationStatus: "confirmed" as const }
      : this.status === "error"
        ? { found: true, error: true, confirmationStatus: null }
        : { found: false, error: false, confirmationStatus: null };
  }

  async getBlockHeight() {
    return 900n;
  }
}

test("manual provisioning signs only after simulation and stores encrypted confirmation evidence", async () => {
  const fixture = await setup();
  try {
    const record = await fixture.service.execute(executionInput(fixture.destinationOwner.address));
    assert.equal(record.state, "confirmed");
    assert.equal(record.signingAttempted, true);
    assert.equal(record.broadcastAttempted, true);
    assert.equal(fixture.chain.signCalls, 1);
    assert.equal(fixture.chain.broadcastCalls, 1);
    assert.ok(record.encryptedPayload);
    assert.equal(record.encryptedPayload.includes("fixture-signature"), false);
    const plaintext = await fixture.cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce!,
      keyId: "local-data-key-v1",
    });
    assert.equal(JSON.parse(plaintext).signature, "fixture-signature");
    await assert.rejects(
      fixture.service.execute(executionInput(fixture.destinationOwner.address)),
      /already exists or requires review/u,
    );
    assert.equal(fixture.chain.broadcastCalls, 1);
  } finally {
    await fixture.close();
  }
});

test("network loss after simulation prevents signing, while a broadcast error stays ambiguous", async () => {
  const beforeSign = await setup();
  try {
    beforeSign.chain.stopAfterSimulation = true;
    const failed = await beforeSign.service.execute(executionInput(beforeSign.destinationOwner.address));
    assert.equal(failed.state, "failed");
    assert.equal(beforeSign.chain.signCalls, 0);
    assert.equal(beforeSign.chain.broadcastCalls, 0);
  } finally {
    await beforeSign.close();
  }

  const afterBroadcast = await setup();
  try {
    afterBroadcast.chain.throwAfterBroadcast = true;
    const ambiguous = await afterBroadcast.service.execute(executionInput(afterBroadcast.destinationOwner.address));
    assert.equal(ambiguous.state, "ambiguous");
    assert.equal(ambiguous.failureCode, "network-dropped");
    assert.equal(afterBroadcast.chain.broadcastCalls, 1);
  } finally {
    await afterBroadcast.close();
  }
});

test("restart reconciliation never rebroadcasts and can confirm an already submitted provision", async () => {
  const fixture = await setup();
  try {
    const proposedMint = await generateKeyPairSigner();
    const proposed = fixture.database.createFixtureProvision({
      id: "00000000-0000-4000-8000-000000000400",
      mintAddress: proposedMint.address,
      messageHash: "b".repeat(64),
      lastValidBlockHeight: "1000",
      now: new Date().toISOString(),
    });
    const signedMint = await generateKeyPairSigner();
    const signed = fixture.database.createFixtureProvision({
      id: "00000000-0000-4000-8000-000000000401",
      mintAddress: signedMint.address,
      messageHash: "c".repeat(64),
      lastValidBlockHeight: "1000",
      now: new Date().toISOString(),
    });
    const envelope = await fixture.cipher.encryptString(JSON.stringify({ signature: "restart-signature" }));
    fixture.database.updateFixtureProvision({
      id: signed.id,
      expectedState: "proposed",
      state: "simulated",
      simulationUnits: "1",
      now: new Date().toISOString(),
    });
    fixture.database.updateFixtureProvision({
      id: signed.id,
      expectedState: "simulated",
      state: "signed",
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      signingAttempted: true,
      now: new Date().toISOString(),
    });

    const broadcastMint = await generateKeyPairSigner();
    const broadcast = fixture.database.createFixtureProvision({
      id: "00000000-0000-4000-8000-000000000402",
      mintAddress: broadcastMint.address,
      messageHash: "d".repeat(64),
      lastValidBlockHeight: "1000",
      now: new Date().toISOString(),
    });
    fixture.database.updateFixtureProvision({
      id: broadcast.id,
      expectedState: "proposed",
      state: "simulated",
      simulationUnits: "1",
      now: new Date().toISOString(),
    });
    fixture.database.updateFixtureProvision({
      id: broadcast.id,
      expectedState: "simulated",
      state: "signed",
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      signingAttempted: true,
      now: new Date().toISOString(),
    });
    fixture.database.updateFixtureProvision({
      id: broadcast.id,
      expectedState: "signed",
      state: "broadcast",
      broadcastAttempted: true,
      now: new Date().toISOString(),
    });

    await fixture.service.reconcilePending();
    assert.equal(fixture.database.getFixtureProvision(proposed.id)?.state, "failed");
    assert.equal(fixture.database.getFixtureProvision(proposed.id)?.failureCode, "restart-before-signing");
    assert.equal(fixture.database.getFixtureProvision(signed.id)?.state, "failed");
    assert.equal(fixture.database.getFixtureProvision(broadcast.id)?.state, "confirmed");
    assert.equal(fixture.chain.broadcastCalls, 0);
  } finally {
    await fixture.close();
  }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-fixture-executor-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const keystore = new MemoryKeystore();
  const cipher = new LocalDataCipher(keystore);
  const health = new NetworkHealthMonitor({ probeHealth: async () => ({ latencyMs: 1 }) });
  await health.checkNow();
  const [wallet, mint, destinationOwner] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const chain = new FakeProvisioningChain(mint, health);
  const service = new FixtureProvisioningExecutionService({
    database,
    cipher,
    health,
    keystore,
    wallet: { withWalletSigner: async (operation) => operation(wallet) },
    chain,
    confirmationTimeoutMs: 20,
    confirmationPollMs: 1,
  });
  return {
    database,
    cipher,
    chain,
    service,
    destinationOwner,
    async close() {
      health.stop();
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function executionInput(destinationOwner: string) {
  return {
    destinationOwner,
    decimals: 6,
    supplyAtomic: 1_000_000n,
    transferAmountAtomic: 100n,
  };
}
