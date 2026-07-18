import { createHash, randomUUID } from "node:crypto";

import {
  AgentCreateSessionRequestSchema,
  AgentIntentEvaluationViewSchema,
  AgentIntentReceiptSchema,
  AgentSessionViewSchema,
  type AgentCreateSessionRequest,
  type AgentIntentEvaluationView,
  type AgentSessionView,
  type AiProviderSetting,
  type JupiterShadowQuoteView,
  type MarketObservationView,
} from "@silfable/contracts";
import { evaluateAgentIntent } from "@silfable/core";

import {
  RuntimeDatabase,
  type AgentIntentEvaluationStorageRecord,
  type AgentSessionStorageRecord,
} from "../storage/database.js";
import type { AiDraftService } from "../ai/service.js";

type AgentCipher = {
  encryptString(plaintext: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>;
  decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string>;
};

type AgentAi = Pick<AiDraftService, "listSettings" | "proposeAgentIntent">;
type ObservationSource = { list(): Promise<MarketObservationView[]> };
type QuoteSource = { list(): Promise<JupiterShadowQuoteView[]> };

export class AgentSessionService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: AgentCipher;
  readonly #ai: AgentAi;
  readonly #observations: ObservationSource;
  readonly #quotes: QuoteSource;
  readonly #now: () => Date;

  constructor(input: {
    database: RuntimeDatabase;
    cipher: AgentCipher;
    ai: AgentAi;
    observations: ObservationSource;
    quotes: QuoteSource;
    now?: () => Date;
  }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#ai = input.ai;
    this.#observations = input.observations;
    this.#quotes = input.quotes;
    this.#now = input.now ?? (() => new Date());
  }

  async create(untrustedRequest: AgentCreateSessionRequest): Promise<AgentSessionView> {
    const request = AgentCreateSessionRequestSchema.parse(untrustedRequest);
    const now = this.#now();
    const deadline = Date.parse(request.deadlineAt);
    if (deadline < now.getTime() + 5 * 60_000 || deadline > now.getTime() + 7 * 24 * 60 * 60_000) {
      throw new Error("Agent session deadline must be between five minutes and seven days");
    }
    const settings: AiProviderSetting[] = await this.#ai.listSettings();
    if (!settings.find((setting) => setting.provider === request.provider)?.configured) {
      throw new Error("Selected AI provider is not configured");
    }
    const body = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      provider: request.provider,
      objective: request.objective,
      venue: "jupiter-swap-v2" as const,
      maxActionNotionalUsdcMicros: request.maxActionNotionalUsdcMicros,
      maxPriceImpactBps: request.maxPriceImpactBps,
      maxVolatilityBps: request.maxVolatilityBps,
      deadlineAt: request.deadlineAt,
      createdAt: now.toISOString(),
    };
    const envelope = await this.#cipher.encryptString(JSON.stringify(body));
    const record: AgentSessionStorageRecord = {
      id: body.id,
      state: "active",
      provider: body.provider,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      deadlineAt: body.deadlineAt,
      haltedAt: null,
      haltReason: null,
      executionEnabled: false,
      createdAt: body.createdAt,
      updatedAt: body.createdAt,
    };
    this.#database.insertAgentSession(record);
    return this.#hydrateSession(record);
  }

  async halt(id: string): Promise<AgentSessionView> {
    return this.#hydrateSession(this.#database.haltAgentSession(id, "operator", this.#now().toISOString()));
  }

  async evaluate(sessionId: string, observationId: string): Promise<AgentIntentEvaluationView> {
    const now = this.#now();
    this.#expire(now);
    const sessionRecord = this.#database.getAgentSession(sessionId);
    if (sessionRecord === null) throw new Error("Agent session does not exist");
    const session = await this.#hydrateSession(sessionRecord);
    if (session.state !== "active" || Date.parse(session.deadlineAt) <= now.getTime()) {
      throw new Error("Agent session is not active");
    }
    const observation = (await this.#observations.list()).find((candidate) => candidate.id === observationId);
    if (observation === undefined || observation.freshnessStatus !== "fresh") {
      throw new Error("Fresh main-owned observation does not exist");
    }
    const quote = (await this.#quotes.list()).find((candidate) => candidate.id === observation.primaryQuoteId);
    if (quote === undefined || !quote.allowed || quote.transactionReturned || Date.parse(quote.expiresAt) <= now.getTime()) {
      throw new Error("Fresh allowed main-owned quote does not exist");
    }
    const result = await this.#ai.proposeAgentIntent({ provider: session.provider, session, observation, quote });
    const evaluatedAt = this.#now();
    this.#expire(evaluatedAt);
    const currentSessionRecord = this.#database.getAgentSession(session.id);
    if (currentSessionRecord === null) throw new Error("Agent session disappeared during evaluation");
    const currentSession = await this.#hydrateSession(currentSessionRecord);
    const currentObservation = (await this.#observations.list()).find((candidate) => candidate.id === observation.id)
      ?? { ...observation, freshnessStatus: "stale" as const };
    const currentQuote = (await this.#quotes.list()).find((candidate) => candidate.id === quote.id) ?? quote;
    const evaluation = evaluateAgentIntent({
      session: currentSession,
      observation: currentObservation,
      quote: currentQuote,
      proposal: result.proposal,
      now: evaluatedAt,
    });
    const proposalDigest = createHash("sha256").update(JSON.stringify(result.proposal), "utf8").digest("hex");
    const receipt = AgentIntentReceiptSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      sessionId: currentSession.id,
      observationId: currentObservation.id,
      proposalDigest,
      outcome: evaluation.outcome,
      denialCodes: evaluation.denialCodes,
      evaluatedAt: evaluatedAt.toISOString(),
      modelCallsAttempted: true,
      signingAttempted: false,
      executionAttempted: false,
      persistedLocally: true,
    });
    const payload = {
      schemaVersion: 1 as const,
      provider: currentSession.provider,
      model: result.model,
      observation: currentObservation,
      quote: currentQuote,
      proposal: result.proposal,
      receipt,
    };
    const envelope = await this.#cipher.encryptString(JSON.stringify(payload));
    const approvalExpiresAt = receipt.outcome === "pending-approval"
      ? new Date(Math.min(evaluatedAt.getTime() + 60 * 60_000, Date.parse(currentSession.deadlineAt))).toISOString()
      : null;
    this.#database.insertAgentIntentEvaluation({
      id: receipt.id,
      sessionId: currentSession.id,
      observationId: currentObservation.id,
      quoteId: currentQuote.id,
      proposalDigest,
      outcome: receipt.outcome,
      encryptedPayload: envelope.ciphertext,
      payloadNonce: envelope.nonce,
      keyId: envelope.keyId,
      approvalState: receipt.outcome === "pending-approval" ? "pending" : "not-actionable",
      approvalExpiresAt,
      decidedAt: null,
      modelCallsAttempted: true,
      signingAttempted: false,
      executionAttempted: false,
      evaluatedAt: receipt.evaluatedAt,
    });
    if ((receipt.outcome === "halted" || receipt.outcome === "blocked") && currentSession.state === "active") {
      this.#database.haltAgentSession(
        currentSession.id,
        receipt.outcome === "halted" ? "ai-halt" : "policy-denial",
        evaluatedAt.toISOString(),
      );
    }
    const stored = this.#database.getAgentIntentEvaluation(receipt.id);
    if (stored === null) throw new Error("Agent evaluation was not persisted");
    return this.#hydrateEvaluation(stored);
  }

  async approve(id: string, expectedProposalDigest: string): Promise<AgentIntentEvaluationView> {
    const now = this.#now();
    this.#expire(now);
    const candidate = this.#database.getAgentIntentEvaluation(id);
    if (candidate === null) throw new Error("Agent intent evaluation does not exist");
    const session = this.#database.getAgentSession(candidate.sessionId);
    if (session === null || session.state !== "active" || Date.parse(session.deadlineAt) <= now.getTime()) {
      throw new Error("Agent session is no longer active");
    }
    return this.#hydrateEvaluation(this.#database.approveAgentIntent({
      id,
      expectedProposalDigest,
      decidedAt: now.toISOString(),
    }));
  }

  async reject(id: string, expectedProposalDigest: string): Promise<AgentIntentEvaluationView> {
    const now = this.#now();
    this.#expire(now);
    return this.#hydrateEvaluation(this.#database.rejectAgentIntent({
      id,
      expectedProposalDigest,
      decidedAt: now.toISOString(),
    }));
  }

  async list(): Promise<{ sessions: AgentSessionView[]; evaluations: AgentIntentEvaluationView[] }> {
    this.#expire(this.#now());
    return {
      sessions: await Promise.all(this.#database.listAgentSessions().map((record) => this.#hydrateSession(record))),
      evaluations: await Promise.all(this.#database.listAgentIntentEvaluations().map((record) => this.#hydrateEvaluation(record))),
    };
  }

  #expire(now: Date): void {
    this.#database.expireAgentSessions(now.toISOString());
    this.#database.expireAgentIntentApprovals(now.toISOString());
  }

  async #hydrateSession(record: AgentSessionStorageRecord): Promise<AgentSessionView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Agent session key is unsupported");
    const payload: unknown = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    }));
    return AgentSessionViewSchema.parse({
      ...(typeof payload === "object" && payload !== null ? payload : {}),
      state: record.state,
      haltedAt: record.haltedAt,
      haltReason: record.haltReason,
      executionEnabled: false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async #hydrateEvaluation(record: AgentIntentEvaluationStorageRecord): Promise<AgentIntentEvaluationView> {
    if (record.keyId !== "local-data-key-v1") throw new Error("Agent evaluation key is unsupported");
    const payload: unknown = JSON.parse(await this.#cipher.decryptString({
      ciphertext: record.encryptedPayload,
      nonce: record.payloadNonce,
      keyId: record.keyId,
    }));
    const sessionRecord = this.#database.getAgentSession(record.sessionId);
    if (sessionRecord === null) throw new Error("Agent evaluation session does not exist");
    const view = AgentIntentEvaluationViewSchema.parse({
      ...(typeof payload === "object" && payload !== null ? payload : {}),
      session: await this.#hydrateSession(sessionRecord),
      approval: {
        state: record.approvalState,
        expiresAt: record.approvalExpiresAt,
        decidedAt: record.decidedAt,
        executionEnabled: false,
      },
    });
    if (
      view.receipt.id !== record.id || view.receipt.sessionId !== record.sessionId
      || view.receipt.observationId !== record.observationId || view.quote.id !== record.quoteId
      || view.receipt.proposalDigest !== record.proposalDigest || view.receipt.outcome !== record.outcome
    ) throw new Error("Agent evaluation metadata mismatch");
    return view;
  }
}
