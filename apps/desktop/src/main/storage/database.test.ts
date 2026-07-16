import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeDatabase } from "./database";

test("SQLite migrations persist one Devnet wallet record", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-db-test-"));
  const path = join(directory, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    assert.equal(database.hasWallet("devnet-simulation"), false);
    database.insertWallet({
      id: "wallet-1",
      profileId: "devnet-simulation",
      ciphertext: "ciphertext-with-auth-tag",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(database.hasWallet("devnet-simulation"), true);
    assert.throws(() =>
      database.insertWallet({
        id: "wallet-2",
        profileId: "devnet-simulation",
        ciphertext: "different-ciphertext",
        nonce: "different-nonce",
        keyId: "local-data-key-v1",
        createdAt: "2026-07-16T00:00:01.000Z",
      }),
    );
    database.close();

    const reopened = await RuntimeDatabase.open(path);
    assert.equal(reopened.hasWallet("devnet-simulation"), true);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
