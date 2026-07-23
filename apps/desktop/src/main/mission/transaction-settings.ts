import { TransactionSettingsSchema, type TransactionSettings } from "@silfable/contracts";

import type { RuntimeDatabase } from "../storage/database.js";

const SETTINGS_KEY = "mainnet-transaction-settings-v1";

export const DEFAULT_TRANSACTION_SETTINGS: TransactionSettings = Object.freeze({
  maxNetworkFeeLamports: 200_000,
  maxFeePercent: 5,
  defaultSlippageBps: 50,
  defaultDeadlineMinutes: 30,
  priority: "standard",
});

export class TransactionSettingsService {
  readonly #database: RuntimeDatabase;

  constructor(database: RuntimeDatabase) {
    this.#database = database;
  }

  get(): TransactionSettings {
    const stored = this.#database.getSetting(SETTINGS_KEY);
    const parsed = TransactionSettingsSchema.safeParse(stored);
    return parsed.success ? parsed.data : { ...DEFAULT_TRANSACTION_SETTINGS };
  }

  save(input: TransactionSettings): TransactionSettings {
    const settings = TransactionSettingsSchema.parse(input);
    this.#database.setSetting(SETTINGS_KEY, settings);
    return settings;
  }
}
