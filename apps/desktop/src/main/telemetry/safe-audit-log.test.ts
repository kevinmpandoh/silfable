import assert from "node:assert/strict";
import test from "node:test";

import { writeSafeAuditLog } from "./safe-audit-log.js";

test("safe audit log writes only allowlisted structured fields", () => {
  const messages: unknown[][] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => { messages.push(args); };
  try {
    writeSafeAuditLog("reconciliation_failed", { operation: "limit_order_reconciliation", outcome: "failure", count: -1, code: "provider error", retryAt: "not-a-date" });
  } finally {
    console.info = original;
  }
  const record = JSON.parse(String(messages[0]?.[0])) as Record<string, unknown>;
  assert.equal(record.event, "reconciliation_failed");
  assert.equal(record.operation, "limit_order_reconciliation");
  assert.equal(record.outcome, "failure");
  assert.equal("count" in record, false);
  assert.equal("code" in record, false);
  assert.equal("retryAt" in record, false);
});

test("safe audit log rejects free-form event names", () => {
  assert.throws(() => writeSafeAuditLog("wallet password Mc465800."), /bounded machine-readable/u);
});
