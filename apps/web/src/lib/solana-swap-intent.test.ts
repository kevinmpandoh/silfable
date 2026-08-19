import assert from "node:assert/strict";
import test from "node:test";

import { resolveSolanaSwapIntent } from "./solana-swap-intent";

test("resolves Indonesian stock swap request with 'swap untuk NVDA dari usdc 0.5'", () => {
  const result = resolveSolanaSwapIntent("saya ingin swap untuk NVDA dari usdc 0.5");
  assert.equal(result.requested, true);
  assert.equal(result.amount, 0.5);
  assert.equal(result.inputSymbol, "USDC");
  assert.equal(result.outputSymbol, "NVDA");
});

test("resolves English swap request with 'swap 0.5 usdc to NVDA'", () => {
  const result = resolveSolanaSwapIntent("swap 0.5 usdc to NVDA");
  assert.equal(result.requested, true);
  assert.equal(result.amount, 0.5);
  assert.equal(result.inputSymbol, "USDC");
  assert.equal(result.outputSymbol, "NVDA");
});

test("resolves 'beli NVDA pakai 10 USDC'", () => {
  const result = resolveSolanaSwapIntent("beli NVDA pakai 10 USDC");
  assert.equal(result.requested, true);
  assert.equal(result.amount, 10);
  assert.equal(result.inputSymbol, "USDC");
  assert.equal(result.outputSymbol, "NVDA");
});

test("resolves SOL to USDC swap", () => {
  const result = resolveSolanaSwapIntent("swap 1 sol to usdc");
  assert.equal(result.requested, true);
  assert.equal(result.amount, 1);
  assert.equal(result.inputSymbol, "SOL");
  assert.equal(result.outputSymbol, "USDC");
});

test("ignores non-swap messages", () => {
  const result = resolveSolanaSwapIntent("analisa saham NVDA");
  assert.equal(result.requested, false);
});
