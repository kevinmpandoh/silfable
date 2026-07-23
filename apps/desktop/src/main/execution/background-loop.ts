import { EventEmitter } from "node:events";
import type { PositionStrategyManager, ExitTriggerEvent } from "./strategy-manager.js";

export class DurableBackgroundObservationService extends EventEmitter {
  readonly #strategyManager: PositionStrategyManager;
  #intervalTimer: NodeJS.Timeout | null = null;
  #active = false;
  #pollIntervalMs: number;

  constructor(strategyManager: PositionStrategyManager, pollIntervalMs = 2000) {
    super();
    this.#strategyManager = strategyManager;
    this.#pollIntervalMs = pollIntervalMs;

    // Listen to strategy exits
    this.#strategyManager.on("exit_triggered", (event: ExitTriggerEvent) => {
      this.emit("auto_execution_triggered", event);
    });
  }

  isRunning(): boolean {
    return this.#active;
  }

  startObservationLoop(fetchPricesCallback: (mints: string[]) => Promise<Map<string, number>>): void {
    if (this.#active) return;
    this.#active = true;

    this.#intervalTimer = setInterval(async () => {
      if (!this.#active) return;
      try {
        const activePositions = this.#strategyManager.getActivePositions();
        if (activePositions.length === 0) return;

        const uniqueMints = [...new Set(activePositions.map((p) => p.mintAddress))];
        const prices = await fetchPricesCallback(uniqueMints);

        for (const [mint, price] of prices.entries()) {
          this.#strategyManager.evaluatePriceTick(mint, price);
        }
      } catch (err) {
        this.emit("error", err);
      }
    }, this.#pollIntervalMs);

    this.emit("statusChange", { running: true });
  }

  stopObservationLoop(): void {
    this.#active = false;
    if (this.#intervalTimer !== null) {
      clearInterval(this.#intervalTimer);
      this.#intervalTimer = null;
    }
    this.emit("statusChange", { running: false });
  }
}
