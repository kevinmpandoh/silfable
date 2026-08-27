import assert from "node:assert/strict";
import test from "node:test";
import { KaminoRwaDesktopService } from "./service.js";

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>): typeof fetch {
  let call = 0;
  return (async (_url: string) => {
    const response = responses[call];
    call += 1;
    if (!response) throw new Error(`unexpected fetch call #${call}`);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    } as Response;
  }) as typeof fetch;
}

test("discover returns only catalog markets that have a USDC reserve, with live isCurated", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { status: 200, body: [
      { name: "Obligate Market", isPrimary: false, description: "Obligate Pool", lendingMarket: "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH", lookupTable: "x", isCurated: true },
      { name: "PAXG Market", isPrimary: false, description: "PAXG Pool", lendingMarket: "7G9hUEyKbxLdRmvNwpe5V1D23gXdcXoSuwoFRCBa2c2j", lookupTable: "x", isCurated: true },
    ] },
    { status: 200, body: [
      { reserve: "6nk5K3PiV3EHtW4LLFhfMc1uR4kNwEfibvTdWqxCm6WF", liquidityToken: "oTFY", liquidityTokenMint: "BwB3tNH92jKw6naNGDYDbDwRo8bvYxZVvZjRZRcoWR2h", maxLtv: "0.75", borrowApy: "0.14", supplyApy: "0", totalSupply: "1", totalBorrow: "0", totalBorrowUsd: "0", totalSupplyUsd: "1" },
      { reserve: "Au2Cg9CNNTX1KfzVhNnpi1ouHX74CwMMBvmSchmqS5ZW", liquidityToken: "USDC", liquidityTokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", maxLtv: "0", borrowApy: "0.065", supplyApy: "0.052", totalSupply: "5099745.6", totalBorrow: "4550387.8", totalBorrowUsd: "4550160.3", totalSupplyUsd: "5099490.6" },
    ] },
    { status: 200, body: [
      { reserve: "r1", liquidityToken: "USDG", liquidityTokenMint: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", maxLtv: "0", borrowApy: "0.02", supplyApy: "0.007", totalSupply: "1", totalBorrow: "0", totalBorrowUsd: "0", totalSupplyUsd: "1" },
      { reserve: "r2", liquidityToken: "PAX Gold", liquidityTokenMint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW", maxLtv: "0.75", borrowApy: "0", supplyApy: "0", totalSupply: "1", totalBorrow: "0", totalBorrowUsd: "0", totalSupplyUsd: "1" },
    ] },
  ]);
  try {
    const service = new KaminoRwaDesktopService({} as any, {} as any, {} as any);
    const pools = await service.discover();
    assert.equal(pools.length, 1);
    const pool = pools[0];
    assert.ok(pool);
    assert.equal(pool.name, "Obligate Market");
    assert.equal(pool.usdcReserve, "Au2Cg9CNNTX1KfzVhNnpi1ouHX74CwMMBvmSchmqS5ZW");
    assert.equal(pool.isCurated, true);
    assert.ok(pool.utilization > 0.89 && pool.utilization < 0.90);
    assert.equal(pool.highUtilizationWarning, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discover fails closed when the Kamino API errors, without returning partial data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([{ status: 500, body: {} }]);
  try {
    const service = new KaminoRwaDesktopService({} as any, {} as any, {} as any);
    await assert.rejects(() => service.discover());
  } finally {
    globalThis.fetch = originalFetch;
  }
});
