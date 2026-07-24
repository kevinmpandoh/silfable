import type { MissionContractPreview } from "@silfable/contracts";
import { describe, expect, it, vi } from "vitest";

import { AgentKeyService } from "../wallet/agent-keys.js";
import { AutonomousPolicyService } from "./autonomous-policy.js";
import type { TokenAllowlistService } from "./token-allowlist.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const mockPreview: MissionContractPreview = {
  id: "test-uuid",
  status: "ready-for-review",
  goal: "Buy SOL with USDC",
  walletAddress: "11111111111111111111111111111111",
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  inputAmount: "1000000",
  maxSlippageBps: 50,
  deadlineAt: new Date(Date.now() + 3600000).toISOString(),
  stopConditions: [],
  quote: null,
  checks: [],
  executionAllowed: false,
  createdAt: new Date().toISOString(),
};

describe("AutonomousPolicyService", () => {
  it("denies autonomous execution if agent key is uninitialized", async () => {
    const agentKeys = new AgentKeyService();
    const allowlist = {
      evaluateAutonomousEligibility: vi.fn().mockResolvedValue({ eligible: true }),
    } as unknown as TokenAllowlistService;

    const service = new AutonomousPolicyService(agentKeys, allowlist);
    const result = await service.evaluateMissionForAutonomousExecution(mockPreview, 1_000_000n);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Agent key is not initialized in active session.");
  });

  it("approves autonomous execution when agent initialized and tokens allowlisted", async () => {
    const agentKeys = new AgentKeyService();
    await agentKeys.initializeAgent(
      {
        maxAllocationLamports: 10_000_000n,
        maxSingleTxLamports: 2_000_000n,
        maxDrawdownBps: 1000,
        maxTxPerHour: 10,
      },
      10_000_000n
    );

    const allowlist = {
      evaluateAutonomousEligibility: vi.fn().mockResolvedValue({ eligible: true }),
    } as unknown as TokenAllowlistService;

    const service = new AutonomousPolicyService(agentKeys, allowlist);
    const result = await service.evaluateMissionForAutonomousExecution(mockPreview, 1_000_000n);

    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.agentAddress).toBeTruthy();
  });

  it("denies autonomous execution if input or output token is not allowlisted", async () => {
    const agentKeys = new AgentKeyService();
    await agentKeys.initializeAgent(
      {
        maxAllocationLamports: 10_000_000n,
        maxSingleTxLamports: 2_000_000n,
        maxDrawdownBps: 1000,
        maxTxPerHour: 10,
      },
      10_000_000n
    );

    const allowlist = {
      evaluateAutonomousEligibility: vi.fn().mockImplementation(async (mint: string) => {
        if (mint === USDC_MINT) return { eligible: true };
        return { eligible: false, reason: "Token is not in the autonomous allowlist." };
      }),
    } as unknown as TokenAllowlistService;

    const service = new AutonomousPolicyService(agentKeys, allowlist);
    const result = await service.evaluateMissionForAutonomousExecution(mockPreview, 1_000_000n);

    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain("Output token");
    expect(result.reasons[0]).toContain("not in the autonomous allowlist");
  });
});
