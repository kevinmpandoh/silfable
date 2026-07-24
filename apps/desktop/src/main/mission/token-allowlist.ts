import type { MainnetReadService } from "../integrations/read-only.js";
import type { RuntimeDatabase } from "../storage/database.js";

export type AutonomousEligibilityResult = 
  | { eligible: true }
  | { eligible: false; reason: string };

export class TokenAllowlistService {
  readonly #db: RuntimeDatabase;
  readonly #reads: MainnetReadService;

  constructor(db: RuntimeDatabase, reads: MainnetReadService) {
    this.#db = db;
    this.#reads = reads;
  }

  /**
   * Retrieves the current user-defined allowlist of mint addresses.
   */
  getAllowlist(): string[] {
    const raw = this.#db.getSetting("autonomous_token_allowlist");
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback to empty
      }
    }
    return [];
  }

  /**
   * Updates the user-defined allowlist.
   */
  setAllowlist(mints: string[]): void {
    this.#db.setSetting("autonomous_token_allowlist", JSON.stringify(mints));
  }

  /**
   * Evaluates whether a token is eligible for autonomous AI operations (P3.4).
   * It must be on the user's allowlist, and must pass basic liquidity/verification checks.
   */
  async evaluateAutonomousEligibility(mint: string): Promise<AutonomousEligibilityResult> {
    const allowlist = this.getAllowlist();
    if (!allowlist.includes(mint)) {
      return { eligible: false, reason: "Token is not in the autonomous allowlist." };
    }

    // In a real implementation, we would query the Jupiter API or RPC for liquidity here.
    // For now, we fetch price to at least verify the token is resolvable by our oracle.
    try {
      const prices = await this.#reads.prices([mint]);
      if (!prices.has(mint)) {
        return { eligible: false, reason: "Token price is unresolvable or lacks liquidity." };
      }
    } catch (err) {
      return { eligible: false, reason: "Failed to verify token liquidity." };
    }

    return { eligible: true };
  }
}
