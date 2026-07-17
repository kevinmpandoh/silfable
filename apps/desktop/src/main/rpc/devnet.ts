import {
  address,
  createSolanaRpc,
  devnet,
  lamports,
  signature,
  type Base64EncodedWireTransaction,
} from "@solana/kit";

const DEVNET_ENDPOINT = "https://api.devnet.solana.com";
const REQUEST_TIMEOUT_MS = 5_000;
const DEGRADED_LATENCY_MS = 3_000;
const MAX_HEALTH_AGE_MS = 30_000;
const AIRDROP_LAMPORTS = 1_000_000_000n;
const AIRDROP_COOLDOWN_MS = 60_000;

export type NetworkHealthSnapshot = {
  health: "unknown" | "healthy" | "degraded" | "offline";
  checkedAt: string | null;
  latencyMs: number | null;
};

export type DevnetRpcPort = {
  probeHealth(): Promise<{ latencyMs: number }>;
  getBalance(addressValue: string): Promise<bigint>;
  requestAirdrop(addressValue: string): Promise<string>;
};

export type DevnetTransactionRpcPort = {
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
  simulateTransaction(wireTransaction: string): Promise<{ error: boolean; unitsConsumed: bigint | null; fee: bigint | null }>;
  sendTransaction(wireTransaction: string): Promise<string>;
  getSignatureStatus(signatureValue: string): Promise<{
    found: boolean;
    error: boolean;
    confirmationStatus: "processed" | "confirmed" | "finalized" | null;
  }>;
  getBlockHeight(): Promise<bigint>;
};

export type DevnetProvisioningRpcPort = DevnetTransactionRpcPort & {
  getMinimumBalanceForRentExemption(space: bigint): Promise<bigint>;
};

export type DevnetEncodedAccount = {
  address: string;
  programAddress: string;
  executable: boolean;
  dataBase64: string;
} | null;

export type DevnetFixtureRpcPort = {
  getMultipleAccountsBase64(addressesValue: readonly string[]): Promise<{
    contextSlot: bigint;
    accounts: DevnetEncodedAccount[];
  }>;
};

export class SolanaDevnetRpc implements DevnetRpcPort, DevnetTransactionRpcPort, DevnetFixtureRpcPort {
  readonly #rpc = createSolanaRpc(devnet(DEVNET_ENDPOINT));

  async probeHealth(): Promise<{ latencyMs: number }> {
    const startedAt = performance.now();
    const result = await this.#rpc.getHealth().send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (result !== "ok") throw new Error("Devnet RPC node is unhealthy");
    return { latencyMs: Math.round(performance.now() - startedAt) };
  }

  async getBalance(addressValue: string): Promise<bigint> {
    const response = await this.#rpc
      .getBalance(address(addressValue), { commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return response.value;
  }

  async requestAirdrop(addressValue: string): Promise<string> {
    return this.#rpc
      .requestAirdrop(address(addressValue), lamports(AIRDROP_LAMPORTS), { commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }> {
    const response = await this.#rpc
      .getLatestBlockhash({ commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return { blockhash: response.value.blockhash, lastValidBlockHeight: response.value.lastValidBlockHeight };
  }

  async getMinimumBalanceForRentExemption(space: bigint): Promise<bigint> {
    return this.#rpc
      .getMinimumBalanceForRentExemption(space, { commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  async simulateTransaction(wireTransaction: string): Promise<{ error: boolean; unitsConsumed: bigint | null; fee: bigint | null }> {
    const response = await this.#rpc
      .simulateTransaction(wireTransaction as Base64EncodedWireTransaction, {
        commitment: "confirmed",
        encoding: "base64",
        sigVerify: false,
      })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return {
      error: response.value.err !== null,
      unitsConsumed: response.value.unitsConsumed ?? null,
      fee: response.value.fee,
    };
  }

  async sendTransaction(wireTransaction: string): Promise<string> {
    return this.#rpc
      .sendTransaction(wireTransaction as Base64EncodedWireTransaction, {
        encoding: "base64",
        maxRetries: 0n,
        preflightCommitment: "confirmed",
        skipPreflight: false,
      })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  async getSignatureStatus(signatureValue: string): Promise<{
    found: boolean;
    error: boolean;
    confirmationStatus: "processed" | "confirmed" | "finalized" | null;
  }> {
    const response = await this.#rpc
      .getSignatureStatuses([signature(signatureValue)], { searchTransactionHistory: true })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const status = response.value[0];
    if (status === null || status === undefined) return { found: false, error: false, confirmationStatus: null };
    return {
      found: true,
      error: status.err !== null,
      confirmationStatus: status.confirmationStatus,
    };
  }

  async getBlockHeight(): Promise<bigint> {
    return this.#rpc
      .getBlockHeight({ commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  async getMultipleAccountsBase64(addressesValue: readonly string[]): Promise<{
    contextSlot: bigint;
    accounts: DevnetEncodedAccount[];
  }> {
    if (addressesValue.length === 0 || addressesValue.length > 8) throw new Error("Devnet fixture account count is invalid");
    const addresses = addressesValue.map((value) => address(value));
    const response = await this.#rpc
      .getMultipleAccounts(addresses, { commitment: "confirmed", encoding: "base64" })
      .send({ abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return {
      contextSlot: BigInt(response.context.slot),
      accounts: response.value.map((accountInfo, index) => accountInfo === null ? null : {
        address: addressesValue[index]!,
        programAddress: accountInfo.owner,
        executable: accountInfo.executable,
        dataBase64: accountInfo.data[0],
      }),
    };
  }
}

export class NetworkHealthMonitor {
  readonly #rpc: Pick<DevnetRpcPort, "probeHealth">;
  readonly #intervalMs: number;
  #timer: ReturnType<typeof setInterval> | null = null;
  #checking = false;
  #snapshot: NetworkHealthSnapshot = { health: "unknown", checkedAt: null, latencyMs: null };

  constructor(rpc: Pick<DevnetRpcPort, "probeHealth">, intervalMs = 15_000) {
    this.#rpc = rpc;
    this.#intervalMs = intervalMs;
  }

  getSnapshot(): NetworkHealthSnapshot {
    return { ...this.#snapshot };
  }

  isHealthyFresh(): boolean {
    const checkedAt = this.#snapshot.checkedAt === null ? 0 : new Date(this.#snapshot.checkedAt).getTime();
    return this.#snapshot.health === "healthy" && Date.now() - checkedAt <= MAX_HEALTH_AGE_MS;
  }

  start(): void {
    if (this.#timer !== null) return;
    void this.checkNow();
    this.#timer = setInterval(() => void this.checkNow(), this.#intervalMs);
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
    this.#snapshot = { health: "offline", checkedAt: new Date().toISOString(), latencyMs: null };
  }

  async checkNow(): Promise<NetworkHealthSnapshot> {
    if (this.#checking) return this.getSnapshot();
    this.#checking = true;
    const checkedAt = new Date().toISOString();
    try {
      const { latencyMs } = await this.#rpc.probeHealth();
      this.#snapshot = {
        health: latencyMs >= DEGRADED_LATENCY_MS ? "degraded" : "healthy",
        checkedAt,
        latencyMs,
      };
    } catch {
      this.#snapshot = { health: "offline", checkedAt, latencyMs: null };
    } finally {
      this.#checking = false;
    }
    return this.getSnapshot();
  }
}

export class DevnetWalletRpcService {
  readonly #rpc: DevnetRpcPort;
  readonly #health: NetworkHealthMonitor;
  readonly #getWalletAddress: () => Promise<string>;
  #lastAirdropAt = 0;

  constructor(input: {
    rpc: DevnetRpcPort;
    health: NetworkHealthMonitor;
    getWalletAddress: () => Promise<string>;
  }) {
    this.#rpc = input.rpc;
    this.#health = input.health;
    this.#getWalletAddress = input.getWalletAddress;
  }

  async getBalance(): Promise<{ address: string; lamportsAtomic: string; observedAt: string }> {
    this.#assertNetworkHealthy();
    const addressValue = await this.#getWalletAddress();
    const balance = await this.#rpc.getBalance(addressValue);
    return { address: addressValue, lamportsAtomic: balance.toString(), observedAt: new Date().toISOString() };
  }

  async requestOneSolAirdrop(): Promise<{ address: string; signature: string }> {
    this.#assertNetworkHealthy();
    const now = Date.now();
    if (now - this.#lastAirdropAt < AIRDROP_COOLDOWN_MS) throw new Error("Devnet faucet cooldown is active");
    const addressValue = await this.#getWalletAddress();
    const signature = await this.#rpc.requestAirdrop(addressValue);
    this.#lastAirdropAt = now;
    return { address: addressValue, signature };
  }

  #assertNetworkHealthy(): void {
    if (!this.#health.isHealthyFresh()) throw new Error("Devnet network is not healthy");
  }
}
