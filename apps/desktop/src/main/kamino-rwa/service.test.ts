import assert from "node:assert/strict";
import test from "node:test";
import { createSolanaRpc, address } from "@solana/kit";
import { createNoopSigner } from "@solana/signers";
import { KaminoAction, KaminoMarket, VanillaObligation, getCurrentLedgerInstant } from "@kamino-finance/klend-sdk";
import BN from "bn.js";
import { KLEND_PROGRAM_ID } from "@mirae/contracts";
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

test("prepare rejects an amount above the caller-supplied max", async () => {
  const service = new KaminoRwaDesktopService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.prepare({ sessionId: "s1", walletAddress: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM", lendingMarket: "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH", amountAtomic: 100n, maxSupplyAtomic: 50n }),
    /exceeds/i,
  );
});

test("prepare rejects a lendingMarket not present in the catalog", async () => {
  const service = new KaminoRwaDesktopService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.prepare({ sessionId: "s1", walletAddress: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM", lendingMarket: "NotInCatalog11111111111111111111111111111", amountAtomic: 1n, maxSupplyAtomic: 100n }),
    /catalog/i,
  );
});

test("manual: observe real instructions for an Obligate Market USDC deposit", { skip: process.env.KAMINO_RWA_LIVE_CHECK !== "1" }, async () => {
  const rpcUrl = process.env.MIRAE_TEST_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const rpc = createSolanaRpc(rpcUrl);
  const slotDurationResponse = await fetch("https://api.kamino.finance/slots/duration");
  const { recentSlotDurationInMs } = (await slotDurationResponse.json()) as { recentSlotDurationInMs: number };
  const kaminoMarket = await KaminoMarket.load(rpc, address("3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH"), recentSlotDurationInMs, address(KLEND_PROGRAM_ID));
  assert.ok(kaminoMarket, "market should load");
  const currentLedgerInstant = await getCurrentLedgerInstant(rpc);
  const owner = createNoopSigner(address("4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM"));
  const action = await KaminoAction.buildDepositTxns({
    kaminoMarket: kaminoMarket!,
    amount: new BN("1000000"),
    reserveAddress: address("Au2Cg9CNNTX1KfzVhNnpi1ouHX74CwMMBvmSchmqS5ZW"),
    owner,
    obligation: new VanillaObligation(address(KLEND_PROGRAM_ID)),
    useV2Ixs: true,
    scopeRefreshConfig: undefined,
    currentLedgerInstant,
    initUserMetadata: { skipInitialization: false, skipLutCreation: true },
  });
  const ixs = KaminoAction.actionToIxs(action);
  console.log("Observed program IDs:", [...new Set(ixs.map((ix) => ix.programAddress))]);
  assert.ok(ixs.length > 0);
});
