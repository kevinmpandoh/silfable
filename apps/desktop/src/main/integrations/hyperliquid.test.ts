import { describe, expect, it } from "vitest";

import { HyperliquidClientService } from "./hyperliquid.js";

describe("HyperliquidClientService", () => {
  it("fetches perpetual market metadata", async () => {
    const client = new HyperliquidClientService("mainnet");
    const meta = await client.getMetaData();
    expect(meta.universe.length).toBeGreaterThan(0);
    expect(meta.universe.some((item) => item.name === "SOL")).toBe(true);
  });

  it("places perpetual order using Agent key", async () => {
    const client = new HyperliquidClientService("mainnet");
    const res = await client.placeOrder(
      "0x1111111111111111111111111111111111111111",
      "0xmock_signature",
      {
        coin: "SOL",
        isBuy: true,
        limitPrice: 150.5,
        size: 1.0,
        orderType: "market",
      }
    );

    expect(res.status).toBe("ok");
    expect(res.response?.data.statuses[0]?.filled).toBeDefined();
  });

  it("rejects order with invalid size or limit price", async () => {
    const client = new HyperliquidClientService("mainnet");
    const res = await client.placeOrder("0x111", "0xsig", {
      coin: "SOL",
      isBuy: true,
      limitPrice: 0,
      size: 0,
      orderType: "market",
    });

    expect(res.status).toBe("err");
    expect(res.error).toContain("Order size must be greater than zero");
  });
});
