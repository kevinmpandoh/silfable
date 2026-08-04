import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeDatabase } from "../storage/database.js";
import { AutomationManager } from "./automation-manager.js";

const WALLET = "2r2pXUspsXamwzNWc8dQn52GK2BJJWmr63MPzDDxjTcg";
const TOKEN = "7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump";
const SOL = "So11111111111111111111111111111111111111112";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-automation-"));
  const path = join(directory, "runtime.sqlite");
  const database = await RuntimeDatabase.open(path);
  return { directory, path, database, manager: new AutomationManager(database) };
}

test("DCA wake creates one durable approval proposal and never fabricates execution", async () => {
  const value = await fixture();
  try {
    const now = new Date("2026-07-29T00:00:00.000Z");
    const strategy = value.manager.createDca({
      id: "dca-1",
      sessionId: "session-1",
      walletAddress: WALLET,
      outputMint: TOKEN,
      orderAmountRaw: "1000000",
      maximumTotalRaw: "3000000",
      intervalSeconds: 60,
      maximumExecutions: 3,
      expiresAt: "2026-07-30T00:00:00.000Z",
    }, now);

    assert.equal(strategy.status, "ACTIVE");
    const proposals = value.manager.evaluate(new Date("2026-07-29T00:01:01.000Z"));
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.reason, "DCA_DUE");
    assert.equal(proposals[0]?.status, "AWAITING_APPROVAL");
    const persisted = value.manager.listStrategies()[0];
    assert.equal(persisted?.kind, "DCA");
    assert.equal(persisted?.kind === "DCA" ? persisted.completedExecutions : null, 0);

    const duplicate = value.manager.evaluate(new Date("2026-07-29T00:01:10.000Z"));
    assert.equal(duplicate.length, 0);
    assert.equal(value.manager.listProposals().length, 1);
  } finally {
    value.database.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("automation state and proposals survive restart", async () => {
  const value = await fixture();
  try {
    value.manager.createDca({
      id: "dca-restart",
      sessionId: "session-1",
      walletAddress: WALLET,
      outputMint: TOKEN,
      orderAmountRaw: "1000000",
      maximumTotalRaw: "1000000",
      intervalSeconds: 60,
      maximumExecutions: 1,
      expiresAt: "2026-07-30T00:00:00.000Z",
    }, new Date("2026-07-29T00:00:00.000Z"));
    value.manager.evaluate(new Date("2026-07-29T00:01:01.000Z"));
    value.database.close();

    const reopened = await RuntimeDatabase.open(value.path);
    try {
      const restored = new AutomationManager(reopened);
      assert.equal(restored.listStrategies()[0]?.status, "AWAITING_APPROVAL");
      assert.equal(restored.listProposals()[0]?.strategyId, "dca-restart");
      assert.match(restored.listProposals()[0]?.disclosure ?? "", /cannot sign or broadcast/u);
    } finally {
      reopened.close();
    }
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("TP/SL strategy deduplicates a trigger and preserves exact session and wallet binding", async () => {
  const value = await fixture();
  try {
    value.manager.createExit({
      id: "exit-1",
      sessionId: "session-exit",
      walletAddress: WALLET,
      inputMint: TOKEN,
      outputMint: SOL,
      amountRaw: "250000",
      entryPriceUsd: 1,
      stopLossPriceUsd: 0.8,
      takeProfitPriceUsd: 1.5,
      expiresAt: "2026-07-30T00:00:00.000Z",
    }, new Date("2026-07-29T00:00:00.000Z"));

    const proposals = value.manager.evaluate(
      new Date("2026-07-29T00:01:00.000Z"),
      new Map([[TOKEN, 0.75]]),
    );
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.reason, "STOP_LOSS");
    assert.equal(proposals[0]?.walletFingerprint.length, 64);
    assert.notEqual(proposals[0]?.walletFingerprint, WALLET);
    assert.equal(proposals[0]?.sessionId, "session-exit");
    assert.equal(value.manager.evaluate(new Date("2026-07-29T00:02:00.000Z"), new Map([[TOKEN, 0.7]])).length, 0);
  } finally {
    value.database.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("pause, resume, expiry and emergency stop are fail closed", async () => {
  const value = await fixture();
  try {
    value.manager.createExit({
      id: "exit-controls",
      sessionId: "session-exit",
      walletAddress: WALLET,
      inputMint: TOKEN,
      amountRaw: "250000",
      entryPriceUsd: 1,
      takeProfitPriceUsd: 1.5,
      expiresAt: "2026-07-29T01:00:00.000Z",
    }, new Date("2026-07-29T00:00:00.000Z"));

    assert.equal(value.manager.setStatus("exit-controls", "PAUSE").status, "PAUSED");
    assert.equal(value.manager.evaluate(new Date("2026-07-29T00:01:00.000Z"), new Map([[TOKEN, 2]])).length, 0);
    assert.equal(value.manager.setStatus("exit-controls", "RESUME", new Date("2026-07-29T00:02:00.000Z")).status, "ACTIVE");
    value.manager.emergencyStop(new Date("2026-07-29T00:03:00.000Z"));
    assert.equal(value.manager.listStrategies()[0]?.status, "EMERGENCY_STOPPED");
    assert.equal(value.manager.evaluate(new Date("2026-07-29T00:04:00.000Z"), new Map([[TOKEN, 2]])).length, 0);
  } finally {
    value.database.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("invalid DCA limits and exit conditions are rejected", async () => {
  const value = await fixture();
  try {
    assert.throws(() => value.manager.createDca({
      sessionId: "session-1",
      walletAddress: WALLET,
      outputMint: TOKEN,
      orderAmountRaw: "2000000",
      maximumTotalRaw: "1000000",
      intervalSeconds: 1,
      maximumExecutions: 2,
      expiresAt: "2026-07-30T00:00:00.000Z",
    }, new Date("2026-07-29T00:00:00.000Z")));
    assert.throws(() => value.manager.createExit({
      sessionId: "session-1",
      walletAddress: WALLET,
      inputMint: TOKEN,
      amountRaw: "1",
      entryPriceUsd: 1,
      stopLossPriceUsd: 2,
      expiresAt: "2026-07-30T00:00:00.000Z",
    }, new Date("2026-07-29T00:00:00.000Z")));
    assert.throws(() => value.manager.setStatus("missing", "ENABLE" as "RESUME"));
  } finally {
    value.database.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});
