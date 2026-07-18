import { randomUUID } from "node:crypto";

import {
  GuardedDevnetProposalSchema,
  GuardedDevnetSimulationSchema,
  GuardedDevnetValidationSchema,
  type GuardedDevnetProposal,
  type GuardedDevnetSimulation,
  type GuardedDevnetValidation,
} from "@silfable/contracts";
import {
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type Transaction,
} from "@solana/kit";

import {
  RuntimeDatabase,
  type GuardedExecutionStorageRecord,
} from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";
import {
  transitionGuardedExecution,
  type GuardedExecutionEvent,
} from "./guarded-policy.js";
import { assertExactSimulatedMessage } from "./spl-fixture.js";

export type GuardedJournalEvidence = {
  id: string;
  eventName: string;
  fromState: GuardedExecutionStorageRecord["state"] | null;
  toState: GuardedExecutionStorageRecord["state"];
  createdAt: string;
  payload: unknown;
};

export class GuardedDevnetJournal {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;

  constructor(database: RuntimeDatabase, cipher: LocalDataCipher) {
    this.#database = database;
    this.#cipher = cipher;
  }

  async create(untrustedProposal: GuardedDevnetProposal): Promise<GuardedExecutionStorageRecord> {
    const proposal = GuardedDevnetProposalSchema.parse(untrustedProposal);
    const now = new Date().toISOString();
    const envelope = await this.#encryptEvidence({ kind: "proposal", proposal });
    return this.#database.createGuardedExecution({
      id: proposal.id,
      missionId: proposal.missionId,
      missionRevision: proposal.missionRevision,
      cycle: proposal.cycle,
      fixtureManifestDigest: proposal.fixtureManifestDigest,
      eventId: randomUUID(),
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      now,
    });
  }

  async recordValidation(
    executionId: string,
    untrustedValidation: GuardedDevnetValidation,
  ): Promise<GuardedExecutionStorageRecord> {
    const validation = GuardedDevnetValidationSchema.parse(untrustedValidation);
    if (
      validation.stage !== "pre-simulation" ||
      validation.proposalId !== executionId ||
      validation.fixtureManifestDigest !== this.#require(executionId).fixtureManifestDigest ||
      !validation.allowed ||
      validation.signingAllowed
    ) {
      throw new Error("Guarded pre-simulation validation did not pass");
    }
    return this.#transition(executionId, "validation-passed", { kind: "validation", validation });
  }

  async recordSimulation(
    executionId: string,
    untrustedSimulation: GuardedDevnetSimulation,
    transaction: Pick<Transaction, "messageBytes">,
  ): Promise<GuardedExecutionStorageRecord> {
    const simulation = GuardedDevnetSimulationSchema.parse(untrustedSimulation);
    if (
      simulation.proposalId !== executionId ||
      simulation.fixtureManifestDigest !== this.#require(executionId).fixtureManifestDigest ||
      !simulation.succeeded
    ) {
      throw new Error("Guarded simulation did not pass");
    }
    assertExactSimulatedMessage(simulation.transactionMessageHash, transaction);
    return this.#transition(
      executionId,
      "simulation-passed",
      { kind: "simulation", simulation },
      { messageHash: simulation.transactionMessageHash },
    );
  }

  async recordSigned(input: {
    executionId: string;
    validation: GuardedDevnetValidation;
    transaction: Transaction;
  }): Promise<GuardedExecutionStorageRecord> {
    const validation = GuardedDevnetValidationSchema.parse(input.validation);
    const current = this.#require(input.executionId);
    if (
      validation.stage !== "pre-sign" ||
      validation.proposalId !== input.executionId ||
      validation.fixtureManifestDigest !== current.fixtureManifestDigest ||
      !validation.allowed ||
      !validation.signingAllowed ||
      current.messageHash === null
    ) {
      throw new Error("Guarded pre-sign validation did not pass");
    }
    assertExactSimulatedMessage(current.messageHash, input.transaction);
    const wireTransaction = getBase64EncodedWireTransaction(input.transaction);
    const signature = getSignatureFromTransaction(input.transaction);
    return this.#transition(
      input.executionId,
      "signed",
      {
        kind: "signed-transaction",
        validation,
        wireTransaction,
        signature,
      },
      { messageHash: current.messageHash, signingAttempted: true },
    );
  }

  async recordBroadcastAttempt(executionId: string): Promise<GuardedExecutionStorageRecord> {
    return this.#transition(
      executionId,
      "broadcast-attempted",
      { kind: "broadcast-attempt" },
      { broadcastAttempted: true },
    );
  }

  async recordConfirmed(executionId: string, confirmation: unknown): Promise<GuardedExecutionStorageRecord> {
    return this.#transition(executionId, "confirmed", { kind: "confirmation", confirmation });
  }

  async recordReceipt(executionId: string, receipt: unknown): Promise<GuardedExecutionStorageRecord> {
    return this.#transition(executionId, "receipt-stored", { kind: "receipt", receipt });
  }

  async recordFailure(executionId: string, failureCode: string): Promise<GuardedExecutionStorageRecord> {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(failureCode)) throw new Error("Failure code is invalid");
    const current = this.#require(executionId);
    const event: GuardedExecutionEvent = current.broadcastAttempted
      ? "post-broadcast-failure"
      : "pre-broadcast-failure";
    return this.#transition(
      executionId,
      event,
      { kind: "failure", failureCode },
      { failureCode },
    );
  }

  get(executionId: string): GuardedExecutionStorageRecord | null {
    return this.#database.getGuardedExecution(executionId);
  }

  async listEvidence(executionId: string): Promise<GuardedJournalEvidence[]> {
    return Promise.all(this.#database.listGuardedExecutionEvents(executionId).map(async (event) => ({
      id: event.id,
      eventName: event.eventName,
      fromState: event.fromState,
      toState: event.toState,
      createdAt: event.createdAt,
      payload: JSON.parse(await this.#cipher.decryptString({
        ciphertext: event.encryptedPayload,
        nonce: event.payloadNonce,
        keyId: requireDataKeyId(event.keyId),
      })) as unknown,
    })));
  }

  async #transition(
    executionId: string,
    event: GuardedExecutionEvent,
    evidence: unknown,
    updates: {
      messageHash?: string;
      signingAttempted?: boolean;
      broadcastAttempted?: boolean;
      failureCode?: string | null;
    } = {},
  ): Promise<GuardedExecutionStorageRecord> {
    const current = this.#require(executionId);
    const state = transitionGuardedExecution(current.state, event);
    const envelope = await this.#encryptEvidence(evidence);
    return this.#database.transitionGuardedExecution({
      id: executionId,
      expectedState: current.state,
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

  #require(executionId: string): GuardedExecutionStorageRecord {
    const current = this.#database.getGuardedExecution(executionId);
    if (current === null) throw new Error("Guarded execution does not exist");
    return current;
  }

  #encryptEvidence(evidence: unknown) {
    const serialized = JSON.stringify(evidence);
    if (serialized === undefined) throw new Error("Guarded execution evidence is not serializable");
    return this.#cipher.encryptString(serialized);
  }
}

function requireDataKeyId(value: string): "local-data-key-v1" {
  if (value !== "local-data-key-v1") throw new Error("Guarded execution evidence key is unsupported");
  return value;
}
