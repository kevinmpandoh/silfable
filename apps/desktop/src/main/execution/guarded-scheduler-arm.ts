import { randomUUID } from "node:crypto";

import {
  RuntimeDatabase,
  type GuardedSchedulerArmStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";

const ARM_LIFETIME_MS = 15 * 60 * 1_000;

type KeystoreState = { isLocked(): boolean };

export class GuardedSchedulerArmService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #keystore: KeystoreState;

  constructor(input: { database: RuntimeDatabase; cipher: LocalDataCipher; keystore: KeystoreState }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
  }

  async arm(input: {
    authorizationId: string;
    acknowledgedAutomaticSigning: true;
    acknowledgedHotWallet: true;
    acknowledgedDevnetFixtureOnly: true;
  }): Promise<GuardedSchedulerArmStorageRecord> {
    this.#assertUnlocked();
    const now = new Date();
    if (this.#database.getActiveGuardedSchedulerArm(now.toISOString()) !== null) {
      throw new Error("A guarded scheduler arm is already active");
    }
    if (this.#database.listPendingGuardedExecutions().length > 0) {
      throw new Error("An unresolved guarded execution must be reconciled before arming again");
    }
    const authorization = this.#database.getActiveGuardedMissionAuthorization();
    if (authorization === null || authorization.id !== input.authorizationId) {
      throw new Error("An exact active guarded mission authorization is required");
    }
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + ARM_LIFETIME_MS).toISOString();
    const envelope = await this.#cipher.encryptString(JSON.stringify({
      schemaVersion: 1,
      schedulerArmId: id,
      authorizationId: authorization.id,
      missionId: authorization.missionId,
      missionRevision: authorization.missionRevision,
      planDigest: authorization.planDigest,
      deskRuleDigest: authorization.deskRuleDigest,
      fixtureManifestDigest: authorization.fixtureManifestDigest,
      scope: "devnet-fixture-cycle-once",
      acknowledgedAutomaticSigning: input.acknowledgedAutomaticSigning,
      acknowledgedHotWallet: input.acknowledgedHotWallet,
      acknowledgedDevnetFixtureOnly: input.acknowledgedDevnetFixtureOnly,
      mainnetEnabled: false,
      armedAt: now.toISOString(),
      expiresAt,
    }));
    const record = {
      id,
      authorizationId: authorization.id,
      missionId: authorization.missionId,
      missionRevision: authorization.missionRevision,
      planDigest: authorization.planDigest,
      deskRuleDigest: authorization.deskRuleDigest,
      fixtureManifestDigest: authorization.fixtureManifestDigest,
      scope: "devnet-fixture-cycle-once",
      state: "active",
      executionId: null,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      armedAt: now.toISOString(),
      expiresAt,
      consumedAt: null,
      revokedAt: null,
    } satisfies GuardedSchedulerArmStorageRecord;
    this.#database.insertGuardedSchedulerArm(record);
    return record;
  }

  revoke(id: string): GuardedSchedulerArmStorageRecord {
    this.#assertUnlocked();
    return this.#database.revokeGuardedSchedulerArm(id, new Date().toISOString());
  }

  list(): GuardedSchedulerArmStorageRecord[] {
    this.#assertUnlocked();
    this.#database.getActiveGuardedSchedulerArm(new Date().toISOString());
    return this.#database.listGuardedSchedulerArms(20);
  }

  #assertUnlocked(): void {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
  }
}
