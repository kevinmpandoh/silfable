import { randomUUID } from "node:crypto";

import type { MissionView } from "@silfable/contracts";

import type { NetworkHealthMonitor } from "../rpc/devnet.js";
import { RuntimeDatabase } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import { getGuardedDeskRuleDigest } from "./guarded-mission-authorization.js";

type KeystoreState = { isLocked(): boolean };

export type GuardedSchedulerReadiness = {
  evaluationId: string;
  outcome: "inactive" | "ready" | "denied";
  reasonCode: string;
  authorizationId: string | null;
  evaluatedAt: string;
  executionEnabled: false;
  signingAttempted: false;
};

export class GuardedSchedulerReadinessService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #keystore: KeystoreState;
  readonly #health: NetworkHealthMonitor;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    keystore: KeystoreState;
    health: NetworkHealthMonitor;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#health = input.health;
  }

  async evaluate(mission: MissionView, cycle: number): Promise<GuardedSchedulerReadiness> {
    if (!Number.isInteger(cycle) || cycle <= 0) throw new Error("Guarded scheduler cycle is invalid");
    const existing = this.#database.getGuardedSchedulerEvaluation(mission.id, mission.revision, cycle);
    if (existing !== null) {
      return {
        evaluationId: existing.id,
        outcome: "denied",
        reasonCode: "evaluation-already-recorded",
        authorizationId: existing.authorizationId,
        evaluatedAt: new Date().toISOString(),
        executionEnabled: false,
        signingAttempted: false,
      };
    }
    const authorization = this.#database.getActiveGuardedMissionAuthorization();
    if (authorization === null) return this.#record(mission, cycle, null, "inactive", "no-guarded-authority");
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) {
      return this.#record(mission, cycle, authorization.id, "denied", "network-unhealthy");
    }
    if (authorization.missionId !== mission.id) {
      return this.#record(mission, cycle, authorization.id, "denied", "authorization-mission-mismatch");
    }
    if (authorization.missionRevision !== mission.revision) {
      return this.#record(mission, cycle, authorization.id, "denied", "authorization-revision-mismatch");
    }
    if (authorization.planDigest !== mission.planDigest) {
      return this.#record(mission, cycle, authorization.id, "denied", "authorization-plan-mismatch");
    }
    const deskRuleDigest = getGuardedDeskRuleDigest(mission.plan);
    if (authorization.deskRuleDigest !== deskRuleDigest) {
      return this.#record(mission, cycle, authorization.id, "denied", "desk-rule-mismatch");
    }
    if (!(await this.#authorizationEvidenceMatches(authorization, mission, deskRuleDigest))) {
      return this.#record(mission, cycle, authorization.id, "denied", "authorization-evidence-invalid");
    }
    const approval = this.#database.getGuardedFixtureTransferApproval();
    const transfer = approval === null ? null : this.#database.getGuardedFixtureTransfer(approval.transferId);
    const fixture = this.#database.getActiveFixtureReview();
    if (
      approval === null
      || transfer === null
      || transfer.state !== "confirmed"
      || fixture === null
      || approval.transferId !== authorization.fixtureTransferId
      || approval.fixtureManifestDigest !== authorization.fixtureManifestDigest
      || transfer.fixtureManifestDigest !== authorization.fixtureManifestDigest
      || fixture.manifestDigest !== authorization.fixtureManifestDigest
    ) return this.#record(mission, cycle, authorization.id, "denied", "fixture-proof-missing");

    const schedulerArm = this.#database.getActiveGuardedSchedulerArm(new Date().toISOString());
    if (schedulerArm === null) {
      return this.#record(mission, cycle, authorization.id, "inactive", "scheduler-not-armed");
    }
    if (
      schedulerArm.authorizationId !== authorization.id
      || schedulerArm.missionId !== mission.id
      || schedulerArm.missionRevision !== mission.revision
      || schedulerArm.planDigest !== mission.planDigest
      || schedulerArm.deskRuleDigest !== deskRuleDigest
      || schedulerArm.fixtureManifestDigest !== authorization.fixtureManifestDigest
      || schedulerArm.scope !== "devnet-fixture-cycle-once"
    ) return this.#record(mission, cycle, authorization.id, "denied", "scheduler-arm-mismatch");

    return this.#record(mission, cycle, authorization.id, "ready", "guarded-prerequisites-ready");
  }

  async #authorizationEvidenceMatches(
    authorization: NonNullable<ReturnType<RuntimeDatabase["getActiveGuardedMissionAuthorization"]>>,
    mission: MissionView,
    deskRuleDigest: string,
  ): Promise<boolean> {
    if (authorization.keyId !== "local-data-key-v1") return false;
    try {
      const value: unknown = JSON.parse(await this.#cipher.decryptString({
        ciphertext: authorization.encryptedPayload,
        nonce: authorization.payloadNonce,
        keyId: authorization.keyId,
      }));
      if (typeof value !== "object" || value === null) return false;
      const item = value as Record<string, unknown>;
      return item.schemaVersion === 1
        && item.authorizationId === authorization.id
        && item.missionId === mission.id
        && item.missionRevision === mission.revision
        && item.planDigest === mission.planDigest
        && item.deskRuleDigest === deskRuleDigest
        && item.fixtureManifestDigest === authorization.fixtureManifestDigest
        && item.fixtureTransferId === authorization.fixtureTransferId
        && item.schedulerSigningEnabled === false
        && item.mainnetEnabled === false;
    } catch {
      return false;
    }
  }

  async #record(
    mission: MissionView,
    cycle: number,
    authorizationId: string | null,
    outcome: GuardedSchedulerReadiness["outcome"],
    reasonCode: string,
  ): Promise<GuardedSchedulerReadiness> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    const evaluatedAt = new Date().toISOString();
    const evaluationId = randomUUID();
    const result = {
      evaluationId,
      outcome,
      reasonCode,
      authorizationId,
      evaluatedAt,
      executionEnabled: false,
      signingAttempted: false,
    } satisfies GuardedSchedulerReadiness;
    const envelope = await this.#cipher.encryptString(JSON.stringify({
      schemaVersion: 1,
      missionId: mission.id,
      missionRevision: mission.revision,
      planDigest: mission.planDigest,
      cycle,
      ...result,
    }));
    this.#database.insertGuardedSchedulerEvaluation({
      id: evaluationId,
      missionId: mission.id,
      missionRevision: mission.revision,
      cycle,
      authorizationId,
      outcome,
      reasonCode,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      evaluatedAt,
    });
    return result;
  }
}
