import assert from "node:assert/strict";
import test from "node:test";
import { createSolanaRpc, address, type Rpc } from "@solana/kit";
import { createNoopSigner } from "@solana/signers";
import { KaminoAction, KaminoMarket, VanillaObligation, getCurrentLedgerInstant, type KaminoMarketRpcApi } from "@kamino-finance/klend-sdk";
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

test("execute rejects an unknown planId", async () => {
  const service = new KaminoRwaDesktopService({} as any, {} as any, {} as any);
  await assert.rejects(
    () => service.execute({ planId: "22222222-2222-4222-8222-222222222222", sessionId: "s1", walletAddress: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM" }),
    /unavailable/i,
  );
});

test("listPositions returns an empty array with no stored positions", async () => {
  const database = { listKaminoRwaPositionRecords: () => [] } as any;
  const secrets = { getSecret: async () => null, setSecret: async () => {} } as any;
  const service = new KaminoRwaDesktopService(database, secrets, {} as any);
  assert.deepEqual(await service.listPositions(), []);
});

test("save then listPositions round-trips a position through AES-256-GCM encryption", async () => {
  const stored: Array<{ id: string; ciphertext: string; nonce: string; tag: string; updatedAt: string }> = [];
  const database = {
    listKaminoRwaPositionRecords: () => stored,
    upsertKaminoRwaPositionRecord: (record: any) => { stored.push(record); },
  } as any;
  let storedKey: string | null = null;
  const secrets = {
    getSecret: async () => storedKey,
    setSecret: async (_name: string, value: string) => { storedKey = value; },
  } as any;
  const service = new KaminoRwaDesktopService(database, secrets, {} as any);
  const position = {
    id: "33333333-3333-4333-8333-333333333333", planId: "44444444-4444-4444-8444-444444444444",
    sessionId: "s1", walletAddress: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM",
    lendingMarket: "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH", marketName: "Obligate Market",
    usdcReserve: "Au2Cg9CNNTX1KfzVhNnpi1ouHX74CwMMBvmSchmqS5ZW", amountSuppliedAtomic: "1000000",
    supplyApyAtEntry: 0.052, signature: "5" + "x".repeat(63), status: "CONFIRMED" as const, errorMessage: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await (service as any).save(position);
  const positions = await service.listPositions();
  assert.deepEqual(positions, [position]);
});

test("applyWithdrawToPositions marks fully withdrawn positions as WITHDRAWN", async () => {
  const stored: Array<{ id: string; ciphertext: string; nonce: string; tag: string; updatedAt: string }> = [];
  const database = {
    listKaminoRwaPositionRecords: () => stored,
    upsertKaminoRwaPositionRecord: (record: any) => {
      const idx = stored.findIndex((r) => r.id === record.id);
      if (idx >= 0) stored[idx] = record;
      else stored.push(record);
    },
  } as any;
  let storedKey: string | null = null;
  const secrets = {
    getSecret: async () => storedKey,
    setSecret: async (_name: string, value: string) => { storedKey = value; },
  } as any;
  const service = new KaminoRwaDesktopService(database, secrets, {} as any);
  const position = {
    id: "55555555-5555-4555-8555-555555555555", planId: "66666666-6666-4666-8666-666666666666",
    sessionId: "s1", walletAddress: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM",
    lendingMarket: "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH", marketName: "Obligate Market",
    usdcReserve: "Au2Cg9CNNTX1KfzVhNnpi1ouHX74CwMMBvmSchmqS5ZW", amountSuppliedAtomic: "10000000",
    supplyApyAtEntry: 0.052, signature: "5" + "x".repeat(63), status: "CONFIRMED" as const, errorMessage: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await (service as any).save(position);

  // Apply full withdrawal
  await (service as any).applyWithdrawToPositions({
    walletAddress: position.walletAddress,
    lendingMarket: position.lendingMarket,
    withdrawnAtomic: 10000000n,
  });

  const updatedPositions = await service.listPositions();
  assert.equal(updatedPositions.length, 1);
  assert.equal(updatedPositions[0].status, "WITHDRAWN");
  assert.equal(updatedPositions[0].amountSuppliedAtomic, "0");
});

test("manual: observe real instructions for an Obligate Market USDC deposit", { skip: process.env.KAMINO_RWA_LIVE_CHECK !== "1" }, async () => {
  const rpcUrl = process.env.MIRAE_TEST_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  // klend-sdk nests its own @solana/kit@2.x with a slightly different (but runtime-compatible)
  // Rpc type than this workspace's @solana/kit@7.x — verified compatible by this very live
  // integration test against real Mainnet RPC; this assertion resolves only the type-level
  // version mismatch, not a real behavioral difference.
  const rpc = createSolanaRpc(rpcUrl) as unknown as Rpc<KaminoMarketRpcApi>;
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
