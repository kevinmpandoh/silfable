import { randomUUID, createHash } from "node:crypto";
import { Connection, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createSolanaRpc, address } from "@solana/kit";
import { createNoopSigner } from "@solana/signers";
import { KaminoAction, KaminoMarket, VanillaObligation, getCurrentLedgerInstant } from "@kamino-finance/klend-sdk";
import BN from "bn.js";
import { KAMINO_API_BASE_URL, KAMINO_RWA_HIGH_UTILIZATION_WARNING, KAMINO_RWA_MARKET_CATALOG, KAMINO_RWA_SOLANA_USDC_MINT, KLEND_PROGRAM_ID, KaminoRwaPoolSchema, KaminoRwaReserveMetricsSchema, KaminoRwaSupplyPlanSchema, type KaminoRwaPool, type KaminoRwaSupplyPlan } from "@mirae/contracts";
import type { RuntimeDatabase } from "../storage/database.js";
import type { LocalEncryptedKeystore } from "../storage/keystore.js";
import type { WalletOnboardingService } from "../wallet/onboarding.js";
import { toWeb3Instruction } from "./instructionBridge.js";

type KaminoMarketListEntry = { lendingMarket: string; isCurated: boolean };

// Populated from the real observed output of the Step 2 live-instruction check against
// the Obligate Market (KAMINO_RWA_LIVE_CHECK=1 run, see service.test.ts): a 1 USDC deposit
// into an already-initialized obligation produced ComputeBudget, Associated Token Program,
// and KLend instructions only (no SPL Token Program instruction appeared in that run, and
// no Kamino Farms Program instruction — this reserve has no farm attached).
const KNOWN_DEPOSIT_PROGRAM_IDS = new Set<string>([
  "ComputeBudget111111111111111111111111111111", // Compute Budget Program
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token Program
  KLEND_PROGRAM_ID,
]);

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

  async prepare(input: { sessionId: string; walletAddress: string; lendingMarket: string; amountAtomic: bigint; maxSupplyAtomic: bigint }): Promise<KaminoRwaSupplyPlan> {
    if (input.amountAtomic > input.maxSupplyAtomic) throw new Error("Requested supply amount exceeds the approved budget");
    const catalogEntry = KAMINO_RWA_MARKET_CATALOG.find((entry) => entry.lendingMarket === input.lendingMarket);
    if (!catalogEntry) throw new Error("Requested market is not in the Kamino RWA catalog");
    const [pool] = (await this.discover()).filter((entry) => entry.lendingMarket === input.lendingMarket);
    if (!pool) throw new Error("Requested market no longer has a live USDC reserve; discover again");

    const rpcUrl = (await this.secrets.getSecret("solana-rpc-url")) ?? "https://api.mainnet-beta.solana.com";
    const rpc = createSolanaRpc(rpcUrl);
    const slotDurationResponse = await fetch("https://api.kamino.finance/slots/duration");
    if (!slotDurationResponse.ok) throw new Error("Unable to read Kamino slot duration");
    const { recentSlotDurationInMs } = (await slotDurationResponse.json()) as { recentSlotDurationInMs: number };
    const kaminoMarket = await KaminoMarket.load(rpc, address(input.lendingMarket), recentSlotDurationInMs, address(KLEND_PROGRAM_ID));
    if (!kaminoMarket) throw new Error("Kamino market failed to load");
    const currentLedgerInstant = await getCurrentLedgerInstant(rpc);

    const action = await KaminoAction.buildDepositTxns({
      kaminoMarket,
      amount: new BN(input.amountAtomic.toString()),
      reserveAddress: address(pool.usdcReserve),
      owner: createNoopSigner(address(input.walletAddress)),
      obligation: new VanillaObligation(address(KLEND_PROGRAM_ID)),
      useV2Ixs: true,
      scopeRefreshConfig: undefined,
      currentLedgerInstant,
      initUserMetadata: { skipInitialization: false, skipLutCreation: true },
    });
    const kitIxs = KaminoAction.actionToIxs(action);
    for (const ix of kitIxs) {
      if (!KNOWN_DEPOSIT_PROGRAM_IDS.has(ix.programAddress)) throw new Error(`Unexpected program in Kamino deposit instructions: ${ix.programAddress}`);
    }
    const instructions = kitIxs.map(toWeb3Instruction);

    const connection = new Connection(rpcUrl, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    const payer = instructions.find((ix) => ix.keys.some((key) => key.isSigner))?.keys.find((key) => key.isSigner)?.pubkey;
    if (!payer) throw new Error("Deposit instructions have no signer account");
    const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: latest.blockhash, instructions }).compileToV0Message());
    const [fee, simulation] = await Promise.all([
      connection.getFeeForMessage(transaction.message, "confirmed"),
      connection.simulateTransaction(transaction, { replaceRecentBlockhash: true, sigVerify: false }),
    ]);
    if (simulation.value.err) throw new Error(`Kamino deposit simulation failed: ${JSON.stringify(simulation.value.err)}`);

    const now = new Date();
    return KaminoRwaSupplyPlanSchema.parse({
      id: randomUUID(),
      sessionId: input.sessionId,
      walletAddress: input.walletAddress,
      lendingMarket: input.lendingMarket,
      usdcReserve: pool.usdcReserve,
      amountAtomic: input.amountAtomic.toString(),
      supplyApyAtPrepare: pool.supplyApy,
      requirementsDigest: `sha256:${createHash("sha256").update(JSON.stringify({ lendingMarket: input.lendingMarket, usdcReserve: pool.usdcReserve, supplyApy: pool.supplyApy })).digest("hex")}`,
      transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
      blockhash: latest.blockhash,
      lastValidBlockHeight: String(latest.lastValidBlockHeight),
      estimatedNetworkFeeLamports: String(fee.value ?? 0),
      expiresAt: new Date(now.getTime() + 90_000).toISOString(),
      createdAt: now.toISOString(),
    });
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
