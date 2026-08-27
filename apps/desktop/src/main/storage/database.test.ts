import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MAINNET_PROFILE_ID, RuntimeDatabase } from "./database.js";

test("Mainnet database persists encrypted wallet metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mirae-mainnet-db-"));
  const path = join(directory, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    assert.equal(database.hasWallet(MAINNET_PROFILE_ID), false);
    database.insertWallet({ id: "wallet-1", profileId: MAINNET_PROFILE_ID, ciphertext: "encrypted-address", nonce: "nonce", keyId: "local-data-key-v1", createdAt: "2026-07-21T00:00:00.000Z" });
    assert.equal(database.hasWallet(MAINNET_PROFILE_ID), true);
    assert.equal(database.getWallet(MAINNET_PROFILE_ID)?.ciphertext, "encrypted-address");
    database.close();
    const reopened = await RuntimeDatabase.open(path);
    assert.equal(reopened.hasWallet(MAINNET_PROFILE_ID), true);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("provider settings persist without secret material", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mirae-settings-db-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    database.setSetting("ai.provider.openrouter", { model: "vendor/model" });
    assert.deepEqual(database.getSetting("ai.provider.openrouter"), { model: "vendor/model" });
    database.deleteSetting("ai.provider.openrouter");
    assert.equal(database.getSetting("ai.provider.openrouter"), null);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("kamino rwa position records round-trip through the database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mirae-kamino-rwa-db-"));
  const database = await RuntimeDatabase.open(join(dir, "test.sqlite3"));
  try {
    assert.deepEqual(database.listKaminoRwaPositionRecords(), []);
    const record = { id: "11111111-1111-4111-8111-111111111111", ciphertext: "cipher", nonce: "nonce", tag: "tag", updatedAt: new Date().toISOString() };
    database.upsertKaminoRwaPositionRecord(record);
    assert.deepEqual(database.listKaminoRwaPositionRecords(), [record]);
    const updated = { ...record, ciphertext: "cipher2", updatedAt: new Date(Date.now() + 1000).toISOString() };
    database.upsertKaminoRwaPositionRecord(updated);
    const rows = database.listKaminoRwaPositionRecords();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.ciphertext, "cipher2");
    database.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("vault reset clears active settings, wallets, and encrypted sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mirae-reset-db-"));
  try {
    const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
    database.setSetting("security.master-password.v1", { verifier: true });
    database.insertWallet({ id: "wallet-1", profileId: MAINNET_PROFILE_ID, ciphertext: "encrypted-address", nonce: "nonce", keyId: "local-data-key-v1", createdAt: "2026-07-21T00:00:00.000Z" });
    database.upsertSessionRecord({ id: "00000000-0000-4000-8000-000000000001", ciphertext: "ciphertext", nonce: "nonce", tag: "tag", updatedAt: "2026-07-21T00:00:00.000Z" });
    database.upsertPumpRiskLedgerRecord({ ciphertext: "ledger-ciphertext", nonce: "ledger-nonce", tag: "ledger-tag", updatedAt: "2026-07-21T00:00:00.000Z" });
    database.resetVaultData();
    assert.equal(database.getSetting("security.master-password.v1"), null);
    assert.equal(database.hasWallet(MAINNET_PROFILE_ID), false);
    assert.deepEqual(database.listSessionRecords(), []);
    assert.equal(database.getPumpRiskLedgerRecord(), null);
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
