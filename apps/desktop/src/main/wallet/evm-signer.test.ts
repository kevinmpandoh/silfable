import { generateMnemonic } from "bip39";
import { describe, expect, it } from "vitest";

import { EvmSignerService, privateKeyToEvmAddress } from "./evm-signer.js";

describe("EvmSignerService", () => {
  it("derives valid 0x EVM address from private key", () => {
    const pk = new Uint8Array(32).fill(7);
    const address = privateKeyToEvmAddress(pk);
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/u);
  });

  it("derives EVM signer from valid BIP-39 mnemonic", () => {
    const mnemonic = generateMnemonic();
    const signer = EvmSignerService.fromMnemonic(mnemonic);
    expect(signer.getAddress()).toMatch(/^0x[0-9a-fA-F]{40}$/u);
  });

  it("signs message producing 0x hex signature", () => {
    const pk = new Uint8Array(32).fill(9);
    const signer = new EvmSignerService(pk);
    const res = signer.signMessage("Hello EVM");
    expect(res.address).toBe(signer.getAddress());
    expect(res.signature).toMatch(/^0x[0-9a-fA-F]+$/u);
  });

  it("signs EIP-1559 transaction request", () => {
    const pk = new Uint8Array(32).fill(11);
    const signer = new EvmSignerService(pk);
    const signedTx = signer.signTransaction({
      to: "0x1111111111111111111111111111111111111111",
      value: 1000000000000000000n, // 1 ETH
      nonce: 0,
      gasLimit: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      chainId: 42161, // Arbitrum One
    });

    expect(signedTx.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/u);
    expect(signedTx.rawTransaction).toContain("0x1111111111111111111111111111111111111111");
  });
});
