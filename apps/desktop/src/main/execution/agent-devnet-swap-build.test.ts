import assert from "node:assert/strict";
import test from "node:test";

import { AccountState, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { address, blockhash, getCompiledTransactionMessageEncoder, getTransactionEncoder } from "@solana/kit";
import { AgentDevnetSwapQuoteViewSchema, type AgentIntentEvaluationView } from "@silfable/contracts";

import { AgentDevnetSwapBuildService, validateBuiltTransaction, validateSellSolBalanceProof } from "./agent-devnet-swap-build";
import type { AgentDevnetSwapQuoteExactEvidence } from "./agent-devnet-swap-quote";
import type { AgentDevnetSwapBuildStorageRecord, RuntimeDatabase } from "../storage/database";

const WALLET = "JDryrxitcK8cwcAUAaRaMDQEHMuYV3gRLMseSJQJPnFK";
const ROUTER = "DRaybByLpbUL57LJARs3j8BitTxVfzBg351EaMr5UTCd";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const LOOKUP = "EFhMuDw1PKEuckuFRW9PavNfTH4LKP5uKHgyXDmWpFCq";
const POOL = "C4UR6mqrdSzQQow6nJLq2zNMVh2DmMhw4ieanAvegWs6";
const OUTPUT_ATA = "E7iCLAZw5ikohzbsNycEtEHFtYVguc1ByojNHL7suUPX";

test("compiled Raydium transaction binds signer, programs, lookup table, and exact amounts", () => {
  const evidence = quoteEvidence(); const wire = buildWire();
  const valid = validateBuiltTransaction(wire, WALLET, evidence.view, OUTPUT_ATA);
  assert.deepEqual(valid.programIds, [ROUTER, COMPUTE]); assert.equal(valid.messageHash.length, 64);
  assert.throws(() => validateBuiltTransaction(buildWire({ inputAmount: 2n }), WALLET, evidence.view, OUTPUT_ATA), /amount-mismatch/u);
  assert.throws(() => validateBuiltTransaction(buildWire({ program: "11111111111111111111111111111111" }), WALLET, evidence.view, OUTPUT_ATA), /program-denied/u);
  assert.throws(() => validateBuiltTransaction(buildWire({ lookup: "11111111111111111111111111111111" }), WALLET, evidence.view, OUTPUT_ATA), /build-invalid/u);
});

test("allowed quote builds and simulates once while keeping unsigned wire encrypted", async () => {
  const f = fixture(); const service = f.service(); const first = service.build(f.evidence.view.id);
  await assert.rejects(() => service.build(f.evidence.view.id), /already active/u);
  const result = await first;
  assert.equal(result.state, "simulated"); assert.equal(result.exactAmountBound, true);
  assert.equal(result.outputTokenAccount, OUTPUT_ATA); assert.equal(result.outputAmountDelta, "92717");
  assert.equal(result.associatedTokenAccountVerified, true); assert.equal(result.balanceDeltaVerified, true);
  assert.equal(result.transactionBuilt, true); assert.equal(result.simulationAttempted, true);
  assert.equal(result.signingAttempted, false); assert.equal(result.broadcastAttempted, false);
  assert.ok(f.database.record); assert.equal(f.database.record.encryptedPayload.includes(buildWire()), false);
  await assert.rejects(() => f.service().build(f.evidence.view.id), /already has/u);
});

test("transaction mutation, simulation failure, and approval race deny without signing", async () => {
  const mutated = fixture(); const mutation = await mutated.service({ wire: buildWire({ inputAmount: 2n }) }).build(mutated.evidence.view.id);
  assert.equal(mutation.state, "denied"); assert.equal(mutation.failureCode, "amount-mismatch"); assert.equal(mutation.signingAttempted, false);
  const failed = fixture(); const simulation = await failed.service({ simulationError: true }).build(failed.evidence.view.id);
  assert.equal(simulation.state, "denied"); assert.equal(simulation.failureCode, "simulation-failed");
  const race = fixture(); let approved = true;
  const raced = await race.service({ beforeSimulation: () => { approved = false; }, isApproved: () => approved }).build(race.evidence.view.id);
  assert.equal(raced.state, "denied"); assert.equal(raced.failureCode, "binding-changed"); assert.equal(raced.broadcastAttempted, false);
});

test("sell-sol balance proof rejects foreign token accounts and unsafe deltas", () => {
  const base = balanceProofInput();
  const proof = validateSellSolBalanceProof(base); assert.equal(proof.outputAmountDelta, 92717n);
  assert.throws(() => validateSellSolBalanceProof({ ...base, after: { ...base.after,
    accounts: [systemAccount("8995000"), tokenAccount(10n)] } }), /balance-delta-invalid/u);
  assert.throws(() => validateSellSolBalanceProof({ ...base, after: { ...base.after,
    accounts: [systemAccount("8995000"), tokenAccount(92717n, "11111111111111111111111111111111")] } }), /account-proof-failed/u);
  assert.throws(() => validateSellSolBalanceProof({ ...base, after: { ...base.after,
    accounts: [systemAccount("1000000"), tokenAccount(92717n)] } }), /balance-delta-invalid/u);
});

function fixture() {
  const database = new FakeDatabase(); const evidence = quoteEvidence();
  const service = (options: { wire?: string; simulationError?: boolean; beforeSimulation?: () => void; isApproved?: () => boolean } = {}) =>
    new AgentDevnetSwapBuildService({ database: database as unknown as RuntimeDatabase, cipher,
      keystore: { isLocked: () => false }, health: { isHealthyFresh: () => true }, wallet: { async getWalletAddress() { return WALLET; } },
      quotes: { async loadExactEvidence() { return evidence; } }, agents: { async list() { return { evaluations: [evaluation(options.isApproved?.() ?? true)] }; } },
      rpc: { async getMultipleAccountsBase64() { return { contextSlot: 1n, accounts: [systemAccount("10000000"), null] }; },
        async simulateTransactionWithAccounts() { options.beforeSimulation?.(); return { error: options.simulationError ?? false,
          unitsConsumed: 2000n, fee: 5000n, contextSlot: 2n,
          accounts: [systemAccount("8995000"), tokenAccount(92717n)] }; } },
      transport: async () => options.wire ?? buildWire(), now: () => new Date("2026-07-19T00:00:10.000Z") });
  return { database, evidence, service };
}
function quoteEvidence(): AgentDevnetSwapQuoteExactEvidence { return { raydiumResponse: { success: true }, view: AgentDevnetSwapQuoteViewSchema.parse({
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000a01", evaluationId: "00000000-0000-4000-8000-000000000a04",
  sessionId: "00000000-0000-4000-8000-000000000a03", action: "sell-sol", venue: "raydium-devnet",
  inputMint: "So11111111111111111111111111111111111111112", outputMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  inputAmount: "1000000", outputAmount: "92717", minimumOutputAmount: "92253", slippageBps: 50, priceImpactBps: 20,
  routePoolIds: [POOL], proposalNotionalUsdcMicros: "1000000", economicValueMapping: "direction-only-capped-devnet",
  amountPolicy: "fixed-low-value-canary-v1", allowed: true, denialCodes: [], transactionBuilt: false, signingAttempted: false,
  broadcastAttempted: false, marketSwapPerformed: false, mainnetEnabled: false,
  quotedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T00:00:20.000Z" }) }; }
function buildWire(options: { inputAmount?: bigint; program?: string; lookup?: string } = {}) {
  const input = options.inputAmount ?? 1_000_000n; const minimum = 92_253n; const data = Buffer.alloc(17); data[0] = 0;
  data.writeBigUInt64LE(input, 1); data.writeBigUInt64LE(minimum, 9);
  const instructionData = (discriminator: number, length: number) => { const value = new Uint8Array(length); value[0] = discriminator; return value; };
  const messageBytes = getCompiledTransactionMessageEncoder().encode({ version: 0, header: { numSignerAccounts: 1,
    numReadonlySignerAccounts: 0, numReadonlyNonSignerAccounts: 4 }, staticAccounts: [WALLET,
    "So11111111111111111111111111111111111111112", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", POOL, OUTPUT_ATA,
    options.program ?? ROUTER, COMPUTE], lifetimeToken: blockhash("11111111111111111111111111111111"), instructions: [
      { programAddressIndex: 5, accountIndices: [0, 1], data: instructionData(5, 9) },
      { programAddressIndex: 5, accountIndices: [0, 1, 2, 3, 4], data },
      { programAddressIndex: 5, accountIndices: [0, 1], data: instructionData(6, 1) },
      { programAddressIndex: 6, data: instructionData(3, 9) },
      { programAddressIndex: 6, data: instructionData(2, 5) }],
    addressTableLookups: [{ lookupTableAddress: options.lookup ?? LOOKUP, writableIndexes: [0], readonlyIndexes: [1] }] } as never);
  const bytes = getTransactionEncoder().encode({ messageBytes, signatures: { [WALLET]: null } } as never);
  return Buffer.from(bytes).toString("base64");
}
function evaluation(approved: boolean): AgentIntentEvaluationView { const q = quoteEvidence().view; return { schemaVersion: 1, provider: "openai", model: "test",
  session: { schemaVersion: 1, id: q.sessionId, state: "active", provider: "openai", objective: "Bounded Devnet swap simulation.", venue: "jupiter-swap-v2",
    maxActionNotionalUsdcMicros: "20000000", maxPriceImpactBps: 50, maxVolatilityBps: 100, deadlineAt: "2026-07-19T01:00:00.000Z",
    haltedAt: null, haltReason: null, executionEnabled: false, createdAt: q.quotedAt, updatedAt: q.quotedAt },
  observation: {} as AgentIntentEvaluationView["observation"], quote: {} as AgentIntentEvaluationView["quote"],
  proposal: { schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: q.sessionId, observationId: "00000000-0000-4000-8000-000000000a02",
    quoteId: "00000000-0000-4000-8000-000000000a00", action: "sell-sol", notionalUsdcMicros: "1000000", confidenceBps: 8000, rationale: "Bounded", riskFlags: [] },
  receipt: { schemaVersion: 1, id: q.evaluationId, sessionId: q.sessionId, observationId: "00000000-0000-4000-8000-000000000a02",
    proposalDigest: "d".repeat(64), outcome: "pending-approval", denialCodes: [], evaluatedAt: q.quotedAt, modelCallsAttempted: true,
    signingAttempted: false, executionAttempted: false, persistedLocally: true }, approval: { state: approved ? "approved" : "rejected",
    expiresAt: approved ? "2026-07-19T00:30:00.000Z" : null, decidedAt: q.quotedAt, executionEnabled: false } }; }
class FakeDatabase { record: AgentDevnetSwapBuildStorageRecord | null = null; getAgentDevnetSwapBuildByQuote() { return this.record; }
  insertAgentDevnetSwapBuild(record: AgentDevnetSwapBuildStorageRecord) { this.record = record; } listAgentDevnetSwapBuilds() { return this.record ? [this.record] : []; } }
const cipher = { async encryptString(value: string) { return { ciphertext: Buffer.from(value).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const }; },
  async decryptString(input: { ciphertext: string }) { return Buffer.from(input.ciphertext, "base64").toString("utf8"); } };
function systemAccount(lamportsAtomic: string) { return { address: WALLET, programAddress: "11111111111111111111111111111111",
  executable: false, dataBase64: "", lamportsAtomic }; }
function tokenAccount(amount: bigint, owner = WALLET) { return { address: OUTPUT_ATA, programAddress: TOKEN_PROGRAM_ADDRESS, executable: false,
  dataBase64: Buffer.from(getTokenEncoder().encode({ mint: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    owner: address(owner), amount, delegate: null, state: AccountState.Initialized, isNative: null,
    delegatedAmount: 0n, closeAuthority: null })).toString("base64"), lamportsAtomic: "2039280" }; }
function balanceProofInput() { return { wallet: WALLET, outputTokenAccount: OUTPUT_ATA, quote: quoteEvidence().view, fee: 5000n,
  before: { contextSlot: 1n, accounts: [systemAccount("10000000"), null] },
  after: { error: false, unitsConsumed: 2000n, fee: 5000n, contextSlot: 2n,
    accounts: [systemAccount("8995000"), tokenAccount(92717n)] } }; }
