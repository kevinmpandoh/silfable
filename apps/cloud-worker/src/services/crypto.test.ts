import { describe, expect, it } from "vitest";
import { decryptAgentKey, encryptAgentKey } from "./crypto.js";

describe("Cloud Worker Cryptography Service", () => {
  it("encrypts and decrypts agent private key correctly using AES-256-GCM", () => {
    const rawSecret = "5K8...solana_private_key_base58_or_hex_string";
    const { ciphertext, iv } = encryptAgentKey(rawSecret);

    expect(ciphertext).toBeDefined();
    expect(iv).toHaveLength(24); // 12 bytes hex

    const decrypted = decryptAgentKey(ciphertext, iv);
    expect(decrypted).toBe(rawSecret);
  });

  it("throws error when attempting to decrypt tampered ciphertext", () => {
    const rawSecret = "secret_key_payload";
    const { ciphertext, iv } = encryptAgentKey(rawSecret);
    const tampered = "bad" + ciphertext.slice(3);

    expect(() => decryptAgentKey(tampered, iv)).toThrow();
  });
});
