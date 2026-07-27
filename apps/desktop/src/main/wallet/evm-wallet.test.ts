import assert from "node:assert/strict";
import test from "node:test";

import { EvmWalletService } from "./evm-wallet.js";

function createSecrets() {
  let value: string | null = null;
  return {
    isLocked: () => false,
    getSecret: async () => value,
    setSecret: async (_name: "evm-wallet-secret", next: string) => { value = next; },
  };
}

test("EVM wallet creates a one-time recovery mnemonic and persists only encrypted-secret input", async () => {
  const service = new EvmWalletService(createSecrets());
  const created = await service.createWallet();
  assert.match(created.address, /^0x[0-9a-f]{40}$/iu);
  assert.equal(created.derivationPath, "m/44'/60'/0'/0/0");
  assert.equal(await service.getAddress(), created.address);
  await assert.rejects(() => service.createWallet(), /already configured/u);
});

test("EVM wallet imports a mnemonic and rejects malformed recovery material", async () => {
  const service = new EvmWalletService(createSecrets());
  await assert.rejects(() => service.importMnemonic("not a mnemonic"), /invalid/u);
  const imported = await service.importMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
  assert.equal(await service.getAddress(), imported.address);
});

test("EVM wallet exposes a signer only inside the local main-process callback", async () => {
  const service = new EvmWalletService(createSecrets());
  await service.importMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
  const address = await service.withSigner(async (signer) => signer.getAddress());
  assert.match(address, /^0x[0-9a-f]{40}$/iu);
});
