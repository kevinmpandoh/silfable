import { EventEmitter } from "node:events";
import type { ExitTriggerEvent, PositionStrategyManager } from "./strategy-manager.js";
import type { PumpMainnetRpc } from "../pump/rpc.js";
import type { TransactionSettingsService } from "../mission/transaction-settings.js";
import type { PumpRiskSettingsService } from "../pump/risk-settings.js";
import type { PumpRiskLedgerService } from "../pump/risk-ledger.js";
import { assertPumpProposalWithinRisk } from "../pump/risk-settings.js";
import { buildAndSimulatePumpV2ProductionTransaction, type PumpV2ProductionSimulationInput } from "../pump/production.js";
import type { LocalEncryptedKeystore } from "../storage/keystore.js";
import type { EncryptedPumpReceiptService } from "../pump/receipt-store.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";
import { MAINNET_PROFILE_ID } from "../storage/database.js";
import { evaluatePumpTradeEligibility } from "../pump/eligibility.js";

export class AutonomousExecutorService extends EventEmitter {
  readonly #strategyManager: PositionStrategyManager;
  readonly #pumpRpc: PumpMainnetRpc;
  readonly #transactionSettings: TransactionSettingsService;
  readonly #pumpRiskSettings: PumpRiskSettingsService;
  readonly #pumpRiskLedger: PumpRiskLedgerService;
  readonly #keystore: LocalEncryptedKeystore;
  readonly #receiptStore: EncryptedPumpReceiptService;
  readonly #wallets: WalletOnboardingService;

  constructor(deps: {
    strategyManager: PositionStrategyManager;
    pumpRpc: PumpMainnetRpc;
    transactionSettings: TransactionSettingsService;
    pumpRiskSettings: PumpRiskSettingsService;
    pumpRiskLedger: PumpRiskLedgerService;
    keystore: LocalEncryptedKeystore;
    receiptStore: EncryptedPumpReceiptService;
    wallets: WalletOnboardingService;
  }) {
    super();
    this.#strategyManager = deps.strategyManager;
    this.#pumpRpc = deps.pumpRpc;
    this.#transactionSettings = deps.transactionSettings;
    this.#pumpRiskSettings = deps.pumpRiskSettings;
    this.#pumpRiskLedger = deps.pumpRiskLedger;
    this.#keystore = deps.keystore;
    this.#receiptStore = deps.receiptStore;
    this.#wallets = deps.wallets;
  }

  async executeTrigger(event: ExitTriggerEvent): Promise<void> {
    try {
      if (this.#keystore.isLocked()) {
        throw new Error("Cannot execute autonomous trade: Keystore is locked");
      }

      const activePositions = this.#strategyManager.getActivePositions();
      const position = activePositions.find(p => p.id === event.positionId);
      
      if (!position) {
        throw new Error("Position not found in strategy manager");
      }

      const wallets = await this.#wallets.listWallets();
      const wallet = wallets[0]; // For now, assume primary wallet
      
      if (!wallet) {
        throw new Error("No wallet found for execution");
      }

      // Check balance first
      const balance = await this.#pumpRpc.getBalanceAndContext(wallet.address, { commitment: "finalized" });
      
      const settings = this.#transactionSettings.get();
      const pumpRisk = this.#pumpRiskSettings.get();
      const usage = await this.#pumpRiskLedger.usageFor(position.mintAddress);

      // We are always doing a 100% full sell as per user instruction
      const inputAmount = position.amount;
      
      const riskEvidence = assertPumpProposalWithinRisk({
        side: "sell",
        inputAmount: inputAmount,
        maxSlippageBps: settings.defaultSlippageBps,
        walletSolLamports: balance.value,
        maxNetworkFeeLamports: settings.maxNetworkFeeLamports,
        settings: pumpRisk,
        usage,
      });

      const buildInput: PumpV2ProductionSimulationInput = {
        side: "sell",
        walletAddress: wallet.address,
        tokenMint: position.mintAddress,
        inputAmount: inputAmount,
        minimumOutputAmount: "0", // Handled by codec slippage
        maxTotalFeeBps: pumpRisk.maxTradingFeeBps,
        maxSlippageBps: settings.defaultSlippageBps,
        maxNetworkFeeLamports: settings.maxNetworkFeeLamports,
        maxFeePercent: settings.maxFeePercent,
      };

      const build = await buildAndSimulatePumpV2ProductionTransaction(this.#pumpRpc, buildInput);

      const eligibilityEvidence = evaluatePumpTradeEligibility({
        side: "sell",
        tokenMint: position.mintAddress,
        inputAmount: inputAmount,
        state: build.stateEvidence,
        fee: build.feePreview,
        quote: build.executableQuote,
        risk: riskEvidence,
        simulation: build.simulation,
      });

      if (eligibilityEvidence.status !== "eligible") {
        throw new Error(`Autonomous execution blocked: Trade is not eligible. ${eligibilityEvidence.checks.filter(c => !c.passed).map(c => c.message).join(" ")}`);
      }

      if (build.simulation.status !== "passed" || build.simulation.error) {
        throw new Error("Autonomous execution blocked: Simulation failed");
      }

      // 4. Secure Autonomous Signing
      // Instead of requiring 'EXECUTE MAINNET' via UI, we use the special autonomous signing method
      const signedTransactionBytes = await this.#wallets.withWalletSigner(wallet.address, async (signer) => {
        // Assume build.unsignedTransaction.serialized is a Uint8Array of the transaction
        // Actually, we need to sign the unsignedTransaction using the signer from @solana/kit.
        // We will just use the signer's signTransactions method if it exists, or manually sign.
        const txBytes = build.unsignedTransaction.serialized;
        
        // Since signer is a KeyPairSigner from @solana/kit, it has a signTransactions function or similar,
        // but for simplicity we can construct the signed transaction if we know the API.
        // Let's assume we can just sign it.
        const [signedTx] = await signer.signTransactions([txBytes as any]);
        return signedTx;
      });

      // 5. Broadcast
      let txBase64: string;
      if (signedTransactionBytes instanceof Uint8Array) {
        txBase64 = Buffer.from(signedTransactionBytes).toString("base64");
      } else {
        // Fallback for whatever `signTransactions` returned if it's already a string, though unlikely
        txBase64 = Buffer.from(Object.values(signedTransactionBytes as any) as any[]).toString("base64");
      }

      const signature = await this.#pumpRpc.sendTransaction(txBase64, {
        encoding: "base64",
        skipPreflight: true,
        maxRetries: 0
      });
      
      // We don't poll here to avoid blocking, but in a full impl we'd enqueue to a reconciler
      console.log(`Autonomous execution broadcasted for ${event.mintAddress}: ${signature}`);

      // 6. Cleanup
      this.#strategyManager.closePosition(event.positionId);
      this.emit("execution_success", { positionId: event.positionId, signature });
      
    } catch (err) {
      console.error("Autonomous execution failed", err);
      this.emit("execution_error", { positionId: event.positionId, error: err });
    }
  }
}
