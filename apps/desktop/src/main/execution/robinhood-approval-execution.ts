import type { Address, Hex } from "viem";
import { randomUUID } from "node:crypto";

import type { EvmSignerService } from "../wallet/evm-signer.js";
import { buildExactApprovalCalldata } from "./erc20-approval.js";
import type { EmergencyStopService } from "../security/emergency-stop.js";
import type { MasterPasswordService } from "../security/master-password.js";

type ApprovalEngine = {
  getChainId(): number;
  getPendingNonce(address: Address): Promise<number>;
  estimateGasAndFees(input: { from: Address; to: Address; data?: Hex; valueWei: bigint }): Promise<{ gasLimit: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
  sendRawTransaction(rawTx: Hex): Promise<Hex>;
  waitForReceipt(hash: Hex): Promise<{ status: "success" | "reverted" }>;
};

type ReceiptSaver = { save(receipt: { id: string; transactionHash: Hex; wallet: Address; kind: "approval"; status: "confirmed" | "reverted" | "unknown"; reconciledAt: string }): Promise<void> };

export type RobinhoodApprovalRequest = {
  masterPassword: string;
  confirmation: "APPROVE ROBINHOOD MAINNET";
  wallet: Address;
  token: Address;
  spender: Address;
  exactAmount: bigint;
};

/**
 * Executes only the exact ERC-20 approval required by an already reviewed trade.
 * It deliberately does not execute a swap: after approval is confirmed, the caller
 * must obtain a new firm quote and preflight it again.
 */
export class RobinhoodApprovalExecutionService {
  readonly #passwords: MasterPasswordService;
  readonly #emergencyStop: EmergencyStopService;
  readonly #receipts: ReceiptSaver | undefined;

  constructor(passwords: MasterPasswordService, emergencyStop: EmergencyStopService, receipts?: ReceiptSaver) {
    this.#passwords = passwords;
    this.#emergencyStop = emergencyStop;
    this.#receipts = receipts;
  }

  async execute(input: RobinhoodApprovalRequest & { engine: ApprovalEngine; withSigner: <T>(operation: (signer: EvmSignerService) => Promise<T>) => Promise<T> }): Promise<{ hash: Hex }> {
    if (input.confirmation !== "APPROVE ROBINHOOD MAINNET") throw new Error("Robinhood approval confirmation is required");
    this.#emergencyStop.assertExecutionAllowed();
    if (!(await this.#passwords.verify(input.masterPassword))) throw new Error("Master password is incorrect");

    const data = buildExactApprovalCalldata({ tokenAddress: input.token, spenderAddress: input.spender, exactAmount: input.exactAmount });
    const [nonce, gas] = await Promise.all([
      input.engine.getPendingNonce(input.wallet),
      input.engine.estimateGasAndFees({ from: input.wallet, to: input.token, data, valueWei: 0n }),
    ]);
    const signed = await input.withSigner((signer) => signer.signTransaction({
      to: input.token,
      value: 0n,
      data,
      nonce,
      gasLimit: gas.gasLimit,
      maxFeePerGas: gas.maxFeePerGas,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
      chainId: input.engine.getChainId(),
    }));
    const hash = await input.engine.sendRawTransaction(signed.rawTransaction);
    const receiptId = randomUUID();
    const broadcastAt = new Date().toISOString();
    await this.#receipts?.save({ id: receiptId, transactionHash: hash, wallet: input.wallet, kind: "approval", status: "unknown", reconciledAt: broadcastAt });
    const receipt = await input.engine.waitForReceipt(hash);
    const status = receipt.status === "success" ? "confirmed" : "reverted" as const;
    await this.#receipts?.save({ id: receiptId, transactionHash: hash, wallet: input.wallet, kind: "approval", status, reconciledAt: new Date().toISOString() });
    if (receipt.status !== "success") throw new Error("Robinhood approval reverted on-chain");
    return { hash };
  }
}
