import type { SessionService } from "../sessions/service.js";
import type { LimitOrderService } from "../mission/limit-order.js";

export class ReconciliationService {
  readonly #sessions: SessionService;
  readonly #limitOrders: LimitOrderService;

  constructor(sessions: SessionService, limitOrders: LimitOrderService) {
    this.#sessions = sessions;
    this.#limitOrders = limitOrders;
  }

  /**
   * Scans all stored session records for limit orders with status 'unknown',
   * attempts to verify their transaction signature on-chain, and updates the local state.
   */
  async reconcilePendingOrders(): Promise<number> {
    let reconciledCount = 0;
    try {
      const allSessions = await this.#sessions.list();
      for (const session of allSessions) {
        let changed = false;
        const messages = [...session.messages];
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.limitOrderExecution && msg.limitOrderExecution.status === "unknown") {
            try {
              msg.limitOrderExecution = await this.#limitOrders.verifyExecutionReceipt(msg.limitOrderExecution);
              changed = true;
              reconciledCount++;
            } catch { /* stay unknown */ }
          }
          if (msg.limitOrderCancelReceipt && msg.limitOrderCancelReceipt.status === "unknown") {
            try {
              msg.limitOrderCancelReceipt = await this.#limitOrders.verifyCancelReceipt(msg.limitOrderCancelReceipt);
              changed = true;
              reconciledCount++;
            } catch { /* stay unknown */ }
          }
        }
        if (changed) {
          await this.#sessions.upsert({ ...session, messages });
        }
      }
    } catch (error) {
      console.error("Failed to reconcile pending orders:", error);
    }
    return reconciledCount;
  }
}
