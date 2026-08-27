import { randomUUID } from "node:crypto";
import { KAMINO_API_BASE_URL, KAMINO_RWA_HIGH_UTILIZATION_WARNING, KAMINO_RWA_MARKET_CATALOG, KAMINO_RWA_SOLANA_USDC_MINT, KaminoRwaPoolSchema, KaminoRwaReserveMetricsSchema, type KaminoRwaPool } from "@mirae/contracts";
import type { RuntimeDatabase } from "../storage/database.js";
import type { LocalEncryptedKeystore } from "../storage/keystore.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";

type KaminoMarketListEntry = { lendingMarket: string; isCurated: boolean };

export class KaminoRwaDesktopService {
  constructor(
    readonly database: RuntimeDatabase,
    readonly secrets: LocalEncryptedKeystore,
    readonly wallets: WalletOnboardingService,
  ) {}

  async discover(): Promise<KaminoRwaPool[]> {
    const curationByMarket = await fetchCurationFlags();
    const pools: KaminoRwaPool[] = [];
    for (const entry of KAMINO_RWA_MARKET_CATALOG) {
      const metrics = await fetchReserveMetrics(entry.lendingMarket);
      const rawUsdc = metrics.find(
        (reserve) => (reserve as { liquidityTokenMint?: unknown }).liquidityTokenMint === KAMINO_RWA_SOLANA_USDC_MINT,
      );
      if (!rawUsdc) continue;
      const usdc = KaminoRwaReserveMetricsSchema.parse(rawUsdc);
      const totalSupplyUsd = Number(usdc.totalSupplyUsd);
      const totalBorrowUsd = Number(usdc.totalBorrowUsd);
      const utilization = totalSupplyUsd > 0 ? totalBorrowUsd / totalSupplyUsd : 0;
      pools.push(KaminoRwaPoolSchema.parse({
        lendingMarket: entry.lendingMarket,
        name: entry.name,
        rwaReason: entry.rwaReason,
        isCurated: curationByMarket.get(entry.lendingMarket) ?? false,
        usdcReserve: usdc.reserve,
        supplyApy: Number(usdc.supplyApy),
        totalSupplyUsd,
        totalBorrowUsd,
        utilization,
        highUtilizationWarning: utilization >= KAMINO_RWA_HIGH_UTILIZATION_WARNING,
        discoveredAt: new Date().toISOString(),
      }));
    }
    return pools;
  }
}

async function fetchCurationFlags(): Promise<Map<string, boolean>> {
  const response = await fetch(`${KAMINO_API_BASE_URL}/v2/kamino-market`);
  if (!response.ok) throw new Error(`Kamino market list request failed (${response.status})`);
  const body = (await response.json()) as KaminoMarketListEntry[];
  return new Map(body.map((entry) => [entry.lendingMarket, entry.isCurated === true]));
}

async function fetchReserveMetrics(lendingMarket: string): Promise<unknown[]> {
  const response = await fetch(`${KAMINO_API_BASE_URL}/kamino-market/${lendingMarket}/reserves/metrics`);
  if (!response.ok) throw new Error(`Kamino reserve metrics request failed for ${lendingMarket} (${response.status})`);
  const body = await response.json();
  return body as unknown[];
}
