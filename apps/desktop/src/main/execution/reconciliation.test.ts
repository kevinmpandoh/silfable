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
});
