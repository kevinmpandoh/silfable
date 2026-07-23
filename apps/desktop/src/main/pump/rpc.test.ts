import assert from "node:assert/strict";
import { test } from "node:test";

import { PumpMainnetRpc } from "./rpc.js";

const GLOBAL = "4wTV1YmiEkRvAtNtsSGPtUrqRYQq8fJAPxrBN1ybump";
const OWNER = "6EF8rrecthR5DkzonAcEnjLo9i9Fdtn5NQjN7pump3P";

test("Pump Mainnet RPC sends bounded finalized account requests and decodes base64", async () => {
  let request: { method?: string; params?: unknown[] } | undefined;
  const rpc = new PumpMainnetRpc({
    rpcUrl: "https://rpc.example.test",
    fetch: async (_url, init) => {
      request = JSON.parse(String(init?.body)) as typeof request;
      return response({ result: { context: { slot: 42 }, value: [{ lamports: 7, owner: OWNER, data: [Buffer.from([1, 2, 3]).toString("base64"), "base64"] }] } });
    },
  });
  const result = await rpc.getMultipleAccountsInfoAndContext([GLOBAL], { commitment: "finalized" });
  assert.equal(request?.method, "getMultipleAccounts");
  assert.deepEqual(request?.params, [[GLOBAL], { commitment: "finalized", encoding: "base64" }]);
  assert.equal(result.context.slot, 42);
  assert.deepEqual([...result.value[0]!.data], [1, 2, 3]);
});

test("Pump Mainnet RPC rejects credential-bearing endpoints and malformed account evidence", async () => {
  assert.throws(() => new PumpMainnetRpc({ rpcUrl: "https://user:secret@rpc.example.test" }), /credentials/u);
  const rpc = new PumpMainnetRpc({
    rpcUrl: "https://rpc.example.test",
    fetch: async () => response({ result: { context: { slot: 42 }, value: [{ lamports: 7, owner: OWNER, data: ["%%%", "base64"] }] } }),
  });
  await assert.rejects(() => rpc.getMultipleAccountsInfoAndContext([GLOBAL], { commitment: "finalized" }), /account data/u);
});

test("Pump Mainnet RPC accepts a valid zero-data system account", async () => {
  const rpc = new PumpMainnetRpc({
    rpcUrl: "https://rpc.example.test",
    fetch: async () => response({ result: { context: { slot: 42 }, value: [{ lamports: 1, owner: "11111111111111111111111111111111", data: ["", "base64"] }] } }),
  });
  const result = await rpc.getMultipleAccountsInfoAndContext([GLOBAL], { commitment: "finalized" });
  assert.equal(result.value[0]?.data.length, 0);
});

test("Pump Mainnet RPC returns a finalized wallet balance without numeric coercion in callers", async () => {
  const rpc = new PumpMainnetRpc({
    rpcUrl: "https://rpc.example.test",
    fetch: async () => response({ result: { context: { slot: 43 }, value: 123_456_789 } }),
  });
  assert.deepEqual(await rpc.getBalanceAndContext(GLOBAL, { commitment: "finalized" }), { context: { slot: 43 }, value: "123456789" });
});

test("Pump Mainnet RPC sends signed transaction base64 and returns valid signature", async () => {
  let request: { method?: string; params?: unknown[] } | undefined;
  const dummySignature = "1".repeat(64);
  const dummyTxBase64 = Buffer.from(new Uint8Array(100)).toString("base64");
  const rpc = new PumpMainnetRpc({
    rpcUrl: "https://rpc.example.test",
    fetch: async (_url, init) => {
      request = JSON.parse(String(init?.body)) as typeof request;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: dummySignature }));
    },
  });
  const result = await rpc.sendTransaction(dummyTxBase64);
  assert.equal(request?.method, "sendTransaction");
  assert.equal(result, dummySignature);
});


function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
