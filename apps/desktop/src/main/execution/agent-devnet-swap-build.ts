import { createHash, randomUUID } from "node:crypto";

import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";
import { AgentDevnetSwapBuildViewSchema, type AgentDevnetSwapBuildView, type AgentIntentEvaluationView } from "@silfable/contracts";

import type { DevnetTransactionRpcPort } from "../rpc/devnet.js";
import { RuntimeDatabase } from "../storage/database.js";
import type { AgentDevnetSwapQuoteExactEvidence } from "./agent-devnet-swap-quote.js";

export const RAYDIUM_DEVNET_BUILD_ENDPOINT = "https://transaction-v1-devnet.raydium.io/transaction/swap-base-in" as const;
const RAYDIUM_ROUTER = "DRaybByLpbUL57LJARs3j8BitTxVfzBg351EaMr5UTCd";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const RAYDIUM_LOOKUP_TABLE = "EFhMuDw1PKEuckuFRW9PavNfTH4LKP5uKHgyXDmWpFCq";
const MAX_FEE_LAMPORTS = 30_000n;
type Cipher = { encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>; decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string> };
export type RaydiumDevnetBuildTransport = (input: { raydiumResponse: unknown; wallet: string }) => Promise<string>;

export const fetchRaydiumDevnetBuild: RaydiumDevnetBuildTransport = async (input) => {
  const response = await fetch(RAYDIUM_DEVNET_BUILD_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ computeUnitPriceMicroLamports: "50000", swapResponse: input.raydiumResponse,
      txVersion: "V0", wallet: input.wallet, wrapSol: true, unwrapSol: false }), signal: AbortSignal.timeout(8_000) });
  const body: unknown = await response.json();
  if (!response.ok || typeof body !== "object" || body === null) throw new Error("build-invalid");
  const envelope = body as { success?: unknown; data?: unknown };
  if (envelope.success !== true || !Array.isArray(envelope.data) || envelope.data.length !== 1) throw new Error("build-invalid");
  const item = envelope.data[0] as { transaction?: unknown };
  if (typeof item?.transaction !== "string" || item.transaction.length < 100 || item.transaction.length > 10_000) throw new Error("build-invalid");
  return item.transaction;
};

export class AgentDevnetSwapBuildService {
  readonly #database: RuntimeDatabase; readonly #cipher: Cipher; readonly #keystore: { isLocked(): boolean };
  readonly #health: { isHealthyFresh(): boolean }; readonly #wallet: { getWalletAddress(): Promise<string> };
  readonly #quotes: { loadExactEvidence(id: string): Promise<AgentDevnetSwapQuoteExactEvidence> };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
  readonly #rpc: Pick<DevnetTransactionRpcPort, "simulateTransaction">; readonly #transport: RaydiumDevnetBuildTransport; readonly #now: () => Date; #running = false;
  constructor(input: { database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean }; health: { isHealthyFresh(): boolean };
    wallet: { getWalletAddress(): Promise<string> }; quotes: { loadExactEvidence(id: string): Promise<AgentDevnetSwapQuoteExactEvidence> };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> }; rpc: Pick<DevnetTransactionRpcPort, "simulateTransaction">;
    transport?: RaydiumDevnetBuildTransport; now?: () => Date }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore; this.#health = input.health;
    this.#wallet = input.wallet; this.#quotes = input.quotes; this.#agents = input.agents; this.#rpc = input.rpc;
    this.#transport = input.transport ?? fetchRaydiumDevnetBuild; this.#now = input.now ?? (() => new Date());
  }
  async build(quoteId: string): Promise<AgentDevnetSwapBuildView> {
    if (this.#running) throw new Error("Devnet swap build is already active"); this.#assertReady();
    if (this.#database.getAgentDevnetSwapBuildByQuote(quoteId) !== null) throw new Error("Quote already has a build journal");
    this.#running = true;
    try {
      const evidence = await this.#quotes.loadExactEvidence(quoteId); const quote = evidence.view;
      if (!quote.allowed || quote.action !== "sell-sol") throw new Error("Only an allowed sell-sol quote can be built");
      await this.#assertCurrent(quote); const wallet = await this.#wallet.getWalletAddress();
      let wire: string | null = null; let programIds: string[] = []; let messageHash: string | null = null;
      let built = false; let simulated = false; let exact = false; let fee: bigint | null = null; let units: bigint | null = null;
      try {
        wire = await this.#transport({ raydiumResponse: evidence.raydiumResponse, wallet }); built = true;
        const validation = validateBuiltTransaction(wire, wallet, quote); programIds = validation.programIds;
        messageHash = validation.messageHash; exact = true; this.#assertReady(); simulated = true;
        const result = await this.#rpc.simulateTransaction(wire); fee = result.fee; units = result.unitsConsumed;
        if (result.error) throw new Error("simulation-failed"); if (fee === null || fee > MAX_FEE_LAMPORTS) throw new Error("fee-exceeded");
        await this.#assertCurrent(quote);
        return await this.#persist(quote, "simulated", null, messageHash, programIds, built, simulated, exact, fee, units, wire);
      } catch (error) {
        return this.#persist(quote, "denied", failureCode(error), messageHash, programIds, built, simulated, false, fee, units, wire);
      }
    } finally { this.#running = false; }
  }
  async list() {
    this.#assertUnlocked(); return Promise.all(this.#database.listAgentDevnetSwapBuilds().map(async (record) => {
      const payload = JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload, nonce: record.payloadNonce,
        keyId: "local-data-key-v1" })) as { view?: unknown };
      const view = AgentDevnetSwapBuildViewSchema.parse(payload.view);
      if (view.id !== record.id || view.quoteId !== record.quoteId || view.state !== record.state) throw new Error("Devnet swap build metadata mismatch");
      return view;
    }));
  }
  async #assertCurrent(quote: AgentDevnetSwapQuoteExactEvidence["view"]) {
    this.#assertReady(); if (new Date(quote.expiresAt).getTime() <= this.#now().getTime()) throw new Error("quote-expired");
    const evaluation = (await this.#agents.list()).evaluations.find((value) => value.receipt.id === quote.evaluationId);
    if (evaluation === undefined || evaluation.session.id !== quote.sessionId || evaluation.session.state !== "active"
      || evaluation.proposal.action !== quote.action || evaluation.approval.state !== "approved" || evaluation.approval.expiresAt === null
      || new Date(evaluation.approval.expiresAt).getTime() <= this.#now().getTime()) throw new Error("binding-changed");
  }
  async #persist(quote: AgentDevnetSwapQuoteExactEvidence["view"], state: AgentDevnetSwapBuildView["state"],
    failure: AgentDevnetSwapBuildView["failureCode"], messageHash: string | null, programIds: string[], transactionBuilt: boolean,
    simulationAttempted: boolean, exactAmountBound: boolean, fee: bigint | null, units: bigint | null, wire: string | null) {
    const builtAt = this.#now().toISOString(); const view = AgentDevnetSwapBuildViewSchema.parse({ schemaVersion: 1, id: randomUUID(),
      quoteId: quote.id, evaluationId: quote.evaluationId, sessionId: quote.sessionId, action: "sell-sol", state, failureCode: failure,
      messageHash, programIds, inputAmount: quote.inputAmount, minimumOutputAmount: quote.minimumOutputAmount,
      feeLamports: fee?.toString() ?? null, unitsConsumed: units?.toString() ?? null, exactAmountBound,
      transactionBuilt, simulationAttempted, signingAttempted: false, broadcastAttempted: false,
      marketSwapPerformed: false, mainnetEnabled: false, builtAt, expiresAt: quote.expiresAt });
    const envelope = await this.#cipher.encryptString(JSON.stringify({ view, unsignedWire: wire }));
    this.#database.insertAgentDevnetSwapBuild({ id: view.id, quoteId: quote.id, evaluationId: quote.evaluationId,
      sessionId: quote.sessionId, state, messageHash, encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce,
      keyId: envelope.keyId, transactionBuilt, simulationAttempted, builtAt, expiresAt: quote.expiresAt }); return view;
  }
  #assertReady() { this.#assertUnlocked(); if (!this.#health.isHealthyFresh()) throw new Error("binding-changed"); }
  #assertUnlocked() { if (this.#keystore.isLocked()) throw new Error("Keystore is locked"); }
}

export function validateBuiltTransaction(wire: string, wallet: string, quote: AgentDevnetSwapQuoteExactEvidence["view"]) {
  const transaction = getTransactionDecoder().decode(Buffer.from(wire, "base64"));
  const signatures = Object.entries(transaction.signatures); if (signatures.length !== 1 || signatures[0]?.[0] !== wallet || signatures[0]?.[1] !== null) throw new Error("binding-changed");
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if (message.version !== 0 || message.header.numSignerAccounts !== 1 || message.staticAccounts[0] !== wallet
    || (message.addressTableLookups?.length ?? 0) !== 1 || message.addressTableLookups?.[0]?.lookupTableAddress !== RAYDIUM_LOOKUP_TABLE) throw new Error("build-invalid");
  for (const required of [quote.inputMint, quote.outputMint, ...quote.routePoolIds]) if (!message.staticAccounts.includes(required as never)) throw new Error("binding-changed");
  const programIds = [...new Set(message.instructions.map((instruction) => message.staticAccounts[instruction.programAddressIndex])
    .filter((value) => value !== undefined).map(String))];
  if (programIds.some((program) => program !== RAYDIUM_ROUTER && program !== COMPUTE_BUDGET)) throw new Error("program-denied");
  const swap = message.instructions.find((instruction) => instruction.programAddressIndex === message.staticAccounts.indexOf(RAYDIUM_ROUTER as never)
    && instruction.data?.length === 17 && instruction.data[0] === 0);
  if (swap?.data === undefined) throw new Error("amount-mismatch"); const data = Buffer.from(swap.data);
  if (data.readBigUInt64LE(1) !== BigInt(quote.inputAmount) || data.readBigUInt64LE(9) !== BigInt(quote.minimumOutputAmount)) throw new Error("amount-mismatch");
  return { messageHash: createHash("sha256").update(Buffer.from(transaction.messageBytes)).digest("hex"), programIds };
}
function failureCode(error: unknown): AgentDevnetSwapBuildView["failureCode"] {
  const message = error instanceof Error ? error.message : "";
  if (/quote-expired/u.test(message)) return "quote-expired"; if (/program-denied/u.test(message)) return "program-denied";
  if (/amount-mismatch/u.test(message)) return "amount-mismatch"; if (/simulation-failed/u.test(message)) return "simulation-failed";
  if (/fee-exceeded/u.test(message)) return "fee-exceeded"; if (/binding/u.test(message)) return "binding-changed"; return "build-invalid";
}
