import assert from "node:assert/strict";
import test from "node:test";

import { createPerpPreflightToken, verifyPerpPreflightToken } from "./perp-preflight-token";

const originalEnv = {
  databaseUrl: process.env.DATABASE_URL,
  dedicated: process.env.PERP_PREFLIGHT_SECRET,
  recommendation: process.env.INVESTMENT_RECOMMENDATION_SECRET,
  vercel: process.env.VERCEL_ENV,
  worker: process.env.WORKER_ENCRYPTION_KEY,
};

function restoreEnv(): void {
  setOrDelete("DATABASE_URL", originalEnv.databaseUrl);
  setOrDelete("PERP_PREFLIGHT_SECRET", originalEnv.dedicated);
  setOrDelete("INVESTMENT_RECOMMENDATION_SECRET", originalEnv.recommendation);
  setOrDelete("VERCEL_ENV", originalEnv.vercel);
  setOrDelete("WORKER_ENCRYPTION_KEY", originalEnv.worker);
}

function setOrDelete(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function proof(expiresAt = Date.now() + 60_000) {
  return {
    sessionId: "0123456789abcdef01234567",
    walletAddress: "11111111111111111111111111111111",
    digest: "a".repeat(64),
    expiresAt,
  };
}

test.afterEach(restoreEnv);

test("local preflight tokens may use the documented fallback secret", () => {
  delete process.env.VERCEL_ENV;
  delete process.env.PERP_PREFLIGHT_SECRET;
  delete process.env.INVESTMENT_RECOMMENDATION_SECRET;
  delete process.env.WORKER_ENCRYPTION_KEY;
  process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/mirae_test";

  const input = proof();
  const token = createPerpPreflightToken(input);
  assert.equal(verifyPerpPreflightToken(token, input), true);
});

test("production requires a dedicated preflight secret", () => {
  process.env.VERCEL_ENV = "production";
  delete process.env.PERP_PREFLIGHT_SECRET;
  process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/mirae_test";

  assert.throws(
    () => createPerpPreflightToken(proof()),
    /PERP_PREFLIGHT_SECRET must be configured/u,
  );
});

test("production accepts a stable dedicated preflight secret", () => {
  process.env.VERCEL_ENV = "production";
  process.env.PERP_PREFLIGHT_SECRET = "0123456789abcdef".repeat(4);

  const input = proof();
  const token = createPerpPreflightToken(input);
  assert.equal(verifyPerpPreflightToken(token, input), true);
});

test("expired preflight tokens are rejected", () => {
  delete process.env.VERCEL_ENV;
  process.env.PERP_PREFLIGHT_SECRET = "0123456789abcdef".repeat(4);

  const input = proof(Date.now() - 1);
  const token = createPerpPreflightToken(input);
  assert.equal(verifyPerpPreflightToken(token, input), false);
});

test("preflight tokens cannot be reused for another digest", () => {
  delete process.env.VERCEL_ENV;
  process.env.PERP_PREFLIGHT_SECRET = "0123456789abcdef".repeat(4);

  const input = proof();
  const token = createPerpPreflightToken(input);
  assert.equal(verifyPerpPreflightToken(token, { ...input, digest: "b".repeat(64) }), false);
});
