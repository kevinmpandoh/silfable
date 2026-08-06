const fs = require('fs');

// 1. Export in components/index.ts
let index = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/index.ts', 'utf-8');
const exportsToAdd = [
  'export * from "./bridge/EvmBridge";',
  'export * from "./trading/PumpCards";',
  'export * from "./modals/ApprovalModals";',
  'export * from "./workspace/Conversation";'
];
let added = false;
for (const ex of exportsToAdd) {
  if (!index.includes(ex)) {
    index += ex + '\n';
    added = true;
  }
}
if (added) {
  fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/components/index.ts', index);
}

// 2. Import in WorkspaceApp.tsx
let workspace = fs.readFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/WorkspaceApp.tsx', 'utf-8');
const importsToAdd = [
  'EvmBridgeWorkspace', 'BridgeProposalCard',
  'PumpTradePreviewCard', 'PumpExecutionCard',
  'SimulationApprovalModal', 'EvmBridgeExecutionApprovalModal', 'ExecutionApprovalModal', 'PumpExecutionApprovalModal', 'SessionModal',
  'Conversation'
];

// we just add them after SetupFlow
for (const imp of importsToAdd) {
  if (!workspace.includes(imp + ',')) {
    workspace = workspace.replace('SetupFlow\n}', 'SetupFlow,\n  ' + imp + '\n}');
  }
}
fs.writeFileSync('d:/Web3/silfable-web/apps/desktop/src/renderer/src/WorkspaceApp.tsx', workspace);
console.log('Exports and imports updated.');
