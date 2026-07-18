import type {
  AiShadowTradeEvaluationDenialCode,
  AiShadowTradeProposalV1,
  AgentIntentDenialCode,
  AgentIntentProposalV1,
  AgentSessionView,
  DcaPlanV1,
  DcaSimulationRequest,
  DcaSimulationResponse,
  DeskRuleDenialCode,
  DeskRuleSnapshot,
  JupiterShadowQuoteView,
  MarketObservationView,
} from "@silfable/contracts";

export type AiShadowTradeEvaluation = {
  outcome: "hold" | "would-execute" | "blocked";
  denialCodes: AiShadowTradeEvaluationDenialCode[];
  signingAttempted: false;
  executionAttempted: false;
};

export function evaluateAiShadowTradeProposal(input: {
  proposal: AiShadowTradeProposalV1;
  quote: JupiterShadowQuoteView;
  now: Date;
}): AiShadowTradeEvaluation {
  const { proposal, quote, now } = input;
  const denialCodes: AiShadowTradeEvaluationDenialCode[] = [];

  if (!quote.allowed || quote.denialCodes.length > 0) denialCodes.push("quote-not-allowed");
  if (new Date(quote.expiresAt).getTime() <= now.getTime()) denialCodes.push("quote-expired");
  if (quote.transactionReturned) denialCodes.push("transaction-returned");
  if (
    proposal.quoteId !== quote.id ||
    proposal.direction !== quote.direction ||
    proposal.inAmount !== quote.inAmount
  ) {
    denialCodes.push("proposal-quote-mismatch");
  }

  return {
    outcome: denialCodes.length > 0
      ? "blocked"
      : proposal.action === "hold"
        ? "hold"
        : "would-execute",
    denialCodes,
    signingAttempted: false,
    executionAttempted: false,
  };
}

export type AgentIntentEvaluation = {
  outcome: "pending-approval" | "hold" | "halted" | "blocked";
  denialCodes: AgentIntentDenialCode[];
  signingAttempted: false;
  executionAttempted: false;
};

export function evaluateAgentIntent(input: {
  session: AgentSessionView;
  observation: MarketObservationView;
  quote: JupiterShadowQuoteView;
  proposal: AgentIntentProposalV1;
  now: Date;
}): AgentIntentEvaluation {
  const { session, observation, quote, proposal, now } = input;
  const denialCodes: AgentIntentDenialCode[] = [];
  const actionable = proposal.action === "buy-sol" || proposal.action === "sell-sol";

  if (session.state !== "active") denialCodes.push("session-not-active");
  if (Date.parse(session.deadlineAt) <= now.getTime()) denialCodes.push("session-expired");
  if (observation.freshnessStatus !== "fresh" || Date.parse(observation.provenance.expiresAt) <= now.getTime()) {
    denialCodes.push("observation-stale");
  }
  if (observation.primaryQuoteId !== quote.id || proposal.quoteId !== quote.id) {
    denialCodes.push("observation-quote-mismatch");
  }
  if (!quote.allowed || quote.denialCodes.length > 0) denialCodes.push("quote-not-allowed");
  if (Date.parse(quote.expiresAt) <= now.getTime()) denialCodes.push("quote-expired");
  if (quote.transactionReturned) denialCodes.push("transaction-returned");
  if (proposal.sessionId !== session.id || proposal.observationId !== observation.id) {
    denialCodes.push("proposal-binding-mismatch");
  }

  const expectedNotional = proposal.action === "buy-sol"
    ? (quote.direction === "usdc-to-sol" ? BigInt(quote.inAmount) : null)
    : proposal.action === "sell-sol"
      ? (quote.direction === "sol-to-usdc" ? BigInt(quote.outAmount) : null)
      : 0n;
  if (expectedNotional === null) denialCodes.push("action-direction-mismatch");
  else if (BigInt(proposal.notionalUsdcMicros) !== expectedNotional) denialCodes.push("notional-mismatch");
  if (actionable && BigInt(proposal.notionalUsdcMicros) > BigInt(session.maxActionNotionalUsdcMicros)) {
    denialCodes.push("capital-cap-exceeded");
  }
  if (actionable && observation.market.priceImpactBps > session.maxPriceImpactBps) {
    denialCodes.push("price-impact-exceeded");
  }
  if (actionable && observation.market.volatility.rangeBps === null) denialCodes.push("volatility-unavailable");
  else if (actionable && (observation.market.volatility.rangeBps ?? 0) > session.maxVolatilityBps) {
    denialCodes.push("volatility-exceeded");
  }

  return {
    outcome: denialCodes.length > 0
      ? "blocked"
      : proposal.action === "hold"
        ? "hold"
        : proposal.action === "halt"
          ? "halted"
          : "pending-approval",
    denialCodes,
    signingAttempted: false,
    executionAttempted: false,
  };
}

export type MissionHaltReason =
  | "network-offline"
  | "observation-stale"
  | "quote-expired"
  | "desk-rule-denied"
  | "simulation-failed"
  | "receipt-store-unavailable"
  | "keystore-locked"
  | "manual";

export type DcaScheduleDecision =
  | { action: "wait"; dueAt: Date }
  | { action: "execute"; cycle: number; dueAt: Date }
  | { action: "skip"; cycle: number; dueAt: Date; reason: "missed-cycle" }
  | { action: "complete" };

export function decideNextDcaAction(input: {
  plan: DcaPlanV1;
  completedCycles: number;
  now: Date;
  lastSchedulerTickAt: Date;
}): DcaScheduleDecision {
  const { plan, completedCycles, now } = input;

  if (plan.maxCycles !== undefined && completedCycles >= plan.maxCycles) {
    return { action: "complete" };
  }

  const startAt = new Date(plan.startAt);
  const dueAt = new Date(startAt.getTime() + completedCycles * plan.intervalSeconds * 1_000);

  if (plan.endAt !== undefined && dueAt > new Date(plan.endAt)) {
    return { action: "complete" };
  }

  if (now < dueAt) {
    return { action: "wait", dueAt };
  }

  if (now.getTime() - dueAt.getTime() <= plan.intervalSeconds * 1_000) {
    return { action: "execute", cycle: completedCycles + 1, dueAt };
  }

  return { action: "skip", cycle: completedCycles + 1, dueAt, reason: "missed-cycle" };
}

export function evaluateDeskRules(input: {
  plan: DcaPlanV1;
  snapshot: DeskRuleSnapshot;
  now: Date;
  maxObservationAgeMs?: number;
}): DeskRuleDenialCode[] {
  const { plan, snapshot, now, maxObservationAgeMs = 30_000 } = input;
  const denials: DeskRuleDenialCode[] = [];
  const observedAt = new Date(snapshot.observedAt);
  const quoteExpiresAt = new Date(snapshot.quoteExpiresAt);

  if (plan.profile !== "devnet-simulation") denials.push("profile-not-simulation");
  if (snapshot.networkHealth !== "healthy") denials.push("network-unhealthy");
  if (!snapshot.keystoreUnlocked) denials.push("keystore-locked");
  if (snapshot.globalKillSwitch || snapshot.missionKillSwitch) denials.push("kill-switch-active");
  if (!snapshot.inputMintAllowed || !snapshot.outputMintAllowed) denials.push("mint-denied");
  if (!snapshot.marketEligible) denials.push("market-ineligible");

  const observationAgeMs = now.getTime() - observedAt.getTime();
  if (observationAgeMs < 0 || observationAgeMs > maxObservationAgeMs) denials.push("observation-stale");
  if (quoteExpiresAt.getTime() <= now.getTime()) denials.push("quote-expired");

  if (
    (plan.minPrice !== undefined && compareDecimalStrings(snapshot.price, plan.minPrice) < 0) ||
    (plan.maxPrice !== undefined && compareDecimalStrings(snapshot.price, plan.maxPrice) > 0)
  ) {
    denials.push("price-outside-range");
  }

  if (snapshot.priceImpactBps > plan.maxPriceImpactBps) denials.push("price-impact-exceeded");
  if (BigInt(snapshot.feeLamports) > BigInt(plan.maxFeeLamports)) denials.push("fee-exceeded");

  const amount = BigInt(plan.amountPerCycleAtomic);
  if (BigInt(snapshot.spentTodayAtomic) + amount > BigInt(plan.dailySpendLimitAtomic)) {
    denials.push("daily-spend-exceeded");
  }
  if (
    BigInt(snapshot.walletBalanceAtomic) < amount ||
    BigInt(snapshot.walletBalanceAtomic) - amount < BigInt(plan.minimumWalletReserveAtomic)
  ) {
    denials.push("wallet-reserve-breached");
  }
  if (!snapshot.simulationSucceeded) denials.push("simulation-failed");

  return denials;
}

export function simulateDcaCycle(request: DcaSimulationRequest): DcaSimulationResponse {
  const schedule = decideNextDcaAction({
    plan: request.plan,
    completedCycles: request.completedCycles,
    now: new Date(request.now),
    lastSchedulerTickAt: new Date(request.lastSchedulerTickAt),
  });
  const base = {
    schemaVersion: 1 as const,
    requestId: request.requestId,
    schedulerAction: schedule.action,
    denialCodes: [] as DeskRuleDenialCode[],
    signingAttempted: false as const,
  };

  if (schedule.action === "complete") return { ...base, outcome: "complete" };
  if (schedule.action === "wait") {
    return { ...base, outcome: "not-due", dueAt: schedule.dueAt.toISOString() };
  }
  if (schedule.action === "skip") {
    return {
      ...base,
      outcome: "skipped",
      cycle: schedule.cycle,
      dueAt: schedule.dueAt.toISOString(),
    };
  }

  const denialCodes = evaluateDeskRules({
    plan: request.plan,
    snapshot: request.snapshot,
    now: new Date(request.now),
  });

  return {
    ...base,
    outcome: denialCodes.length === 0 ? "would-execute" : "halted",
    cycle: schedule.cycle,
    dueAt: schedule.dueAt.toISOString(),
    denialCodes,
  };
}

function compareDecimalStrings(left: string, right: string): number {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(leftWhole + leftFraction.padEnd(scale, "0"));
  const rightScaled = BigInt(rightWhole + rightFraction.padEnd(scale, "0"));
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}
