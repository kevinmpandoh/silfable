import assert from "node:assert/strict";
import test from "node:test";

import {
  AiDraftDcaRequestSchema,
  AiApproveShadowTradeRequestSchema,
  AiProposeShadowTradeRequestSchema,
  AiRejectShadowTradeRequestSchema,
  AgentCreateSessionRequestSchema,
  AgentEvaluateObservationRequestSchema,
  AgentApproveIntentRequestSchema,
  AgentHaltSessionRequestSchema,
  AgentSimulateDevnetIntentRequestSchema,
  AgentArmDevnetSigningRequestSchema,
  AgentRevokeDevnetSigningArmRequestSchema,
  AgentPrepareDevnetExecutionRequestSchema,
  AgentDevnetPreSignExecutionViewSchema,
  AgentSignDevnetExecutionRequestSchema,
  AgentDevnetSignedExecutionViewSchema,
  AgentBroadcastDevnetExecutionRequestSchema,
  AgentDevnetBroadcastExecutionViewSchema,
  DevnetFixtureProvisionExecuteRequestSchema,
  DevnetFixtureReviewActivateRequestSchema,
  DevnetFixtureTransferExecuteRequestSchema,
  DevnetFixtureTransferApproveRequestSchema,
  GuardedMissionAuthorizeRequestSchema,
  GuardedMissionRevokeRequestSchema,
  GuardedSchedulerArmRequestSchema,
  GuardedSchedulerArmRevokeRequestSchema,
  GuardedExecutionViewSchema,
  IPC_CHANNELS,
  JupiterShadowQuoteRequestSchema,
  MarketCreateObservationRequestSchema,
  MarketCreateWatchRequestSchema,
  MarketPauseWatchRequestSchema,
  MissionCommandRequestSchema,
  TelemetryConsentRequestSchema,
  UpdateCommandRequestSchema,
  WalletUnlockRequestSchema,
} from "@silfable/contracts";

const requestId = "00000000-0000-4000-8000-000000000001";

test("every IPC channel is unique, namespaced, and non-generic", () => {
  const channels = Object.values(IPC_CHANNELS);
  assert.equal(new Set(channels).size, channels.length);
  for (const channel of channels) {
    assert.match(channel, /^[a-z]+:[a-z-]+$/u);
    assert.equal(["shell", "filesystem", "sql", "http", "eval"].includes(channel.split(":")[0] ?? ""), false);
  }
});

test("security-sensitive requests reject unknown privilege-shaped fields", () => {
  const cases = [
    [UpdateCommandRequestSchema, { schemaVersion: 1, requestId, url: "file:///etc/passwd" }],
    [TelemetryConsentRequestSchema, { schemaVersion: 1, requestId, consent: true, acknowledgedCrashOnly: true, uploadUrl: "https://evil.invalid" }],
    [WalletUnlockRequestSchema, { schemaVersion: 1, requestId, privateKey: "must-not-be-accepted" }],
    [DevnetFixtureProvisionExecuteRequestSchema, {
      schemaVersion: 1,
      requestId,
      acknowledgedCreatesDevnetMint: true,
      acknowledgedPaysNetworkFees: true,
      acknowledgedAuthorityRevocationIsPermanent: true,
      acknowledgedDoesNotEnableAutomaticTrading: true,
      destinationOwner: "renderer-must-not-select-fixture-accounts",
    }],
    [DevnetFixtureReviewActivateRequestSchema, {
      schemaVersion: 1,
      requestId,
      provisionId: requestId,
      acknowledgedFreshOnChainReview: true,
      acknowledgedGuardedDevnetOnly: true,
      acknowledgedAutomaticTradingRemainsDisabled: true,
      rpcEndpoint: "https://evil.invalid",
    }],
    [DevnetFixtureTransferExecuteRequestSchema, {
      schemaVersion: 1,
      requestId,
      acknowledgedUsesActiveReviewedFixture: true,
      acknowledgedFixedLowValueTransfer: true,
      acknowledgedPaysNetworkFee: true,
      acknowledgedAutomaticTradingRemainsDisabled: true,
      amountAtomic: "999999999",
    }],
    [DevnetFixtureTransferApproveRequestSchema, {
      schemaVersion: 1,
      requestId,
      transferId: requestId,
      acknowledgedReviewedExactReceipt: true,
      acknowledgedFreshOnChainConfirmation: true,
      acknowledgedAutomaticTradingRemainsDisabled: true,
      signature: "renderer-must-not-submit-signatures",
    }],
    [GuardedMissionAuthorizeRequestSchema, {
      schemaVersion: 1,
      requestId,
      missionId: requestId,
      expectedRevision: 1,
      expectedPlanDigest: "a".repeat(64),
      acknowledgedExactMissionRevision: true,
      acknowledgedDeskRuleLimits: true,
      acknowledgedDedicatedHotWallet: true,
      acknowledgedSchedulerSigningRemainsDisabled: true,
      schedulerSigningEnabled: true,
    }],
    [GuardedSchedulerArmRequestSchema, {
      schemaVersion: 1,
      requestId,
      authorizationId: requestId,
      acknowledgedAutomaticSigning: true,
      acknowledgedHotWallet: true,
      acknowledgedDevnetFixtureOnly: true,
      transactionBytes: "renderer-must-not-submit-transactions",
    }],
    [MissionCommandRequestSchema, { schemaVersion: 1, requestId, missionId: requestId, expectedRevision: 1, instruction: "arbitrary-solana-program" }],
    [AiDraftDcaRequestSchema, { schemaVersion: 1, requestId, provider: "openai", prompt: "Create a bounded DCA plan", acknowledgedExternalProcessing: true, tools: ["shell"] }],
    [AiProposeShadowTradeRequestSchema, {
      schemaVersion: 1,
      requestId,
      provider: "openai",
      quoteId: "00000000-0000-4000-8000-000000000002",
      objective: "Preserve capital unless the exact observed route is compelling",
      acknowledgedExternalProcessing: true,
      acknowledgedQuoteOnly: true,
      transaction: "renderer-must-not-submit-transaction-material",
    }],
    [AiApproveShadowTradeRequestSchema, {
      schemaVersion: 1,
      requestId,
      evaluationId: "00000000-0000-4000-8000-000000000002",
      expectedProposalDigest: "a".repeat(64),
      acknowledgedIntentOnly: true,
      acknowledgedFreshQuoteRequired: true,
      acknowledgedNoExecution: true,
      transaction: "renderer-must-not-submit-transaction-material",
    }],
    [AiRejectShadowTradeRequestSchema, {
      schemaVersion: 1,
      requestId,
      evaluationId: "00000000-0000-4000-8000-000000000002",
      expectedProposalDigest: "a".repeat(64),
      acknowledgedRejectionOrRevocation: true,
      signingEnabled: true,
    }],
    [JupiterShadowQuoteRequestSchema, {
      schemaVersion: 1,
      requestId,
      direction: "sol-to-usdc",
      amountAtomic: "1",
      slippageBps: 50,
      maxPriceImpactBps: 100,
      maxFeeBps: 50,
      acknowledgedQuoteOnly: true,
      taker: "wallet-address-must-not-be-accepted",
    }],
    [MarketCreateObservationRequestSchema, {
      schemaVersion: 1,
      requestId,
      quoteId: "00000000-0000-4000-8000-000000000002",
      acknowledgedObservationOnly: true,
      walletAddress: "renderer-must-not-select-mainnet-wallet",
    }],
    [MarketCreateWatchRequestSchema, {
      schemaVersion: 1,
      requestId,
      direction: "sol-to-usdc",
      condition: "price-at-or-below",
      thresholdPriceMicros: "150000000",
      maxPriceImpactBps: 50,
      intervalSeconds: 300,
      acknowledgedBackgroundMarketData: true,
      acknowledgedZeroAiCallsWhileSleeping: true,
      acknowledgedNoExecution: true,
      model: "renderer-must-not-select-a-model",
    }],
    [MarketPauseWatchRequestSchema, {
      schemaVersion: 1,
      requestId,
      watchId: "00000000-0000-4000-8000-000000000002",
      acknowledgedImmediatePause: true,
      executeOnTrigger: true,
    }],
    [AgentCreateSessionRequestSchema, {
      schemaVersion: 1,
      requestId,
      provider: "openai",
      objective: "Protect capital with conservative SOL observations only.",
      maxActionNotionalUsdcMicros: "20000000",
      maxPriceImpactBps: 50,
      maxVolatilityBps: 100,
      deadlineAt: "2026-07-18T01:00:00.000Z",
      acknowledgedExternalAiProcessing: true,
      acknowledgedPerActionApproval: true,
      acknowledgedNoExecution: true,
      privateKey: "renderer-must-not-provide-wallet-material",
    }],
    [AgentEvaluateObservationRequestSchema, {
      schemaVersion: 1,
      requestId,
      sessionId: "00000000-0000-4000-8000-000000000002",
      observationId: "00000000-0000-4000-8000-000000000003",
      acknowledgedExternalAiProcessing: true,
      acknowledgedIntentOnly: true,
      transaction: "renderer-must-not-provide-transaction",
    }],
    [AgentApproveIntentRequestSchema, {
      schemaVersion: 1,
      requestId,
      evaluationId: "00000000-0000-4000-8000-000000000002",
      expectedProposalDigest: "a".repeat(64),
      acknowledgedIntentOnly: true,
      acknowledgedFreshQuoteRequired: true,
      acknowledgedNoExecution: true,
      executionEnabled: true,
    }],
    [AgentSimulateDevnetIntentRequestSchema, {
      schemaVersion: 1,
      requestId,
      evaluationId: "00000000-0000-4000-8000-000000000002",
      expectedProposalDigest: "a".repeat(64),
      acknowledgedDevnetFixtureProofOnly: true,
      acknowledgedNoEconomicValueMapping: true,
      acknowledgedNoSigningOrBroadcast: true,
      signingEnabled: true,
    }],
    [AgentArmDevnetSigningRequestSchema, {
      schemaVersion: 1,
      requestId,
      simulationId: "00000000-0000-4000-8000-000000000002",
      expectedProposalDigest: "a".repeat(64),
      expectedMessageHash: "b".repeat(64),
      acknowledgedOneShotDevnetSigning: true,
      acknowledgedDedicatedHotWallet: true,
      acknowledgedNoMarketSwapOrEconomicMapping: true,
      transactionBytes: "renderer-must-not-provide-an-executable-message",
    }],
    [AgentRevokeDevnetSigningArmRequestSchema, {
      schemaVersion: 1,
      requestId,
      signingArmId: "00000000-0000-4000-8000-000000000002",
      acknowledgedImmediateRevocation: true,
      preserveSigningAuthority: true,
    }],
    [AgentPrepareDevnetExecutionRequestSchema, {
      schemaVersion: 1, requestId, signingArmId: "00000000-0000-4000-8000-000000000002",
      expectedMessageHash: "a".repeat(64), acknowledgedConsumesOneShotArm: true,
      acknowledgedPreSignOnly: true, acknowledgedNoSigningOrBroadcast: true,
      transactionBytes: "renderer-must-not-provide-exact-wire",
    }],
    [AgentSignDevnetExecutionRequestSchema, {
      schemaVersion: 1, requestId, preSignExecutionId: "00000000-0000-4000-8000-000000000002",
      expectedMessageHash: "a".repeat(64), acknowledgedExactFixtureSignature: true,
      acknowledgedConsumesReadyReceipt: true, acknowledgedNoBroadcastOrMarketSwap: true,
      privateKey: "renderer-must-not-provide-signing-material",
    }],
    [AgentBroadcastDevnetExecutionRequestSchema, {
      schemaVersion: 1, requestId, signedExecutionId: "00000000-0000-4000-8000-000000000002",
      expectedMessageHash: "a".repeat(64), expectedSignatureHash: "b".repeat(64),
      acknowledgedDevnetFeeAndFixtureTransfer: true, acknowledgedNoAutomaticRetry: true,
      acknowledgedNoMarketSwapOrMainnet: true, signedWire: "renderer-must-not-provide-wire",
    }],
  ] as const;
  for (const [schema, value] of cases) assert.equal(schema.safeParse(value).success, false);
});

test("acknowledgements cannot be omitted or replaced with truthy strings", () => {
  assert.equal(TelemetryConsentRequestSchema.safeParse({ schemaVersion: 1, requestId, consent: true }).success, false);
  assert.equal(TelemetryConsentRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    consent: true,
    acknowledgedCrashOnly: "true",
  }).success, false);
  assert.equal(DevnetFixtureProvisionExecuteRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    acknowledgedCreatesDevnetMint: true,
    acknowledgedPaysNetworkFees: true,
    acknowledgedAuthorityRevocationIsPermanent: "true",
    acknowledgedDoesNotEnableAutomaticTrading: true,
  }).success, false);
  assert.equal(DevnetFixtureReviewActivateRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    provisionId: requestId,
    acknowledgedFreshOnChainReview: true,
    acknowledgedGuardedDevnetOnly: true,
    acknowledgedAutomaticTradingRemainsDisabled: 1,
  }).success, false);
  assert.equal(DevnetFixtureTransferExecuteRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    acknowledgedUsesActiveReviewedFixture: true,
    acknowledgedFixedLowValueTransfer: "true",
    acknowledgedPaysNetworkFee: true,
    acknowledgedAutomaticTradingRemainsDisabled: true,
  }).success, false);
  assert.equal(DevnetFixtureTransferApproveRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    transferId: requestId,
    acknowledgedReviewedExactReceipt: true,
    acknowledgedFreshOnChainConfirmation: 1,
    acknowledgedAutomaticTradingRemainsDisabled: true,
  }).success, false);
  assert.equal(GuardedMissionAuthorizeRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    missionId: requestId,
    expectedRevision: 1,
    expectedPlanDigest: "a".repeat(64),
    acknowledgedExactMissionRevision: true,
    acknowledgedDeskRuleLimits: true,
    acknowledgedDedicatedHotWallet: true,
    acknowledgedSchedulerSigningRemainsDisabled: "true",
  }).success, false);
  assert.equal(GuardedMissionRevokeRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    authorizationId: requestId,
    acknowledgedRevocation: 1,
  }).success, false);
  assert.equal(GuardedSchedulerArmRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    authorizationId: requestId,
    acknowledgedAutomaticSigning: "true",
    acknowledgedHotWallet: true,
    acknowledgedDevnetFixtureOnly: true,
  }).success, false);
  assert.equal(GuardedSchedulerArmRevokeRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    schedulerArmId: requestId,
    acknowledgedImmediateRevocation: 1,
  }).success, false);
  assert.equal(AiApproveShadowTradeRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    evaluationId: "00000000-0000-4000-8000-000000000002",
    expectedProposalDigest: "a".repeat(64),
    acknowledgedIntentOnly: true,
    acknowledgedFreshQuoteRequired: true,
    acknowledgedNoExecution: "true",
  }).success, false);
  assert.equal(AiRejectShadowTradeRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    evaluationId: "00000000-0000-4000-8000-000000000002",
    expectedProposalDigest: "a".repeat(64),
  }).success, false);
  assert.equal(MarketCreateObservationRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    quoteId: "00000000-0000-4000-8000-000000000002",
    acknowledgedObservationOnly: "true",
  }).success, false);
  assert.equal(MarketCreateWatchRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    direction: "sol-to-usdc",
    condition: "price-at-or-below",
    thresholdPriceMicros: "150000000",
    maxPriceImpactBps: 50,
    intervalSeconds: 300,
    acknowledgedBackgroundMarketData: true,
    acknowledgedZeroAiCallsWhileSleeping: true,
    acknowledgedNoExecution: "true",
  }).success, false);
  assert.equal(MarketPauseWatchRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    watchId: "00000000-0000-4000-8000-000000000002",
  }).success, false);
  assert.equal(AgentCreateSessionRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    provider: "openai",
    objective: "Protect capital with conservative SOL observations only.",
    maxActionNotionalUsdcMicros: "20000000",
    maxPriceImpactBps: 50,
    maxVolatilityBps: 100,
    deadlineAt: "2026-07-18T01:00:00.000Z",
    acknowledgedExternalAiProcessing: true,
    acknowledgedPerActionApproval: true,
    acknowledgedNoExecution: "true",
  }).success, false);
  assert.equal(AgentHaltSessionRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    sessionId: "00000000-0000-4000-8000-000000000002",
  }).success, false);
  assert.equal(AgentSimulateDevnetIntentRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    evaluationId: "00000000-0000-4000-8000-000000000002",
    expectedProposalDigest: "a".repeat(64),
    acknowledgedDevnetFixtureProofOnly: true,
    acknowledgedNoEconomicValueMapping: true,
    acknowledgedNoSigningOrBroadcast: "true",
  }).success, false);
  assert.equal(AgentArmDevnetSigningRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    simulationId: "00000000-0000-4000-8000-000000000002",
    expectedProposalDigest: "a".repeat(64),
    expectedMessageHash: "b".repeat(64),
    acknowledgedOneShotDevnetSigning: true,
    acknowledgedDedicatedHotWallet: true,
    acknowledgedNoMarketSwapOrEconomicMapping: "true",
  }).success, false);
  assert.equal(AgentRevokeDevnetSigningArmRequestSchema.safeParse({
    schemaVersion: 1,
    requestId,
    signingArmId: "00000000-0000-4000-8000-000000000002",
    acknowledgedImmediateRevocation: 1,
  }).success, false);
  assert.equal(AgentPrepareDevnetExecutionRequestSchema.safeParse({
    schemaVersion: 1, requestId, signingArmId: "00000000-0000-4000-8000-000000000002",
    expectedMessageHash: "a".repeat(64), acknowledgedConsumesOneShotArm: true,
    acknowledgedPreSignOnly: true, acknowledgedNoSigningOrBroadcast: "true",
  }).success, false);
  assert.equal(AgentSignDevnetExecutionRequestSchema.safeParse({
    schemaVersion: 1, requestId, preSignExecutionId: "00000000-0000-4000-8000-000000000002",
    expectedMessageHash: "a".repeat(64), acknowledgedExactFixtureSignature: true,
    acknowledgedConsumesReadyReceipt: true, acknowledgedNoBroadcastOrMarketSwap: "true",
  }).success, false);
  assert.equal(AgentBroadcastDevnetExecutionRequestSchema.safeParse({
    schemaVersion: 1, requestId, signedExecutionId: "00000000-0000-4000-8000-000000000002",
    expectedMessageHash: "a".repeat(64), expectedSignatureHash: "b".repeat(64),
    acknowledgedDevnetFeeAndFixtureTransfer: true, acknowledgedNoAutomaticRetry: true,
    acknowledgedNoMarketSwapOrMainnet: "true",
  }).success, false);
});

test("public agent pre-sign receipts reject wire, signatures, and execution claims", () => {
  const view = {
    schemaVersion: 1, id: requestId, signingArmId: "00000000-0000-4000-8000-000000000002",
    simulationId: "00000000-0000-4000-8000-000000000003", evaluationId: "00000000-0000-4000-8000-000000000004",
    sessionId: "00000000-0000-4000-8000-000000000005", proposalDigest: "a".repeat(64),
    fixtureManifestDigest: "b".repeat(64), messageHash: "c".repeat(64), state: "ready-for-signing",
    failureCode: null, signingArmConsumed: true, exactMessageRevalidated: true,
    executionBridgeConnected: false, signingAttempted: false, broadcastAttempted: false,
    executionAttempted: false, marketSwapPerformed: false, mainnetEnabled: false,
    preparedAt: "2026-07-18T00:00:00.000Z",
  };
  assert.equal(AgentDevnetPreSignExecutionViewSchema.safeParse(view).success, true);
  assert.equal(AgentDevnetPreSignExecutionViewSchema.safeParse({ ...view, wireTransaction: "secret" }).success, false);
  assert.equal(AgentDevnetPreSignExecutionViewSchema.safeParse({ ...view, signingAttempted: true }).success, false);
});

test("public signed agent receipts expose only a signature hash and reject signed wire", () => {
  const view = { schemaVersion: 1, id: requestId, preSignExecutionId: "00000000-0000-4000-8000-000000000002",
    signingArmId: "00000000-0000-4000-8000-000000000003", simulationId: "00000000-0000-4000-8000-000000000004",
    evaluationId: "00000000-0000-4000-8000-000000000005", sessionId: "00000000-0000-4000-8000-000000000006",
    messageHash: "a".repeat(64), state: "signed-awaiting-broadcast", signatureHash: "b".repeat(64), failureCode: null,
    signingAttempted: true, broadcastAttempted: false, executionAttempted: false,
    marketSwapPerformed: false, mainnetEnabled: false, createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:01.000Z" };
  assert.equal(AgentDevnetSignedExecutionViewSchema.safeParse(view).success, true);
  assert.equal(AgentDevnetSignedExecutionViewSchema.safeParse({ ...view, signedWire: "secret" }).success, false);
  assert.equal(AgentDevnetSignedExecutionViewSchema.safeParse({ ...view, broadcastAttempted: true }).success, false);
});

test("public agent broadcast receipts expose hashes but reject transaction material and Mainnet claims", () => {
  const view = { schemaVersion: 1, id: requestId, signedExecutionId: "00000000-0000-4000-8000-000000000002",
    preSignExecutionId: "00000000-0000-4000-8000-000000000003", simulationId: "00000000-0000-4000-8000-000000000004",
    evaluationId: "00000000-0000-4000-8000-000000000005", sessionId: "00000000-0000-4000-8000-000000000006",
    messageHash: "a".repeat(64), signatureHash: "b".repeat(64), state: "confirmed", failureCode: null,
    broadcastAttempted: true, executionAttempted: true, fixtureTransferPerformed: true,
    economicValueMapping: "none", marketSwapPerformed: false, mainnetEnabled: false,
    createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:01.000Z" };
  assert.equal(AgentDevnetBroadcastExecutionViewSchema.safeParse(view).success, true);
  assert.equal(AgentDevnetBroadcastExecutionViewSchema.safeParse({ ...view, signedWire: "secret" }).success, false);
  assert.equal(AgentDevnetBroadcastExecutionViewSchema.safeParse({ ...view, mainnetEnabled: true }).success, false);
  assert.equal(AgentDevnetBroadcastExecutionViewSchema.safeParse({ ...view, marketSwapPerformed: true }).success, false);
});

test("public guarded execution receipts reject signatures and transaction evidence", () => {
  const receipt = {
    schemaVersion: 1,
    id: requestId,
    missionId: "00000000-0000-4000-8000-000000000002",
    missionRevision: 1,
    cycle: 1,
    fixtureManifestDigest: "a".repeat(64),
    state: "receipted",
    signingAttempted: true,
    broadcastAttempted: true,
    failureCode: null,
    marketSwapPerformed: false,
    mainnetEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [{
      id: "00000000-0000-4000-8000-000000000003",
      fromState: null,
      toState: "proposed",
      eventName: "proposal-created",
      createdAt: new Date().toISOString(),
    }],
  };
  assert.equal(GuardedExecutionViewSchema.safeParse(receipt).success, true);
  assert.equal(GuardedExecutionViewSchema.safeParse({
    ...receipt,
    signature: "must-remain-encrypted",
    wireTransaction: "must-remain-encrypted",
  }).success, false);
});
