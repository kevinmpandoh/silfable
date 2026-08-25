import assert from "node:assert/strict";
import test from "node:test";
import { X402PaymentRequirementsSchema, X402PolicySchema, X402_SOLANA_MAINNET, X402_SOLANA_USDC_MINT } from "@mirae/contracts";
import { assertSafeExternalUrl, compactProviderEvidence, decodeX402Header, digest, encodeX402Header, stableJson } from "./x402-server";

const requirements = { scheme: "exact", network: X402_SOLANA_MAINNET, amount: "10000", asset: X402_SOLANA_USDC_MINT, payTo: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4", maxTimeoutSeconds: 60, extra: { feePayer: "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd" } };

test("canonical JSON and digest do not depend on key insertion order", () => {
  assert.equal(stableJson({ b: 2, a: { d: 4, c: 3 } }), stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
});

test("x402 headers round trip and enforce size limits", () => {
  assert.deepEqual(decodeX402Header(encodeX402Header({ x402Version: 2, accepts: [requirements] })), { x402Version: 2, accepts: [requirements] });
  assert.throws(() => decodeX402Header("a".repeat(32_001)), /too large/u);
});

test("requirements accept only exact canonical USDC on Solana mainnet", () => {
  assert.equal(X402PaymentRequirementsSchema.parse(requirements).amount, "10000");
  assert.throws(() => X402PaymentRequirementsSchema.parse({ ...requirements, network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" }));
  assert.throws(() => X402PaymentRequirementsSchema.parse({ ...requirements, asset: "So11111111111111111111111111111111111111112" }));
});

test("policy enforces resource, mission and global ceilings", () => {
  assert.equal(X402PolicySchema.parse({ enabled: true, maxResourceAmount: "30000", maxMissionAmount: "100000" }).enabled, true);
  assert.throws(() => X402PolicySchema.parse({ enabled: true, maxResourceAmount: "100001", maxMissionAmount: "100001" }));
  assert.throws(() => X402PolicySchema.parse({ enabled: true, maxResourceAmount: "30000", maxMissionAmount: "20000" }));
});

test("provider URL guard blocks loopback and private hosts before fetch", async () => {
  await assert.rejects(assertSafeExternalUrl("http://example.com/data"), /HTTPS/u);
  await assert.rejects(assertSafeExternalUrl("https://127.0.0.1/data"), /Private/u);
  await assert.rejects(assertSafeExternalUrl("https://localhost/data"), /Private/u);
});

test("oversized market snapshots are reduced to requested-symbol evidence", () => {
  const payload = JSON.stringify({ markets: [
    ...Array.from({ length: 500 }, (_, index) => ({ symbol: `ASSET${index}`, mark: index, padding: "x".repeat(200) })),
    { symbol: "SOL", mark: 145.25, funding: 0.0001 },
  ] });
  const compacted = compactProviderEvidence(payload, { query: "Analyze SOL using x402" }, 4_000);
  assert.match(compacted, /SOL/u);
  assert.match(compacted, /145\.25/u);
  assert.ok(Buffer.byteLength(compacted, "utf8") <= 4_000);
  assert.doesNotMatch(compacted, /ASSET499/u);
});
