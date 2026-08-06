const fs = require('fs');

const commonImports = '// @ts-nocheck\n' +
'import React, { useState, useEffect, useRef, useCallback, useMemo } from \'react\';\n' +
'import { Activity, ArrowUp, Bot, Brain, CirclePlus, Settings, ShieldCheck, Target, ShieldAlert, Sparkles, Zap, KeyRound, KeySquare, ChevronRight, MessageSquare, History, List, X, Flame } from \'lucide-react\';\n' +
'import { Button, Modal, Input, Badge } from \'../../ui\';\n' +
'import { shorten, cn } from \'../../../lib/utils\';\n' +
'import { formatEvmTokenAmount, formatWeiToGweiOrEth, formatRuntimeTokens, formatPortfolioUsd, portfolioAssetUsd, formatPortfolioAmount, formatPumpMetric, formatPumpPercent, formatPumpBps, formatPumpRawAmount } from \'../../../lib/formatters\';\n' +
'import { StatusPill, Notice, Field, SetupCard, SetupActions, Brand, BrandMark, CornerFooter, RailSection, ProviderCard } from \'../setup/SetupHelpers\';\n' +
'import { ACTIVITY_LEVELS, INTEGRATION_CATEGORIES, SETUP_STEPS, STORAGE_KEY } from \'../types\';\n' +
'import type { BridgePreflightEvidence, BridgeProposal, BridgeReceipt, BridgeDestinationChain, EmergencyStopStatus, EvmBridgeContract, EvmBridgePreflight, EvmBridgeQuote, EvmBridgeReceipt, EvmChainKey, EvmPortfolioSnapshot, EvmSessionExecutionReceipt, EvmSwapPreflightEvidence, EvmSwapProposal, LimitOrderCancelSimulation, LimitOrderContractPreview, LimitOrderExecutionReceipt, LimitOrderSimulationPreview, LegacyPumpLaunchMetadataPackage, MissionContractPreview, MissionExecutionReceipt, MissionSimulationPreview, OpenRouterModelView, PortfolioSnapshot, PumpExecutionRecord, PumpFinalRevalidation, PumpLaunchDraft, PumpLaunchDraftInput, PumpLaunchMetadata, PumpLaunchPreflight, PumpLaunchFinalRevalidation, PumpLaunchExecutionRecord, PumpRiskSettings, PumpSimulationArtifact, PumpTokenIntelligence, PumpTradeContractPreview, RuntimeStatus, SessionRecord, TransactionSettings, WalletActivitySnapshot, SetupState, AgentSettings } from \'@silfable/contracts\';\n' +
'import { BRIDGE_ARBITRUM_CHAIN_ID, BRIDGE_ARBITRUM_USDC_ADDRESS, BRIDGE_AVALANCHE_CHAIN_ID, BRIDGE_AVALANCHE_USDC_ADDRESS, BRIDGE_BASE_CHAIN_ID, BRIDGE_BASE_USDC_ADDRESS, BRIDGE_ETHEREUM_CHAIN_ID, BRIDGE_ETHEREUM_USDC_ADDRESS, BRIDGE_OPTIMISM_CHAIN_ID, BRIDGE_OPTIMISM_USDC_ADDRESS, BRIDGE_POLYGON_CHAIN_ID, BRIDGE_POLYGON_USDC_ADDRESS, BRIDGE_ROBINHOOD_CHAIN_ID, BRIDGE_ROBINHOOD_USDG_ADDRESS, BRIDGE_SOLANA_CHAIN_ID, BRIDGE_SOLANA_USDC_MINT } from \'@silfable/contracts\';\n\n';

const files = [
  'd:/Web3/silfable-web/apps/desktop/src/renderer/src/components/workspace/WorkspacePanels.tsx',
  'd:/Web3/silfable-web/apps/desktop/src/renderer/src/components/trading/ActivityCards.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  fs.writeFileSync(file, commonImports + content);
}

// For formatters
const formatterImports = '// @ts-nocheck\n' +
'import { formatUnits } from \'viem\';\n\n';
let fmtContent = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/lib/formatters.ts', 'utf-8');
fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/lib/formatters.ts', formatterImports + fmtContent);

// Add to index.ts
let index = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/index.ts', 'utf-8');
if (!index.includes('./workspace/WorkspacePanels')) {
  index += 'export * from "./workspace/WorkspacePanels";\n';
  index += 'export * from "./trading/ActivityCards";\n';
  fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/index.ts', index);
}

// WorkspaceApp imports
let workspace = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/WorkspaceApp.tsx', 'utf-8');
const workspaceImportsToAdd = [
  'RightRail', 'PortfolioAssetRow', 'MissionsView', 'UtilityView', 'Composer', 'EmergencyStopPanel',
  'EvmSwapProposalCard', 'LimitOrderPreviewCard', 'PumpSimulationCard', 'PumpLaunchDraftCard', 'MissionPreviewCard', 'SimulationResult', 'ExecutionResult', 'PumpLaunchDraftForm',
  'LimitOrderSimulationApprovalModal', 'LimitOrderCancelSimulationModal', 'LimitOrderFinalModal', 'EvmExecutionApprovalModal', 'BridgeExecutionApprovalModal'
];
for (const imp of workspaceImportsToAdd) {
  if (!workspace.includes(imp + ',')) {
    workspace = workspace.replace('SetupFlow,\n', 'SetupFlow,\n  ' + imp + ',\n');
  }
}
// Add formatter imports
const formatterImportLine = "import { formatEvmTokenAmount, formatWeiToGweiOrEth, formatRuntimeTokens, formatPortfolioUsd, portfolioAssetUsd, formatPortfolioAmount, formatPumpMetric, formatPumpPercent, formatPumpBps, formatPumpRawAmount } from './lib/formatters';\n";
if (!workspace.includes('formatEvmTokenAmount')) {
  workspace = workspace.replace('import React', formatterImportLine + 'import React');
}

fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/WorkspaceApp.tsx', workspace);

console.log('Final imports added.');
