import { getTransferSolInstruction } from "@solana-program/system";
import {
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
} from "@solana/kit";
import { DevnetCanaryViewSchema, type DevnetCanaryView } from "@silfable/contracts";
import { randomUUID } from "node:crypto";

import type { DevnetTransactionRpcPort } from "../rpc/devnet.js";
import type { NetworkHealthMonitor } from "../rpc/devnet.js";
import { RuntimeDatabase, type DevnetCanaryStorageRecord } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";

const MAX_CANARY_FEE_LAMPORTS = 20_000n;
const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_MS = 750;

type WalletSignerPort = {
  withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T>;
};

type KeystoreState = { isLocked(): boolean };

export type CanarySimulation = {
  blockhash: string;
  lastValidBlockHeight: bigint;
  unitsConsumed: bigint;
};

export type CanarySignedTransaction = { wireTransaction: string; signature: string };

export type CanaryChainAdapter = {
  simulate(signer: KeyPairSigner): Promise<CanarySimulation>;
  sign(signer: KeyPairSigner, simulation: CanarySimulation): Promise<CanarySignedTransaction>;
  broadcast(signed: CanarySignedTransaction): Promise<void>;
  getSignatureStatus(signatureValue: string): ReturnType<DevnetTransactionRpcPort["getSignatureStatus"]>;
  getBlockHeight(): Promise<bigint>;
};

export class SolanaDevnetCanaryAdapter implements CanaryChainAdapter {
  readonly #rpc: DevnetTransactionRpcPort;

  constructor(rpc: DevnetTransactionRpcPort) {
    this.#rpc = rpc;
  }

  async simulate(signer: KeyPairSigner): Promise<CanarySimulation> {
    const lifetime = await this.#rpc.getLatestBlockhash();
    const transaction = compileTransaction(buildCanaryMessage(signer, lifetime));
    const response = await this.#rpc.simulateTransaction(getBase64EncodedWireTransaction(transaction));
    if (response.error) throw new Error("canary-simulation-failed");
    if (response.fee === null || response.fee > MAX_CANARY_FEE_LAMPORTS) {
      throw new Error("canary-fee-exceeded");
    }
    return {
      ...lifetime,
      unitsConsumed: response.unitsConsumed ?? 0n,
    };
  }

  async sign(signer: KeyPairSigner, simulation: CanarySimulation): Promise<CanarySignedTransaction> {
    const transaction = await signTransactionMessageWithSigners(buildCanaryMessage(signer, simulation));
    return {
      wireTransaction: getBase64EncodedWireTransaction(transaction),
      signature: getSignatureFromTransaction(transaction),
    };
  }

  async broadcast(signed: CanarySignedTransaction): Promise<void> {
    const returnedSignature = await this.#rpc.sendTransaction(signed.wireTransaction);
    if (returnedSignature !== signed.signature) throw new Error("canary-signature-mismatch");
  }

  getSignatureStatus(signatureValue: string) {
    return this.#rpc.getSignatureStatus(signatureValue);
  }

  getBlockHeight(): Promise<bigint> {
    return this.#rpc.getBlockHeight();
  }
}

export class DevnetCanaryExecutionService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #wallet: WalletSignerPort;
  readonly #chain: CanaryChainAdapter;
  readonly #confirmationTimeoutMs: number;
  readonly #confirmationPollMs: number;
  #executing = false;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    health: NetworkHealthMonitor;
    keystore: KeystoreState;
    wallet: WalletSignerPort;
    chain: CanaryChainAdapter;
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

  async execute(): Promise<DevnetCanaryView> {
    if (this.#executing) throw new Error("A Devnet canary is already executing");
    this.#assertExecutionPrerequisites();
    this.#executing = true;
    let record = this.#database.createDevnetCanary(randomUUID(), new Date().toISOString());
    try {
      record = await this.#wallet.withWalletSigner(async (signer) => {
        const simulation = await this.#chain.simulate(signer);
        record = this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "proposed",
          state: "simulated",
          simulationUnits: simulation.unitsConsumed.toString(),
          lastValidBlockHeight: simulation.lastValidBlockHeight.toString(),
          now: new Date().toISOString(),
        });

        this.#assertExecutionPrerequisites();
        const signed = await this.#chain.sign(signer, simulation);
        const [wire, signatureEnvelope] = await Promise.all([
          this.#cipher.encryptString(signed.wireTransaction),
          this.#cipher.encryptString(signed.signature),
        ]);
        record = this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "simulated",
          state: "signed",
          encryptedWire: wire.ciphertext,
          wireNonce: wire.nonce,
          encryptedSignature: signatureEnvelope.ciphertext,
          signatureNonce: signatureEnvelope.nonce,
          keyId: wire.keyId,
          signingAttempted: true,
          now: new Date().toISOString(),
        });

        this.#assertExecutionPrerequisites();
        record = this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "signed",
          state: "broadcast",
          broadcastAttempted: true,
          now: new Date().toISOString(),
        });
        await this.#chain.broadcast(signed);
        return this.#waitForConfirmation(record, signed.signature, simulation.lastValidBlockHeight);
      });
    } catch (error) {
      const target = record.broadcastAttempted ? "ambiguous" : "failed";
      if (!isTerminal(record.state)) {
        record = this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: record.state,
          state: target,
          failureCode: failureCode(error, target),
          now: new Date().toISOString(),
        });
      }
    } finally {
      this.#executing = false;
    }
    return this.#toView(record);
  }

  async list(): Promise<DevnetCanaryView[]> {
    this.#assertKeystoreUnlocked();
    return Promise.all(this.#database.listDevnetCanaries(20).map((record) => this.#toView(record)));
  }

  async reconcilePending(): Promise<void> {
    this.#assertKeystoreUnlocked();
    for (const record of this.#database.listPendingDevnetCanaries()) {
      if (record.state === "signed") {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "signed",
          state: "failed",
          failureCode: "restart-before-broadcast",
          now: new Date().toISOString(),
        });
        continue;
      }
      await this.#reconcileBroadcastRecord(record);
    }
  }

  async #waitForConfirmation(
    initial: DevnetCanaryStorageRecord,
    signatureValue: string,
    lastValidBlockHeight: bigint,
  ): Promise<DevnetCanaryStorageRecord> {
    const deadline = Date.now() + this.#confirmationTimeoutMs;
    while (Date.now() < deadline) {
      if (!this.#health.isHealthyFresh()) {
        return this.#database.updateDevnetCanary({
          id: initial.id,
          expectedState: "broadcast",
          state: "ambiguous",
          failureCode: "network-lost-after-broadcast",
          now: new Date().toISOString(),
        });
      }
      const status = await this.#chain.getSignatureStatus(signatureValue);
      if (status.error) {
        return this.#database.updateDevnetCanary({
          id: initial.id,
          expectedState: "broadcast",
          state: "failed",
          failureCode: "transaction-error",
          now: new Date().toISOString(),
        });
      }
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return this.#database.updateDevnetCanary({
          id: initial.id,
          expectedState: "broadcast",
          state: "confirmed",
          failureCode: null,
          now: new Date().toISOString(),
        });
      }
      if ((await this.#chain.getBlockHeight()) > lastValidBlockHeight) {
        return this.#database.updateDevnetCanary({
          id: initial.id,
          expectedState: "broadcast",
          state: "failed",
          failureCode: "blockhash-expired-unconfirmed",
          now: new Date().toISOString(),
        });
      }
      await delay(this.#confirmationPollMs);
    }
    return this.#database.updateDevnetCanary({
      id: initial.id,
      expectedState: "broadcast",
      state: "ambiguous",
      failureCode: "confirmation-timeout",
      now: new Date().toISOString(),
    });
  }

  async #reconcileBroadcastRecord(record: DevnetCanaryStorageRecord): Promise<void> {
    if (
      record.encryptedSignature === null ||
      record.signatureNonce === null ||
      record.keyId !== "local-data-key-v1" ||
      record.lastValidBlockHeight === null
    ) {
      this.#database.updateDevnetCanary({
        id: record.id,
        expectedState: record.state,
        state: "failed",
        failureCode: "journal-integrity-error",
        now: new Date().toISOString(),
      });
      return;
    }
    if (!this.#health.isHealthyFresh()) {
      if (record.state === "broadcast") {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "broadcast",
          state: "ambiguous",
          failureCode: "network-unhealthy-reconciliation",
          now: new Date().toISOString(),
        });
      }
      return;
    }
    try {
      const signatureValue = await this.#cipher.decryptString({
        ciphertext: record.encryptedSignature,
        nonce: record.signatureNonce,
        keyId: record.keyId,
      });
      const status = await this.#chain.getSignatureStatus(signatureValue);
      if (status.error || status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: record.state,
          state: status.error ? "failed" : "confirmed",
          failureCode: status.error ? "transaction-error" : null,
          now: new Date().toISOString(),
        });
        return;
      }
      if ((await this.#chain.getBlockHeight()) > BigInt(record.lastValidBlockHeight)) {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: record.state,
          state: "failed",
          failureCode: "blockhash-expired-unconfirmed",
          now: new Date().toISOString(),
        });
        return;
      }
      if (record.state === "broadcast") {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "broadcast",
          state: "ambiguous",
          failureCode: "reconciliation-pending",
          now: new Date().toISOString(),
        });
      }
    } catch {
      if (record.state === "broadcast") {
        this.#database.updateDevnetCanary({
          id: record.id,
          expectedState: "broadcast",
          state: "ambiguous",
          failureCode: "reconciliation-unavailable",
          now: new Date().toISOString(),
        });
      }
    }
  }

  async #toView(record: DevnetCanaryStorageRecord): Promise<DevnetCanaryView> {
    let signatureValue: string | null = null;
    if (record.encryptedSignature !== null && record.signatureNonce !== null && record.keyId === "local-data-key-v1") {
      signatureValue = await this.#cipher.decryptString({
        ciphertext: record.encryptedSignature,
        nonce: record.signatureNonce,
        keyId: record.keyId,
      });
    }
    return DevnetCanaryViewSchema.parse({
      schemaVersion: 1,
      id: record.id,
      kind: record.kind,
      state: record.state,
      signature: signatureValue,
      simulationUnits: record.simulationUnits,
      failureCode: record.failureCode,
      signingAttempted: record.signingAttempted,
      broadcastAttempted: record.broadcastAttempted,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  #assertExecutionPrerequisites(): void {
    this.#assertKeystoreUnlocked();
    if (!this.#health.isHealthyFresh()) throw new Error("network-unhealthy");
  }

  #assertKeystoreUnlocked(): void {
    if (this.#keystore.isLocked()) throw new Error("keystore-locked");
  }
}

function buildCanaryMessage(
  signer: KeyPairSigner,
  lifetime: { blockhash: string; lastValidBlockHeight: bigint },
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(signer, message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: blockhash(lifetime.blockhash), lastValidBlockHeight: lifetime.lastValidBlockHeight },
        message,
      ),
    (message) =>
      appendTransactionMessageInstruction(
        getTransferSolInstruction({ source: signer, destination: signer.address, amount: 0n }),
        message,
      ),
  );
}

function isTerminal(state: DevnetCanaryStorageRecord["state"]): boolean {
  return state === "confirmed" || state === "failed" || state === "ambiguous";
}

function failureCode(error: unknown, fallback: "failed" | "ambiguous"): string {
  if (error instanceof Error && /^canary-[a-z-]+$/u.test(error.message)) return error.message;
  return fallback === "ambiguous" ? "broadcast-status-unknown" : "execution-failed-closed";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
