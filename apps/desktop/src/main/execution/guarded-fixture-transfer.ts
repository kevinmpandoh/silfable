import { randomUUID } from "node:crypto";

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
  address,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";

import type {
  DevnetFixtureRpcPort,
  DevnetTransactionRpcPort,
  NetworkHealthMonitor,
} from "../rpc/devnet.js";
import {
  RuntimeDatabase,
  type GuardedFixtureTransferStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import {
  getGuardedFixtureManifestDigest,
  observeGuardedFixture,
  validateGuardedFixtureProvenance,
  type FixtureProvenanceValidation,
  type GuardedFixtureManifest,
} from "./fixture-provenance.js";
import {
  assertExactSimulatedMessage,
  buildGuardedSplTransferFixture,
  getTransactionMessageHash,
} from "./spl-fixture.js";

const MAX_TRANSFER_FEE_LAMPORTS = 20_000n;
const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_MS = 750;

type WalletSignerPort = {
  withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T>;
};
type KeystoreState = { isLocked(): boolean };
type ActiveFixturePort = { loadActiveManifest(): Promise<GuardedFixtureManifest> };

export type GuardedTransferPreparation = {
  messageHash: string;
  simulationWireTransaction: string;
  lastValidBlockHeight: bigint;
  initialValidation: FixtureProvenanceValidation;
  sign(): Promise<{ wireTransaction: string; signature: string }>;
};

export type GuardedFixtureTransferChainPort = {
  prepare(payer: KeyPairSigner, manifest: GuardedFixtureManifest): Promise<GuardedTransferPreparation>;
  simulate(preparation: GuardedTransferPreparation): Promise<{ unitsConsumed: bigint }>;
  revalidate(manifest: GuardedFixtureManifest): Promise<FixtureProvenanceValidation>;
  broadcast(signed: { wireTransaction: string; signature: string }): Promise<void>;
  getSignatureStatus(signatureValue: string): ReturnType<DevnetTransactionRpcPort["getSignatureStatus"]>;
  getBlockHeight(): Promise<bigint>;
};

export class SolanaGuardedFixtureTransferAdapter implements GuardedFixtureTransferChainPort {
  readonly #rpc: DevnetTransactionRpcPort & DevnetFixtureRpcPort;

  constructor(rpc: DevnetTransactionRpcPort & DevnetFixtureRpcPort) {
    this.#rpc = rpc;
  }

  async prepare(payer: KeyPairSigner, manifest: GuardedFixtureManifest): Promise<GuardedTransferPreparation> {
    if (payer.address !== manifest.walletAuthority) throw new Error("Active fixture wallet authority mismatch");
    const fixture = buildFixture(payer, manifest);
    const initialValidation = await this.#validate(manifest, fixture);
    if (!initialValidation.allowed) throw new Error("Active fixture provenance validation failed");
    const lifetime = await this.#rpc.getLatestBlockhash();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayerSigner(payer, value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({
        blockhash: blockhash(lifetime.blockhash),
        lastValidBlockHeight: lifetime.lastValidBlockHeight,
      }, value),
      (value) => appendTransactionMessageInstruction(fixture.instruction, value),
    );
    const transaction = compileTransaction(message);
    const messageHash = getTransactionMessageHash(transaction);
    return {
      messageHash,
      simulationWireTransaction: getBase64EncodedWireTransaction(transaction),
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
      initialValidation,
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

  async simulate(preparation: GuardedTransferPreparation): Promise<{ unitsConsumed: bigint }> {
    const result = await this.#rpc.simulateTransaction(preparation.simulationWireTransaction);
    if (result.error) throw new Error("guarded-transfer-simulation-failed");
    if (result.fee === null || result.fee > MAX_TRANSFER_FEE_LAMPORTS) throw new Error("guarded-transfer-fee-exceeded");
    return { unitsConsumed: result.unitsConsumed ?? 0n };
  }

  async revalidate(manifest: GuardedFixtureManifest): Promise<FixtureProvenanceValidation> {
    return this.#validate(manifest, buildFixture(manifest.walletAuthority, manifest));
  }

  async broadcast(signed: { wireTransaction: string; signature: string }): Promise<void> {
    const returned = await this.#rpc.sendTransaction(signed.wireTransaction);
    if (returned !== signed.signature) throw new Error("guarded-transfer-signature-mismatch");
  }

  getSignatureStatus(signatureValue: string) {
    return this.#rpc.getSignatureStatus(signatureValue);
  }

  getBlockHeight(): Promise<bigint> {
    return this.#rpc.getBlockHeight();
  }

  async #validate(
    manifest: GuardedFixtureManifest,
    fixture: ReturnType<typeof buildGuardedSplTransferFixture>,
  ): Promise<FixtureProvenanceValidation> {
    const now = new Date();
    const observation = await observeGuardedFixture(this.#rpc, manifest, now);
    return validateGuardedFixtureProvenance({ manifest, observation, instruction: fixture, now });
  }
}

export class GuardedFixtureTransferExecutionService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #wallet: WalletSignerPort;
  readonly #fixtureReview: ActiveFixturePort;
  readonly #chain: GuardedFixtureTransferChainPort;
  readonly #confirmationTimeoutMs: number;
  readonly #confirmationPollMs: number;
  #executing = false;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    health: NetworkHealthMonitor;
    keystore: KeystoreState;
    wallet: WalletSignerPort;
    fixtureReview: ActiveFixturePort;
    chain: GuardedFixtureTransferChainPort;
    confirmationTimeoutMs?: number;
    confirmationPollMs?: number;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#health = input.health;
    this.#keystore = input.keystore;
    this.#wallet = input.wallet;
    this.#fixtureReview = input.fixtureReview;
    this.#chain = input.chain;
    this.#confirmationTimeoutMs = input.confirmationTimeoutMs ?? CONFIRMATION_TIMEOUT_MS;
    this.#confirmationPollMs = input.confirmationPollMs ?? CONFIRMATION_POLL_MS;
  }

  async execute(): Promise<GuardedFixtureTransferStorageRecord> {
    if (this.#executing) throw new Error("Guarded fixture transfer is already executing");
    this.#assertPrerequisites();
    this.#executing = true;
    let recordId: string | null = null;
    try {
      const manifest = await this.#fixtureReview.loadActiveManifest();
      const manifestDigest = getGuardedFixtureManifestDigest(manifest);
      return await this.#wallet.withWalletSigner(async (payer) => {
        const preparation = await this.#chain.prepare(payer, manifest);
        if (!preparation.initialValidation.allowed || preparation.initialValidation.manifestDigest !== manifestDigest) {
          throw new Error("guarded-transfer-initial-provenance-denied");
        }
        let record = this.#database.createGuardedFixtureTransfer({
          id: randomUUID(),
          fixtureManifestDigest: manifestDigest,
          messageHash: preparation.messageHash,
          lastValidBlockHeight: preparation.lastValidBlockHeight.toString(),
          now: new Date().toISOString(),
        });
        recordId = record.id;
        const simulation = await this.#chain.simulate(preparation);
        record = this.#database.updateGuardedFixtureTransfer({
          id: record.id,
          expectedState: "proposed",
          state: "simulated",
          simulationUnits: simulation.unitsConsumed.toString(),
          now: new Date().toISOString(),
        });
        this.#assertPrerequisites();
        const preSignValidation = await this.#chain.revalidate(manifest);
        if (!preSignValidation.allowed || preSignValidation.manifestDigest !== manifestDigest) {
          throw new Error("guarded-transfer-pre-sign-provenance-denied");
        }
        const signed = await preparation.sign();
        const envelope = await this.#cipher.encryptString(JSON.stringify({
          schemaVersion: 1,
          manifestDigest,
          amountAtomic: manifest.transferAmountAtomic,
          initialValidation: preparation.initialValidation,
          preSignValidation,
          wireTransaction: signed.wireTransaction,
          signature: signed.signature,
        }));
        record = this.#database.updateGuardedFixtureTransfer({
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
        record = this.#database.updateGuardedFixtureTransfer({
          id: record.id,
          expectedState: "signed",
          state: "broadcast",
          broadcastAttempted: true,
          now: new Date().toISOString(),
        });
        await this.#chain.broadcast(signed);
        return this.#waitForConfirmation(record, signed.signature);
      });
    } catch (error) {
      if (recordId === null) throw error;
      const current = this.#database.getGuardedFixtureTransfer(recordId);
      if (current === null) throw error;
      if (isTerminal(current.state)) return current;
      return this.#database.updateGuardedFixtureTransfer({
        id: current.id,
        expectedState: current.state,
        state: current.broadcastAttempted ? "ambiguous" : "failed",
        failureCode: failureCode(error),
        now: new Date().toISOString(),
      });
    } finally {
      this.#executing = false;
    }
  }

  async reconcilePending(): Promise<void> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    for (const record of this.#database.listPendingGuardedFixtureTransfers()) {
      if (record.state === "proposed" || record.state === "simulated" || record.state === "signed") {
        this.#database.updateGuardedFixtureTransfer({
          id: record.id,
          expectedState: record.state,
          state: "failed",
          failureCode: "restart-before-broadcast",
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
          this.#database.updateGuardedFixtureTransfer({
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

  async #waitForConfirmation(record: GuardedFixtureTransferStorageRecord, signature: string) {
    const deadline = Date.now() + this.#confirmationTimeoutMs;
    while (Date.now() < deadline) {
      if (!this.#health.isHealthyFresh()) return this.#markAmbiguous(record, "network-lost-after-broadcast");
      const status = await this.#chain.getSignatureStatus(signature);
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return this.#database.updateGuardedFixtureTransfer({
          id: record.id,
          expectedState: "broadcast",
          state: "confirmed",
          failureCode: null,
          now: new Date().toISOString(),
        });
      }
      if (status.error) return this.#markAmbiguous(record, "transaction-error-after-broadcast");
      if ((await this.#chain.getBlockHeight()) > BigInt(record.lastValidBlockHeight)) {
        return this.#markAmbiguous(record, "blockhash-expired-unconfirmed");
      }
      await delay(this.#confirmationPollMs);
    }
    return this.#markAmbiguous(record, "confirmation-timeout");
  }

  #markAmbiguous(record: GuardedFixtureTransferStorageRecord, code: string) {
    return this.#database.updateGuardedFixtureTransfer({
      id: record.id,
      expectedState: record.state,
      state: "ambiguous",
      failureCode: code,
      now: new Date().toISOString(),
    });
  }

  async #readSignature(record: GuardedFixtureTransferStorageRecord): Promise<string> {
    if (record.encryptedPayload === null || record.payloadNonce === null || record.keyId !== "local-data-key-v1") {
      throw new Error("Guarded fixture transfer journal is invalid");
    }
    const payload = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as { signature?: unknown };
    if (typeof payload.signature !== "string" || payload.signature.length === 0) throw new Error("Signature is invalid");
    return payload.signature;
  }

  #assertPrerequisites() {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
  }
}

function buildFixture(authority: TransactionSigner | string, manifest: GuardedFixtureManifest) {
  return buildGuardedSplTransferFixture({
    source: manifest.sourceTokenAccount,
    mint: manifest.mintAddress,
    destination: manifest.destinationTokenAccount,
    authority: typeof authority === "string" ? reviewSigner(authority) : authority,
    amount: BigInt(manifest.transferAmountAtomic),
    decimals: manifest.mintDecimals,
  });
}

function reviewSigner(authority: string): TransactionSigner {
  return {
    address: address(authority),
    async signTransactions() { throw new Error("Review signer cannot sign"); },
  };
}

function isTerminal(state: GuardedFixtureTransferStorageRecord["state"]) {
  return state === "confirmed" || state === "failed" || state === "ambiguous";
}

function failureCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown-error";
  return /^[a-z0-9-]{1,64}$/u.test(value) ? value : "guarded-fixture-transfer-error";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
