import { randomUUID } from "node:crypto";

import { getMintSize } from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
} from "@solana/kit";

import type { DevnetProvisioningRpcPort, DevnetTransactionRpcPort, NetworkHealthMonitor } from "../rpc/devnet.js";
import { RuntimeDatabase, type FixtureProvisionStorageRecord } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import { buildDevnetFixtureProvisioningPlan } from "./fixture-provisioning.js";
import { assertExactSimulatedMessage, getTransactionMessageHash } from "./spl-fixture.js";

const MAX_PROVISIONING_FEE_LAMPORTS = 50_000n;
const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_MS = 750;

type WalletSignerPort = {
  withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T>;
};

type KeystoreState = { isLocked(): boolean };

export type FixtureProvisioningPreparation = {
  mintAddress: string;
  messageHash: string;
  simulationWireTransaction: string;
  lastValidBlockHeight: bigint;
  evidence: {
    walletAuthority: string;
    sourceTokenAccount: string;
    destinationTokenAccount: string;
    destinationOwner: string;
    decimals: number;
    supplyAtomic: string;
    transferAmountAtomic: string;
    instructionFingerprint: string;
  };
  sign(): Promise<{ wireTransaction: string; signature: string }>;
};

export type FixtureProvisioningChainPort = {
  prepare(payer: KeyPairSigner, input: {
    destinationOwner: string;
    decimals: number;
    supplyAtomic: bigint;
    transferAmountAtomic: bigint;
  }): Promise<FixtureProvisioningPreparation>;
  simulate(preparation: FixtureProvisioningPreparation): Promise<{ unitsConsumed: bigint }>;
  broadcast(signed: { wireTransaction: string; signature: string }): Promise<void>;
  getSignatureStatus(signatureValue: string): ReturnType<DevnetTransactionRpcPort["getSignatureStatus"]>;
  getBlockHeight(): Promise<bigint>;
};

export class SolanaFixtureProvisioningAdapter implements FixtureProvisioningChainPort {
  readonly #rpc: DevnetProvisioningRpcPort;

  constructor(rpc: DevnetProvisioningRpcPort) {
    this.#rpc = rpc;
  }

  async prepare(payer: KeyPairSigner, input: {
    destinationOwner: string;
    decimals: number;
    supplyAtomic: bigint;
    transferAmountAtomic: bigint;
  }): Promise<FixtureProvisioningPreparation> {
    const [mint, mintRentLamports, lifetime] = await Promise.all([
      generateKeyPairSigner(),
      this.#rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())),
      this.#rpc.getLatestBlockhash(),
    ]);
    const plan = await buildDevnetFixtureProvisioningPlan({
      payer,
      mint,
      destinationOwner: input.destinationOwner,
      decimals: input.decimals,
      supplyAtomic: input.supplyAtomic,
      transferAmountAtomic: input.transferAmountAtomic,
      mintRentLamports,
    });
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayerSigner(payer, value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({
        blockhash: blockhash(lifetime.blockhash),
        lastValidBlockHeight: lifetime.lastValidBlockHeight,
      }, value),
      (value) => appendTransactionMessageInstructions(plan.instructions, value),
    );
    const transaction = compileTransaction(message);
    const messageHash = getTransactionMessageHash(transaction);
    return {
      mintAddress: plan.mintAddress,
      messageHash,
      simulationWireTransaction: getBase64EncodedWireTransaction(transaction),
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
      evidence: {
        walletAuthority: payer.address,
        sourceTokenAccount: plan.sourceTokenAccount,
        destinationTokenAccount: plan.destinationTokenAccount,
        destinationOwner: plan.destinationOwner,
        decimals: plan.decimals,
        supplyAtomic: plan.supplyAtomic,
        transferAmountAtomic: plan.transferAmountAtomic,
        instructionFingerprint: plan.transferFixture.fingerprint,
      },
      async sign() {
        const signed = await signTransactionMessageWithSigners(message);
        assertExactSimulatedMessage(messageHash, signed);
        return {
          wireTransaction: getBase64EncodedWireTransaction(signed),
          signature: getSignatureFromTransaction(signed),
        };
      },
    };
  }

  async simulate(preparation: FixtureProvisioningPreparation): Promise<{ unitsConsumed: bigint }> {
    // The exact unsigned message is simulated with RPC signature verification disabled.
    const response = await this.#rpc.simulateTransaction(preparation.simulationWireTransaction);
    if (response.error) throw new Error("fixture-provisioning-simulation-failed");
    if (response.fee === null || response.fee > MAX_PROVISIONING_FEE_LAMPORTS) {
      throw new Error("fixture-provisioning-fee-exceeded");
    }
    return { unitsConsumed: response.unitsConsumed ?? 0n };
  }

  async broadcast(signed: { wireTransaction: string; signature: string }): Promise<void> {
    const returnedSignature = await this.#rpc.sendTransaction(signed.wireTransaction);
    if (returnedSignature !== signed.signature) throw new Error("fixture-provisioning-signature-mismatch");
  }

  getSignatureStatus(signatureValue: string) {
    return this.#rpc.getSignatureStatus(signatureValue);
  }

  getBlockHeight(): Promise<bigint> {
    return this.#rpc.getBlockHeight();
  }
}

export class FixtureProvisioningExecutionService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #wallet: WalletSignerPort;
  readonly #chain: FixtureProvisioningChainPort;
  readonly #confirmationTimeoutMs: number;
  readonly #confirmationPollMs: number;
  #executing = false;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    health: NetworkHealthMonitor;
    keystore: KeystoreState;
    wallet: WalletSignerPort;
    chain: FixtureProvisioningChainPort;
    confirmationTimeoutMs?: number;
    confirmationPollMs?: number;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#health = input.health;
    this.#keystore = input.keystore;
    this.#wallet = input.wallet;
    this.#chain = input.chain;
    this.#confirmationTimeoutMs = input.confirmationTimeoutMs ?? CONFIRMATION_TIMEOUT_MS;
    this.#confirmationPollMs = input.confirmationPollMs ?? CONFIRMATION_POLL_MS;
  }

  async execute(input: {
    destinationOwner: string;
    decimals: number;
    supplyAtomic: bigint;
    transferAmountAtomic: bigint;
  }): Promise<FixtureProvisionStorageRecord> {
    if (this.#executing) throw new Error("Fixture provisioning is already executing");
    this.#assertPrerequisites();
    if (this.#database.hasBlockingFixtureProvision()) {
      throw new Error("A fixture provision already exists or requires review");
    }
    this.#executing = true;
    let record: FixtureProvisionStorageRecord | null = null;
    let recordId: string | null = null;
    try {
      return await this.#wallet.withWalletSigner(async (payer) => {
        const preparation = await this.#chain.prepare(payer, input);
        const now = new Date().toISOString();
        record = this.#database.createFixtureProvision({
          id: randomUUID(),
          mintAddress: preparation.mintAddress,
          messageHash: preparation.messageHash,
          lastValidBlockHeight: preparation.lastValidBlockHeight.toString(),
          now,
        });
        recordId = record.id;
        const simulation = await this.#chain.simulate(preparation);
        record = this.#database.updateFixtureProvision({
          id: record.id,
          expectedState: "proposed",
          state: "simulated",
          simulationUnits: simulation.unitsConsumed.toString(),
          now: new Date().toISOString(),
        });
        this.#assertPrerequisites();
        const signed = await preparation.sign();
        const envelope = await this.#cipher.encryptString(JSON.stringify({
          schemaVersion: 1,
          ...preparation.evidence,
          wireTransaction: signed.wireTransaction,
          signature: signed.signature,
        }));
        record = this.#database.updateFixtureProvision({
          id: record.id,
          expectedState: "simulated",
          state: "signed",
          encryptedPayload: envelope.ciphertext,
          payloadNonce: envelope.nonce,
          keyId: envelope.keyId,
          signingAttempted: true,
          now: new Date().toISOString(),
        });
        this.#assertPrerequisites();
        record = this.#database.updateFixtureProvision({
          id: record.id,
          expectedState: "signed",
          state: "broadcast",
          broadcastAttempted: true,
          now: new Date().toISOString(),
        });
        await this.#chain.broadcast(signed);
        record = await this.#waitForConfirmation(record, signed.signature);
        return record;
      });
    } catch (error) {
      if (recordId === null) throw error;
      const failedRecord = this.#database.getFixtureProvision(recordId);
      if (failedRecord === null) throw error;
      if (!isTerminal(failedRecord.state)) {
        record = this.#database.updateFixtureProvision({
          id: failedRecord.id,
          expectedState: failedRecord.state,
          state: failedRecord.broadcastAttempted ? "ambiguous" : "failed",
          failureCode: failureCode(error),
          now: new Date().toISOString(),
        });
      } else {
        record = failedRecord;
      }
      return record;
    } finally {
      this.#executing = false;
    }
  }

  async reconcilePending(): Promise<void> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    for (const record of this.#database.listPendingFixtureProvisions()) {
      if (record.state === "proposed" || record.state === "simulated" || record.state === "signed") {
        this.#database.updateFixtureProvision({
          id: record.id,
          expectedState: record.state,
          state: "failed",
          failureCode: record.state === "signed" ? "restart-before-broadcast" : "restart-before-signing",
          now: new Date().toISOString(),
        });
        continue;
      }
      if (!this.#health.isHealthyFresh()) {
        if (record.state === "broadcast") this.#markAmbiguous(record, "network-unhealthy-reconciliation");
        continue;
      }
      try {
        const signature = await this.#readSignature(record);
        const status = await this.#chain.getSignatureStatus(signature);
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          this.#database.updateFixtureProvision({
            id: record.id,
            expectedState: record.state,
            state: "confirmed",
            failureCode: null,
            now: new Date().toISOString(),
          });
        } else if (record.state === "broadcast") {
          this.#markAmbiguous(record, status.error ? "transaction-error-after-broadcast" : "unconfirmed-after-restart");
        }
      } catch {
        this.#markAmbiguous(record, "journal-integrity-error-after-broadcast");
      }
    }
  }

  async #waitForConfirmation(
    initial: FixtureProvisionStorageRecord,
    signature: string,
  ): Promise<FixtureProvisionStorageRecord> {
    const deadline = Date.now() + this.#confirmationTimeoutMs;
    while (Date.now() < deadline) {
      if (!this.#health.isHealthyFresh()) return this.#markAmbiguous(initial, "network-lost-after-broadcast");
      const status = await this.#chain.getSignatureStatus(signature);
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return this.#database.updateFixtureProvision({
          id: initial.id,
          expectedState: "broadcast",
          state: "confirmed",
          failureCode: null,
          now: new Date().toISOString(),
        });
      }
      if (status.error) return this.#markAmbiguous(initial, "transaction-error-after-broadcast");
      if ((await this.#chain.getBlockHeight()) > BigInt(initial.lastValidBlockHeight)) {
        return this.#markAmbiguous(initial, "blockhash-expired-unconfirmed");
      }
      await delay(this.#confirmationPollMs);
    }
    return this.#markAmbiguous(initial, "confirmation-timeout");
  }

  #markAmbiguous(record: FixtureProvisionStorageRecord, failureCodeValue: string): FixtureProvisionStorageRecord {
    return this.#database.updateFixtureProvision({
      id: record.id,
      expectedState: record.state,
      state: "ambiguous",
      failureCode: failureCodeValue,
      now: new Date().toISOString(),
    });
  }

  async #readSignature(record: FixtureProvisionStorageRecord): Promise<string> {
    if (record.encryptedPayload === null || record.payloadNonce === null || record.keyId !== "local-data-key-v1") {
      throw new Error("Fixture provisioning journal is invalid");
    }
    const payload = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as { signature?: unknown };
    if (typeof payload.signature !== "string" || payload.signature.length === 0) {
      throw new Error("Fixture provisioning signature is invalid");
    }
    return payload.signature;
  }

  #assertPrerequisites(): void {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
  }
}

function isTerminal(state: FixtureProvisionStorageRecord["state"]): boolean {
  return state === "confirmed" || state === "failed" || state === "ambiguous";
}

function failureCode(error: unknown): string {
  const value = error instanceof Error ? error.message : "unknown-error";
  return /^[a-z0-9-]{1,64}$/u.test(value) ? value : "fixture-provisioning-error";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
