import assert from "node:assert/strict";
import test from "node:test";
import { parseInvestmentBudget } from "./investment-intent";

test("recognizes an English USD investment request", () => {
  assert.equal(parseInvestmentBudget("Hi Mirae, I have $100. Help me invest it."), 100);
});

test("recognizes an Indonesian USD allocation request", () => {
  assert.equal(parseInvestmentBudget("Tolong rekomendasi investasi 250 USD di Solana"), 250);
});

test("does not hijack ordinary swap messages", () => {
  assert.equal(parseInvestmentBudget("swap $100 USDC to SOL"), null);
});

test("rejects budgets outside supported bounds", () => {
  assert.equal(parseInvestmentBudget("invest $0.50"), null);
  assert.equal(parseInvestmentBudget("invest $1000001"), null);
});

test("accepts a small research budget without routing to generic AI", () => {
  assert.equal(parseInvestmentBudget("Hi Mirae, I have $4. Help me invest it."), 4);
});
