import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import { LocalCrashTelemetryService, normalizeChildProcessType, normalizeCrashReason } from "./service";

class MemoryDataKeyStore {
  dataKey: string | null = null;
  async getSecret() { return this.dataKey; }
  async setSecret(_name: "database-data-key", value: string) { this.dataKey = value; }
}

test("crashes are not collected before explicit opt-in", async () => {
  const context = await createContext();
  try {
    assert.equal(await context.service.capture({ processType: "renderer", reason: "crashed", exitCode: 9 }), false);
    assert.equal(context.database.countCrashReports(), 0);
    assert.equal(context.service.getSettings().consent, false);
  } finally { await context.close(); }
});

test("opted-in reports contain only bounded code fields and stay encrypted", async () => {
  const context = await createContext();
  try {
    context.service.setConsent(true);
    assert.equal(await context.service.capture({ processType: "renderer", reason: "oom", exitCode: 137 }), true);
    const stored = context.database.listCrashReports()[0];
    assert.ok(stored);
    assert.equal(stored.encryptedPayload.includes("oom"), false);
    const report = (await context.service.listReports())[0];
    assert.ok(report);
    assert.equal(report.reason, "oom");
    assert.equal(report.errorCode, "exit:137");
    assert.equal(report.transmitted, false);
    assert.deepEqual(Object.keys(report).sort(), [
      "appVersion", "createdAt", "errorCode", "id", "platform", "processType", "reason", "schemaVersion", "transmitted",
    ]);
  } finally { await context.close(); }
});

test("revoking consent immediately purges existing reports", async () => {
  const context = await createContext();
  try {
    context.service.setConsent(true);
    await context.service.capture({ processType: "gpu", reason: "crashed", exitCode: 1 });
    assert.equal(context.database.countCrashReports(), 1);
    const settings = context.service.setConsent(false);
    assert.equal(settings.consent, false);
    assert.equal(settings.reportCount, 0);
    assert.deepEqual(await context.service.listReports(), []);
  } finally { await context.close(); }
});

test("Electron process details are reduced to allowlisted values", () => {
  assert.equal(normalizeCrashReason("crashed"), "crashed");
  assert.equal(normalizeCrashReason("secret-wallet-reason"), "unknown");
  assert.equal(normalizeChildProcessType("GPU"), "gpu");
  assert.equal(normalizeChildProcessType("Wallet Service"), "other-child");
});

async function createContext() {
  const directory = await mkdtemp(join(tmpdir(), "silfable-telemetry-test-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const service = new LocalCrashTelemetryService({
    database,
    cipher: new LocalDataCipher(new MemoryDataKeyStore()),
    appVersion: "0.1.0",
  });
  return {
    database,
    service,
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
