import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const ENCRYPTION_ALGO = "AES-GCM";
const KEY_DERIVATION_ALGO = "PBKDF2";
const PBKDF2_ITERATIONS = 310_000;
const WEB_VAULT_STORAGE_KEY = "silfable_web_wallet_vault_v1";
const VAULT_VERIFIER = "silfable-web-vault-verifier-v1";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(window.atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    KEY_DERIVATION_ALGO,
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_ALGO,
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedPayload {
  cipherText: string;
  salt: string;
  iv: string;
}

export interface StoredWebWallet {
  id: string;
  address: string;
  label: string;
  encryptedSecretKey: EncryptedPayload;
  createdAt: number;
}

export interface StoredWebVault {
  version: 1;
  verifier: EncryptedPayload;
  wallets: StoredWebWallet[];
}

export async function encryptSecretKey(
  secretKey: Uint8Array,
  password: string,
): Promise<EncryptedPayload> {
  if (password.length < 8) throw new Error("Vault password must contain at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    toArrayBuffer(secretKey),
  );

  return {
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  };
}

export async function decryptSecretKey(
  payload: EncryptedPayload,
  password: string,
): Promise<Uint8Array> {
  if (!password) throw new Error("Vault password is required.");
  const key = await deriveKey(password, base64ToBytes(payload.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGO, iv: toArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    toArrayBuffer(base64ToBytes(payload.cipherText)),
  );
  return new Uint8Array(decrypted);
}

export function loadWebVault(): StoredWebVault | null {
  const value = window.localStorage.getItem(WEB_VAULT_STORAGE_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredWebVault;
    return parsed.version === 1 && Array.isArray(parsed.wallets) ? parsed : null;
  } catch {
    return null;
  }
}

function saveWebVault(vault: StoredWebVault): void {
  window.localStorage.setItem(WEB_VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export async function createWebVault(password: string): Promise<StoredWebVault> {
  const verifier = await encryptSecretKey(new TextEncoder().encode(VAULT_VERIFIER), password);
  const vault: StoredWebVault = { version: 1, verifier, wallets: [] };
  saveWebVault(vault);
  return vault;
}

export async function verifyWebVaultPassword(vault: StoredWebVault, password: string): Promise<boolean> {
  try {
    const value = await decryptSecretKey(vault.verifier, password);
    return new TextDecoder().decode(value) === VAULT_VERIFIER;
  } catch {
    return false;
  }
}

function parseSecretKey(input: string): Uint8Array {
  const value = input.trim();
  if (!value) throw new Error("Enter a wallet secret key.");

  try {
    if (value.startsWith("[")) {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed) || parsed.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
        throw new Error("The JSON secret key must be an array of byte values.");
      }
      return Uint8Array.from(parsed);
    }
    return bs58.decode(value);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The JSON")) throw error;
    throw new Error("Secret key must be Base58 or a Solana JSON byte array.");
  }
}

export async function importWalletIntoVault(
  vault: StoredWebVault,
  secretInput: string,
  password: string,
  expectedAddress: string,
): Promise<StoredWebVault> {
  if (!(await verifyWebVaultPassword(vault, password))) throw new Error("Vault password is incorrect.");
  const secretKey = parseSecretKey(secretInput);
  if (secretKey.length !== 64) throw new Error("A Solana secret key must contain exactly 64 bytes.");

  const keypair = Keypair.fromSecretKey(secretKey);
  const address = keypair.publicKey.toBase58();
  keypair.secretKey.fill(0);
  if (address !== expectedAddress) {
    secretKey.fill(0);
    throw new Error("This secret key does not belong to the wallet currently connected in Phantom or Solflare.");
  }
  if (vault.wallets.some((wallet) => wallet.address === address)) {
    secretKey.fill(0);
    throw new Error("This wallet is already stored in the web vault.");
  }
  if (vault.wallets.length >= 1) {
    secretKey.fill(0);
    throw new Error("Web mode supports one wallet only. Remove the current encrypted wallet before importing another.");
  }

  const encryptedSecretKey = await encryptSecretKey(secretKey, password);
  secretKey.fill(0);
  const next: StoredWebVault = {
    ...vault,
    wallets: [
      ...vault.wallets,
      {
        id: crypto.randomUUID(),
        address,
        label: "Primary Mainnet wallet",
        encryptedSecretKey,
        createdAt: Date.now(),
      },
    ],
  };
  saveWebVault(next);
  return next;
}

export function removeWalletFromVault(vault: StoredWebVault, walletId: string): StoredWebVault {
  const next = { ...vault, wallets: vault.wallets.filter((wallet) => wallet.id !== walletId) };
  saveWebVault(next);
  return next;
}
