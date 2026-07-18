import type { DevnetTransactionRpcPort, NetworkHealthMonitor } from "../rpc/devnet.js";
import {
  RuntimeDatabase,
  type GuardedFixtureTransferApprovalStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance.js";

type KeystoreState = { isLocked(): boolean };
type ActiveFixturePort = { loadActiveManifest(): Promise<GuardedFixtureManifest> };
type ConfirmationPort = Pick<DevnetTransactionRpcPort, "getSignatureStatus">;

type TransferEvidence = {
  schemaVersion: 1;
  manifestDigest: string;
  amountAtomic: string;
  initialValidation: { allowed: boolean; manifestDigest: string; denialCodes: unknown[] };
  preSignValidation: { allowed: boolean; manifestDigest: string; denialCodes: unknown[] };
  wireTransaction: string;
  signature: string;
};

export class FixtureTransferApprovalService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #fixtureReview: ActiveFixturePort;
  readonly #chain: ConfirmationPort;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    health: NetworkHealthMonitor;
    keystore: KeystoreState;
    fixtureReview: ActiveFixturePort;
    chain: ConfirmationPort;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#health = input.health;
    this.#keystore = input.keystore;
    this.#fixtureReview = input.fixtureReview;
    this.#chain = input.chain;
  }

  getApproval(): GuardedFixtureTransferApprovalStorageRecord | null {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    return this.#database.getGuardedFixtureTransferApproval();
  }

  async approve(transferId: string): Promise<GuardedFixtureTransferApprovalStorageRecord> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    if (this.#database.getGuardedFixtureTransferApproval() !== null) {
      throw new Error("Guarded fixture transfer is already approved");
    }
    const transfer = this.#database.getGuardedFixtureTransfer(transferId);
    if (transfer === null || transfer.state !== "confirmed" || !transfer.broadcastAttempted) {
      throw new Error("Only a confirmed guarded fixture transfer can be approved");
    }
    const manifest = await this.#fixtureReview.loadActiveManifest();
    const manifestDigest = getGuardedFixtureManifestDigest(manifest);
    if (manifestDigest !== transfer.fixtureManifestDigest) throw new Error("Active fixture manifest mismatch");
    const evidence = await this.#readAndValidateEvidence(transfer, manifest);
    const status = await this.#chain.getSignatureStatus(evidence.signature);
    if (!status.found || status.error || (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized")) {
      throw new Error("Guarded fixture transfer is not confirmed on-chain");
    }
    const approvedAt = new Date().toISOString();
    const envelope = await this.#cipher.encryptString(JSON.stringify({
      schemaVersion: 1,
      transferId: transfer.id,
      manifestDigest,
      messageHash: transfer.messageHash,
      amountAtomic: evidence.amountAtomic,
      signature: evidence.signature,
      confirmationStatus: status.confirmationStatus,
      approvedAt,
      automaticTradingEnabled: false,
    }));
    const approval = {
      transferId: transfer.id,
      fixtureManifestDigest: manifestDigest,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      approvedAt,
    } satisfies GuardedFixtureTransferApprovalStorageRecord;
    this.#database.insertGuardedFixtureTransferApproval(approval);
    return approval;
  }

  async #readAndValidateEvidence(
    transfer: NonNullable<ReturnType<RuntimeDatabase["getGuardedFixtureTransfer"]>>,
    manifest: GuardedFixtureManifest,
  ): Promise<TransferEvidence> {
    if (transfer.encryptedPayload === null || transfer.payloadNonce === null || transfer.keyId !== "local-data-key-v1") {
      throw new Error("Guarded fixture transfer evidence is missing");
    }
    const value: unknown = JSON.parse(await this.#cipher.decryptString({
      ciphertext: transfer.encryptedPayload,
      nonce: transfer.payloadNonce,
      keyId: transfer.keyId,
    }));
    if (!isTransferEvidence(value)) throw new Error("Guarded fixture transfer evidence is invalid");
    if (
      value.manifestDigest !== transfer.fixtureManifestDigest
      || value.manifestDigest !== getGuardedFixtureManifestDigest(manifest)
      || value.amountAtomic !== manifest.transferAmountAtomic
      || value.initialValidation.manifestDigest !== value.manifestDigest
      || value.preSignValidation.manifestDigest !== value.manifestDigest
      || !value.initialValidation.allowed
      || !value.preSignValidation.allowed
      || value.initialValidation.denialCodes.length !== 0
      || value.preSignValidation.denialCodes.length !== 0
    ) throw new Error("Guarded fixture transfer evidence does not match the active manifest");
    return value;
  }
}

function isTransferEvidence(value: unknown): value is TransferEvidence {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === 1
    && typeof item.manifestDigest === "string"
    && /^[a-f0-9]{64}$/u.test(item.manifestDigest)
    && typeof item.amountAtomic === "string"
    && /^\d+$/u.test(item.amountAtomic)
    && isValidation(item.initialValidation)
    && isValidation(item.preSignValidation)
    && typeof item.wireTransaction === "string"
    && item.wireTransaction.length > 0
    && item.wireTransaction.length <= 4_096
    && typeof item.signature === "string"
    && item.signature.length >= 64
    && item.signature.length <= 128;
}

function isValidation(value: unknown): value is TransferEvidence["initialValidation"] {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.allowed === "boolean"
    && typeof item.manifestDigest === "string"
    && Array.isArray(item.denialCodes);
}
