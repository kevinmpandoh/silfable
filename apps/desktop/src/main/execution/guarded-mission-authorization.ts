import { createHash, randomUUID } from "node:crypto";

import type { DcaPlanV1, MissionView } from "@silfable/contracts";

import {
  RuntimeDatabase,
  type GuardedMissionAuthorizationStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";

type KeystoreState = { isLocked(): boolean };
type MissionPort = { get(missionId: string): Promise<MissionView> };

export class GuardedMissionAuthorizationService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #keystore: KeystoreState;
  readonly #missions: MissionPort;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    keystore: KeystoreState;
    missions: MissionPort;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#missions = input.missions;
  }

  list(): GuardedMissionAuthorizationStorageRecord[] {
    this.#assertUnlocked();
    return this.#database.listGuardedMissionAuthorizations(20);
  }

  async authorize(input: {
    missionId: string;
    expectedRevision: number;
    expectedPlanDigest: string;
  }): Promise<GuardedMissionAuthorizationStorageRecord> {
    this.#assertUnlocked();
    if (this.#database.getActiveGuardedMissionAuthorization() !== null) {
      throw new Error("A guarded mission authorization is already active");
    }
    const approval = this.#database.getGuardedFixtureTransferApproval();
    if (approval === null) throw new Error("Guarded fixture transfer approval is required");
    const approvalEvidence = await this.#readApprovalEvidence(approval);
    const transfer = this.#database.getGuardedFixtureTransfer(approval.transferId);
    const activeFixture = this.#database.getActiveFixtureReview();
    if (
      transfer === null
      || transfer.state !== "confirmed"
      || activeFixture === null
      || transfer.fixtureManifestDigest !== approval.fixtureManifestDigest
      || activeFixture.manifestDigest !== approval.fixtureManifestDigest
      || approvalEvidence.transferId !== approval.transferId
      || approvalEvidence.manifestDigest !== approval.fixtureManifestDigest
      || approvalEvidence.approvedAt !== approval.approvedAt
      || approvalEvidence.automaticTradingEnabled !== false
    ) throw new Error("Guarded fixture approval integrity check failed");

    const mission = await this.#missions.get(input.missionId);
    if (mission.state !== "authorized" && mission.state !== "halted") {
      throw new Error("Mission must first be authorized for deterministic simulation");
    }
    if (mission.revision !== input.expectedRevision || mission.planDigest !== input.expectedPlanDigest) {
      throw new Error("Guarded mission authorization revision conflict");
    }
    const deskRuleSnapshot = getGuardedDeskRuleSnapshot(mission.plan);
    const deskRuleDigest = getGuardedDeskRuleDigest(mission.plan);
    const authorizedAt = new Date().toISOString();
    const id = randomUUID();
    const envelope = await this.#cipher.encryptString(JSON.stringify({
      schemaVersion: 1,
      authorizationId: id,
      missionId: mission.id,
      missionRevision: mission.revision,
      planDigest: mission.planDigest,
      deskRuleDigest,
      deskRuleSnapshot,
      fixtureManifestDigest: approval.fixtureManifestDigest,
      fixtureTransferId: approval.transferId,
      fixtureApprovalApprovedAt: approval.approvedAt,
      authorizedAt,
      schedulerSigningEnabled: false,
      mainnetEnabled: false,
    }));
    const record = {
      id,
      missionId: mission.id,
      missionRevision: mission.revision,
      planDigest: mission.planDigest,
      deskRuleDigest,
      fixtureManifestDigest: approval.fixtureManifestDigest,
      fixtureTransferId: approval.transferId,
      state: "active",
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      authorizedAt,
      revokedAt: null,
    } satisfies GuardedMissionAuthorizationStorageRecord;
    this.#database.insertGuardedMissionAuthorization(record);
    return record;
  }

  revoke(authorizationId: string): GuardedMissionAuthorizationStorageRecord {
    this.#assertUnlocked();
    return this.#database.revokeGuardedMissionAuthorization(authorizationId, new Date().toISOString());
  }

  async #readApprovalEvidence(approval: NonNullable<ReturnType<RuntimeDatabase["getGuardedFixtureTransferApproval"]>>) {
    if (approval.keyId !== "local-data-key-v1") throw new Error("Guarded fixture approval key is unsupported");
    const value: unknown = JSON.parse(await this.#cipher.decryptString({
      ciphertext: approval.encryptedPayload,
      nonce: approval.payloadNonce,
      keyId: approval.keyId,
    }));
    if (typeof value !== "object" || value === null) throw new Error("Guarded fixture approval is invalid");
    const item = value as Record<string, unknown>;
    if (
      typeof item.transferId !== "string"
      || typeof item.manifestDigest !== "string"
      || item.schemaVersion !== 1
      || typeof item.approvedAt !== "string"
      || item.automaticTradingEnabled !== false
    ) throw new Error("Guarded fixture approval is invalid");
    return {
      transferId: item.transferId,
      manifestDigest: item.manifestDigest,
      approvedAt: item.approvedAt,
      automaticTradingEnabled: false as const,
    };
  }

  #assertUnlocked() {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
  }
}

export function getGuardedDeskRuleSnapshot(plan: DcaPlanV1) {
  return {
    schemaVersion: 1 as const,
    profile: plan.profile,
    inputMint: plan.inputMint,
    outputMint: plan.outputMint,
    amountPerCycleAtomic: plan.amountPerCycleAtomic,
    intervalSeconds: plan.intervalSeconds,
    startAt: plan.startAt,
    endAt: plan.endAt ?? null,
    maxCycles: plan.maxCycles ?? null,
    minPrice: plan.minPrice ?? null,
    maxPrice: plan.maxPrice ?? null,
    maxSlippageBps: plan.maxSlippageBps,
    maxPriceImpactBps: plan.maxPriceImpactBps,
    maxFeeLamports: plan.maxFeeLamports,
    dailySpendLimitAtomic: plan.dailySpendLimitAtomic,
    minimumWalletReserveAtomic: plan.minimumWalletReserveAtomic,
    missedCyclePolicy: plan.missedCyclePolicy,
    failurePolicy: plan.failurePolicy,
  };
}

export function getGuardedDeskRuleDigest(plan: DcaPlanV1): string {
  return digest(getGuardedDeskRuleSnapshot(plan));
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
