import { createPublicClient, http, formatEther, parseAbi, parseEther, type Hex, type Address } from "viem";
import { ROBINHOOD_CHAIN_CONFIG } from "../wallet/evm-signer.js";
import { VenueExecutionGate } from "./venue-execution-gate.js";

export interface EvmExecutionParams {
  to: `0x${string}`;
  valueWei: bigint;
  data?: Hex;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
}

export class EvmEngine {
  readonly #rpcUrl: string;
  readonly #chainId: number;
  readonly #publicClient;
  readonly #executionGate: VenueExecutionGate;

  constructor(
    rpcUrl: string = ROBINHOOD_CHAIN_CONFIG.rpcUrl,
    chainId: number = ROBINHOOD_CHAIN_CONFIG.chainId,
    executionGate: VenueExecutionGate = new VenueExecutionGate(),
  ) {
    this.#rpcUrl = rpcUrl;
    this.#chainId = chainId;
    this.#executionGate = executionGate;
    this.#publicClient = createPublicClient({
      transport: http(this.#rpcUrl),
    });
  }

  getChainId(): number {
    return this.#chainId;
  }

  /**
   * Proves that the configured RPC is serving the expected chain.
   * Call this immediately before any estimate, signing preparation, or broadcast.
   */
  async assertExpectedChain(): Promise<number> {
    const remoteChainId = await this.#publicClient.getChainId();
    if (remoteChainId !== this.#chainId) {
      throw new Error(`EVM RPC chain mismatch: expected ${this.#chainId}, received ${remoteChainId}`);
    }
    return remoteChainId;
  }

  /**
   * Fetches native ETH / L2 Gas token balance of an address
   */
  async getBalance(address: Address): Promise<{ wei: bigint; formatted: string }> {
    await this.assertExpectedChain();
    const wei = await this.#publicClient.getBalance({ address });
    return {
      wei,
      formatted: formatEther(wei),
    };
  }

  /**
   * Estimates gas limit and gas fees for an EIP-1559 transaction
   */
  async estimateGasAndFees(params: EvmExecutionParams & { from: Address }): Promise<{
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    await this.assertExpectedChain();
    const gasLimit = await this.#publicClient.estimateGas({
      account: params.from,
      to: params.to,
      value: params.valueWei,
      data: params.data,
    });

    const feeHistory = await this.#publicClient.estimateFeesPerGas();

    return {
      gasLimit,
      maxFeePerGas: feeHistory.maxFeePerGas ?? parseEther("0.00000002"),
      maxPriorityFeePerGas: feeHistory.maxPriorityFeePerGas ?? parseEther("0.000000001"),
    };
  }

  async getErc20Allowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
    await this.assertExpectedChain();
    return await this.#publicClient.readContract({
      address: token,
      abi: parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]),
      functionName: "allowance",
      args: [owner, spender],
    });
  }

  /** Returns the pending nonce used to create a one-time EIP-1559 transaction. */
  async getPendingNonce(address: Address): Promise<number> {
    await this.assertExpectedChain();
    return await this.#publicClient.getTransactionCount({ address, blockTag: "pending" });
  }

  /**
   * Broadcasts a signed raw transaction payload to Robinhood Chain
   */
  async sendRawTransaction(rawTx: Hex): Promise<Hex> {
    this.#executionGate.require("evm");
    await this.assertExpectedChain();
    const hash = await this.#publicClient.sendRawTransaction({ serializedTransaction: rawTx });
    return hash;
  }

  /**
   * Waits for block finalization / transaction receipt on Robinhood Chain
   */
  async waitForReceipt(hash: Hex) {
    await this.assertExpectedChain();
    return await this.#publicClient.waitForTransactionReceipt({ hash });
  }

  /** Reads an existing transaction only; this method never retries or rebroadcasts it. */
  async getReceiptStatus(hash: Hex): Promise<"success" | "reverted" | null> {
    await this.assertExpectedChain();
    const receipt = await this.#publicClient.getTransactionReceipt({ hash }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (/not found|not exist|unknown transaction/iu.test(message)) return null;
      throw error;
    });
    return receipt === null ? null : receipt.status;
  }
}
