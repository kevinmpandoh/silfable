import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedEnvelope = {
  ciphertext: string;
  nonce: string;
  keyId: "local-data-key-v1";
};

type DataKeyStore = {
  getSecret(name: "database-data-key"): Promise<string | null>;
  setSecret(name: "database-data-key", plaintext: string): Promise<void>;
};

export class LocalDataCipher {
  readonly #keystore: DataKeyStore;

  constructor(keystore: DataKeyStore) {
    this.#keystore = keystore;
  }

  async encryptString(plaintext: string): Promise<EncryptedEnvelope> {
    const key = await this.#getOrCreateKey();
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
      return {
        ciphertext: ciphertext.toString("base64"),
        nonce: nonce.toString("base64"),
        keyId: "local-data-key-v1",
      };
    } finally {
      key.fill(0);
    }
  }

  async decryptString(envelope: EncryptedEnvelope): Promise<string> {
    if (envelope.keyId !== "local-data-key-v1") throw new Error("Encrypted data key is unsupported");
    const key = await this.#getOrCreateKey();
    try {
      const nonce = Buffer.from(envelope.nonce, "base64");
      const payload = Buffer.from(envelope.ciphertext, "base64");
      if (nonce.length !== 12 || payload.length <= 16) throw new Error("Encrypted data is invalid");
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAuthTag(payload.subarray(payload.length - 16));
      return Buffer.concat([decipher.update(payload.subarray(0, payload.length - 16)), decipher.final()]).toString("utf8");
    } finally {
      key.fill(0);
    }
  }

  async #getOrCreateKey(): Promise<Buffer> {
    const stored = await this.#keystore.getSecret("database-data-key");
    if (stored !== null) {
      const key = Buffer.from(stored, "base64");
      if (key.length !== 32) throw new Error("Database data key is invalid");
      return key;
    }
    const key = randomBytes(32);
    await this.#keystore.setSecret("database-data-key", key.toString("base64"));
    return key;
  }
}

export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  return JSON.stringify(envelope);
}

export function parseEnvelope(serialized: string): EncryptedEnvelope {
  const parsed: unknown = JSON.parse(serialized);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Encrypted envelope is invalid");
  const value = parsed as Partial<EncryptedEnvelope>;
  if (
    typeof value.ciphertext !== "string" ||
    typeof value.nonce !== "string" ||
    value.keyId !== "local-data-key-v1"
  ) {
    throw new Error("Encrypted envelope is invalid");
  }
  return value as EncryptedEnvelope;
}
