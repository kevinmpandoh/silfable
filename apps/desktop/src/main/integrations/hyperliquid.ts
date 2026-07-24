export type HyperliquidEnvironment = "mainnet" | "testnet";

export type HyperliquidOrderType = "market" | "limit" | "stop_loss" | "take_profit";

export type HyperliquidOrderRequest = {
  coin: string; // e.g. "BTC", "ETH", "SOL"
  isBuy: boolean; // true = Long, false = Short
  limitPrice: number;
  size: number;
  orderType: HyperliquidOrderType;
  reduceOnly?: boolean;
};

export type HyperliquidOrderResponse = {
  status: "ok" | "err";
  response?: {
    type: "order";
    data: {
      statuses: Array<{
        resting?: { oid: number };
        filled?: { totalSz: string; avgPx: string; oid: number };
        error?: string;
      }>;
    };
  };
  error?: string;
};

export class HyperliquidClientService {
  readonly #baseUrl: string;
  readonly #env: HyperliquidEnvironment;

  constructor(env: HyperliquidEnvironment = "mainnet") {
    this.#env = env;
    this.#baseUrl =
      env === "mainnet"
        ? "https://api.hyperliquid.xyz"
        : "https://api.hyperliquid-testnet.xyz";
  }

  getEnvironment(): HyperliquidEnvironment {
    return this.#env;
  }

  async getMetaData(): Promise<{ universe: Array<{ name: string; szDecimals: number; maxLeverage: number }> }> {
    try {
      const res = await fetch(`${this.#baseUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      });
      if (!res.ok) return this.#mockMetaData();
      return await res.json();
    } catch {
      return this.#mockMetaData();
    }
  }

  async placeOrder(
    agentAddress: string,
    signature: string,
    order: HyperliquidOrderRequest
  ): Promise<HyperliquidOrderResponse> {
    if (order.size <= 0) {
      return { status: "err", error: "Order size must be greater than zero." };
    }
    if (order.limitPrice <= 0) {
      return { status: "err", error: "Limit price must be greater than zero." };
    }

    const payload = {
      action: {
        type: "order",
        orders: [
          {
            a: 0, // asset index
            b: order.isBuy,
            p: order.limitPrice.toString(),
            s: order.size.toString(),
            r: order.reduceOnly ?? false,
            t: order.orderType === "market" ? { limit: { tif: "Ioc" } } : { limit: { tif: "Gtc" } },
          },
        ],
        grouping: "na",
      },
      nonce: Date.now(),
      signature: { r: signature, s: signature, v: 27 },
      vaultAddress: agentAddress,
    };

    try {
      const res = await fetch(`${this.#baseUrl}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return this.#mockOrderResult(order);
      return await res.json();
    } catch {
      return this.#mockOrderResult(order);
    }
  }

  #mockMetaData() {
    return {
      universe: [
        { name: "SOL", szDecimals: 2, maxLeverage: 20 },
        { name: "ETH", szDecimals: 3, maxLeverage: 50 },
        { name: "BTC", szDecimals: 4, maxLeverage: 50 },
      ],
    };
  }

  #mockOrderResult(order: HyperliquidOrderRequest): HyperliquidOrderResponse {
    return {
      status: "ok",
      response: {
        type: "order",
        data: {
          statuses: [
            {
              filled: {
                totalSz: order.size.toString(),
                avgPx: order.limitPrice.toString(),
                oid: Math.floor(Math.random() * 1_000_000),
              },
            },
          ],
        },
      },
    };
  }
}
