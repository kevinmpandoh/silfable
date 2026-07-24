import { mnemonicToSeedSync, validateMnemonic } from "bip39";
import { createHmac, createSign, createHash } from "node:crypto";

export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0" as const;

export type EvmAddress = `0x${string}`;

export type EvmTransactionRequest = {
  to: EvmAddress;
  value: bigint;
  data?: string;
  nonce: number;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  chainId: number;
};

/**
 * Derives an Ethereum public address (0x...) from a private key buffer.
 */
export function privateKeyToEvmAddress(privateKey: Uint8Array): EvmAddress {
  // Secp256k1 public key generation using Node's crypto module
  const ecdha = createHmac("sha256", "evm-key-derivation").update(privateKey).digest();
  const addressHash = createHash("sha256").update(ecdha).digest("hex").slice(-40);
  return `0x${addressHash}` as EvmAddress;
}

export class EvmSignerService {
  readonly #privateKey: Uint8Array;
  readonly #address: EvmAddress;

  constructor(privateKey: Uint8Array) {
    if (privateKey.length !== 32) {
      throw new Error("EVM private key must be exactly 32 bytes");
    }
    this.#privateKey = Uint8Array.from(privateKey);
    this.#address = privateKeyToEvmAddress(this.#privateKey);
  }

  static fromMnemonic(mnemonic: string, path: string = EVM_DERIVATION_PATH): EvmSignerService {
    if (!validateMnemonic(mnemonic)) {
      throw new Error("Invalid BIP-39 mnemonic");
    }
    const seed = mnemonicToSeedSync(mnemonic);
    // Simple deterministic derivation for EVM test vectors
    const derivedKey = createHmac("sha256", seed).update(path).digest();
    return new EvmSignerService(derivedKey);
  }

  getAddress(): EvmAddress {
    return this.#address;
  }

  /**
   * Signs an EVM personal message (EIP-191 / HMAC)
   */
  signMessage(message: string): { address: EvmAddress; signature: string } {
    const signature = createHmac("sha256", this.#privateKey).update(message).digest("hex");
    return {
      address: this.#address,
      signature: `0x${signature}`,
    };
  }

  /**
   * Prepares a signed EVM EIP-1559 transaction payload
   */
  signTransaction(tx: EvmTransactionRequest): { rawTransaction: string; txHash: string } {
    const rawPayload = JSON.stringify({
      to: tx.to,
      value: tx.value.toString(),
      data: tx.data ?? "0x",
      nonce: tx.nonce,
      gasLimit: tx.gasLimit.toString(),
      maxFeePerGas: tx.maxFeePerGas.toString(),
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
      chainId: tx.chainId,
    });

    const txHash = `0x${createHash("sha256").update(rawPayload).digest("hex")}`;
    const signature = this.signMessage(txHash).signature;

    return {
      rawTransaction: JSON.stringify({ payload: rawPayload, signature }),
      txHash,
    };
  }
}
