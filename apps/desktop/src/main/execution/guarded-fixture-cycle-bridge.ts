import { randomUUID } from "node:crypto";

import {
  GuardedFixtureCycleProposalSchema,
  type GuardedFixtureCycleProposal,
  type MissionView,
} from "@silfable/contracts";
import type { KeyPairSigner } from "@solana/kit";

import type { NetworkHealthMonitor } from "../rpc/devnet.js";
import {
  RuntimeDatabase,
  type GuardedExecutionStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import type {
  GuardedFixtureTransferChainPort,
  GuardedTransferPreparation,
} from "./guarded-fixture-transfer.js";
import { getGuardedDeskRuleDigest } from "./guarded-mission-authorization.js";
import { transitionGuardedExecution, type GuardedExecutionEvent } from "./guarded-policy.js";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance.js";

const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_MS = 750;

type KeystoreState = { isLocked(): boolean };
type WalletSignerPort = { withWalletSigner<T>(operation: (signer: KeyPairSigner) => Promise<T>): Promise<T> };
type ActiveFixturePort = { loadActiveManifest(): Promise<GuardedFixtureManifest> };
type MissionPort = { get(missionId: string): Promise<MissionView> };

export class GuardedFixtureCycleExecutionBridge {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #health: NetworkHealthMonitor;
  readonly #keystore: KeystoreState;
  readonly #wallet: WalletSignerPort;
  readonly #fixtureReview: ActiveFixturePort;
  readonly #missions: MissionPort;
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
    missions: MissionPort;
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
    this.#missions = input.missions;
    this.#chain = input.chain;
    this.#confirmationTimeoutMs = input.confirmationTimeoutMs ?? CONFIRMATION_TIMEOUT_MS;
    this.#confirmationPollMs = input.confirmationPollMs ?? CONFIRMATION_POLL_MS;
  }

  async execute(untrustedProposal: GuardedFixtureCycleProposal): Promise<GuardedExecutionStorageRecord> {
    if (this.#executing) throw new Error("Guarded fixture-cycle execution is already active");
    const proposal = GuardedFixtureCycleProposalSchema.parse(untrustedProposal);
    const manifest = await this.#assertCurrent(proposal, "active");
    this.#executing = true;
    let executionId: string | null = null;
    try {
      return await this.#wallet.withWalletSigner(async (payer) => {
        const proposalEnvelope = await this.#encrypt({ kind: "fixture-cycle-proposal", proposal });
        let record = this.#database.createGuardedExecution({
          id: proposal.id,
          missionId: proposal.missionId,
          missionRevision: proposal.missionRevision,
          cycle: proposal.cycle,
          fixtureManifestDigest: proposal.fixtureManifestDigest,
          eventId: randomUUID(),
          encryptedPayload: proposalEnvelope.ciphertext,
          payloadNonce: proposalEnvelope.nonce,
          keyId: proposalEnvelope.keyId,
          now: new Date().toISOString(),
        });
        executionId = record.id;
        const preparation = await this.#chain.prepare(payer, manifest);
        this.#assertInitialValidation(preparation, proposal.fixtureManifestDigest);
        record = await this.#transition(record, "validation-passed", {
          kind: "pre-simulation-validation",
          proposalId: proposal.id,
          readinessEvaluationId: proposal.readinessEvaluationId,
          provenance: preparation.initialValidation,
          executionEnabledByBridge: true,
        });
        const simulation = await this.#chain.simulate(preparation);
        record = await this.#transition(record, "simulation-passed", {
          kind: "exact-message-simulation",
          messageHash: preparation.messageHash,
          unitsConsumed: simulation.unitsConsumed.toString(),
          lastValidBlockHeight: preparation.lastValidBlockHeight.toString(),
        }, { messageHash: preparation.messageHash });

        await this.#assertCurrent(proposal, "active");
        const preSignValidation = await this.#chain.revalidate(manifest);
        if (!preSignValidation.allowed || preSignValidation.manifestDigest !== proposal.fixtureManifestDigest) {
          throw new Error("guarded-cycle-pre-sign-provenance-denied");
        }
        this.#database.consumeGuardedSchedulerArm(proposal.schedulerArmId, proposal.id, new Date().toISOString());
        const signed = await preparation.sign();
        record = await this.#transition(record, "signed", {
          kind: "signed-exact-message",
          messageHash: preparation.messageHash,
          preSignValidation,
          wireTransaction: signed.wireTransaction,
          signature: signed.signature,
        }, { messageHash: preparation.messageHash, signingAttempted: true });

        await this.#assertCurrent(proposal, "consumed");
        record = await this.#transition(record, "broadcast-attempted", {
          kind: "broadcast-marker",
          signature: signed.signature,
        }, { broadcastAttempted: true });
        await this.#chain.broadcast(signed);
        return this.#waitForConfirmation(record, signed.signature, preparation.lastValidBlockHeight, proposal);
      });
    } catch (error) {
      if (executionId === null) throw error;
      const current = this.#database.getGuardedExecution(executionId);
      if (current === null) throw error;
      if (isTerminal(current.state)) return current;
      if (!current.broadcastAttempted) {
        const arm = this.#database.getGuardedSchedulerArm(proposal.schedulerArmId);
        if (arm?.state === "active" || arm?.state === "consumed") {
          this.#database.revokeGuardedSchedulerArm(arm.id, new Date().toISOString());
        }
      }
      return this.#recordFailure(current, failureCode(error));
    } finally {
      this.#executing = false;
    }
  }

  async reconcilePending(): Promise<void> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    for (const record of this.#database.listPendingGuardedExecutions()) {
      if (["proposed", "validated", "simulated", "signed"].includes(record.state)) {
        await this.#recordFailure(record, "restart-before-broadcast");
        continue;
      }
      if (record.state === "confirmed") {
        await this.#recordReceipt(record, { reconciledAfterRestart: true });
        continue;
      }
      if (!this.#health.isHealthyFresh()) {
        if (record.state === "broadcast") await this.#recordFailure(record, "network-unhealthy-reconciliation");
        continue;
      }
      try {
        const signature = await this.#readSignedSignature(record.id);
        const status = await this.#chain.getSignatureStatus(signature);
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          const confirmed = record.state === "ambiguous"
            ? await this.#transition(record, "confirmed", { kind: "reconciled-confirmation", signature })
            : await this.#transition(record, "confirmed", { kind: "reconciled-confirmation", signature });
          await this.#recordReceipt(confirmed, { reconciledAfterRestart: true, signature });
        } else if (record.state === "broadcast") {
          await this.#recordFailure(record, status.error ? "transaction-error-after-broadcast" : "unconfirmed-after-restart");
        }
      } catch {
        if (record.state === "broadcast") await this.#recordFailure(record, "journal-integrity-error-after-broadcast");
      }
    }
  }

  async #waitForConfirmation(
    record: GuardedExecutionStorageRecord,
    signature: string,
    lastValidBlockHeight: bigint,
    proposal: GuardedFixtureCycleProposal,
  ): Promise<GuardedExecutionStorageRecord> {
    const deadline = Date.now() + this.#confirmationTimeoutMs;
    while (Date.now() < deadline) {
      if (!this.#health.isHealthyFresh()) return this.#recordFailure(record, "network-lost-after-broadcast");
      const status = await this.#chain.getSignatureStatus(signature);
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        const confirmed = await this.#transition(record, "confirmed", {
          kind: "confirmation",
          signature,
          confirmationStatus: status.confirmationStatus,
        });
        return this.#recordReceipt(confirmed, {
          proposalId: proposal.id,
          readinessEvaluationId: proposal.readinessEvaluationId,
          signature,
          marketSwapPerformed: false,
        });
      }
      if (status.error) return this.#recordFailure(record, "transaction-error-after-broadcast");
      if ((await this.#chain.getBlockHeight()) > lastValidBlockHeight) {
        return this.#recordFailure(record, "blockhash-expired-unconfirmed");
      }
      await delay(this.#confirmationPollMs);
    }
    return this.#recordFailure(record, "confirmation-timeout");
  }

  async #assertCurrent(
    proposal: GuardedFixtureCycleProposal,
    expectedArmState: "active" | "consumed",
  ): Promise<GuardedFixtureManifest> {
    if (this.#keystore.isLocked()) throw new Error("Keystore is locked");
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
    const now = Date.now();
    if (new Date(proposal.observedAt).getTime() > now || new Date(proposal.expiresAt).getTime() <= now) {
      throw new Error("Guarded fixture-cycle proposal expired");
    }
    const mission = await this.#missions.get(proposal.missionId);
    const authorization = this.#database.getActiveGuardedMissionAuthorization();
    const readiness = this.#database.getGuardedSchedulerEvaluation(
      proposal.missionId,
      proposal.missionRevision,
      proposal.cycle,
    );
    const schedulerArm = this.#database.getGuardedSchedulerArm(proposal.schedulerArmId);
    if (
      mission.state !== "running"
      || mission.revision !== proposal.missionRevision
      || mission.planDigest !== proposal.planDigest
      || getGuardedDeskRuleDigest(mission.plan) !== proposal.deskRuleDigest
      || authorization === null
      || authorization.id !== proposal.authorizationId
      || authorization.state !== "active"
      || authorization.fixtureManifestDigest !== proposal.fixtureManifestDigest
      || readiness === null
      || readiness.id !== proposal.readinessEvaluationId
      || readiness.authorizationId !== proposal.authorizationId
      || readiness.outcome !== "ready"
      || schedulerArm === null
      || schedulerArm.authorizationId !== proposal.authorizationId
      || schedulerArm.missionId !== proposal.missionId
      || schedulerArm.missionRevision !== proposal.missionRevision
      || schedulerArm.planDigest !== proposal.planDigest
      || schedulerArm.deskRuleDigest !== proposal.deskRuleDigest
      || schedulerArm.fixtureManifestDigest !== proposal.fixtureManifestDigest
      || schedulerArm.scope !== "devnet-fixture-cycle-once"
      || schedulerArm.state !== expectedArmState
      || (expectedArmState === "consumed" && schedulerArm.executionId !== proposal.id)
    ) throw new Error("Guarded fixture-cycle authority binding changed");
    await this.#assertAuthorizationEvidence(authorization, proposal);
    await this.#assertReadinessEvidence(readiness, proposal);
    await this.#assertSchedulerArmEvidence(schedulerArm, proposal);
    const manifest = await this.#fixtureReview.loadActiveManifest();
    if (
      getGuardedFixtureManifestDigest(manifest) !== proposal.fixtureManifestDigest
      || manifest.sourceTokenAccount !== proposal.sourceTokenAccount
      || manifest.mintAddress !== proposal.mintAddress
      || manifest.destinationTokenAccount !== proposal.destinationTokenAccount
      || manifest.walletAuthority !== proposal.walletAuthority
      || manifest.transferAmountAtomic !== proposal.fixtureAmountAtomic
      || manifest.mintDecimals !== proposal.mintDecimals
    ) throw new Error("Guarded fixture-cycle manifest binding changed");
    return manifest;
  }

  async #assertSchedulerArmEvidence(
    arm: NonNullable<ReturnType<RuntimeDatabase["getGuardedSchedulerArm"]>>,
    proposal: GuardedFixtureCycleProposal,
  ) {
    const value = await this.#decryptRecord(arm.encryptedPayload, arm.payloadNonce, arm.keyId);
    if (
      value.schedulerArmId !== proposal.schedulerArmId
      || value.authorizationId !== proposal.authorizationId
      || value.missionId !== proposal.missionId
      || value.missionRevision !== proposal.missionRevision
      || value.planDigest !== proposal.planDigest
      || value.deskRuleDigest !== proposal.deskRuleDigest
      || value.fixtureManifestDigest !== proposal.fixtureManifestDigest
      || value.scope !== "devnet-fixture-cycle-once"
      || value.acknowledgedAutomaticSigning !== true
      || value.acknowledgedHotWallet !== true
      || value.acknowledgedDevnetFixtureOnly !== true
      || value.mainnetEnabled !== false
    ) throw new Error("Guarded scheduler arm evidence changed");
  }

  async #assertAuthorizationEvidence(
    authorization: NonNullable<ReturnType<RuntimeDatabase["getActiveGuardedMissionAuthorization"]>>,
    proposal: GuardedFixtureCycleProposal,
  ) {
    const value = await this.#decryptRecord(authorization.encryptedPayload, authorization.payloadNonce, authorization.keyId);
    if (
      value.authorizationId !== proposal.authorizationId
      || value.missionId !== proposal.missionId
      || value.missionRevision !== proposal.missionRevision
      || value.planDigest !== proposal.planDigest
      || value.deskRuleDigest !== proposal.deskRuleDigest
      || value.fixtureManifestDigest !== proposal.fixtureManifestDigest
      || value.schedulerSigningEnabled !== false
      || value.mainnetEnabled !== false
    ) throw new Error("Guarded authorization evidence changed");
  }

  async #assertReadinessEvidence(
    readiness: NonNullable<ReturnType<RuntimeDatabase["getGuardedSchedulerEvaluation"]>>,
    proposal: GuardedFixtureCycleProposal,
  ) {
    const value = await this.#decryptRecord(readiness.encryptedPayload, readiness.payloadNonce, readiness.keyId);
    if (
      value.evaluationId !== proposal.readinessEvaluationId
      || value.authorizationId !== proposal.authorizationId
      || value.missionId !== proposal.missionId
      || value.missionRevision !== proposal.missionRevision
      || value.planDigest !== proposal.planDigest
      || value.cycle !== proposal.cycle
      || value.outcome !== "ready"
      || value.executionEnabled !== false
      || value.signingAttempted !== false
    ) throw new Error("Guarded readiness evidence changed");
  }

  #assertInitialValidation(preparation: GuardedTransferPreparation, manifestDigest: string) {
    if (!preparation.initialValidation.allowed || preparation.initialValidation.manifestDigest !== manifestDigest) {
      throw new Error("guarded-cycle-initial-provenance-denied");
    }
  }

  async #recordReceipt(record: GuardedExecutionStorageRecord, evidence: unknown) {
    return this.#transition(record, "receipt-stored", { kind: "fixture-cycle-receipt", ...asRecord(evidence) });
  }

  async #recordFailure(record: GuardedExecutionStorageRecord, code: string) {
    const event: GuardedExecutionEvent = record.broadcastAttempted ? "post-broadcast-failure" : "pre-broadcast-failure";
    if (record.state === "ambiguous") return record;
    return this.#transition(record, event, { kind: "failure", failureCode: code }, { failureCode: code });
  }

  async #transition(
    record: GuardedExecutionStorageRecord,
    event: GuardedExecutionEvent,
    evidence: unknown,
    updates: { messageHash?: string; signingAttempted?: boolean; broadcastAttempted?: boolean; failureCode?: string } = {},
  ) {
    const state = transitionGuardedExecution(record.state, event);
    const envelope = await this.#encrypt(evidence);
    return this.#database.transitionGuardedExecution({
      id: record.id,
      expectedState: record.state,
      state,
      eventId: randomUUID(),
      eventName: event,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      ...updates,
      now: new Date().toISOString(),
    });
  }

  async #readSignedSignature(executionId: string): Promise<string> {
    const event = this.#database.listGuardedExecutionEvents(executionId).find((item) => item.eventName === "signed");
    if (event === undefined) throw new Error("Signed evidence is missing");
    const value = await this.#decryptRecord(event.encryptedPayload, event.payloadNonce, event.keyId);
    if (typeof value.signature !== "string" || value.signature.length === 0) throw new Error("Signed evidence is invalid");
    return value.signature;
  }

  async #decryptRecord(ciphertext: string, nonce: string, keyId: string): Promise<Record<string, unknown>> {
    if (keyId !== "local-data-key-v1") throw new Error("Guarded execution key is unsupported");
    const value: unknown = JSON.parse(await this.#cipher.decryptString({ ciphertext, nonce, keyId }));
    if (typeof value !== "object" || value === null) throw new Error("Guarded execution evidence is invalid");
    return value as Record<string, unknown>;
  }

  #encrypt(value: unknown) {
    return this.#cipher.encryptString(JSON.stringify(value));
  }
}

function isTerminal(state: GuardedExecutionStorageRecord["state"]) {
  return state === "receipted" || state === "failed" || state === "ambiguous";
}

function failureCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown-error";
  return /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value) ? value : "guarded-fixture-cycle-error";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : { value };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
