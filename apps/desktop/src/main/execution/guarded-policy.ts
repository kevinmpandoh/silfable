import {
  DcaPlanV1Schema,
  GuardedDevnetProposalSchema,
  GuardedDevnetSimulationSchema,
  GuardedDevnetValidationSchema,
  type DcaPlanV1,
  type GuardedDevnetDenialCode,
  type GuardedDevnetProposal,
  type GuardedDevnetSimulation,
  type GuardedDevnetValidation,
} from "@silfable/contracts";

export const GUARDED_DEVNET_PROGRAM_ALLOWLIST = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ComputeBudget111111111111111111111111111111",
]);

export type GuardedDeskRuleContext = {
  missionId: string;
  missionRevision: number;
  planDigest: string;
  fixtureManifestDigest: string;
  cycle: number;
  plan: DcaPlanV1;
  proposal: GuardedDevnetProposal;
  simulation?: GuardedDevnetSimulation;
  now: Date;
  networkHealthy: boolean;
  keystoreUnlocked: boolean;
  globalKillSwitch: boolean;
  missionKillSwitch: boolean;
  fixtureProvenanceAllowed: boolean;
  walletBalanceAtomic: string;
  spentTodayAtomic: string;
};

export function validateGuardedDevnet(
  stage: "pre-simulation" | "pre-sign",
  untrusted: GuardedDeskRuleContext,
): GuardedDevnetValidation {
  const plan = DcaPlanV1Schema.parse(untrusted.plan);
  const proposal = GuardedDevnetProposalSchema.parse(untrusted.proposal);
  const simulation = untrusted.simulation === undefined ? undefined : GuardedDevnetSimulationSchema.parse(untrusted.simulation);
  const denials: GuardedDevnetDenialCode[] = [];

  if (plan.profile !== "devnet-simulation") denials.push("profile-invalid");
  if (!untrusted.fixtureProvenanceAllowed || proposal.fixtureManifestDigest !== untrusted.fixtureManifestDigest) {
    denials.push("fixture-provenance-invalid");
  }
  if (
    proposal.missionId !== untrusted.missionId ||
    proposal.missionRevision !== untrusted.missionRevision ||
    proposal.planDigest !== untrusted.planDigest ||
    proposal.cycle !== untrusted.cycle
  ) denials.push("mission-context-mismatch");
  if (proposal.inputMint !== plan.inputMint || proposal.outputMint !== plan.outputMint) denials.push("mint-mismatch");
  if (proposal.inputAmountAtomic !== plan.amountPerCycleAtomic) denials.push("amount-mismatch");
  const expectedMinimumOutput =
    BigInt(proposal.quotedOutputAtomic) * BigInt(10_000 - proposal.slippageBps) / 10_000n;
  if (BigInt(proposal.minimumOutputAtomic) !== expectedMinimumOutput) denials.push("quote-invalid");
  const observationAge = untrusted.now.getTime() - new Date(proposal.observedAt).getTime();
  if (observationAge < 0 || observationAge > 30_000) denials.push("quote-stale");
  if (new Date(proposal.expiresAt).getTime() <= untrusted.now.getTime()) denials.push("quote-expired");
  if (proposal.slippageBps > plan.maxSlippageBps) denials.push("slippage-exceeded");
  if (proposal.priceImpactBps > plan.maxPriceImpactBps) denials.push("price-impact-exceeded");
  if (!untrusted.networkHealthy) denials.push("network-unhealthy");
  if (!untrusted.keystoreUnlocked) denials.push("keystore-locked");
  if (untrusted.globalKillSwitch || untrusted.missionKillSwitch) denials.push("kill-switch-active");
  if (BigInt(untrusted.spentTodayAtomic) + BigInt(plan.amountPerCycleAtomic) > BigInt(plan.dailySpendLimitAtomic)) {
    denials.push("daily-spend-exceeded");
  }
  if (
    BigInt(untrusted.walletBalanceAtomic) < BigInt(plan.amountPerCycleAtomic) ||
    BigInt(untrusted.walletBalanceAtomic) - BigInt(plan.amountPerCycleAtomic) < BigInt(plan.minimumWalletReserveAtomic)
  ) denials.push("wallet-reserve-breached");

  if (stage === "pre-sign") {
    if (simulation === undefined) {
      denials.push("simulation-missing");
    } else {
      if (!simulation.succeeded) denials.push("simulation-failed");
      if (simulation.proposalId !== proposal.id) denials.push("proposal-mismatch");
      if (simulation.fixtureManifestDigest !== proposal.fixtureManifestDigest) denials.push("fixture-provenance-invalid");
      if (BigInt(simulation.feeLamports) > BigInt(plan.maxFeeLamports)) denials.push("fee-exceeded");
      if (simulation.programIds.some((programId) => !GUARDED_DEVNET_PROGRAM_ALLOWLIST.has(programId))) {
        denials.push("program-denied");
      }
      if (
        simulation.inputDebitAtomic !== proposal.inputAmountAtomic ||
        BigInt(simulation.outputCreditAtomic) < BigInt(proposal.minimumOutputAtomic)
      ) denials.push("balance-delta-invalid");
    }
  }

  const uniqueDenials = [...new Set(denials)];
  return GuardedDevnetValidationSchema.parse({
    schemaVersion: 1,
    stage,
    proposalId: proposal.id,
    fixtureManifestDigest: proposal.fixtureManifestDigest,
    allowed: uniqueDenials.length === 0,
    signingAllowed: stage === "pre-sign" && uniqueDenials.length === 0,
    denialCodes: uniqueDenials,
    validatedAt: untrusted.now.toISOString(),
  });
}

export type GuardedExecutionState =
  | "proposed"
  | "validated"
  | "simulated"
  | "signed"
  | "broadcast"
  | "confirmed"
  | "receipted"
  | "failed"
  | "ambiguous";

export type GuardedExecutionEvent =
  | "validation-passed"
  | "simulation-passed"
  | "signed"
  | "broadcast-attempted"
  | "confirmed"
  | "receipt-stored"
  | "pre-broadcast-failure"
  | "post-broadcast-failure";

const TRANSITIONS: Record<GuardedExecutionState, Partial<Record<GuardedExecutionEvent, GuardedExecutionState>>> = {
  proposed: { "validation-passed": "validated", "pre-broadcast-failure": "failed" },
  validated: { "simulation-passed": "simulated", "pre-broadcast-failure": "failed" },
  simulated: { signed: "signed", "pre-broadcast-failure": "failed" },
  signed: { "broadcast-attempted": "broadcast", "pre-broadcast-failure": "failed" },
  broadcast: { confirmed: "confirmed", "post-broadcast-failure": "ambiguous" },
  confirmed: { "receipt-stored": "receipted", "post-broadcast-failure": "ambiguous" },
  receipted: {},
  failed: {},
  ambiguous: { confirmed: "confirmed" },
};

export function transitionGuardedExecution(
  state: GuardedExecutionState,
  event: GuardedExecutionEvent,
): GuardedExecutionState {
  const next = TRANSITIONS[state][event];
  if (next === undefined) throw new Error(`Invalid guarded execution transition: ${state} -> ${event}`);
  return next;
}
