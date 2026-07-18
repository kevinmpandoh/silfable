import { randomUUID } from "node:crypto";

import {
  GuardedFixtureCycleProposalSchema,
  type GuardedFixtureCycleProposal,
  type MissionView,
} from "@silfable/contracts";

import type { NetworkHealthMonitor } from "../rpc/devnet.js";
import { RuntimeDatabase } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import { getGuardedDeskRuleDigest } from "./guarded-mission-authorization.js";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance.js";

const PROPOSAL_LIFETIME_MS = 15_000;

type KeystoreState = { isLocked(): boolean };
type ActiveFixturePort = { loadActiveManifest(): Promise<GuardedFixtureManifest> };

export class GuardedFixtureCycleProposalService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #keystore: KeystoreState;
  readonly #health: NetworkHealthMonitor;
  readonly #fixtureReview: ActiveFixturePort;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: LocalDataCipher;
    keystore: KeystoreState;
    health: NetworkHealthMonitor;
    fixtureReview: ActiveFixturePort;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#keystore = input.keystore;
    this.#health = input.health;
    this.#fixtureReview = input.fixtureReview;
  }

  async prepare(mission: MissionView, cycle: number): Promise<GuardedFixtureCycleProposal> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    if (mission.state !== "running") throw new Error("Guarded fixture proposal requires a running mission");
    if (!Number.isInteger(cycle) || cycle <= 0) throw new Error("Guarded fixture cycle is invalid");
    const readiness = this.#database.getGuardedSchedulerEvaluation(mission.id, mission.revision, cycle);
    if (readiness === null || readiness.outcome !== "ready" || readiness.authorizationId === null) {
      throw new Error("A ready guarded scheduler evaluation is required");
    }
    const authorization = this.#database.getActiveGuardedMissionAuthorization();
    if (
      authorization === null
      || authorization.id !== readiness.authorizationId
      || authorization.missionId !== mission.id
      || authorization.missionRevision !== mission.revision
      || authorization.planDigest !== mission.planDigest
      || authorization.deskRuleDigest !== getGuardedDeskRuleDigest(mission.plan)
    ) throw new Error("Active guarded authority does not match the ready cycle");
    const schedulerArm = this.#database.getActiveGuardedSchedulerArm(new Date().toISOString());
    if (
      schedulerArm === null
      || schedulerArm.authorizationId !== authorization.id
      || schedulerArm.missionId !== mission.id
      || schedulerArm.missionRevision !== mission.revision
      || schedulerArm.planDigest !== mission.planDigest
      || schedulerArm.deskRuleDigest !== authorization.deskRuleDigest
      || schedulerArm.fixtureManifestDigest !== authorization.fixtureManifestDigest
      || schedulerArm.scope !== "devnet-fixture-cycle-once"
    ) throw new Error("An exact active one-shot scheduler arm is required");
    await this.#assertReadinessEvidence(readiness, mission, authorization.id);
    const manifest = await this.#fixtureReview.loadActiveManifest();
    const manifestDigest = getGuardedFixtureManifestDigest(manifest);
    const approval = this.#database.getGuardedFixtureTransferApproval();
    const proof = approval === null ? null : this.#database.getGuardedFixtureTransfer(approval.transferId);
    if (
      manifestDigest !== authorization.fixtureManifestDigest
      || approval === null
      || proof === null
      || proof.state !== "confirmed"
      || approval.transferId !== authorization.fixtureTransferId
      || approval.fixtureManifestDigest !== manifestDigest
    ) throw new Error("Guarded fixture proof no longer matches the active authority");
    const observedAt = new Date();
    return GuardedFixtureCycleProposalSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      proposalKind: "spl-transfer-checked-cycle-v1",
      purpose: "devnet-execution-path-proof",
      missionId: mission.id,
      missionRevision: mission.revision,
      cycle,
      planDigest: mission.planDigest,
      deskRuleDigest: authorization.deskRuleDigest,
      authorizationId: authorization.id,
      schedulerArmId: schedulerArm.id,
      readinessEvaluationId: readiness.id,
      fixtureManifestDigest: manifestDigest,
      sourceTokenAccount: manifest.sourceTokenAccount,
      mintAddress: manifest.mintAddress,
      destinationTokenAccount: manifest.destinationTokenAccount,
      walletAuthority: manifest.walletAuthority,
      fixtureAmountAtomic: manifest.transferAmountAtomic,
      mintDecimals: manifest.mintDecimals,
      authorizedDcaAmountAtomic: mission.plan.amountPerCycleAtomic,
      economicValueMapping: "none",
      marketSwapPerformed: false,
      executionEnabled: false,
      observedAt: observedAt.toISOString(),
      expiresAt: new Date(observedAt.getTime() + PROPOSAL_LIFETIME_MS).toISOString(),
    });
  }

  async #assertReadinessEvidence(
    readiness: NonNullable<ReturnType<RuntimeDatabase["getGuardedSchedulerEvaluation"]>>,
    mission: MissionView,
    authorizationId: string,
  ): Promise<void> {
    if (readiness.keyId !== "local-data-key-v1") throw new Error("Guarded readiness key is unsupported");
    const value: unknown = JSON.parse(await this.#cipher.decryptString({
      ciphertext: readiness.encryptedPayload,
      nonce: readiness.payloadNonce,
      keyId: readiness.keyId,
    }));
    if (typeof value !== "object" || value === null) throw new Error("Guarded readiness evidence is invalid");
    const item = value as Record<string, unknown>;
    if (
      item.schemaVersion !== 1
      || item.evaluationId !== readiness.id
      || item.missionId !== mission.id
      || item.missionRevision !== mission.revision
      || item.planDigest !== mission.planDigest
      || item.cycle !== readiness.cycle
      || item.authorizationId !== authorizationId
      || item.outcome !== "ready"
      || item.executionEnabled !== false
      || item.signingAttempted !== false
    ) throw new Error("Guarded readiness evidence does not match the cycle");
  }
}
