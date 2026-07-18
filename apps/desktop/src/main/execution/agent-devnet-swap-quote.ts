import { randomUUID } from "node:crypto";

import { AgentDevnetSwapQuoteViewSchema, type AgentDevnetSwapQuoteView, type AgentIntentEvaluationView } from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database.js";

export const RAYDIUM_DEVNET_QUOTE_ENDPOINT = "https://transaction-v1-devnet.raydium.io/compute/swap-base-in" as const;
export const DEVNET_SWAP_MINTS = { sol: "So11111111111111111111111111111111111111112",
  usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" } as const;
const SELL_SOL_LAMPORTS = "1000000"; const BUY_SOL_USDC_MICROS = "100000"; const SLIPPAGE_BPS = 50;
type Cipher = { encryptString(value: string): Promise<{ ciphertext: string; nonce: string; keyId: "local-data-key-v1" }>; decryptString(input: { ciphertext: string; nonce: string; keyId: "local-data-key-v1" }): Promise<string> };
type RawQuote = { inputMint: string; inputAmount: string; outputMint: string; outputAmount: string;
  otherAmountThreshold: string; slippageBps: number; priceImpactPct: number;
  routePlan: { poolId: string; inputMint: string; outputMint: string }[] };
export type RaydiumDevnetQuoteTransport = (input: { inputMint: string; outputMint: string; amount: string; slippageBps: number }) => Promise<RawQuote>;

export const fetchRaydiumDevnetQuote: RaydiumDevnetQuoteTransport = async (input) => {
  const url = new URL(RAYDIUM_DEVNET_QUOTE_ENDPOINT);
  url.searchParams.set("inputMint", input.inputMint); url.searchParams.set("outputMint", input.outputMint);
  url.searchParams.set("amount", input.amount); url.searchParams.set("slippageBps", String(input.slippageBps));
  url.searchParams.set("txVersion", "V0");
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`Raydium Devnet quote failed with status ${response.status}`);
  return parseRawQuote(body);
};

export class AgentDevnetSwapQuoteService {
  readonly #database: RuntimeDatabase; readonly #cipher: Cipher; readonly #keystore: { isLocked(): boolean };
  readonly #agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> };
  readonly #transport: RaydiumDevnetQuoteTransport; readonly #now: () => Date; #running = false;
  constructor(input: { database: RuntimeDatabase; cipher: Cipher; keystore: { isLocked(): boolean };
    agents: { list(): Promise<{ evaluations: AgentIntentEvaluationView[] }> }; transport?: RaydiumDevnetQuoteTransport; now?: () => Date }) {
    this.#database = input.database; this.#cipher = input.cipher; this.#keystore = input.keystore;
    this.#agents = input.agents; this.#transport = input.transport ?? fetchRaydiumDevnetQuote; this.#now = input.now ?? (() => new Date());
  }
  async quote(evaluationId: string): Promise<AgentDevnetSwapQuoteView> {
    if (this.#running) throw new Error("Agent Devnet swap quote is already active");
    this.#assertUnlocked();
    if (this.#database.getAgentDevnetSwapQuoteByEvaluation(evaluationId) !== null) throw new Error("Evaluation already has a Devnet swap quote");
    const evaluation = await this.#loadEligible(evaluationId); const action = evaluation.proposal.action;
    if (action !== "buy-sol" && action !== "sell-sol") throw new Error("Approved action is unsupported");
    const pair = pairFor(action);
    this.#running = true;
    try {
      const raw = await this.#transport({ ...pair, slippageBps: SLIPPAGE_BPS });
      const current = await this.#loadEligible(evaluationId);
      const denialCodes: AgentDevnetSwapQuoteView["denialCodes"] = [];
      if (current.receipt.proposalDigest !== evaluation.receipt.proposalDigest) denialCodes.push("binding-changed");
      if (raw.inputMint !== pair.inputMint || raw.outputMint !== pair.outputMint || raw.inputAmount !== pair.amount
        || raw.slippageBps !== SLIPPAGE_BPS || !positive(raw.outputAmount) || !positive(raw.otherAmountThreshold)
        || BigInt(raw.otherAmountThreshold) > BigInt(raw.outputAmount)) denialCodes.push("quote-invalid");
      if (!validRoute(raw, pair.inputMint, pair.outputMint)) denialCodes.push("route-invalid");
      const priceImpactBps = Number.isFinite(raw.priceImpactPct) ? Math.min(10_000, Math.ceil(Math.abs(raw.priceImpactPct) * 100)) : 10_000;
      if (priceImpactBps > evaluation.session.maxPriceImpactBps) denialCodes.push("price-impact-exceeded");
      const quotedAt = this.#now(); const view = AgentDevnetSwapQuoteViewSchema.parse({ schemaVersion: 1, id: randomUUID(),
        evaluationId, sessionId: evaluation.session.id, action, venue: "raydium-devnet",
        inputMint: raw.inputMint, outputMint: raw.outputMint, inputAmount: raw.inputAmount,
        outputAmount: raw.outputAmount, minimumOutputAmount: raw.otherAmountThreshold, slippageBps: raw.slippageBps,
        priceImpactBps, routePoolIds: raw.routePlan.map((route) => route.poolId),
        proposalNotionalUsdcMicros: evaluation.proposal.notionalUsdcMicros,
        economicValueMapping: "direction-only-capped-devnet", amountPolicy: "fixed-low-value-canary-v1",
        allowed: denialCodes.length === 0, denialCodes: [...new Set(denialCodes)], transactionBuilt: false,
        signingAttempted: false, broadcastAttempted: false, marketSwapPerformed: false, mainnetEnabled: false,
        quotedAt: quotedAt.toISOString(), expiresAt: new Date(quotedAt.getTime() + 20_000).toISOString() });
      const envelope = await this.#cipher.encryptString(JSON.stringify(view));
      this.#database.insertAgentDevnetSwapQuote({ id: view.id, evaluationId, sessionId: view.sessionId, action: view.action,
        allowed: view.allowed, encryptedPayload: envelope.ciphertext, payloadNonce: envelope.nonce, keyId: envelope.keyId,
        quotedAt: view.quotedAt, expiresAt: view.expiresAt });
      return view;
    } finally { this.#running = false; }
  }
  async list() {
    this.#assertUnlocked();
    return Promise.all(this.#database.listAgentDevnetSwapQuotes().map(async (record) => {
      const view = AgentDevnetSwapQuoteViewSchema.parse(JSON.parse(await this.#cipher.decryptString({ ciphertext: record.encryptedPayload,
        nonce: record.payloadNonce, keyId: "local-data-key-v1" })) as unknown);
      if (view.id !== record.id || view.evaluationId !== record.evaluationId || view.allowed !== record.allowed) throw new Error("Devnet swap quote metadata mismatch");
      return view;
    }));
  }
  async #loadEligible(evaluationId: string) {
    const evaluation = (await this.#agents.list()).evaluations.find((value) => value.receipt.id === evaluationId);
    const now = this.#now().getTime();
    if (evaluation === undefined || (evaluation.proposal.action !== "buy-sol" && evaluation.proposal.action !== "sell-sol")
      || evaluation.session.state !== "active" || evaluation.approval.state !== "approved" || evaluation.approval.expiresAt === null
      || new Date(evaluation.approval.expiresAt).getTime() <= now) throw new Error("Exact active approved buy/sell evaluation is required");
    return evaluation;
  }
  #assertUnlocked() { if (this.#keystore.isLocked()) throw new Error("Keystore is locked"); }
}

function pairFor(action: "buy-sol" | "sell-sol") {
  return action === "sell-sol" ? { inputMint: DEVNET_SWAP_MINTS.sol, outputMint: DEVNET_SWAP_MINTS.usdc, amount: SELL_SOL_LAMPORTS }
    : { inputMint: DEVNET_SWAP_MINTS.usdc, outputMint: DEVNET_SWAP_MINTS.sol, amount: BUY_SOL_USDC_MICROS };
}
function positive(value: string) { return /^[1-9][0-9]*$/u.test(value); }
function validRoute(quote: RawQuote, inputMint: string, outputMint: string) {
  if (quote.routePlan.length < 1 || quote.routePlan.length > 4) return false;
  if (quote.routePlan[0]?.inputMint !== inputMint || quote.routePlan.at(-1)?.outputMint !== outputMint) return false;
  return quote.routePlan.every((route, index) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(route.poolId)
    && (index === 0 || quote.routePlan[index - 1]?.outputMint === route.inputMint));
}
function parseRawQuote(body: unknown): RawQuote {
  if (typeof body !== "object" || body === null) throw new Error("Raydium Devnet quote response is invalid");
  const envelope = body as { success?: unknown; data?: unknown };
  if (envelope.success !== true || typeof envelope.data !== "object" || envelope.data === null) throw new Error("Raydium Devnet quote was denied");
  const data = envelope.data as Record<string, unknown>;
  if (typeof data.inputMint !== "string" || typeof data.inputAmount !== "string" || typeof data.outputMint !== "string"
    || typeof data.outputAmount !== "string" || typeof data.otherAmountThreshold !== "string" || typeof data.slippageBps !== "number"
    || typeof data.priceImpactPct !== "number" || !Array.isArray(data.routePlan)) throw new Error("Raydium Devnet quote data is invalid");
  const routePlan = data.routePlan.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Raydium Devnet route is invalid");
    const route = item as Record<string, unknown>;
    if (typeof route.poolId !== "string" || typeof route.inputMint !== "string" || typeof route.outputMint !== "string") throw new Error("Raydium Devnet route is invalid");
    return { poolId: route.poolId, inputMint: route.inputMint, outputMint: route.outputMint };
  });
  return { inputMint: data.inputMint, inputAmount: data.inputAmount, outputMint: data.outputMint,
    outputAmount: data.outputAmount, otherAmountThreshold: data.otherAmountThreshold,
    slippageBps: data.slippageBps, priceImpactPct: data.priceImpactPct, routePlan };
}
