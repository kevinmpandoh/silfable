import { randomUUID, createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createSolanaRpc, address, type Rpc } from "@solana/kit";
import { createNoopSigner } from "@solana/signers";
import { KaminoAction, KaminoMarket, VanillaObligation, getCurrentLedgerInstant, type KaminoMarketRpcApi } from "@kamino-finance/klend-sdk";
import BN from "bn.js";
import { KAMINO_API_BASE_URL, KAMINO_RWA_GLOBAL_MAX_SUPPLY_ATOMIC, KAMINO_RWA_HIGH_UTILIZATION_WARNING, KAMINO_RWA_MARKET_CATALOG, KAMINO_RWA_SOLANA_USDC_MINT, KLEND_PROGRAM_ID, KaminoRwaPoolSchema, KaminoRwaPositionSchema, KaminoRwaReserveMetricsSchema, KaminoRwaSupplyPlanSchema, type KaminoRwaPool, type KaminoRwaPosition, type KaminoRwaSupplyPlan } from "@mirae/contracts";
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
  readonly #prepared = new Map<string, KaminoRwaSupplyPlan>();
  private static readonly AAD = Buffer.from("mirae-kamino-rwa-positions-v1", "utf8");

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
      const rawUtilization = totalSupplyUsd > 0 ? totalBorrowUsd / totalSupplyUsd : 0;
      const utilization = Math.min(1, rawUtilization);
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
        highUtilizationWarning: rawUtilization >= KAMINO_RWA_HIGH_UTILIZATION_WARNING,
        discoveredAt: new Date().toISOString(),
      }));
    }
    return pools;
  }

  async prepare(input: { sessionId: string; walletAddress: string; lendingMarket: string; amountAtomic: bigint; maxSupplyAtomic: bigint }): Promise<KaminoRwaSupplyPlan> {
    if (input.maxSupplyAtomic > BigInt(KAMINO_RWA_GLOBAL_MAX_SUPPLY_ATOMIC)) throw new Error("Kamino RWA budget exceeds hard cap");
    if (input.amountAtomic > input.maxSupplyAtomic) throw new Error("Requested supply amount exceeds the approved budget");
    const catalogEntry = KAMINO_RWA_MARKET_CATALOG.find((entry) => entry.lendingMarket === input.lendingMarket);
    if (!catalogEntry) throw new Error("Requested market is not in the Kamino RWA catalog");
    const [pool] = (await this.discover()).filter((entry) => entry.lendingMarket === input.lendingMarket);
    if (!pool) throw new Error("Requested market no longer has a live USDC reserve; discover again");

    const rpcUrl = (await this.secrets.getSecret("solana-rpc-url")) ?? "https://api.mainnet-beta.solana.com";
    // klend-sdk nests its own @solana/kit@2.x with a slightly different (but runtime-compatible)
    // Rpc type than this workspace's @solana/kit@7.x — verified compatible by Task 5's live
    // integration test against real Mainnet RPC; this assertion resolves only the type-level
    // version mismatch, not a real behavioral difference.
    const rpc = createSolanaRpc(rpcUrl) as unknown as Rpc<KaminoMarketRpcApi>;
    const slotDurationResponse = await fetch("https://api.kamino.finance/slots/duration", { signal: AbortSignal.timeout(15_000) });
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

    const payer = new PublicKey(input.walletAddress);
    for (const ix of instructions) {
      for (const key of ix.keys) {
        if (key.isSigner && !key.pubkey.equals(payer)) throw new Error(`Deposit instructions require an unexpected signer: ${key.pubkey.toBase58()}`);
      }
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: latest.blockhash, instructions }).compileToV0Message());
    const [fee, simulation] = await Promise.all([
      connection.getFeeForMessage(transaction.message, "confirmed"),
      connection.simulateTransaction(transaction, { replaceRecentBlockhash: true, sigVerify: false }),
    ]);
    if (simulation.value.err) throw new Error(`Kamino deposit simulation failed: ${JSON.stringify(simulation.value.err)}`);

    const now = new Date();
    const plan = KaminoRwaSupplyPlanSchema.parse({
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
    this.#prepared.set(plan.id, plan);
    return plan;
  }

  async execute(input: { planId: string; sessionId: string; walletAddress: string }): Promise<KaminoRwaPosition> {
    const plan = this.#prepared.get(input.planId);
    if (!plan || plan.sessionId !== input.sessionId || plan.walletAddress !== input.walletAddress) throw new Error("Prepared Kamino RWA plan is unavailable for this session");
    if (Date.parse(plan.expiresAt) <= Date.now()) { this.#prepared.delete(input.planId); throw new Error("Prepared Kamino RWA plan expired"); }
    const catalogEntry = KAMINO_RWA_MARKET_CATALOG.find((entry) => entry.lendingMarket === plan.lendingMarket)!;
    const now = new Date();
    let position: KaminoRwaPosition = KaminoRwaPositionSchema.parse({
      id: randomUUID(), planId: plan.id, sessionId: plan.sessionId, walletAddress: plan.walletAddress,
      lendingMarket: plan.lendingMarket, marketName: catalogEntry.name, usdcReserve: plan.usdcReserve,
      amountSuppliedAtomic: plan.amountAtomic, supplyApyAtEntry: plan.supplyApyAtPrepare,
      signature: null, status: "SUBMITTED", errorMessage: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
    await this.save(position);

    let transaction: VersionedTransaction;
    let rpcUrl: string;
    try {
      transaction = VersionedTransaction.deserialize(Buffer.from(plan.transactionBase64, "base64"));
      await this.wallets.withWalletWeb3Keypair(plan.walletAddress, async (keypair) => { transaction.sign([keypair]); });
      rpcUrl = (await this.secrets.getSecret("solana-rpc-url")) ?? "https://api.mainnet-beta.solana.com";
    } catch (error) {
      position = KaminoRwaPositionSchema.parse({ ...position, status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown pre-broadcast failure", updatedAt: new Date().toISOString() });
      await this.save(position);
      throw error;
    }

    try {
      const connection = new Connection(rpcUrl, "confirmed");
      const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 0 });
      await connection.confirmTransaction({ signature, blockhash: plan.blockhash, lastValidBlockHeight: Number(plan.lastValidBlockHeight) }, "confirmed");
      position = KaminoRwaPositionSchema.parse({ ...position, signature, status: "CONFIRMED", updatedAt: new Date().toISOString() });
      await this.save(position);
      this.#prepared.delete(input.planId);
      return position;
    } catch (error) {
      position = KaminoRwaPositionSchema.parse({ ...position, status: "UNKNOWN", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown broadcast outcome", updatedAt: new Date().toISOString() });
      await this.save(position);
      throw error;
    }
  }

  clearPrepared(): void { this.#prepared.clear(); }

  async listPositions(): Promise<KaminoRwaPosition[]> {
    const key = await this.key();
    return this.database.listKaminoRwaPositionRecords().map((row) => {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(row.nonce, "base64"));
      decipher.setAAD(KaminoRwaDesktopService.AAD);
      decipher.setAuthTag(Buffer.from(row.tag, "base64"));
      return KaminoRwaPositionSchema.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8")));
    });
  }

  private async save(position: KaminoRwaPosition): Promise<void> {
    const key = await this.key();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(KaminoRwaDesktopService.AAD);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(position), "utf8"), cipher.final()]);
    this.database.upsertKaminoRwaPositionRecord({ id: position.id, ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), updatedAt: position.updatedAt });
  }

  private async key(): Promise<Buffer> {
    let encoded = await this.secrets.getSecret("kamino-rwa-position-store-key");
    if (!encoded) { encoded = randomBytes(32).toString("base64"); await this.secrets.setSecret("kamino-rwa-position-store-key", encoded); }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("Kamino RWA position store key is invalid");
    return key;
  }
}

async function fetchCurationFlags(): Promise<Map<string, boolean>> {
  const response = await fetch(`${KAMINO_API_BASE_URL}/v2/kamino-market`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Kamino market list request failed (${response.status})`);
  const body = (await response.json()) as KaminoMarketListEntry[];
  return new Map(body.map((entry) => [entry.lendingMarket, entry.isCurated === true]));
}

async function fetchReserveMetrics(lendingMarket: string): Promise<unknown[]> {
  const response = await fetch(`${KAMINO_API_BASE_URL}/kamino-market/${lendingMarket}/reserves/metrics`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Kamino reserve metrics request failed for ${lendingMarket} (${response.status})`);
  const body = await response.json();
  return body as unknown[];
}
