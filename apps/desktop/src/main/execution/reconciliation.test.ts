import { test, describe } from "node:test";
import assert from "node:assert";
import { ReconciliationService } from "./reconciliation.js";

describe("ReconciliationService", () => {
  test("reconciles pending limit orders and updates session state on restart", async () => {
    let upsertedSession: any = null;

    const mockSessions = {
      list: async () => [
        {
          id: "session-1",
          messages: [
            {
              id: "msg-1",
              limitOrderExecution: {
                id: "receipt-1",
                status: "unknown",
                depositSignature: "sig123",
              },
            },
          ],
        },
      ],
      upsert: async (session: any) => {
        upsertedSession = session;
      },
    };

    const mockLimitOrders = {
      verifyExecutionReceipt: async (receipt: any) => {
        return {
          ...receipt,
          status: "active",
          depositConfirmed: true,
        };
      },
      verifyCancelReceipt: async (receipt: any) => receipt,
    };

    const service = new ReconciliationService(mockSessions as any, mockLimitOrders as any);
    const count = await service.reconcilePendingOrders();

    assert.strictEqual(count, 1);
    assert.notStrictEqual(upsertedSession, null);
    assert.strictEqual(upsertedSession.messages[0].limitOrderExecution.status, "active");
    assert.strictEqual(upsertedSession.messages[0].limitOrderExecution.depositConfirmed, true);
  });

  test("does not print provider or decrypted error details", async () => {
    const secretMarker = "jup_private_key_must_not_appear";
    const messages: unknown[][] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => { messages.push(args); };
    try {
      const service = new ReconciliationService({
        list: async () => { throw new Error(`provider failed: ${secretMarker}`); },
      } as any, {} as any);
      assert.strictEqual(await service.reconcilePendingOrders(), 0);
    } finally {
      console.info = original;
    }
    assert.strictEqual(JSON.stringify(messages).includes(secretMarker), false);
    assert.strictEqual(messages.length, 1);
    const record = JSON.parse(String(messages[0]?.[0])) as Record<string, unknown>;
    assert.strictEqual(record.event, "reconciliation_failed");
    assert.strictEqual(record.operation, "limit_order_reconciliation");
  });
});
