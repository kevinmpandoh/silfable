import {
  address,
  type TransactionSigner,
} from "@solana/kit";

import type { DevnetFixtureRpcPort } from "../rpc/devnet.js";
import {
  RuntimeDatabase,
  type FixtureReviewStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import {
  getGuardedFixtureManifestDigest,
  observeGuardedFixture,
  parseGuardedFixtureManifest,
  validateGuardedFixtureProvenance,
  type GuardedFixtureManifest,
} from "./fixture-provenance.js";
import { buildGuardedSplTransferFixture } from "./spl-fixture.js";

type KeystoreState = { isLocked(): boolean };
type NetworkState = { isHealthyFresh(): boolean };

export class FixtureReviewService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #rpc: DevnetFixtureRpcPort;
  readonly #keystore: KeystoreState;
  readonly #health: NetworkState;
  #reviewing = false;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    rpc: DevnetFixtureRpcPort;
    keystore: KeystoreState;
    health: NetworkState;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#rpc = input.rpc;
    this.#keystore = input.keystore;
    this.#health = input.health;
  }

  async reviewAndActivate(provisionId: string): Promise<FixtureReviewStorageRecord> {
    if (this.#reviewing) throw new Error("Fixture review is already running");
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    const existing = this.#database.getFixtureReview(provisionId);
    if (existing !== null) return existing;
    if (this.#database.getActiveFixtureReview() !== null) throw new Error("An active fixture already exists");
    const provision = this.#database.getFixtureProvision(provisionId);
    if (provision === null || provision.state !== "confirmed") throw new Error("Fixture provision is not confirmed");
    if (provision.encryptedPayload === null || provision.payloadNonce === null || provision.keyId !== "local-data-key-v1") {
      throw new Error("Fixture provision evidence is invalid");
    }
    this.#reviewing = true;
    try {
      const evidence = parseProvisionEvidence(JSON.parse(await this.#cipher.decryptString({
        ciphertext: provision.encryptedPayload,
        nonce: provision.payloadNonce,
        keyId: provision.keyId,
      })) as unknown);
      const reviewedAt = new Date().toISOString();
      const instruction = buildGuardedSplTransferFixture({
        source: evidence.sourceTokenAccount,
        mint: provision.mintAddress,
        destination: evidence.destinationTokenAccount,
        authority: nonSigningAuthority(evidence.walletAuthority),
        amount: BigInt(evidence.transferAmountAtomic),
        decimals: evidence.decimals,
      });
      const manifest = parseGuardedFixtureManifest({
        schemaVersion: 1,
        fixtureId: provision.id,
        cluster: "devnet",
        mintAddress: provision.mintAddress,
        mintDecimals: evidence.decimals,
        sourceTokenAccount: evidence.sourceTokenAccount,
        destinationTokenAccount: evidence.destinationTokenAccount,
        walletAuthority: evidence.walletAuthority,
        destinationOwner: evidence.destinationOwner,
        transferAmountAtomic: evidence.transferAmountAtomic,
        instructionFingerprint: evidence.instructionFingerprint,
        reviewedAt,
      } satisfies GuardedFixtureManifest);
      if (instruction.fingerprint !== evidence.instructionFingerprint) {
        throw new Error("Fixture provision instruction fingerprint is invalid");
      }
      const observation = await observeGuardedFixture(this.#rpc, manifest, new Date(reviewedAt));
      const validation = validateGuardedFixtureProvenance({
        manifest,
        observation,
        instruction,
        now: new Date(reviewedAt),
      });
      if (!validation.allowed) throw new Error(`Fixture provenance denied: ${validation.denialCodes.join(",")}`);
      const manifestDigest = getGuardedFixtureManifestDigest(manifest);
      const envelope = await this.#cipher.encryptString(JSON.stringify({
        schemaVersion: 1,
        manifest,
        observation,
        validation,
      }));
      const record: FixtureReviewStorageRecord = {
        provisionId,
        manifestDigest,
        mintAddress: manifest.mintAddress,
        sourceTokenAccount: manifest.sourceTokenAccount,
        destinationTokenAccount: manifest.destinationTokenAccount,
        walletAuthority: manifest.walletAuthority,
        destinationOwner: manifest.destinationOwner,
        observedSlot: observation.contextSlot,
        encryptedPayload: envelope.ciphertext,
        payloadNonce: envelope.nonce,
        keyId: envelope.keyId,
        active: true,
        createdAt: reviewedAt,
      };
      this.#database.insertFixtureReview(record);
      return record;
    } finally {
      this.#reviewing = false;
    }
  }

  getActive(): FixtureReviewStorageRecord | null {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    return this.#database.getActiveFixtureReview();
  }

  async loadActiveManifest(): Promise<GuardedFixtureManifest> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    const record = this.#database.getActiveFixtureReview();
    if (record === null || record.keyId !== "local-data-key-v1") throw new Error("Active fixture does not exist");
    const payload = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    })) as { manifest?: unknown };
    const manifest = parseGuardedFixtureManifest(payload.manifest);
    if (
      getGuardedFixtureManifestDigest(manifest) !== record.manifestDigest ||
      manifest.mintAddress !== record.mintAddress ||
      manifest.sourceTokenAccount !== record.sourceTokenAccount ||
      manifest.destinationTokenAccount !== record.destinationTokenAccount ||
      manifest.walletAuthority !== record.walletAuthority ||
      manifest.destinationOwner !== record.destinationOwner
    ) throw new Error("Active fixture manifest integrity check failed");
    return manifest;
  }
}

function nonSigningAuthority(value: string): TransactionSigner {
  return {
    address: address(value),
    async signTransactions() {
      throw new Error("Review-only authority cannot sign transactions");
    },
  };
}

type ProvisionEvidence = {
  walletAuthority: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  destinationOwner: string;
  decimals: number;
  supplyAtomic: string;
  transferAmountAtomic: string;
  instructionFingerprint: string;
};

function parseProvisionEvidence(untrusted: unknown): ProvisionEvidence {
  if (typeof untrusted !== "object" || untrusted === null || Array.isArray(untrusted)) {
    throw new Error("Fixture provision evidence is invalid");
  }
  const value = untrusted as Record<string, unknown>;
  for (const key of ["walletAuthority", "sourceTokenAccount", "destinationTokenAccount", "destinationOwner"]) {
    if (typeof value[key] !== "string") throw new Error("Fixture provision evidence is invalid");
    address(value[key] as string);
  }
  if (
    value.schemaVersion !== 1 ||
    typeof value.decimals !== "number" ||
    !Number.isInteger(value.decimals) ||
    value.decimals < 0 ||
    value.decimals > 9 ||
    typeof value.supplyAtomic !== "string" ||
    !/^[1-9][0-9]*$/u.test(value.supplyAtomic) ||
    typeof value.transferAmountAtomic !== "string" ||
    !/^[1-9][0-9]*$/u.test(value.transferAmountAtomic) ||
    BigInt(value.transferAmountAtomic) > BigInt(value.supplyAtomic) ||
    typeof value.instructionFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.instructionFingerprint) ||
    typeof value.wireTransaction !== "string" ||
    typeof value.signature !== "string"
  ) throw new Error("Fixture provision evidence is invalid");
  return value as ProvisionEvidence;
}
