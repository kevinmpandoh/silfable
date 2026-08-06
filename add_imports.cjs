const fs = require('fs');

const commonImports = '// @ts-nocheck\n' +
'import React, { useState, useEffect, useRef, useCallback, useMemo } from \'react\';\n' +
'import { Activity, ArrowUp, Bot, Brain, CirclePlus, Settings, ShieldCheck, Target } from \'lucide-react\';\n' +
'import { Button, Modal } from \'../../ui\';\n' +
'import { shorten, cn } from \'../../../lib/utils\';\n' +
'import { StatusPill, Notice, Field, SetupCard, SetupActions, Brand, BrandMark, CornerFooter, RailSection, ProviderCard } from \'../setup/SetupHelpers\';\n' +
'import { ACTIVITY_LEVELS, INTEGRATION_CATEGORIES, SETUP_STEPS, STORAGE_KEY } from \'../types\';\n' +
'import type { BridgePreflightEvidence, BridgeProposal, BridgeReceipt, BridgeDestinationChain, EmergencyStopStatus, EvmBridgeContract, EvmBridgePreflight, EvmBridgeQuote, EvmBridgeReceipt, EvmChainKey, EvmPortfolioSnapshot, EvmSessionExecutionReceipt, EvmSwapPreflightEvidence, EvmSwapProposal, LimitOrderCancelSimulation, LimitOrderContractPreview, LimitOrderExecutionReceipt, LimitOrderSimulationPreview, LegacyPumpLaunchMetadataPackage, MissionContractPreview, MissionExecutionReceipt, MissionSimulationPreview, OpenRouterModelView, PortfolioSnapshot, PumpExecutionRecord, PumpFinalRevalidation, PumpLaunchDraft, PumpLaunchDraftInput, PumpLaunchMetadata, PumpLaunchPreflight, PumpLaunchFinalRevalidation, PumpLaunchExecutionRecord, PumpRiskSettings, PumpSimulationArtifact, PumpTokenIntelligence, PumpTradeContractPreview, RuntimeStatus, SessionRecord, TransactionSettings, WalletActivitySnapshot } from \'@silfable/contracts\';\n' +
'import { BRIDGE_ARBITRUM_CHAIN_ID, BRIDGE_ARBITRUM_USDC_ADDRESS, BRIDGE_AVALANCHE_CHAIN_ID, BRIDGE_AVALANCHE_USDC_ADDRESS, BRIDGE_BASE_CHAIN_ID, BRIDGE_BASE_USDC_ADDRESS, BRIDGE_ETHEREUM_CHAIN_ID, BRIDGE_ETHEREUM_USDC_ADDRESS, BRIDGE_OPTIMISM_CHAIN_ID, BRIDGE_OPTIMISM_USDC_ADDRESS, BRIDGE_POLYGON_CHAIN_ID, BRIDGE_POLYGON_USDC_ADDRESS, BRIDGE_ROBINHOOD_CHAIN_ID, BRIDGE_ROBINHOOD_USDG_ADDRESS, BRIDGE_SOLANA_CHAIN_ID, BRIDGE_SOLANA_USDC_MINT } from \'@silfable/contracts\';\n\n';

const files = [
  'd:/Web3/silfable-web/apps/desktop/src/renderer/src/components/bridge/EvmBridge.tsx',
  'd:/Web3/silfable-web/apps/desktop/src/renderer/src/components/trading/PumpCards.tsx',
  'd:/Web3/silfable-web/apps/desktop/src/renderer/src/components/modals/ApprovalModals.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  fs.writeFileSync(file, commonImports + content);
}

// Conversation is one level up
const workspaceImports = commonImports
  .replace(/..\/..\/ui/g, '../ui')
  .replace(/..\/..\/..\/lib/g, '../../lib');

let convContent = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/workspace/Conversation.tsx', 'utf-8');
fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/workspace/Conversation.tsx', workspaceImports + convContent);

console.log('Imports added.');
