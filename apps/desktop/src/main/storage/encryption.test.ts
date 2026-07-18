import assert from "node:assert/strict";
import test from "node:test";

import { LocalDataCipher } from "./encryption";

class DelayedDataKeyStore {
  dataKey: string | null = null;
  writes = 0;
  async getSecret() {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return this.dataKey;
  }
  async setSecret(_name: "database-data-key", value: string) {
    this.writes += 1;
    await new Promise((resolve) => setTimeout(resolve, 2));
    this.dataKey = value;
  }
}

test("concurrent encryption initializes exactly one shared data key", async () => {
  const store = new DelayedDataKeyStore();
  const cipher = new LocalDataCipher(store);
  const [first, second, third] = await Promise.all([
    cipher.encryptString("first"),
    cipher.encryptString("second"),
    cipher.encryptString("third"),
  ]);
  assert.equal(store.writes, 1);
  assert.equal(await cipher.decryptString(first), "first");
  assert.equal(await cipher.decryptString(second), "second");
  assert.equal(await cipher.decryptString(third), "third");
});
