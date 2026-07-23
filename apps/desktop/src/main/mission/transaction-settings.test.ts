import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeDatabase } from "../storage/database.js";
import { DEFAULT_TRANSACTION_SETTINGS, TransactionSettingsService } from "./transaction-settings.js";

test("transaction settings use safe defaults and persist after database reopen", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const root = await mkdtemp(join(tmpdir(), "silfable-settings-"));
  const path = join(root, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    const service = new TransactionSettingsService(database);
    assert.deepEqual(service.get(), DEFAULT_TRANSACTION_SETTINGS);
    service.save({ maxNetworkFeeLamports: 300_000, maxFeePercent: 8, defaultSlippageBps: 40, defaultDeadlineMinutes: 45, priority: "economy" });
    database.close();
    const reopened = await RuntimeDatabase.open(path);
    assert.deepEqual(new TransactionSettingsService(reopened).get(), { maxNetworkFeeLamports: 300_000, maxFeePercent: 8, defaultSlippageBps: 40, defaultDeadlineMinutes: 45, priority: "economy" });
    reopened.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
