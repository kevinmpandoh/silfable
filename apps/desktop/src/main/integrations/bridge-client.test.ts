import { describe, expect, it } from "vitest";

import { BridgeClientService } from "./bridge-client.js";

describe("BridgeClientService", () => {
  it("fetches cross-chain bridge quote from Solana to Arbitrum", async () => {
    const client = new BridgeClientService();
    const quote = await client.getQuote({
      srcChainId: 7565164, // Solana
      srcChainTokenIn: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC Solana
      amountIn: "10000000", // 10 USDC
      dstChainId: 42161, // Arbitrum
      dstChainTokenOut: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC Arbitrum
      dstChainTokenOutRecipient: "0x1111111111111111111111111111111111111111",
    });

    expect(quote.srcChainId).toBe(7565164);
    expect(quote.dstChainId).toBe(42161);
    expect(quote.estimatedTimeSeconds).toBeGreaterThan(0);
    expect(BigInt(quote.estimatedAmountOut)).toBeGreaterThan(0n);
    expect(quote.estimatedFeeUsd).toBeGreaterThan(0);
  });

  it("throws error if source and destination chain IDs are identical", async () => {
    const client = new BridgeClientService();
    await expect(
      client.getQuote({
        srcChainId: 42161,
        srcChainTokenIn: "USDC",
        amountIn: "100",
        dstChainId: 42161,
        dstChainTokenOut: "USDC",
        dstChainTokenOutRecipient: "0x123",
      })
    ).rejects.toThrow("Source and destination chains must be different");
  });
});
