import { randomUUID } from "node:crypto";

import {
  CrashReportViewSchema,
  TelemetrySettingsSchema,
  type CrashProcessType,
  type CrashReason,
  type CrashReportView,
  type TelemetrySettings,
} from "@silfable/contracts";

import { RuntimeDatabase } from "../storage/database.js";
import { LocalDataCipher } from "../storage/encryption.js";

const CONSENT_SETTING = "telemetry.crash-consent.v1";

export class LocalCrashTelemetryService {
  readonly #database: RuntimeDatabase;
  readonly #cipher: LocalDataCipher;
  readonly #appVersion: string;

  constructor(input: { database: RuntimeDatabase; cipher: LocalDataCipher; appVersion: string }) {
    this.#database = input.database;
    this.#cipher = input.cipher;
    this.#appVersion = input.appVersion;
  }

  getSettings(): TelemetrySettings {
    return TelemetrySettingsSchema.parse({
      schemaVersion: 1,
      consent: this.#hasConsent(),
      reportCount: this.#database.countCrashReports(),
      endpointConfigured: false,
      networkTransmissionEnabled: false,
    });
  }

  setConsent(consent: boolean): TelemetrySettings {
    this.#database.setCrashTelemetryConsent(CONSENT_SETTING, consent);
    return this.getSettings();
  }

  deleteReports(): TelemetrySettings {
    this.#database.deleteCrashReports();
    return this.getSettings();
  }

  async capture(input: { processType: CrashProcessType; reason: CrashReason; exitCode: number }): Promise<boolean> {
    try {
      if (!this.#hasConsent() || input.reason === "unknown" && input.exitCode === 0) return false;
      const createdAt = new Date().toISOString();
      const report = CrashReportViewSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        processType: input.processType,
        reason: input.reason,
        errorCode: `exit:${Math.trunc(input.exitCode)}`,
        appVersion: this.#appVersion,
        platform: normalizePlatform(process.platform),
        createdAt,
        transmitted: false,
      });
      const encrypted = await this.#cipher.encryptString(JSON.stringify(report));
      this.#database.insertCrashReport({
        id: report.id,
        encryptedPayload: encrypted.ciphertext,
        payloadNonce: encrypted.nonce,
        keyId: encrypted.keyId,
        transmitted: false,
        createdAt,
      });
      return true;
    } catch {
      // Crash observation must never weaken runtime availability or fall back to plaintext.
      return false;
    }
  }

  async listReports(): Promise<CrashReportView[]> {
    if (!this.#hasConsent()) return [];
    return Promise.all(
      this.#database.listCrashReports(20).map(async (record) =>
        CrashReportViewSchema.parse(
          JSON.parse(
            await this.#cipher.decryptString({
              ciphertext: record.encryptedPayload,
              nonce: record.payloadNonce,
              keyId: requireSupportedKey(record.keyId),
            }),
          ) as unknown,
        ),
      ),
    );
  }

  #hasConsent(): boolean {
    const value = this.#database.getSetting(CONSENT_SETTING);
    return typeof value === "object" && value !== null && (value as Record<string, unknown>).consent === true;
  }
}

function requireSupportedKey(value: string): "local-data-key-v1" {
  if (value !== "local-data-key-v1") throw new Error("Crash report key is unsupported");
  return value;
}

export function normalizeCrashReason(value: string): CrashReason {
  return [
    "abnormal-exit",
    "killed",
    "crashed",
    "oom",
    "launch-failed",
    "integrity-failure",
    "memory-eviction",
  ].includes(value)
    ? value as CrashReason
    : "unknown";
}

export function normalizeChildProcessType(value: string): CrashProcessType {
  if (value === "GPU") return "gpu";
  if (value === "Utility") return "utility";
  return "other-child";
}

function normalizePlatform(value: string): CrashReportView["platform"] {
  return value === "linux" || value === "darwin" || value === "win32" ? value : "other";
}
