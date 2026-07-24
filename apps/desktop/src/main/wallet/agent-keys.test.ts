import { describe, expect, it } from "vitest";

import { AgentKeyService, type AgentLimits } from "./agent-keys.js";

const DEFAULT_LIMITS: AgentLimits = {
  maxAllocationLamports: 1_000_000_000n, // 1 SOL
  maxSingleTxLamports: 100_000_000n, // 0.1 SOL
  maxDrawdownBps: 1000, // 10%
  maxTxPerHour: 5,
};

describe("AgentKeyService", () => {
  it("initializes an active agent signer with configured limits", async () => {
    const service = new AgentKeyService();
    expect(service.isInitialized()).toBe(false);

    const result = await service.initializeAgent(DEFAULT_LIMITS, 1_000_000_000n);
    expect(result.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u);
    expect(service.isInitialized()).toBe(true);

    const status = service.getAgentStatus();
    expect(status.active).toBe(true);
    expect(status.address).toBe(result.address);
    expect(status.limits).toEqual(DEFAULT_LIMITS);
  });

  it("validates proposed transaction limits", async () => {
    const service = new AgentKeyService();
    await service.initializeAgent(DEFAULT_LIMITS, 1_000_000_000n);

    // Valid tx
    const valid = service.validateProposedTransaction(50_000_000n);
    expect(valid.allowed).toBe(true);

    // Exceeds single tx size
    const invalidSize = service.validateProposedTransaction(200_000_000n);
    expect(invalidSize.allowed).toBe(false);
    expect(invalidSize.reason).toContain("exceeds max single transaction limit");
  });

  it("triggers kill switch when drawdown limit is exceeded", async () => {
    const service = new AgentKeyService();
    await service.initializeAgent(DEFAULT_LIMITS, 1_000_000_000n);

    // Record initial txs with slight loss
    service.recordTransactionResult(50_000_000n, -20_000_000n, 980_000_000n);
    expect(service.isInitialized()).toBe(true);

    // Record severe loss exceeding 10% drawdown (1,000,000,000 -> 850,000,000 is 15% drop)
    service.recordTransactionResult(50_000_000n, -130_000_000n, 850_000_000n);
    expect(service.isInitialized()).toBe(false);

    const status = service.getAgentStatus();
    expect(status.revoked).toBe(true);
    expect(status.revokeReason).toContain("Automated Kill Switch: Drawdown reached 15%");

    expect(() => service.getSigner()).toThrow("REVOKED");
  });

  it("allows manual emergency stop (revoke)", async () => {
    const service = new AgentKeyService();
    await service.initializeAgent(DEFAULT_LIMITS, 1_000_000_000n);
    expect(service.isInitialized()).toBe(true);

    service.revokeAgent("User clicked emergency halt");
    expect(service.isInitialized()).toBe(false);
    expect(() => service.getSigner()).toThrow("User clicked emergency halt");
  });
});
