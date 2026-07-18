import {
  AiDcaIntentV1Schema,
  AiProviderSchema,
  AiProviderSettingSchema,
  AiShadowTradeProposalV1Schema,
  AgentIntentProposalV1Schema,
  type AiDcaIntentV1,
  type AiProvider,
  type AiProviderSetting,
  type AiShadowTradeProposalV1,
  type AgentIntentProposalV1,
  type AgentSessionView,
  type JupiterShadowQuoteView,
  type MarketObservationView,
} from "@silfable/contracts";

import type { SecretName } from "../storage/keystore.js";
import {
  callAiProvider,
  callAiShadowTradeProvider,
  callAgentIntentProvider,
  DEFAULT_AI_MODELS,
  type AiProviderTransport,
  type AiShadowTradeProviderTransport,
  type AgentIntentProviderTransport,
} from "./providers.js";

type AiSecretStore = {
  getSecret(name: SecretName): Promise<string | null>;
  setSecret(name: SecretName, plaintext: string): Promise<void>;
  deleteSecret(name: SecretName): Promise<void>;
};

type AiSettingsStore = {
  getSetting(key: string): unknown | null;
  setSetting(key: string, value: unknown): void;
  deleteSetting(key: string): void;
};

export class AiDraftService {
  readonly #keystore: AiSecretStore;
  readonly #settings: AiSettingsStore;
  readonly #transport: AiProviderTransport;
  readonly #tradeTransport: AiShadowTradeProviderTransport;
  readonly #agentTransport: AgentIntentProviderTransport;

  constructor(input: {
    keystore: AiSecretStore;
    settings: AiSettingsStore;
    transport?: AiProviderTransport;
    tradeTransport?: AiShadowTradeProviderTransport;
    agentTransport?: AgentIntentProviderTransport;
  }) {
    this.#keystore = input.keystore;
    this.#settings = input.settings;
    this.#transport = input.transport ?? callAiProvider;
    this.#tradeTransport = input.tradeTransport ?? callAiShadowTradeProvider;
    this.#agentTransport = input.agentTransport ?? callAgentIntentProvider;
  }

  async listSettings(): Promise<AiProviderSetting[]> {
    return Promise.all((["openai", "anthropic"] as const).map((provider) => this.#setting(provider)));
  }

  async saveProvider(providerInput: AiProvider, apiKey: string, model: string): Promise<AiProviderSetting> {
    const provider = AiProviderSchema.parse(providerInput);
    const setting = AiProviderSettingSchema.parse({ provider, configured: true, model });
    await this.#keystore.setSecret(secretName(provider), apiKey);
    try {
      this.#settings.setSetting(settingKey(provider), { model: setting.model });
    } catch (error) {
      await this.#keystore.deleteSecret(secretName(provider));
      throw error;
    }
    return setting;
  }

  async deleteProvider(providerInput: AiProvider): Promise<AiProviderSetting> {
    const provider = AiProviderSchema.parse(providerInput);
    await this.#keystore.deleteSecret(secretName(provider));
    this.#settings.deleteSetting(settingKey(provider));
    return AiProviderSettingSchema.parse({ provider, configured: false, model: DEFAULT_AI_MODELS[provider] });
  }

  async draftDca(providerInput: AiProvider, prompt: string): Promise<{ model: string; intent: AiDcaIntentV1 }> {
    const provider = AiProviderSchema.parse(providerInput);
    const key = await this.#keystore.getSecret(secretName(provider));
    if (key === null) throw new Error(`${provider} is not configured`);
    const model = readModel(this.#settings.getSetting(settingKey(provider))) ?? DEFAULT_AI_MODELS[provider];
    const intent = AiDcaIntentV1Schema.parse(
      await this.#transport({ provider, apiKey: key, model, prompt }),
    );
    return { model, intent };
  }

  async proposeShadowTrade(
    providerInput: AiProvider,
    objective: string,
    quote: JupiterShadowQuoteView,
  ): Promise<{ model: string; proposal: AiShadowTradeProposalV1 }> {
    const provider = AiProviderSchema.parse(providerInput);
    const key = await this.#keystore.getSecret(secretName(provider));
    if (key === null) throw new Error(`${provider} is not configured`);
    const model = readModel(this.#settings.getSetting(settingKey(provider))) ?? DEFAULT_AI_MODELS[provider];
    const proposal = AiShadowTradeProposalV1Schema.parse(
      await this.#tradeTransport({ provider, apiKey: key, model, objective, quote }),
    );
    return { model, proposal };
  }

  async proposeAgentIntent(input: {
    provider: AiProvider;
    session: AgentSessionView;
    observation: MarketObservationView;
    quote: JupiterShadowQuoteView;
  }): Promise<{ model: string; proposal: AgentIntentProposalV1 }> {
    const provider = AiProviderSchema.parse(input.provider);
    const key = await this.#keystore.getSecret(secretName(provider));
    if (key === null) throw new Error(`${provider} is not configured`);
    const model = readModel(this.#settings.getSetting(settingKey(provider))) ?? DEFAULT_AI_MODELS[provider];
    const proposal = AgentIntentProposalV1Schema.parse(await this.#agentTransport({
      provider,
      apiKey: key,
      model,
      session: input.session,
      observation: input.observation,
      quote: input.quote,
    }));
    return { model, proposal };
  }

  async #setting(provider: AiProvider): Promise<AiProviderSetting> {
    const configured = (await this.#keystore.getSecret(secretName(provider))) !== null;
    return AiProviderSettingSchema.parse({
      provider,
      configured,
      model: readModel(this.#settings.getSetting(settingKey(provider))) ?? DEFAULT_AI_MODELS[provider],
    });
  }
}

function secretName(provider: AiProvider): SecretName {
  return provider === "openai" ? "openai-api-key" : "anthropic-api-key";
}

function settingKey(provider: AiProvider): string {
  return `ai.provider.${provider}`;
}

function readModel(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const model = (value as { model?: unknown }).model;
  return typeof model === "string" && model.length > 0 && model.length <= 128 ? model : null;
}
