import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  X402PaymentRequirementsSchema,
  X402PreparedPaymentSchema,
  X402ResourceSchema,
  X402_MARKET_PROVIDER_CATALOG,
  X402_SOLANA_MAINNET,
  X402_SOLANA_USDC_MINT,
  type X402PaymentRequirements,
  type X402PreparedPayment,
  type X402Resource,
} from "@mirae/contracts";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const MAX_PROVIDER_DOWNLOAD_BYTES = 1_000_000;
const MAX_STORED_EVIDENCE_BYTES = 63_000;

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

export function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex")}`;
}

export function encodeX402Header(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeX402Header(value: string): unknown {
  if (value.length > 32_000) throw new Error("x402 header is too large");
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown;
}

export async function assertSafeExternalUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Only standard HTTPS provider URLs are allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private provider hosts are blocked");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private provider addresses are blocked");
  return url;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) || (parts[0] === 192 && parts[1] === 168);
}

export async function discoverMiraeCatalog(input: { query: string; maxAtomic: bigint; limit: number }): Promise<{ resources: X402Resource[]; rejectedCount: number }> {
  const resources: X402Resource[] = [];
  let rejectedCount = 0;
  const candidates = X402_MARKET_PROVIDER_CATALOG.slice(0, input.limit);
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    await assertSafeExternalUrl(candidate.url);
    const response = await fetch(candidate.url, { method: candidate.method, headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (response.status !== 402) throw new Error(`Provider did not return x402 requirements (${response.status})`);
    const encoded = response.headers.get("payment-required") ?? response.headers.get("x-payment-required");
    const body = encoded ? decodeX402Header(encoded) : await readLimitedJson(response, 32_000);
    if (!isRecord(body) || body.x402Version !== 2 || !Array.isArray(body.accepts)) throw new Error("Provider returned invalid x402 requirements");
    const requirements = X402PaymentRequirementsSchema.parse(body.accepts.find((entry) => isRecord(entry) && entry.scheme === "exact" && entry.network === X402_SOLANA_MAINNET && entry.asset === X402_SOLANA_USDC_MINT));
    if (requirements.resource && requirements.resource !== candidate.url) throw new Error("Provider requirements target another resource");
    if (BigInt(requirements.amount) > input.maxAtomic) throw new Error("price exceeds limit");
    await assertSponsoredPaymentReady(requirements);
    return X402ResourceSchema.parse({
      id: digest({ url: candidate.url, method: candidate.method, requirements }),
      resource: { url: candidate.url, description: candidate.description, mimeType: "application/json", serviceName: candidate.serviceName, tags: [...candidate.tags] },
      method: candidate.method,
      requirements,
      quality: { callsLast30Days: null, uniquePayersLast30Days: null, lastCalledAt: null },
      discoveredAt: new Date().toISOString(),
    });
  }));
  for (const result of results) {
    if (result.status === "fulfilled") resources.push(result.value);
    else rejectedCount += 1;
  }
  return { resources, rejectedCount };
}

async function assertSponsoredPaymentReady(requirements: X402PaymentRequirements): Promise<void> {
  const connection = new Connection(process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const mint = new PublicKey(X402_SOLANA_USDC_MINT);
  const destinationAta = getAssociatedTokenAddressSync(mint, new PublicKey(requirements.payTo));
  const [feePayerBalance, destination] = await Promise.all([
    connection.getBalance(new PublicKey(requirements.extra.feePayer), "confirmed"),
    connection.getAccountInfo(destinationAta, "confirmed"),
  ]);
  if (feePayerBalance < 1_000_000) throw new Error("Provider sponsored fee payer is unavailable");
  if (!destination) throw new Error("Provider USDC recipient account is unavailable");
}

export async function fetchLiveRequirements(resource: X402Resource, input: unknown): Promise<X402PaymentRequirements> {
  const url = await assertSafeExternalUrl(resource.resource.url);
  const init: RequestInit = { method: resource.method, headers: { Accept: "application/json", ...(resource.method === "POST" ? { "Content-Type": "application/json" } : {}) }, body: resource.method === "POST" ? JSON.stringify(input ?? {}) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) };
  let response: Response;
  try { response = await fetch(url, init); }
  catch (cause) {
    if (isTimeoutError(cause)) throw new Error("Provider payment challenge timed out before any wallet signature or charge");
    throw cause;
  }
  if (response.status !== 402) throw new Error(`Provider did not return x402 requirements (${response.status})`);
  const encoded = response.headers.get("payment-required") ?? response.headers.get("x-payment-required");
  const body = encoded ? decodeX402Header(encoded) : await readLimitedJson(response, 32_000);
  const paymentRequired = body as { x402Version?: unknown; resource?: { url?: unknown }; accepts?: unknown };
  if (paymentRequired.x402Version !== 2 || paymentRequired.resource?.url !== resource.resource.url || !Array.isArray(paymentRequired.accepts)) throw new Error("Provider returned invalid x402 v2 requirements");
  const requirements = X402PaymentRequirementsSchema.parse(paymentRequired.accepts.find((entry) => isRecord(entry) && entry.scheme === "exact" && entry.network === X402_SOLANA_MAINNET && entry.asset === X402_SOLANA_USDC_MINT));
  if (requirements.resource && requirements.resource !== resource.resource.url) throw new Error("Provider requirements target another resource");
  return requirements;
}

export async function preparePayment(input: { sessionId: string; walletAddress: string; resource: X402Resource; requestInput: unknown; maxResourceAtomic: bigint; maxMissionAtomic: bigint; missionSpentAtomic: bigint; connection?: Connection }): Promise<X402PreparedPayment> {
  if (input.maxResourceAtomic > 100_000n || input.maxMissionAtomic > 1_000_000n || input.maxResourceAtomic > input.maxMissionAtomic) throw new Error("x402 budget exceeds the hard cap");
  const live = await fetchLiveRequirements(input.resource, input.requestInput);
  if (digest(live) !== digest(input.resource.requirements)) throw new Error("Provider payment requirements changed; run discovery again");
  const amount = BigInt(live.amount);
  if (amount > input.maxResourceAtomic || input.missionSpentAtomic + amount > input.maxMissionAtomic) throw new Error("x402 purchase exceeds the approved budget");
  const connection = input.connection ?? new Connection(process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const payer = new PublicKey(input.walletAddress);
  const mint = new PublicKey(X402_SOLANA_USDC_MINT);
  const recipient = new PublicKey(live.payTo);
  const sourceAta = getAssociatedTokenAddressSync(mint, payer);
  const destinationAta = getAssociatedTokenAddressSync(mint, recipient);
  const [source, destination, balance] = await Promise.all([connection.getAccountInfo(sourceAta), connection.getAccountInfo(destinationAta), connection.getTokenAccountBalance(sourceAta).catch(() => null)]);
  if (!source || !balance || BigInt(balance.value.amount) < amount) throw new Error("USDC balance is insufficient for this x402 payment");
  if (!destination) throw new Error("Provider USDC recipient account does not exist");
  const latest = live.extra.recentBlockhash && live.extra.lastValidBlockHeight ? { blockhash: live.extra.recentBlockhash, lastValidBlockHeight: Number(live.extra.lastValidBlockHeight) } : await connection.getLatestBlockhash("confirmed");
  const memo = live.extra.memo ?? randomUUID().replaceAll("-", "");
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    createTransferCheckedInstruction(sourceAta, mint, destinationAta, payer, amount, 6),
    new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo, "utf8") }),
  ];
  const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: new PublicKey(live.extra.feePayer), recentBlockhash: latest.blockhash, instructions }).compileToV0Message());
  const [fee, simulation] = await Promise.all([
    connection.getFeeForMessage(transaction.message, "confirmed"),
    connection.simulateTransaction(transaction, { replaceRecentBlockhash: true, sigVerify: false }),
  ]);
  if (simulation.value.err) throw new Error(`x402 payment simulation failed: ${JSON.stringify(simulation.value.err)}`);
  const now = new Date();
  const request = { method: input.resource.method, url: input.resource.resource.url, body: input.resource.method === "POST" ? input.requestInput ?? {} : null } as const;
  const requestDigest = digest(request);
  const requirementsDigest = digest(live);
  const plan = {
    id: randomUUID(), sessionId: input.sessionId, walletAddress: input.walletAddress, resource: { ...input.resource, requirements: live }, request,
    requestDigest, requirementsDigest, idempotencyKey: digest({ input: requestDigest, requirements: requirementsDigest, wallet: input.walletAddress, nonce: randomUUID() }),
    status: "AWAITING_SIGNATURE" as const, expiresAt: new Date(now.getTime() + live.maxTimeoutSeconds * 1_000).toISOString(), createdAt: now.toISOString(),
    transactionBase64: Buffer.from(transaction.serialize()).toString("base64"), blockhash: latest.blockhash, lastValidBlockHeight: String(latest.lastValidBlockHeight), estimatedNetworkFeeLamports: String(fee.value ?? 0),
  };
  return X402PreparedPaymentSchema.parse(plan);
}

export function assertSignedTransactionMatches(preparedBase64: string, signedBase64: string, walletAddress: string): VersionedTransaction {
  const prepared = VersionedTransaction.deserialize(Buffer.from(preparedBase64, "base64"));
  const signed = VersionedTransaction.deserialize(Buffer.from(signedBase64, "base64"));
  if (!Buffer.from(prepared.message.serialize()).equals(Buffer.from(signed.message.serialize()))) throw new Error("Signed x402 transaction differs from the reviewed transaction");
  const signerIndex = signed.message.staticAccountKeys.findIndex((key) => key.toBase58() === walletAddress);
  if (signerIndex < 0 || signed.signatures[signerIndex]?.every((byte) => byte === 0)) throw new Error("Selected wallet did not sign the x402 transaction");
  return signed;
}

export async function callPaidResource(input: { resource: X402Resource; request: { method: "GET" | "POST"; url: string; body: unknown }; signedTransactionBase64: string }): Promise<{ settlement: Record<string, unknown>; mimeType: string; body: string }> {
  await assertSafeExternalUrl(input.request.url);
  const paymentPayload = { x402Version: 2, resource: input.resource.resource, accepted: input.resource.requirements, payload: { transaction: input.signedTransactionBase64 }, extensions: {} };
  let response: Response;
  try {
    response = await fetch(input.request.url, { method: input.request.method, headers: { Accept: "application/json", "PAYMENT-SIGNATURE": encodeX402Header(paymentPayload), ...(input.request.method === "POST" ? { "Content-Type": "application/json" } : {}) }, body: input.request.method === "POST" ? JSON.stringify(input.request.body ?? {}) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(75_000) });
  } catch (cause) {
    if (isTimeoutError(cause)) throw new Error("Provider retrieval timed out after signed proof submission; settlement is unknown. Check the wallet activity or receipt status before retrying");
    throw cause;
  }
  const paymentResponse = response.headers.get("payment-response");
  if (!response.ok || !paymentResponse) throw new Error(`Provider did not settle the x402 payment (${response.status})`);
  const settlement = decodeX402Header(paymentResponse) as Record<string, unknown>;
  if (settlement.success !== true || settlement.network !== X402_SOLANA_MAINNET || typeof settlement.transaction !== "string") throw new Error("Provider returned an invalid settlement response");
  const rawBody = await readLimitedText(response, MAX_PROVIDER_DOWNLOAD_BYTES);
  const body = compactProviderEvidence(rawBody, input.request.body, MAX_STORED_EVIDENCE_BYTES);
  return { settlement, mimeType: response.headers.get("content-type")?.slice(0, 128) ?? "application/octet-stream", body };
}

export function compactProviderEvidence(rawBody: string, requestInput: unknown, maximumBytes = MAX_STORED_EVIDENCE_BYTES): string {
  const query = typeof requestInput === "object" && requestInput !== null && "query" in requestInput && typeof requestInput.query === "string" ? requestInput.query : "";
  const symbols = [...new Set(query.toUpperCase().match(/\b(?:SOL|ETH|BTC|JUP|ONDO|DOGE|USDC)\b/g) ?? [])];
  let evidence = rawBody;
  if (symbols.length > 0) {
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      const matches = collectSymbolEvidence(parsed, symbols, 200);
      if (matches.length > 0) evidence = JSON.stringify({ filteredFor: symbols, sourcePayloadBytes: Buffer.byteLength(rawBody, "utf8"), matches });
    } catch {
      // Non-JSON provider output remains untrusted text and is bounded below.
    }
  }
  if (Buffer.byteLength(evidence, "utf8") <= maximumBytes) return evidence;
  const marker = "\n...[Mirae truncated oversized untrusted provider output]";
  const available = Math.max(0, maximumBytes - Buffer.byteLength(marker, "utf8"));
  let truncated = Buffer.from(evidence, "utf8").subarray(0, available).toString("utf8");
  while (Buffer.byteLength(truncated + marker, "utf8") > maximumBytes) truncated = truncated.slice(0, -1);
  return truncated + marker;
}

function collectSymbolEvidence(value: unknown, symbols: string[], limit: number): unknown[] {
  const matches: unknown[] = [];
  const visit = (entry: unknown): void => {
    if (matches.length >= limit || entry === null || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      for (const item of entry) {
        if (matches.length >= limit) break;
        const preview = safePreview(item);
        if (symbols.some((symbol) => preview.includes(symbol))) matches.push(item);
        else visit(item);
      }
      return;
    }
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      if (matches.length >= limit) break;
      const upperKey = key.toUpperCase();
      if (symbols.some((symbol) => upperKey === symbol || upperKey.includes(`${symbol}-`) || upperKey.includes(`${symbol}_`))) matches.push({ [key]: child });
      else visit(child);
    }
  };
  visit(value);
  return matches;
}

function safePreview(value: unknown): string {
  try { return JSON.stringify(value).slice(0, 8_000).toUpperCase(); }
  catch { return ""; }
}
function isTimeoutError(value: unknown): boolean { return value instanceof Error && (value.name === "TimeoutError" || value.name === "AbortError" || /timeout|aborted/iu.test(value.message)); }

async function readLimitedJson(response: Response, limit: number): Promise<unknown> { return JSON.parse(await readLimitedText(response, limit)) as unknown; }
async function readLimitedText(response: Response, limit: number): Promise<string> { const length = Number(response.headers.get("content-length") ?? 0); if (length > limit) throw new Error("Provider response exceeds the size limit"); const text = await response.text(); if (Buffer.byteLength(text, "utf8") > limit) throw new Error("Provider response exceeds the size limit"); return text; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
