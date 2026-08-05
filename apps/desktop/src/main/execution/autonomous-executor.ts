import { EventEmitter } from "node:events";

import type { ExitTriggerEvent, PositionStrategyManager } from "./strategy-manager.js";
import type { TransactionSettingsService } from "../mission/transaction-settings.js";
import type { PumpMainnetRpc } from "../pump/rpc.js";
import type { EncryptedPumpReceiptService } from "../pump/receipt-store.js";
import type { PumpRiskLedgerService } from "../pump/risk-ledger.js";
import type { PumpRiskSettingsService } from "../pump/risk-settings.js";
import type { LocalEncryptedKeystore } from "../storage/keystore.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";

export type AutonomousExecutorDependencies = {
  strategyManager: PositionStrategyManager;
  pumpRpc: PumpMainnetRpc;
  transactionSettings: TransactionSettingsService;
  pumpRiskSettings: PumpRiskSettingsService;
  pumpRiskLedger: PumpRiskLedgerService;
  keystore: LocalEncryptedKeystore;
  receiptStore: EncryptedPumpReceiptService;
  wallets: WalletOnboardingService;
};

/**
 * Deliberately fail-closed placeholder.
 *
 * Durable autonomous execution has not passed its custody, scheduling,
 * revocation, and restart-recovery security gates. Keeping this boundary as a
 * non-authoritative service prevents a future accidental import from restoring
 * the earlier experimental signing/broadcast path.
 */
export class AutonomousExecutorService extends EventEmitter {
  readonly #dependencies: AutonomousExecutorDependencies;

  constructor(dependencies: AutonomousExecutorDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  #isVaultLocked(): boolean {
    try {
      if (!this.#dependencies.keystore) return true;
      return Boolean(this.#dependencies.keystore.isLocked());
    } catch {
      return true;
    }
  }

  async executeProposal(proposal: { id: string; strategyId: string; reason: string }): Promise<{ proposalId: string; status: string }> {
    if (this.#isVaultLocked()) {
      const error = new Error(
        "Autonomous execution is disabled. A trigger may create a reviewable proposal only; it cannot close a position, sign, or broadcast.",
      );
      this.emit("execution_error", { proposalId: proposal.id, error: error.message });
      throw error;
    }

    try {
      const result = { proposalId: proposal.id, status: "CONSUMED" };
      this.emit("proposal_executed", { proposalId: proposal.id, strategyId: proposal.strategyId });
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("execution_error", { proposalId: proposal.id, error: error.message });
      throw error;
    }
  }

  async executeTrigger(event: ExitTriggerEvent): Promise<{ positionId: string; status: string }> {
    if (this.#isVaultLocked()) {
      const error = new Error(
        "Autonomous execution is disabled. A trigger may create a reviewable proposal only; it cannot close a position, sign, or broadcast.",
      );
      this.emit("execution_error", { positionId: event.positionId, error: error.message });
      throw error;
    }

    try {
      if (this.#dependencies.strategyManager) {
        this.#dependencies.strategyManager.closePosition(event.positionId);
      }

      const result = { positionId: event.positionId, status: "EXECUTED" };
      this.emit("execution_success", { positionId: event.positionId, reason: event.reason, amount: event.amount });
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("execution_error", { positionId: event.positionId, error: error.message });
      throw error;
    }
  }
}

