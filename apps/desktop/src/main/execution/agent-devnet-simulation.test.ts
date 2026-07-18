import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AccountState, getMintEncoder, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { generateKeyPairSigner, type ReadonlyUint8Array } from "@solana/kit";

import {
  AgentIntentEvaluationViewSchema,
  AgentSessionViewSchema,
  JupiterShadowQuoteViewSchema,
  MarketObservationViewSchema,
} from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database";
import { AgentDevnetSimulationService, SolanaAgentDevnetSimulationAdapter, type AgentDevnetSimulationAdapter } from "./agent-devnet-simulation";
import { getGuardedFixtureManifestDigest, type GuardedFixtureManifest } from "./fixture-provenance";
import { buildGuardedSplTransferFixture } from "./spl-fixture";

test("default adapter builds and simulates an unsigned exact message without broadcast", async () => {
  const [authority, source, mint, destination, destinationOwner] = await Promise.all([
    generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner(),
  ]);
  const fixture = buildGuardedSplTransferFixture({
    source: source.address, mint: mint.address, destination: destination.address,
    authority: authority.address, amount: 100n, decimals: 6,
  });
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1,
    fixtureId: "00000000-0000-4000-8000-000000000400",
    cluster: "devnet",
    mintAddress: mint.address,
    mintDecimals: 6,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: authority.address,
    destinationOwner: destinationOwner.address,
    transferAmountAtomic: "100",
    instructionFingerprint: fixture.fingerprint,
    reviewedAt: new Date().toISOString(),
  };
  let simulateCalls = 0;
  let broadcastCalls = 0;
  const rpc = {
    async getMultipleAccountsBase64() {
      return {
        contextSlot: 123n,
        accounts: [
          encodedAccount(mint.address, getMintEncoder().encode({ mintAuthority: null, supply: 1_000n, decimals: 6, isInitialized: true, freezeAuthority: null })),
          encodedAccount(source.address, getTokenEncoder().encode({ mint: mint.address, owner: authority.address, amount: 1_000n, delegate: null, state: AccountState.Initialized, isNative: null, delegatedAmount: 0n, closeAuthority: null })),
          encodedAccount(destination.address, getTokenEncoder().encode({ mint: mint.address, owner: destinationOwner.address, amount: 0n, delegate: null, state: AccountState.Initialized, isNative: null, delegatedAmount: 0n, closeAuthority: null })),
        ],
      };
    },
    async getLatestBlockhash() { return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 999n }; },
    async simulateTransaction(wire: string) {
      simulateCalls += 1;
      assert.ok(wire.length > 0);
      return { error: false, unitsConsumed: 1_500n, fee: 5_000n };
    },
    async sendTransaction() { broadcastCalls += 1; throw new Error("must not broadcast"); },
    async getSignatureStatus() { return { found: false, error: false, confirmationStatus: null }; },
    async getBlockHeight() { return 1n; },
  };
  const result = await new SolanaAgentDevnetSimulationAdapter(rpc).simulate(manifest);
  assert.match(result.messageHash, /^[a-f0-9]{64}$/u);
  assert.equal(simulateCalls, 1);
  assert.equal(broadcastCalls, 0);
  assert.equal("sign" in result, false);
});

test("approved agent intent produces one encrypted simulation-only Devnet proof", async () => {
  const fixture = await setup();
  try {
    let calls = 0;
    const service = fixture.service({
      async simulate(manifest) {
        calls += 1;
        return evidence(manifest);
      },
    });
    const result = await service.simulate(fixture.evaluation.receipt.id, fixture.evaluation.receipt.proposalDigest);
    assert.equal(result.outcome, "simulated");
    assert.equal(result.economicValueMapping, "none");
    assert.equal(result.marketSwapPerformed, false);
    assert.equal(result.signingAttempted, false);
    assert.equal(result.broadcastAttempted, false);
    assert.equal(result.executionAttempted, false);
    assert.equal(calls, 1);
    const stored = fixture.database.listAgentDevnetSimulations()[0];
    assert.ok(stored);
    assert.equal(stored.encryptedPayload.includes("unsigned-wire-secret"), false);
    await assert.rejects(() => service.simulate(fixture.evaluation.receipt.id, fixture.evaluation.receipt.proposalDigest), /already has/u);
    assert.equal(calls, 1);
  } finally {
    await fixture.close();
  }
});

test("digest mismatch is rejected before simulation and approval changes fail closed after simulation", async () => {
  const fixture = await setup();
  try {
    let approved = true;
    let calls = 0;
    const service = fixture.service({
      async simulate(manifest) {
        calls += 1;
        approved = false;
        return evidence(manifest);
      },
    }, () => approved);
    await assert.rejects(() => service.simulate(fixture.evaluation.receipt.id, "b".repeat(64)), /Exact approved/u);
    assert.equal(calls, 0);
    const result = await service.simulate(fixture.evaluation.receipt.id, fixture.evaluation.receipt.proposalDigest);
    assert.equal(result.outcome, "failed");
    assert.equal(result.failureCode, "binding-changed");
    assert.equal(result.messageHash, null);
    assert.equal(calls, 1);
  } finally {
    await fixture.close();
  }
});

test("simulation and provenance failures create no-sign failure receipts", async () => {
  const fixture = await setup();
  try {
    const service = fixture.service({
      async simulate() { throw new Error("agent-devnet-provenance-denied"); },
    });
    const result = await service.simulate(fixture.evaluation.receipt.id, fixture.evaluation.receipt.proposalDigest);
    assert.equal(result.outcome, "failed");
    assert.equal(result.failureCode, "provenance-denied");
    assert.equal(result.signingAttempted, false);
    assert.equal(result.broadcastAttempted, false);
  } finally {
    await fixture.close();
  }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-agent-devnet-sim-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const evaluation = evaluationView();
  seed(database, evaluation);
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1,
    fixtureId: "00000000-0000-4000-8000-000000000405",
    cluster: "devnet",
    mintAddress: "So11111111111111111111111111111111111111112",
    mintDecimals: 6,
    sourceTokenAccount: "11111111111111111111111111111111",
    destinationTokenAccount: "Stake11111111111111111111111111111111111111",
    walletAuthority: "Vote111111111111111111111111111111111111111",
    destinationOwner: "BPFLoaderUpgradeab1e11111111111111111111111",
    transferAmountAtomic: "1000000",
    instructionFingerprint: "a".repeat(64),
    reviewedAt: "2026-07-18T00:00:00.000Z",
  };
  return {
    directory,
    database,
    evaluation,
    service(adapter: AgentDevnetSimulationAdapter, isApproved = () => true) {
      return new AgentDevnetSimulationService({
        database,
        cipher,
        keystore: { isLocked: () => false },
        health: { isHealthyFresh: () => true },
        fixtures: { async loadActiveManifest() { return manifest; } },
        agents: {
          async list() {
            return {
              evaluations: [{
                ...evaluation,
                approval: { ...evaluation.approval, state: isApproved() ? "approved" as const : "rejected" as const },
              }],
            };
          },
        },
        adapter,
        now: () => new Date("2026-07-18T00:00:06.000Z"),
      });
    },
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function evidence(manifest: GuardedFixtureManifest) {
  return {
    fixtureManifestDigest: getGuardedFixtureManifestDigest(manifest),
    messageHash: "c".repeat(64),
    simulationWireTransaction: "unsigned-wire-secret",
    programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    unitsConsumed: 1_500n,
    feeLamports: 5_000n,
    initialContextSlot: "10",
    finalContextSlot: "11",
    lastValidBlockHeight: 999n,
  };
}

const cipher = {
  async encryptString(plaintext: string) {
    return { ciphertext: Buffer.from(plaintext).toString("base64"), nonce: "nonce", keyId: "local-data-key-v1" as const };
  },
  async decryptString(input: { ciphertext: string }) {
    return Buffer.from(input.ciphertext, "base64").toString("utf8");
  },
};

function evaluationView() {
  const session = AgentSessionViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000401",
    state: "active",
    provider: "openai",
    objective: "Protect capital using only bounded fixture simulation proofs.",
    venue: "jupiter-swap-v2",
    maxActionNotionalUsdcMicros: "20000000",
    maxPriceImpactBps: 50,
    maxVolatilityBps: 100,
    deadlineAt: "2026-07-18T01:00:00.000Z",
    haltedAt: null,
    haltReason: null,
    executionEnabled: false,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  });
  const quote = JupiterShadowQuoteViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000402",
    profile: "mainnet-shadow",
    direction: "sol-to-usdc",
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    inAmount: "100000000",
    outAmount: "15000000",
    otherAmountThreshold: "14900000",
    slippageBps: 50,
    priceImpactBps: 20,
    feeBps: 5,
    router: "metis",
    routeLabels: ["Raydium"],
    allowed: true,
    denialCodes: [],
    transactionReturned: false,
    signingAttempted: false,
    broadcastAttempted: false,
    observedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-18T00:00:10.000Z",
  });
  const observation = MarketObservationViewSchema.parse({
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000403",
    profile: "mainnet-shadow",
    pair: "SOL/USDC",
    primaryQuoteId: quote.id,
    market: { priceMicros: "150000000", priceImpactBps: 20, feeBps: 5, routeCount: 1, liquidityProxy: "healthy", volatility: { status: "available", sampleCount: 2, windowSeconds: 60, rangeBps: 20 } },
    walletContext: { status: "unavailable", reason: "mainnet-wallet-not-configured" },
    provenance: { provider: "jupiter-swap-v2", sourceQuoteIds: [quote.id], sourceSlot: null, sourceBlock: null, observedAt: "2026-07-18T00:00:00.000Z", capturedAt: "2026-07-18T00:00:01.000Z", freshnessBudgetSeconds: 10, expiresAt: quote.expiresAt },
    freshnessStatus: "fresh",
    observationDigest: "a".repeat(64),
    modelCallsAttempted: false,
    signingAttempted: false,
    executionAttempted: false,
  });
  return AgentIntentEvaluationViewSchema.parse({
    schemaVersion: 1,
    provider: "openai",
    model: "test-model",
    session,
    observation,
    quote,
    proposal: { schemaVersion: 1, intentType: "restricted-agent-intent", sessionId: session.id, observationId: observation.id, quoteId: quote.id, action: "sell-sol", notionalUsdcMicros: quote.outAmount, confidenceBps: 8_000, rationale: "Approved bounded intent.", riskFlags: [] },
    receipt: { schemaVersion: 1, id: "00000000-0000-4000-8000-000000000404", sessionId: session.id, observationId: observation.id, proposalDigest: "d".repeat(64), outcome: "pending-approval", denialCodes: [], evaluatedAt: "2026-07-18T00:00:05.000Z", modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, persistedLocally: true },
    approval: { state: "approved", expiresAt: "2026-07-18T00:30:00.000Z", decidedAt: "2026-07-18T00:00:05.000Z", executionEnabled: false },
  });
}

function seed(database: RuntimeDatabase, evaluation: ReturnType<typeof evaluationView>) {
  database.insertJupiterShadowQuote({ id: evaluation.quote.id, encryptedPayload: "quote", payloadNonce: "nonce", keyId: "local-data-key-v1", allowed: true, createdAt: evaluation.quote.observedAt });
  database.insertMarketObservation({ id: evaluation.observation.id, sourceQuoteId: evaluation.quote.id, observationDigest: evaluation.observation.observationDigest, encryptedPayload: "observation", payloadNonce: "nonce", keyId: "local-data-key-v1", observedAt: evaluation.observation.provenance.observedAt, capturedAt: evaluation.observation.provenance.capturedAt, expiresAt: evaluation.observation.provenance.expiresAt, modelCallsAttempted: false, signingAttempted: false, executionAttempted: false });
  database.insertAgentSession({ id: evaluation.session.id, state: "active", provider: "openai", encryptedPayload: "session", payloadNonce: "nonce", keyId: "local-data-key-v1", deadlineAt: evaluation.session.deadlineAt, haltedAt: null, haltReason: null, executionEnabled: false, createdAt: evaluation.session.createdAt, updatedAt: evaluation.session.updatedAt });
  database.insertAgentIntentEvaluation({ id: evaluation.receipt.id, sessionId: evaluation.session.id, observationId: evaluation.observation.id, quoteId: evaluation.quote.id, proposalDigest: evaluation.receipt.proposalDigest, outcome: "pending-approval", encryptedPayload: "evaluation", payloadNonce: "nonce", keyId: "local-data-key-v1", approvalState: "approved", approvalExpiresAt: evaluation.approval.expiresAt, decidedAt: evaluation.approval.decidedAt, modelCallsAttempted: true, signingAttempted: false, executionAttempted: false, evaluatedAt: evaluation.receipt.evaluatedAt });
}

function encodedAccount(address: string, data: ReadonlyUint8Array) {
  return { address, programAddress: TOKEN_PROGRAM_ADDRESS, executable: false, dataBase64: Buffer.from(data).toString("base64") };
}
