import assert from "node:assert/strict";
import test from "node:test";

import {
  AiChatRequestSchema,
  AiSaveProviderRequestSchema,
  ClipboardWriteTransactionSignatureRequestSchema,
  ExternalOpenTransactionRequestSchema,
  EmergencyStopEngageRequestSchema,
  EmergencyStopReleaseRequestSchema,
  EmergencyStopStatusSchema,
  IPC_CHANNELS,
  JupiterSaveKeyRequestSchema,
  RobinhoodSaveRpcUrlRequestSchema,
  RobinhoodSaveZeroXKeyRequestSchema,
  RobinhoodWalletCreateRequestSchema,
  RobinhoodWalletImportMnemonicRequestSchema,
  MissionSimulateRequestSchema,
  MissionExecuteRequestSchema,
  MissionVerifyExecutionRequestSchema,
  PumpFinalRevalidateRequestSchema,
  PumpExecuteRequestSchema,
  PumpVerifyExecutionRequestSchema,
  PumpSimulateRequestSchema,
  PumpDiscoverySnapshotSchema,
  PumpRiskSettingsSaveRequestSchema,
  RuntimeStatusSchema,
  SecurityConfigurePasswordRequestSchema,
  SecurityResetVaultRequestSchema,
  SessionUpsertRequestSchema,
  SecurityUnlockRequestSchema,
  WalletImportPrivateKeyRequestSchema,
} from "@silfable/contracts";

const requestId = "00000000-0000-4000-8000-000000000001";

test("new IPC surface is unique, namespaced, and contains no Devnet channel", () => {
  const channels = Object.values(IPC_CHANNELS);
  assert.equal(new Set(channels).size, channels.length);
  for (const channel of channels) assert.match(channel, /^[a-z]+:[a-z-]+$/u);
  assert.equal(channels.some((channel) => /devnet|airdrop|canary|fixture/u.test(channel)), false);
});

test("Mainnet runtime profile cannot report a Devnet environment", () => {
  const base = { appVersion: "0.1.0", networkHealth: "unknown", keystore: "locked", masterPassword: "configured", wallet: "none", activeMissionCount: 0 };
  assert.equal(RuntimeStatusSchema.safeParse({ ...base, profile: "mainnet-guarded" }).success, true);
  assert.equal(RuntimeStatusSchema.safeParse({ ...base, profile: "devnet-simulation" }).success, false);
});

test("password setup and unlock contracts reject bypass-shaped input", () => {
  const configured = { schemaVersion: 1, requestId, password: "StrongPass1!", confirmPassword: "StrongPass1!", acknowledgedPasswordLossRisk: true };
  assert.equal(SecurityConfigurePasswordRequestSchema.safeParse(configured).success, true);
  assert.equal(SecurityConfigurePasswordRequestSchema.safeParse({ ...configured, confirmPassword: "OtherPass2!" }).success, false);
  assert.equal(SecurityConfigurePasswordRequestSchema.safeParse({ ...configured, acknowledgedPasswordLossRisk: false }).success, false);
  assert.equal(SecurityUnlockRequestSchema.safeParse({ schemaVersion: 1, requestId, password: "StrongPass1!" }).success, true);
  assert.equal(SecurityUnlockRequestSchema.safeParse({ schemaVersion: 1, requestId, password: "StrongPass1!", skipVerification: true }).success, false);
});

test("vault reset requires the irreversible acknowledgement and exact phrase", () => {
  const base = { schemaVersion: 1, requestId, confirmation: "SET UP NEW VAULT", acknowledgedPermanentAccessLoss: true };
  assert.equal(SecurityResetVaultRequestSchema.safeParse(base).success, true);
  assert.equal(SecurityResetVaultRequestSchema.safeParse({ ...base, confirmation: "yes" }).success, false);
  assert.equal(SecurityResetVaultRequestSchema.safeParse({ ...base, acknowledgedPermanentAccessLoss: false }).success, false);
});

test("persisted sessions reject unexpected execution authority", () => {
  const session = { id: requestId, title: "Review wallet", mode: "agent", permission: "restricted", walletAddress: null, messages: [], startedAt: "2026-07-21T00:00:00.000Z", usage: { input: 0, output: 0, total: 0, cost: null } };
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session }).success, true);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, executionEnabled: true } }).success, false);
  const pumpConfig = { scope: "exact-mint", objective: "monitor", tokenMint: "So11111111111111111111111111111111111111112", lifecycle: "proposal-only" };
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig } }).success, true);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, workspace: "pump", pumpConfig } }).success, false);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", permission: "full", workspace: "pump", pumpConfig } }).success, false);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, workspace: "pump" } }).success, false);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, pumpConfig } }).success, false);
  const watchlistConfig = { scope: "watchlist", objective: "monitor", tokenMint: null, watchlistMints: ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"], lifecycle: "proposal-only" };
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: watchlistConfig } }).success, true);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: { ...watchlistConfig, tokenMint: watchlistConfig.watchlistMints[0] } } }).success, false);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: { ...watchlistConfig, watchlistMints: [watchlistConfig.watchlistMints[0], watchlistConfig.watchlistMints[0]] } } }).success, false);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: { ...pumpConfig, watchlistMints: watchlistConfig.watchlistMints } } }).success, false);
  const discoveryConfig = { scope: "discovery", objective: "monitor", tokenMint: null, lifecycle: "proposal-only" };
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: discoveryConfig } }).success, true);
  assert.equal(SessionUpsertRequestSchema.safeParse({ schemaVersion: 1, requestId, session: { ...session, mode: "mission", workspace: "pump", pumpConfig: { ...discoveryConfig, tokenMint: pumpConfig.tokenMint } } }).success, false);
});

test("older bounded Pump discovery snapshots receive a null incremental cursor", () => {
  const parsed = PumpDiscoverySnapshotSchema.parse({
    source: "recent-program-transactions",
    programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    commitment: "finalized",
    scannedSignatures: 1,
    observedMints: 0,
    candidates: [],
    executionAllowed: false,
    disclosure: "Legacy bounded scan.",
    scannedAt: "2026-07-22T00:00:00.000Z",
  });
  assert.equal(parsed.cursorSignature, null);
});

test("security-sensitive requests reject privilege-shaped fields", () => {
  const cases = [
    [WalletImportPrivateKeyRequestSchema, { schemaVersion: 1, requestId, acknowledgedHotWalletRisk: true, privateKey: "1".repeat(64), rpcEndpoint: "https://evil.invalid" }],
    [AiSaveProviderRequestSchema, { schemaVersion: 1, requestId, provider: "openrouter", apiKey: "sk-private", model: "vendor/model", acknowledgedExternalProcessing: true, tools: ["shell"] }],
    [AiChatRequestSchema, { schemaVersion: 1, requestId, sessionId: requestId, prompt: "plan", mode: "agent", permission: "restricted", walletAddress: null, acknowledgedExternalProcessing: true, executionEnabled: true }],
    [JupiterSaveKeyRequestSchema, { schemaVersion: 1, requestId, apiKey: "jup-private", acknowledgedMainnetMarketData: true, transaction: "wire" }],
    [RobinhoodSaveZeroXKeyRequestSchema, { schemaVersion: 1, requestId, apiKey: "0x-private", acknowledgedExternalQuoteProvider: true, broadcast: true }],
    [RobinhoodSaveRpcUrlRequestSchema, { schemaVersion: 1, requestId, rpcUrl: "http://rpc.invalid" }],
    [RobinhoodWalletCreateRequestSchema, { schemaVersion: 1, requestId, acknowledgedHotWalletRisk: true, privateKey: "secret" }],
    [RobinhoodWalletImportMnemonicRequestSchema, { schemaVersion: 1, requestId, mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", acknowledgedHotWalletRisk: true, executionEnabled: true }],
  ] as const;
  for (const [schema, value] of cases) assert.equal(schema.safeParse(value).success, false);
});

test("chat supports guarded session permissions and acknowledgements must be literal booleans", () => {
  const base = { schemaVersion: 1, requestId, sessionId: requestId, prompt: "Review my wallet", mode: "agent", walletAddress: "11111111111111111111111111111111", acknowledgedExternalProcessing: true };
  assert.equal(AiChatRequestSchema.safeParse({ ...base, permission: "restricted" }).success, true);
  assert.equal(AiChatRequestSchema.safeParse({ ...base, permission: "full" }).success, true);
  assert.equal(AiChatRequestSchema.safeParse({ ...base, permission: "restricted", acknowledgedExternalProcessing: "true" }).success, false);
});

test("mission simulation requires explicit simulation-only acknowledgement", () => {
  const base = { schemaVersion: 1, requestId, sessionId: requestId, missionId: requestId, acknowledgedSimulationOnly: true };
  assert.equal(MissionSimulateRequestSchema.safeParse(base).success, true);
  assert.equal(MissionSimulateRequestSchema.safeParse({ ...base, acknowledgedSimulationOnly: "true" }).success, false);
  assert.equal(MissionSimulateRequestSchema.safeParse({ ...base, executionEnabled: true }).success, false);
});

test("Pump simulation accepts identifiers and simulation-only acknowledgement, never execution authority", () => {
  const base = { schemaVersion: 1, requestId, sessionId: requestId, previewId: requestId, acknowledgedSimulationOnly: true };
  assert.equal(PumpSimulateRequestSchema.safeParse(base).success, true);
  assert.equal(PumpSimulateRequestSchema.safeParse({ ...base, acknowledgedSimulationOnly: false }).success, false);
  assert.equal(PumpSimulateRequestSchema.safeParse({ ...base, signingAllowed: true }).success, false);
  assert.equal(PumpSimulateRequestSchema.safeParse({ ...base, broadcast: true }).success, false);
});

test("Pump final revalidation is an unsigned no-execution request", () => {
  const base = { schemaVersion: 1, requestId, sessionId: requestId, previewId: requestId, acknowledgedNoExecution: true };
  assert.equal(PumpFinalRevalidateRequestSchema.safeParse(base).success, true);
  assert.equal(PumpFinalRevalidateRequestSchema.safeParse({ ...base, acknowledgedNoExecution: false }).success, false);
  assert.equal(PumpFinalRevalidateRequestSchema.safeParse({ ...base, masterPassword: "StrongPass1!" }).success, false);
  assert.equal(PumpFinalRevalidateRequestSchema.safeParse({ ...base, sign: true, broadcast: true }).success, false);
});

test("Pump execution request is an exact restricted Mainnet manual approval gate", () => {
  const base = {
    schemaVersion: 1,
    requestId,
    sessionId: requestId,
    previewId: requestId,
    masterPassword: "StrongPass1!",
    confirmation: "EXECUTE PUMP MAINNET",
    acknowledgedIrreversibleExecution: true,
  };
  assert.equal(PumpExecuteRequestSchema.safeParse(base).success, true);
  assert.equal(PumpExecuteRequestSchema.safeParse({ ...base, confirmation: "EXECUTE MAINNET" }).success, false);
  assert.equal(PumpExecuteRequestSchema.safeParse({ ...base, acknowledgedIrreversibleExecution: false }).success, false);
  assert.equal(PumpExecuteRequestSchema.safeParse({ ...base, unsignedOnly: true }).success, false);
});

test("emergency stop can be engaged immediately but release requires an explicit password boundary", () => {
  const engage = { schemaVersion: 1, requestId, reason: "Manual safety halt", acknowledgedImmediateHalt: true };
  assert.equal(EmergencyStopEngageRequestSchema.safeParse(engage).success, true);
  assert.equal(EmergencyStopEngageRequestSchema.safeParse({ ...engage, acknowledgedImmediateHalt: false }).success, false);
  assert.equal(EmergencyStopEngageRequestSchema.safeParse({ ...engage, masterPassword: "must-not-be-required" }).success, false);

  const release = { schemaVersion: 1, requestId, masterPassword: "StrongPass1!", acknowledgedResumeRisk: true };
  assert.equal(EmergencyStopReleaseRequestSchema.safeParse(release).success, true);
  assert.equal(EmergencyStopReleaseRequestSchema.safeParse({ ...release, masterPassword: "" }).success, false);
  assert.equal(EmergencyStopReleaseRequestSchema.safeParse({ ...release, acknowledgedResumeRisk: false }).success, false);
  assert.equal(EmergencyStopStatusSchema.safeParse({ engaged: true, reason: null, engagedAt: "2026-07-27T00:00:00.000Z" }).success, true);
  assert.equal(EmergencyStopStatusSchema.safeParse({ engaged: false, reason: "stale", engagedAt: null }).success, false);
});

test("Pump execution verification identifies one persisted record and cannot request rebroadcast", () => {
  const base = {
    schemaVersion: 1,
    requestId,
    sessionId: requestId,
    previewId: requestId,
    executionId: requestId,
  };
  assert.equal(PumpVerifyExecutionRequestSchema.safeParse(base).success, true);
  assert.equal(PumpVerifyExecutionRequestSchema.safeParse({ ...base, rebroadcast: true }).success, false);
  assert.equal(PumpVerifyExecutionRequestSchema.safeParse({ ...base, signedTransaction: "secret" }).success, false);
});

test("Pump risk settings reject inconsistent ceilings and privilege fields", () => {
  const settings = { maxTradingFeeBps: 500, maxSlippageBps: 300, maxSpendPerTradeLamports: "50000000", maxDailySpendLamports: "200000000", maxPerTokenExposureLamports: "100000000", maxTotalExposureLamports: "500000000", maxOpenPositions: 5, maxTransactionsPerHour: 10, minSolReserveLamports: "20000000" };
  const base = { schemaVersion: 1, requestId, settings };
  assert.equal(PumpRiskSettingsSaveRequestSchema.safeParse(base).success, true);
  assert.equal(PumpRiskSettingsSaveRequestSchema.safeParse({ ...base, settings: { ...settings, maxDailySpendLamports: "1" } }).success, false);
  assert.equal(PumpRiskSettingsSaveRequestSchema.safeParse({ ...base, settings: { ...settings, autonomousExecution: true } }).success, false);
});

test("Mainnet execution requires password, exact phrase, and irreversible acknowledgement", () => {
  const base = { schemaVersion: 1, requestId, sessionId: requestId, missionId: requestId, simulationId: requestId, masterPassword: "StrongPass1!", confirmation: "EXECUTE MAINNET", acknowledgedIrreversibleMainnetExecution: true };
  assert.equal(MissionExecuteRequestSchema.safeParse(base).success, true);
  assert.equal(MissionExecuteRequestSchema.safeParse({ ...base, confirmation: "execute" }).success, false);
  assert.equal(MissionExecuteRequestSchema.safeParse({ ...base, acknowledgedIrreversibleMainnetExecution: false }).success, false);
  assert.equal(MissionExecuteRequestSchema.safeParse({ ...base, skipPassword: true }).success, false);
});

test("receipt verification and transaction utilities accept identifiers only, never arbitrary URLs", () => {
  const signature = "1".repeat(64);
  const verify = { schemaVersion: 1, requestId, sessionId: requestId, missionId: requestId, receiptId: requestId };
  assert.equal(MissionVerifyExecutionRequestSchema.safeParse(verify).success, true);
  assert.equal(MissionVerifyExecutionRequestSchema.safeParse({ ...verify, rebroadcast: true }).success, false);
  assert.equal(ClipboardWriteTransactionSignatureRequestSchema.safeParse({ schemaVersion: 1, requestId, signature }).success, true);
  assert.equal(ExternalOpenTransactionRequestSchema.safeParse({ schemaVersion: 1, requestId, signature }).success, true);
  assert.equal(ExternalOpenTransactionRequestSchema.safeParse({ schemaVersion: 1, requestId, signature, url: "https://evil.invalid" }).success, false);
});
