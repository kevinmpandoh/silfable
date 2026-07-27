import { generateMnemonic, validateMnemonic } from "bip39";

import { EVM_DERIVATION_PATH, EvmSignerService, type EvmAddress } from "./evm-signer.js";

type SecretStore = {
  isLocked(): boolean;
  getSecret(name: "evm-wallet-secret"): Promise<string | null>;
  setSecret(name: "evm-wallet-secret", plaintext: string): Promise<void>;
};

/** Local-only EVM wallet for Robinhood Chain. It deliberately has no broadcast method. */
export class EvmWalletService {
  readonly #secrets: SecretStore;

  constructor(secrets: SecretStore) {
    this.#secrets = secrets;
  }

  async getAddress(): Promise<EvmAddress | null> {
    this.#assertUnlocked();
    const mnemonic = await this.#secrets.getSecret("evm-wallet-secret");
    return mnemonic === null ? null : EvmSignerService.fromMnemonic(mnemonic).getAddress();
  }

  async createWallet(): Promise<{ address: EvmAddress; recoveryMnemonic: string; derivationPath: typeof EVM_DERIVATION_PATH }> {
    this.#assertUnlocked();
    if (await this.#secrets.getSecret("evm-wallet-secret") !== null) throw new Error("Robinhood EVM wallet is already configured");
    const recoveryMnemonic = generateMnemonic(256);
    const address = EvmSignerService.fromMnemonic(recoveryMnemonic).getAddress();
    await this.#secrets.setSecret("evm-wallet-secret", recoveryMnemonic);
    return { address, recoveryMnemonic, derivationPath: EVM_DERIVATION_PATH };
  }

  async importMnemonic(mnemonic: string): Promise<{ address: EvmAddress }> {
    this.#assertUnlocked();
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/gu, " ");
    if (!validateMnemonic(normalized)) throw new Error("EVM recovery phrase is invalid");
    const address = EvmSignerService.fromMnemonic(normalized).getAddress();
    await this.#secrets.setSecret("evm-wallet-secret", normalized);
    return { address };
  }

  async withSigner<T>(operation: (signer: EvmSignerService) => Promise<T>): Promise<T> {
    this.#assertUnlocked();
    const mnemonic = await this.#secrets.getSecret("evm-wallet-secret");
    if (mnemonic === null) throw new Error("Robinhood EVM wallet is not configured");
    return await operation(EvmSignerService.fromMnemonic(mnemonic));
  }

  #assertUnlocked(): void {
    if (this.#secrets.isLocked()) throw new Error("Vault is locked");
  }
}
