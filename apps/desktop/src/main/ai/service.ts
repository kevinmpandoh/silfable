// @ts-nocheck
import {
  AiProviderSettingSchema,
  BRIDGE_ROBINHOOD_USDG_ADDRESS,
  BridgeContractSchema,
  EvmBridgeContractSchema,
  type AiProviderSetting,
  type BridgeContract,
  type BridgePreflightEvidence,
  type BridgeProposal,
  type EvmBridgeContract,
  type EvmBridgePreflight,
  type EvmBridgeQuote,
  type EvmSwapProposal,
  type EvmChainKey,
  type SessionIntent,
  type SessionWalletScope,
  type TransactionSettings,
} from "@silfable/contracts";

import type { SecretName } from "../storage/keystore.js";
import type { MainnetReadService } from "../integrations/read-only.js";
import { MissionPolicyService } from "../mission/policy.js";
import { DEFAULT_TRANSACTION_SETTINGS, type TransactionSettingsService } from "../mission/transaction-settings.js";
import { callOpenRouterChat, DEFAULT_OPENROUTER_MODEL, type ReadOnlyAiTool } from "./providers.js";
import type { AutomationManager } from "../execution/automation-manager.js";
import { UNISWAP_NATIVE_TOKEN_ADDRESS } from "../integrations/uniswap.js";

type AiSecretStore = {
  getSecret(name: SecretName): Promise<string | null>;
  setSecret(name: SecretName, plaintext: string): Promise<void>;
  deleteSecret(name: SecretName): Promise<void>;
};

type AiSettingsStore = {
  getSetting(key: string): unknown | null;
  setSetting(key: string, value: unknown): void;
};

type EvmSwapQuoteService = {
  quote(input: {
    walletAddress: string;
    chainKey: EvmChainKey;
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    slippageBps: number;
  }): Promise<EvmSwapProposal>;
};

type BridgePreparationService = {
  prepare(contract: BridgeContract): Promise<{ proposal: BridgeProposal; preflight: BridgePreflightEvidence }>;
};

type EvmBridgePreparationService = {
  prepare(contract: EvmBridgeContract): Promise<{ quote: EvmBridgeQuote; preflight: EvmBridgePreflight }>;
};

const SETTING_KEY = "ai.provider.openrouter";

export type PumpAiScope = {
  kind: "exact-mint" | "watchlist" | "discovery";
  allowedMints: string[];
  discoveryCursor?: string | null;
};

export class AiService {
  readonly #keystore: AiSecretStore;
  readonly #settings: AiSettingsStore;
  readonly #readService: MainnetReadService | null;
  readonly #transactionSettings: Pick<TransactionSettingsService, "get">;
  readonly #evmSwapQuotes: EvmSwapQuoteService | null;
  #bridgePreparation: BridgePreparationService | null;
  #evmBridgePreparation: EvmBridgePreparationService | null;
  #automationManager: AutomationManager | null;

  constructor(input: {
    keystore: AiSecretStore;
    settings: AiSettingsStore;
    readService?: MainnetReadService;
    transactionSettings?: Pick<TransactionSettingsService, "get">;
    evmSwapQuotes?: EvmSwapQuoteService;
    bridgePreparation?: BridgePreparationService;
    evmBridgePreparation?: EvmBridgePreparationService;
    automationManager?: AutomationManager;
  }) {
    this.#keystore = input.keystore;
    this.#settings = input.settings;
    this.#readService = input.readService ?? null;
    this.#transactionSettings = input.transactionSettings ?? { get: () => ({ ...DEFAULT_TRANSACTION_SETTINGS }) };
    this.#evmSwapQuotes = input.evmSwapQuotes ?? null;
    this.#bridgePreparation = input.bridgePreparation ?? null;
    this.#evmBridgePreparation = input.evmBridgePreparation ?? null;
    this.#automationManager = input.automationManager ?? null;
  }

  configureAutomationManager(service: AutomationManager): void {
    if (this.#automationManager !== null) throw new Error("Automation manager is already configured");
    this.#automationManager = service;
  }

  configureBridgePreparation(service: BridgePreparationService): void {
    if (this.#bridgePreparation !== null) throw new Error("Bridge preparation is already configured");
    this.#bridgePreparation = service;
  }

  configureEvmBridgePreparation(service: EvmBridgePreparationService): void {
    if (this.#evmBridgePreparation !== null) throw new Error("EVM Bridge preparation is already configured");
    this.#evmBridgePreparation = service;
  }

  async listSettings(): Promise<AiProviderSetting[]> {
    const configured = (await this.#keystore.getSecret("openrouter-api-key")) !== null;
    return [AiProviderSettingSchema.parse({ provider: "openrouter", configured, model: this.#model() })];
  }

  async saveProvider(apiKey: string, model: string): Promise<AiProviderSetting> {
    const setting = AiProviderSettingSchema.parse({ provider: "openrouter", configured: true, model });
    await this.#keystore.setSecret("openrouter-api-key", apiKey);
    try {
      this.#settings.setSetting(SETTING_KEY, { model: setting.model });
    } catch (error) {
      await this.#keystore.deleteSecret("openrouter-api-key");
      throw error;
    }
    return setting;
  }

  async chat(input: { prompt: string; mode: "agent" | "mission"; walletAddress: string | null; sessionContext?: string; history?: Array<{ role: "user" | "assistant"; text: string }>; pumpScope?: PumpAiScope; intent?: SessionIntent; walletScope?: SessionWalletScope; evmChainKey?: EvmChainKey; transactionSettings?: TransactionSettings }) {
    const apiKey = await this.#keystore.getSecret("openrouter-api-key");
    if (apiKey === null) throw new Error("OpenRouter is not configured");
    const directEvmSwap = parseDirectRobinhoodSwap(input.prompt, input.walletScope, input.evmChainKey);
    if (directEvmSwap !== null && input.mode === "mission" && input.walletAddress !== null && this.#evmSwapQuotes !== null) {
      const settings = input.transactionSettings ?? this.#transactionSettings.get();
      const proposal = await this.#evmSwapQuotes.quote({
        walletAddress: input.walletAddress,
        chainKey: "robinhood",
        sellToken: directEvmSwap.sellToken,
        buyToken: directEvmSwap.buyToken,
        sellAmount: directEvmSwap.sellAmount,
        slippageBps: Math.min(settings.defaultSlippageBps, settings.maxSlippageBps, 100),
      });
      return {
        model: this.#model(),
        text: `Robinhood ${directEvmSwap.sellSymbol} → ${directEvmSwap.buySymbol} quote prepared for review. No transaction was signed or submitted.`,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        toolsUsed: ["robinhood_swap_quote" as const],
        missionPreview: null,
        pumpTokenIntelligence: null,
        pumpDiscoverySnapshot: null,
        pumpTradePreview: null,
        limitOrderPreview: null,
        evmSwapProposal: proposal,
      };
    }
    const { pumpScope, intent, walletScope, ...providerInput } = input;
    return { model: this.#model(), ...(await callOpenRouterChat({ apiKey, model: this.#model(), ...providerInput, tools: await this.#tools(input.walletAddress, input.mode, pumpScope, intent, walletScope, input.transactionSettings ?? this.#transactionSettings.get()) })) };
  }

  async #tools(walletAddress: string | null, mode: "agent" | "mission", pumpScope: PumpAiScope | undefined, intent: SessionIntent | undefined, walletScope: SessionWalletScope | undefined, transactionSettings: TransactionSettings): Promise<ReadOnlyAiTool[]> {
    const tools: ReadOnlyAiTool[] = [];
    if (walletScope === "evm" && mode === "mission" && walletAddress !== null && this.#evmSwapQuotes !== null) {
      tools.push({
        name: "robinhood_swap_quote",
        description: `Create a typed quote-only Robinhood Chain Mainnet EVM swap proposal for the selected encrypted wallet. Known release-pinned aliases are ETH=${UNISWAP_NATIVE_TOKEN_ADDRESS} (18 decimals) and USDG=${BRIDGE_ROBINHOOD_USDG_ADDRESS} (6 decimals); resolve those symbols without asking the user for contracts. Other assets require exact user-supplied contracts. The runtime verifies contracts against the active registry and applies the configured slippage policy. This never signs or broadcasts.`,
        parameters: {
          type: "object",
          properties: {
            sellToken: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
            buyToken: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
            sellAmount: { type: "string", pattern: "^[1-9][0-9]*$" },
            slippageBps: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["sellToken", "buyToken", "sellAmount"],
          additionalProperties: false,
        },
        execute: async (argumentsValue) => {
          const quote = toolEvmSwapQuote(argumentsValue, transactionSettings);
          return this.#evmSwapQuotes!.quote({ walletAddress, chainKey: "robinhood", ...quote });
        },
      });
    }
    if (this.#readService === null) return tools;
    const missionPolicy = new MissionPolicyService(this.#readService, { get: () => transactionSettings });
    // Sessions created before the wallet-first migration have no walletScope.
    // Keep those historical sessions readable, but do not expose legacy Pump
    // trading tools in new Solana wallet sessions.
    const legacyUnscopedSession = walletScope === undefined && intent === undefined;
    const allowsSolanaRead = walletScope === "solana" || legacyUnscopedSession || intent === "research" || intent === "solana-swap" || intent === "legacy-pump-pilot";
    const allowsWalletRead = allowsSolanaRead && walletAddress !== null;
    const allowsJupiter = allowsSolanaRead && await this.#keystore.getSecret("jupiter-api-key") !== null;
    const allowsSwapPreview = allowsSolanaRead && mode === "mission" && pumpScope === undefined && walletAddress !== null && allowsJupiter;
    const allowsLegacyPump = pumpScope !== undefined || intent === "legacy-pump-pilot" || legacyUnscopedSession;
    if (allowsWalletRead) tools.push({
      name: "wallet_portfolio",
      description: "Read the selected registered Solana Mainnet wallet's finalized SOL and SPL-token balances. This never signs or sends a transaction.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => this.#readService!.portfolio(walletAddress),
    });
    if (allowsWalletRead) tools.push({
      name: "wallet_activity",
      description: "Read up to 10 recent finalized transaction signatures for the selected registered Solana Mainnet wallet, including success status, slot, time, memo, and explorer URL. This never signs or sends a transaction.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => this.#readService!.activity(walletAddress, 10),
    });
    if (allowsJupiter) tools.push({
      name: "jupiter_prices",
      description: "Read current USD price evidence for up to 20 Solana token mint addresses from Jupiter Price API V3.",
      parameters: { type: "object", properties: { mints: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 } }, required: ["mints"], additionalProperties: false },
      execute: async (argumentsValue) => {
        const mints = toolMints(argumentsValue);
        return Object.fromEntries(await this.#readService!.prices(mints));
      },
    });
    if (allowsSwapPreview) tools.push({
      name: "mission_contract_preview",
      description: "Create a deterministic, non-executable Mainnet swap mission preview for the selected wallet. Call only when token mints, raw amount, and intent came explicitly from the user. maxSlippageBps and deadlineAt may be omitted to use the user's local Transaction Settings defaults. Convert any user-supplied relative deadline using the exact current UTC timestamp in the system message; deadlineAt must be the resulting absolute ISO-8601 UTC timestamp. The runtime checks wallet registration, token pair, uint64 raw amount, maximum 300 bps guarded slippage, deadline, finalized balance, and a transaction-free Jupiter quote.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", minLength: 1, maxLength: 400 },
          inputMint: { type: "string", minLength: 32, maxLength: 44 },
          outputMint: { type: "string", minLength: 32, maxLength: 44 },
          inputAmount: { type: "string", pattern: "^[1-9][0-9]*$" },
          maxSlippageBps: { type: "integer", minimum: 0, maximum: 10000 },
          deadlineAt: { type: "string", format: "date-time", description: "Absolute ISO-8601 UTC timestamp calculated from the exact current UTC time in the system message when the user supplied a relative deadline." },
          stopConditions: { type: "array", items: { type: "string", minLength: 1, maxLength: 160 }, minItems: 1, maxItems: 8 },
        },
        required: ["goal", "inputMint", "outputMint", "inputAmount", "stopConditions"],
        additionalProperties: false,
      },
      execute: async (argumentsValue) => missionPolicy.preview({ walletAddress, ...toolMissionDraft(argumentsValue, transactionSettings) }),
    });
    if (allowsLegacyPump && mode === "mission" && (pumpScope === undefined || pumpScope.kind === "exact-mint") && walletAddress !== null && allowsJupiter) tools.push({
      name: "pump_trade_contract_preview",
      description: "Create a deterministic proposal-only Pump.fun/PumpSwap Mainnet buy or sell contract for one exact mint. Requires every explicit field from the user. The runtime verifies the registered wallet, official active Pump curve or canonical PumpSwap pool, mint/freeze authorities, top-ten concentration, finalized reserves, balance, maximum SOL exposure, guarded slippage, deadline, and a transaction-free route quote. This never builds, signs, or broadcasts.",
      parameters: { type: "object", properties: {
        goal: { type: "string", minLength: 1, maxLength: 400 }, side: { type: "string", enum: ["buy", "sell"] }, tokenMint: { type: "string", minLength: 32, maxLength: 44 },
        inputAmount: { type: "string", pattern: "^[1-9][0-9]*$" }, maxSolExposureLamports: { type: "string", pattern: "^[0-9]+$" }, minimumOutputAmount: { type: "string", pattern: "^[1-9][0-9]*$" },
        maxSlippageBps: { type: "integer", minimum: 0, maximum: 300 }, deadlineAt: { type: "string", format: "date-time" },
        stopConditions: { type: "array", items: { type: "string", minLength: 1, maxLength: 160 }, minItems: 1, maxItems: 8 },
      }, required: ["goal", "side", "tokenMint", "inputAmount", "maxSolExposureLamports", "minimumOutputAmount", "maxSlippageBps", "deadlineAt", "stopConditions"], additionalProperties: false },
      execute: async (argumentsValue) => {
        const draft = toolPumpTradeDraft(argumentsValue, transactionSettings);
        if (pumpScope?.kind === "exact-mint" && !pumpScope.allowedMints.includes(draft.tokenMint)) {
          throw new Error("Pump trade mint is outside this exact-mint session scope");
        }
        return missionPolicy.pumpTradePreview({ walletAddress, ...draft });
      },
    });
    if (allowsLegacyPump && mode === "mission" && pumpScope === undefined && walletAddress !== null && allowsJupiter) tools.push({
      name: "limit_order_contract_preview",
      description: "Create a deterministic, non-executable Jupiter Trigger V2 single limit-order preview for the selected Solana Mainnet wallet. Call only when the user explicitly supplied both mints, raw input amount, trigger mint, above/below condition, and USD trigger price. maxSlippageBps and expiresAt may be omitted to use the user's local Transaction Settings defaults. The runtime verifies the registered wallet, finalized balance, guarded 300 bps slippage, expiry, pair, and Jupiter's current $10 minimum. This tool never authenticates a Jupiter vault, deposits, signs, or creates an order.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", minLength: 1, maxLength: 400 }, inputMint: { type: "string", minLength: 32, maxLength: 44 }, outputMint: { type: "string", minLength: 32, maxLength: 44 },
          inputAmount: { type: "string", pattern: "^[1-9][0-9]*$" }, triggerMint: { type: "string", minLength: 32, maxLength: 44 }, triggerCondition: { type: "string", enum: ["above", "below"] },
          triggerPriceUsd: { type: "number", exclusiveMinimum: 0 }, maxSlippageBps: { type: "integer", minimum: 0, maximum: 10000 }, expiresAt: { type: "string", format: "date-time" },
        },
        required: ["goal", "inputMint", "outputMint", "inputAmount", "triggerMint", "triggerCondition", "triggerPriceUsd"], additionalProperties: false,
      },
      execute: async (argumentsValue) => missionPolicy.limitOrderPreview({ walletAddress, ...toolLimitOrderDraft(argumentsValue, transactionSettings) }),
    });
    if (allowsJupiter) tools.push({
      name: "jupiter_token_search",
      description: "Search Jupiter Tokens V2 by Solana mint, symbol, or name. Returns bounded token metadata, verification status, organic score, price, market cap, holder count, and tags as read-only evidence. Verification is not a guarantee of safety.",
      parameters: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 100 } }, required: ["query"], additionalProperties: false },
      execute: async (argumentsValue) => this.#readService!.tokenSearch(toolTokenQuery(argumentsValue)),
    });
    if (allowsLegacyPump && (pumpScope === undefined || pumpScope.allowedMints.length > 0)) tools.push({
      name: "pump_token_analysis",
      description: "Verify read-only Pump.fun and canonical PumpSwap evidence for one exact Solana mint using finalized RPC, official program ownership, deterministic PDAs, mint authorities, largest-account concentration, and a size-specific reserve-only buy/sell-back path. referenceBuyLamports is a SOL analysis amount, not authorization. This tool cannot buy, sell, sign, or broadcast.",
      parameters: {
        type: "object",
        properties: {
          mint: { type: "string", minLength: 32, maxLength: 44 },
          referenceBuyLamports: { type: "string", pattern: "^[1-9][0-9]*$" },
        },
        required: ["mint"],
        additionalProperties: false,
      },
      execute: async (argumentsValue) => {
        const analysis = toolPumpAnalysis(argumentsValue);
        if (pumpScope !== undefined && !pumpScope.allowedMints.includes(analysis.mint)) {
          throw new Error("Pump token mint is outside this session scope");
        }
        return this.#readService!.pumpTokenAnalysis(analysis.mint, analysis.referenceBuyLamports);
      },
    });
    if (allowsLegacyPump && pumpScope?.kind === "discovery") tools.push({
      name: "pump_recent_candidates",
      description: "Run one bounded manual scan of recent finalized transactions touching the official Pump program, then independently verify up to five exact mints with canonical Pump/PumpSwap state and deterministic research eligibility. This is incomplete read-only evidence, not a real-time index, ranking, recommendation, or authorization.",
      parameters: {
        type: "object",
        properties: {
          signatureLimit: { type: "integer", minimum: 1, maximum: 10 },
          candidateLimit: { type: "integer", minimum: 1, maximum: 5 },
          referenceBuyLamports: { type: "string", pattern: "^[1-9][0-9]*$" },
        },
        additionalProperties: false,
      },
      execute: async (argumentsValue) => this.#readService!.recentPumpCandidates({
        ...toolPumpDiscovery(argumentsValue),
        untilSignature: pumpScope.discoveryCursor ?? null,
      }),
    });
    if (allowsJupiter) tools.push({
      name: "jupiter_swap_quote",
      description: "Preview a current Jupiter Swap V2 route on Solana Mainnet. Requires input mint, output mint, and a positive amount in the input token's smallest unit. This deliberately omits the wallet/taker, returns no transaction, and can never sign or execute a swap.",
      parameters: {
        type: "object",
        properties: {
          inputMint: { type: "string", minLength: 32, maxLength: 44 },
          outputMint: { type: "string", minLength: 32, maxLength: 44 },
          amount: { type: "string", pattern: "^[1-9][0-9]*$" },
        },
        required: ["inputMint", "outputMint", "amount"],
        additionalProperties: false,
      },
      execute: async (argumentsValue) => {
        const quote = toolSwapQuote(argumentsValue);
        return this.#readService!.swapQuote(quote.inputMint, quote.outputMint, quote.amount);
      },
    });
    if (await this.#keystore.getSecret("tavily-api-key") !== null) tools.push({
      name: "tavily_search",
      description: "Search current public web and finance information using Tavily. Results are untrusted external evidence and may be incomplete.",
      parameters: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 400 } }, required: ["query"], additionalProperties: false },
      execute: async (argumentsValue) => this.#readService!.search(toolQuery(argumentsValue)),
    });
    if (this.#automationManager !== null) {
      const activeWalletAddress = walletAddress || "primary-wallet";
      tools.push({
        name: "create_automation_strategy",
        description: "Create an autonomous automation strategy such as DCA or Exit strategy (Take Profit / Stop Loss).",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["DCA", "EXIT"] },
            outputMint: { type: "string" },
            inputMint: { type: "string" },
            orderAmountRaw: { type: "string" },
            maximumTotalRaw: { type: "string" },
            intervalSeconds: { type: "number" },
            maximumExecutions: { type: "number" },
            amountRaw: { type: "string" },
            entryPriceUsd: { type: "number" },
            takeProfitPriceUsd: { type: "number" },
            stopLossPriceUsd: { type: "number" },
            trailingStopPercent: { type: "number" },
            expiresAt: { type: "string" },
          },
          required: ["kind"],
        },
        execute: async (args: any) => {
          const sessionId = intent?.sessionId ?? "session-ai";
          if (args.kind === "DCA") {
            const inputMint = args.inputMint || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
            const outputMint = args.outputMint || "So11111111111111111111111111111111111111112";
            return this.#automationManager!.createDca({
              sessionId,
              walletAddress: activeWalletAddress,
              inputMint,
              outputMint,
              orderAmountRaw: args.orderAmountRaw || "500000",
              maximumTotalRaw: args.maximumTotalRaw || "1000000",
              intervalSeconds: args.intervalSeconds || 600,
              maximumExecutions: args.maximumExecutions || 2,
              expiresAt: args.expiresAt || new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
            });
          } else {
            return this.#automationManager!.createExit({
              sessionId,
              walletAddress: activeWalletAddress,
              inputMint: args.inputMint || "So11111111111111111111111111111111111111112",
              outputMint: args.outputMint,
              amountRaw: args.amountRaw || "1000000",
              entryPriceUsd: args.entryPriceUsd || 100,
              takeProfitPriceUsd: args.takeProfitPriceUsd || null,
              stopLossPriceUsd: args.stopLossPriceUsd || null,
              trailingStopPercent: args.trailingStopPercent || null,
              expiresAt: args.expiresAt || new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
            });
          }
        },
      });
      tools.push({
        name: "cancel_automation_strategy",
        description: "Cancel an active automation strategy by strategy ID.",
        parameters: {
          type: "object",
          properties: {
            strategyId: { type: "string" },
          },
          required: ["strategyId"],
        },
        execute: async (args: any) => {
          return this.#automationManager!.setStatus(args.strategyId, "CANCEL");
        },
      });
    }
    return tools;
  }

  #model(): string {
    const value = this.#settings.getSetting(SETTING_KEY);
    if (typeof value !== "object" || value === null) return DEFAULT_OPENROUTER_MODEL;
    const model = (value as { model?: unknown }).model;
    return typeof model === "string" && model.length > 0 && model.length <= 192 ? model : DEFAULT_OPENROUTER_MODEL;
  }
}

function toolEvmSwapQuote(value: unknown, settings: TransactionSettings): { sellToken: string; buyToken: string; sellAmount: string; slippageBps: number } {
  if (typeof value !== "object" || value === null) throw new Error("EVM swap fields are required");
  const input = value as Record<string, unknown>;
  const slippageBps = input.slippageBps === undefined
    ? Math.min(settings.defaultSlippageBps, 100)
    : input.slippageBps;
  if (typeof input.sellToken !== "string" || !/^0x[0-9a-fA-F]{40}$/u.test(input.sellToken)
    || typeof input.buyToken !== "string" || !/^0x[0-9a-fA-F]{40}$/u.test(input.buyToken)
    || input.sellToken.toLowerCase() === input.buyToken.toLowerCase()
    || typeof input.sellAmount !== "string" || !/^[1-9]\d*$/u.test(input.sellAmount) || input.sellAmount.length > 78
    || typeof slippageBps !== "number" || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > Math.min(settings.maxSlippageBps, 100)) {
    throw new Error("EVM swap fields are invalid or exceed the configured slippage policy");
  }
  return { sellToken: input.sellToken, buyToken: input.buyToken, sellAmount: input.sellAmount, slippageBps };
}

type RobinhoodTokenSymbol = "ETH" | "USDG";

function parseDirectRobinhoodSwap(
  prompt: string,
  walletScope: SessionWalletScope | undefined,
  chainKey: EvmChainKey | undefined,
): { sellToken: string; buyToken: string; sellAmount: string; sellSymbol: RobinhoodTokenSymbol; buySymbol: RobinhoodTokenSymbol } | null {
  if (walletScope !== "evm" || (chainKey ?? "robinhood") !== "robinhood") return null;
  const match = /\b(?:swap|tukar)\s+([0-9]+(?:[.,][0-9]+)?)\s+(eth|usdg)\s+(?:ke|to)\s+(eth|usdg)\b/iu.exec(prompt);
  if (match === null) return null;
  const sellSymbol = match[2]!.toUpperCase() as RobinhoodTokenSymbol;
  const buySymbol = match[3]!.toUpperCase() as RobinhoodTokenSymbol;
  if (sellSymbol === buySymbol) return null;
  const decimals = sellSymbol === "ETH" ? 18 : 6;
  const sellAmount = decimalToRawAmount(match[1]!.replace(",", "."), decimals);
  if (sellAmount === null) return null;
  return {
    sellToken: sellSymbol === "ETH" ? UNISWAP_NATIVE_TOKEN_ADDRESS : BRIDGE_ROBINHOOD_USDG_ADDRESS,
    buyToken: buySymbol === "ETH" ? UNISWAP_NATIVE_TOKEN_ADDRESS : BRIDGE_ROBINHOOD_USDG_ADDRESS,
    sellAmount,
    sellSymbol,
    buySymbol,
  };
}

function decimalToRawAmount(value: string, decimals: number): string | null {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) return null;
  const raw = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/u, "");
  return /^[1-9]\d*$/u.test(raw) ? raw : null;
}

function toolLimitOrderDraft(value: unknown, settings = DEFAULT_TRANSACTION_SETTINGS): { goal: string; inputMint: string; outputMint: string; inputAmount: string; triggerMint: string; triggerCondition: "above" | "below"; triggerPriceUsd: number; maxSlippageBps: number; expiresAt: string } {
  if (typeof value !== "object" || value === null) throw new Error("Limit order fields are required");
  const input = value as Record<string, unknown>;
  const maxSlippageBps = input.maxSlippageBps === undefined ? settings.defaultSlippageBps : input.maxSlippageBps;
  const expiresAt = input.expiresAt === undefined ? new Date(Date.now() + Math.max(settings.defaultDeadlineMinutes, 15) * 60_000).toISOString() : input.expiresAt;
  if (typeof input.goal !== "string" || input.goal.trim().length < 1 || input.goal.length > 400
    || typeof input.inputMint !== "string" || input.inputMint.length < 32 || input.inputMint.length > 44
    || typeof input.outputMint !== "string" || input.outputMint.length < 32 || input.outputMint.length > 44
    || typeof input.inputAmount !== "string" || !/^[1-9]\d*$/u.test(input.inputAmount) || input.inputAmount.length > 20
    || typeof input.triggerMint !== "string" || input.triggerMint.length < 32 || input.triggerMint.length > 44
    || (input.triggerCondition !== "above" && input.triggerCondition !== "below")
    || typeof input.triggerPriceUsd !== "number" || !Number.isFinite(input.triggerPriceUsd) || input.triggerPriceUsd <= 0
    || typeof maxSlippageBps !== "number" || !Number.isInteger(maxSlippageBps) || maxSlippageBps < 0 || maxSlippageBps > settings.maxSlippageBps
    || typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) throw new Error("Limit order fields are invalid or exceed the configured maximum slippage");
  return { goal: input.goal.trim(), inputMint: input.inputMint, outputMint: input.outputMint, inputAmount: input.inputAmount, triggerMint: input.triggerMint, triggerCondition: input.triggerCondition, triggerPriceUsd: input.triggerPriceUsd, maxSlippageBps, expiresAt };
}

function toolMints(value: unknown): string[] {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { mints?: unknown }).mints)) throw new Error("Token mints are required");
  const mints = (value as { mints: unknown[] }).mints;
  if (mints.length < 1 || mints.length > 20 || mints.some((mint) => typeof mint !== "string" || mint.length < 32 || mint.length > 44)) throw new Error("Token mints are invalid");
  return mints as string[];
}

function toolQuery(value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("Search query is required");
  const query = (value as { query?: unknown }).query;
  if (typeof query !== "string" || query.trim().length < 1 || query.length > 400) throw new Error("Search query is invalid");
  return query.trim();
}

function toolTokenQuery(value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("Token search query is required");
  const query = (value as { query?: unknown }).query;
  if (typeof query !== "string" || query.trim().length < 1 || query.length > 100) throw new Error("Token search query is invalid");
  return query.trim();
}

function toolPumpAnalysis(value: unknown): { mint: string; referenceBuyLamports: string } {
  if (typeof value !== "object" || value === null) throw new Error("Pump token mint is required");
  const { mint, referenceBuyLamports } = value as { mint?: unknown; referenceBuyLamports?: unknown };
  if (typeof mint !== "string" || mint.length < 32 || mint.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/u.test(mint)) {
    throw new Error("Pump token mint is invalid");
  }
  const normalizedReference = referenceBuyLamports === undefined ? "1000000" : referenceBuyLamports;
  if (typeof normalizedReference !== "string" || !/^[1-9]\d*$/u.test(normalizedReference)) {
    throw new Error("Pump reference buy amount must be a positive lamport value");
  }
  return { mint, referenceBuyLamports: normalizedReference };
}

function toolPumpDiscovery(value: unknown): { signatureLimit?: number; candidateLimit?: number; referenceBuyLamports?: string } {
  if (typeof value !== "object" || value === null) throw new Error("Pump scanner parameters are invalid");
  const input = value as { signatureLimit?: unknown; candidateLimit?: unknown; referenceBuyLamports?: unknown };
  if (input.signatureLimit !== undefined && (typeof input.signatureLimit !== "number" || !Number.isInteger(input.signatureLimit) || input.signatureLimit < 1 || input.signatureLimit > 10)) {
    throw new Error("Pump scanner signature limit must be between 1 and 10");
  }
  if (input.candidateLimit !== undefined && (typeof input.candidateLimit !== "number" || !Number.isInteger(input.candidateLimit) || input.candidateLimit < 1 || input.candidateLimit > 5)) {
    throw new Error("Pump scanner candidate limit must be between 1 and 5");
  }
  if (input.referenceBuyLamports !== undefined && (typeof input.referenceBuyLamports !== "string" || !/^[1-9]\d*$/u.test(input.referenceBuyLamports))) {
    throw new Error("Pump scanner reference buy amount is invalid");
  }
  return {
    ...(input.signatureLimit === undefined ? {} : { signatureLimit: input.signatureLimit }),
    ...(input.candidateLimit === undefined ? {} : { candidateLimit: input.candidateLimit }),
    ...(input.referenceBuyLamports === undefined ? {} : { referenceBuyLamports: input.referenceBuyLamports }),
  };
}

function toolPumpTradeDraft(value: unknown, settings = DEFAULT_TRANSACTION_SETTINGS): { goal: string; side: "buy" | "sell"; tokenMint: string; inputAmount: string; maxSolExposureLamports: string; minimumOutputAmount: string; maxSlippageBps: number; deadlineAt: string; stopConditions: string[] } {
  if (typeof value !== "object" || value === null) throw new Error("Pump trade proposal fields are required");
  const input = value as Record<string, unknown>;
  const stopConditions = input.stopConditions;
  if (typeof input.goal !== "string" || input.goal.trim().length < 1 || input.goal.length > 400
    || (input.side !== "buy" && input.side !== "sell")
    || typeof input.tokenMint !== "string" || input.tokenMint.length < 32 || input.tokenMint.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/u.test(input.tokenMint)
    || typeof input.inputAmount !== "string" || !/^[1-9]\d*$/u.test(input.inputAmount) || input.inputAmount.length > 20
    || typeof input.maxSolExposureLamports !== "string" || !/^\d+$/u.test(input.maxSolExposureLamports) || input.maxSolExposureLamports.length > 20
    || typeof input.minimumOutputAmount !== "string" || !/^[1-9]\d*$/u.test(input.minimumOutputAmount) || input.minimumOutputAmount.length > 20
    || typeof input.maxSlippageBps !== "number" || !Number.isInteger(input.maxSlippageBps) || input.maxSlippageBps < 0 || input.maxSlippageBps > settings.maxSlippageBps
    || typeof input.deadlineAt !== "string" || !Number.isFinite(Date.parse(input.deadlineAt))
    || !Array.isArray(stopConditions) || stopConditions.length < 1 || stopConditions.length > 8 || stopConditions.some((condition) => typeof condition !== "string" || condition.trim().length < 1 || condition.length > 160)) {
    throw new Error("Pump trade proposal fields are invalid or exceed the configured maximum slippage");
  }
  return { goal: input.goal.trim(), side: input.side, tokenMint: input.tokenMint, inputAmount: input.inputAmount, maxSolExposureLamports: input.maxSolExposureLamports, minimumOutputAmount: input.minimumOutputAmount, maxSlippageBps: input.maxSlippageBps, deadlineAt: input.deadlineAt, stopConditions: stopConditions as string[] };
}

function toolSwapQuote(value: unknown): { inputMint: string; outputMint: string; amount: string } {
  if (typeof value !== "object" || value === null) throw new Error("Swap quote parameters are required");
  const input = value as { inputMint?: unknown; outputMint?: unknown; amount?: unknown };
  if (typeof input.inputMint !== "string" || input.inputMint.length < 32 || input.inputMint.length > 44
    || typeof input.outputMint !== "string" || input.outputMint.length < 32 || input.outputMint.length > 44
    || typeof input.amount !== "string" || !/^[1-9]\d*$/u.test(input.amount) || input.amount.length > 20) {
    throw new Error("Swap quote parameters are invalid");
  }
  return { inputMint: input.inputMint, outputMint: input.outputMint, amount: input.amount };
}

function toolMissionDraft(value: unknown, settings = DEFAULT_TRANSACTION_SETTINGS): { goal: string; inputMint: string; outputMint: string; inputAmount: string; maxSlippageBps: number; deadlineAt: string; stopConditions: string[] } {
  if (typeof value !== "object" || value === null) throw new Error("Mission contract fields are required");
  const input = value as Record<string, unknown>;
  const stopConditions = input.stopConditions;
  const maxSlippageBps = input.maxSlippageBps === undefined ? settings.defaultSlippageBps : input.maxSlippageBps;
  const deadlineAt = input.deadlineAt === undefined ? new Date(Date.now() + settings.defaultDeadlineMinutes * 60_000).toISOString() : input.deadlineAt;
  if (typeof input.goal !== "string" || input.goal.trim().length < 1 || input.goal.length > 400
    || typeof input.inputMint !== "string" || input.inputMint.length < 32 || input.inputMint.length > 44
    || typeof input.outputMint !== "string" || input.outputMint.length < 32 || input.outputMint.length > 44
    || typeof input.inputAmount !== "string" || !/^[1-9]\d*$/u.test(input.inputAmount) || input.inputAmount.length > 20
    || typeof maxSlippageBps !== "number" || !Number.isInteger(maxSlippageBps) || maxSlippageBps < 0 || maxSlippageBps > settings.maxSlippageBps
    || typeof deadlineAt !== "string" || !Number.isFinite(Date.parse(deadlineAt))
    || !Array.isArray(stopConditions) || stopConditions.length < 1 || stopConditions.length > 8
    || stopConditions.some((condition) => typeof condition !== "string" || condition.trim().length < 1 || condition.length > 160)) {
    throw new Error("Mission contract fields are invalid or exceed the configured maximum slippage");
  }
  return { goal: input.goal.trim(), inputMint: input.inputMint, outputMint: input.outputMint, inputAmount: input.inputAmount, maxSlippageBps, deadlineAt, stopConditions: stopConditions as string[] };
}
