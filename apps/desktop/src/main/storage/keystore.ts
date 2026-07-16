import { safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type SecretName = "wallet-secret" | "openai-api-key" | "anthropic-api-key" | "database-data-key";

type KeystoreFileV1 = {
  version: 1;
  records: Partial<Record<SecretName, string>>;
};

export class LocalEncryptedKeystore {
  readonly #path: string;
  #locked = true;

  constructor(path: string) {
    this.#path = path;
  }

  isLocked(): boolean {
    return this.#locked;
  }

  unlock(): void {
    assertSecureBackend();
    this.#locked = false;
  }

  lock(): void {
    this.#locked = true;
  }

  async setSecret(name: SecretName, plaintext: string): Promise<void> {
    this.#assertUnlocked();
    if (plaintext.length === 0) throw new Error("Secret cannot be empty");

    const file = await this.#readFile();
    file.records[name] = safeStorage.encryptString(plaintext).toString("base64");
    await this.#writeFile(file);
  }

  async getSecret(name: SecretName): Promise<string | null> {
    this.#assertUnlocked();
    const encrypted = (await this.#readFile()).records[name];
    return encrypted === undefined ? null : safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  }

  async deleteSecret(name: SecretName): Promise<void> {
    this.#assertUnlocked();
    const file = await this.#readFile();
    delete file.records[name];
    await this.#writeFile(file);
  }

  #assertUnlocked(): void {
    if (this.#locked) throw new Error("Keystore is locked");
    assertSecureBackend();
  }

  async #readFile(): Promise<KeystoreFileV1> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.#path, "utf8"));
      if (!isKeystoreFile(parsed)) throw new Error("Keystore file is invalid");
      return parsed;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return { version: 1, records: {} };
      throw error;
    }
  }

  async #writeFile(file: KeystoreFileV1): Promise<void> {
    const directory = dirname(this.#path);
    const temporaryPath = `${this.#path}.tmp`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(temporaryPath, JSON.stringify(file), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.#path);
  }
}

function assertSecureBackend(): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("OS-backed encryption is unavailable");
  if (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text") {
    throw new Error("Refusing Electron basic_text secret storage backend");
  }
}

function isKeystoreFile(value: unknown): value is KeystoreFileV1 {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; records?: unknown };
  if (candidate.version !== 1 || typeof candidate.records !== "object" || candidate.records === null) return false;
  return Object.values(candidate.records).every((record) => typeof record === "string");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
