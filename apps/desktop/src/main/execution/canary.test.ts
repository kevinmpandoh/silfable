import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";

import { NetworkHealthMonitor, type DevnetRpcPort, type DevnetTransactionRpcPort } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import {
  DevnetCanaryExecutionService,
  SolanaDevnetCanaryAdapter,
  type CanaryChainAdapter,
  type CanarySimulation,
  type CanarySignedTransaction,
} from "./canary";

const SIGNATURE = "5".repeat(88);

test("Solana adapter builds, simulates, and signs the zero-lamport self-transfer", async () => {
  const rpc = new FakeTransactionRpc();
  const adapter = new SolanaDevnetCanaryAdapter(rpc);
  const signer = await generateKeyPairSigner();
  const simulation = await adapter.simulate(signer);
  const signed = await adapter.sign(signer, simulation);
  rpc.returnedSignature = signed.signature;
  await adapter.broadcast(signed);

  assert.equal(simulation.unitsConsumed, 150n);
  assert.ok(signed.wireTransaction.length > 100);
  assert.ok(signed.signature.length >= 64);
  assert.equal(rpc.simulationCalls, 1);
  assert.equal(rpc.sendCalls, 1);
});

class FakeTransactionRpc implements DevnetTransactionRpcPort {
  returnedSignature = SIGNATURE;
  simulationCalls = 0;
  sendCalls = 0;

  async getLatestBlockhash() {
    return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1_000n };
  }

  async simulateTransaction() {
    this.simulationCalls += 1;
    return { error: false, unitsConsumed: 150n, fee: 5_000n };
  }

  async sendTransaction() {
    this.sendCalls += 1;
    return this.returnedSignature;
  }

  async getSignatureStatus() {
    return { found: true, error: false, confirmationStatus: "confirmed" as const };
  }

  async getBlockHeight() {
    return 500n;
  }
}

class MemoryDataKeyStore {
  locked = false;
  dataKey: string | null = null;

  isLocked() {
    return this.locked;
  }

  async getSecret() {
    if (this.locked) throw new Error("locked");
    return this.dataKey;
  }

  async setSecret(_name: "database-data-key", plaintext: string) {
    if (this.locked) throw new Error("locked");
    this.dataKey = plaintext;
  }
}

class HealthyRpc implements DevnetRpcPort {
  async probeHealth() { return { latencyMs: 10 }; }
  async getBalance() { return 1_000_000_000n; }
  async requestAirdrop() { return SIGNATURE; }
}

class FakeWallet {
  async withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T> {
    return operation({ address: "11111111111111111111111111111111" } as KeyPairSigner);
  }
}

class FakeChain implements CanaryChainAdapter {
  broadcastError = false;
  broadcastCount = 0;
  status: "missing" | "confirmed" | "error" = "confirmed";
  afterSimulate: (() => void) | null = null;
  afterSign: (() => void) | null = null;
  afterBroadcast: (() => void) | null = null;

  async simulate(): Promise<CanarySimulation> {
    const value = { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1_000n, unitsConsumed: 150n };
    this.afterSimulate?.();
    return value;
  }

  async sign(): Promise<CanarySignedTransaction> {
    const value = { wireTransaction: "base64-wire-transaction", signature: SIGNATURE };
    this.afterSign?.();
    return value;
  }

  async broadcast(): Promise<void> {
    this.broadcastCount += 1;
    this.afterBroadcast?.();
    if (this.broadcastError) throw new Error("rpc response lost");
  }

  async getSignatureStatus() {
    return this.status === "confirmed"
      ? { found: true, error: false, confirmationStatus: "confirmed" as const }
      : this.status === "error"
        ? { found: true, error: true, confirmationStatus: "confirmed" as const }
        : { found: false, error: false, confirmationStatus: null };
  }

  async getBlockHeight(): Promise<bigint> {
    return 500n;
  }
}

test("manual Devnet canary confirms and stores wire/signature encrypted", async () => {
  const context = await createContext();
  try {
    const execution = await context.service.execute();
    assert.equal(execution.state, "confirmed");
    assert.equal(execution.signingAttempted, true);
    assert.equal(execution.broadcastAttempted, true);
    assert.equal(execution.signature, SIGNATURE);
    assert.equal(context.chain.broadcastCount, 1);

    const stored = context.database.listDevnetCanaries()[0];
    assert.ok(stored);
    assert.notEqual(stored.encryptedSignature, SIGNATURE);
    assert.notEqual(stored.encryptedWire, "base64-wire-transaction");
  } finally {
    await context.close();
  }
});

test("an error after broadcast attempt is ambiguous and is never reported as a definite failure", async () => {
  const context = await createContext();
  try {
    context.chain.broadcastError = true;
    const execution = await context.service.execute();
    assert.equal(execution.state, "ambiguous");
    assert.equal(execution.failureCode, "broadcast-status-unknown");
    assert.equal(execution.broadcastAttempted, true);
  } finally {
    await context.close();
  }
});

test("a signed pre-broadcast journal is failed on restart without automatic rebroadcast", async () => {
  const context = await createContext();
  try {
    const now = new Date().toISOString();
    let record = context.database.createDevnetCanary(crypto.randomUUID(), now);
    record = context.database.updateDevnetCanary({
      id: record.id,
      expectedState: "proposed",
      state: "simulated",
      simulationUnits: "100",
      lastValidBlockHeight: "1000",
      now,
    });
    const wire = await context.cipher.encryptString("wire");
    const signature = await context.cipher.encryptString(SIGNATURE);
    context.database.updateDevnetCanary({
      id: record.id,
      expectedState: "simulated",
      state: "signed",
      encryptedWire: wire.ciphertext,
      wireNonce: wire.nonce,
      encryptedSignature: signature.ciphertext,
      signatureNonce: signature.nonce,
      keyId: wire.keyId,
      signingAttempted: true,
      now,
    });

    await context.service.reconcilePending();
    const reconciled = context.database.listDevnetCanaries()[0];
    assert.equal(reconciled?.state, "failed");
    assert.equal(reconciled?.failureCode, "restart-before-broadcast");
    assert.equal(context.chain.broadcastCount, 0);
  } finally {
    await context.close();
  }
});

test("network loss after simulation prevents signing and broadcast", async () => {
  const context = await createContext();
  try {
    context.chain.afterSimulate = () => context.health.stop();
    const execution = await context.service.execute();
    assert.equal(execution.state, "failed");
    assert.equal(execution.signingAttempted, false);
    assert.equal(execution.broadcastAttempted, false);
    assert.equal(context.chain.broadcastCount, 0);
  } finally { await context.close(); }
});

test("network loss after signing preserves the journal but prevents broadcast", async () => {
  const context = await createContext();
  try {
    context.chain.afterSign = () => context.health.stop();
    const execution = await context.service.execute();
    assert.equal(execution.state, "failed");
    assert.equal(execution.signingAttempted, true);
    assert.equal(execution.broadcastAttempted, false);
    assert.equal(context.chain.broadcastCount, 0);
  } finally { await context.close(); }
});

test("network loss after broadcast is ambiguous and never rebroadcasts", async () => {
  const context = await createContext();
  try {
    context.chain.afterBroadcast = () => context.health.stop();
    const execution = await context.service.execute();
    assert.equal(execution.state, "ambiguous");
    assert.equal(execution.failureCode, "network-lost-after-broadcast");
    assert.equal(execution.broadcastAttempted, true);
    assert.equal(context.chain.broadcastCount, 1);
    await context.service.reconcilePending();
    assert.equal(context.chain.broadcastCount, 1);
  } finally { await context.close(); }
});

async function createContext() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-canary-test-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const keystore = new MemoryDataKeyStore();
  const cipher = new LocalDataCipher(keystore);
  const health = new NetworkHealthMonitor(new HealthyRpc());
  await health.checkNow();
  const chain = new FakeChain();
  const service = new DevnetCanaryExecutionService({
    database,
    cipher,
    health,
    keystore,
    wallet: new FakeWallet(),
    chain,
    confirmationTimeoutMs: 10,
    confirmationPollMs: 1,
  });
  return {
    database,
    cipher,
    chain,
    health,
    service,
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
