export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "lead"; text: string }
  | { type: "list"; items: string[] }
  | { type: "cards"; items: { title: string; text: string }[] }
  | { type: "steps"; items: string[] }
  | { type: "flow"; items: string[] }
  | { type: "note"; title: string; items: string[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | {
      type: "table";
      head: string[];
      rows: string[][];
    }
  | { type: "heading"; text: string };

export type DocSection = {
  id: string;
  index: string;
  kicker: string;
  title: string;
  blocks: DocBlock[];
};

export const docSections: DocSection[] = [
  {
    id: "abstract",
    index: "01",
    kicker: "Abstract",
    title: "",
    blocks: [
      {
        type: "lead",
        text: "Your machine. Your capital. Your rules. Your agent.\nMirae is a local-first autonomous trading infrastructure that turns artificial intelligence from a passive assistant into a controlled on-chain execution layer, separating reasoning, authorization, signing, and settlement into independent boundaries.",
      },
      {
        type: "list",
        items: [
          "The AI can think, analyze, and discover.",
          "The AI can generate structured intent proposals.",
          "The user's policy engine and local vault decide what is actually allowed to happen.",
          "Settlement occurs directly on-chain across spot, perps, token launches, and real-world assets without intermediate custody.",
        ],
      },
      {
        type: "paragraph",
        text: "The next generation of financial interfaces will not require users to manually monitor charts, calculate routes, manage gas budgets, and click every transaction. Operators will increasingly delegate these workflows to autonomous software agents. However, giving an AI unrestricted custody creates a catastrophic single point of failure. Mirae solves this through deterministic policy separation.",
      },
      {
        type: "note",
        title: "Core Principle",
        items: [
          "AI determines what it wants to propose.",
          "The local runtime determines what is permitted to execute.",
          "This separation enables full autonomy within mathematical boundaries without requiring custodial surrender.",
        ],
      },
    ],
  },
  {
    id: "problem",
    index: "02",
    kicker: "The Problem",
    title: "Intelligence is no longer the bottleneck.",
    blocks: [
      {
        type: "paragraph",
        text: "Modern AI models can digest enormous streams of financial data: price action, order flow, liquidity depths, wallet forensics, volatility, sentiment, and protocol states.",
      },
      { type: "lead", text: "The bottleneck is no longer intelligence. The bottleneck is trusted, non-custodial execution." },
      { type: "heading", text: "Advisory AI" },
      { type: "paragraph", text: "The AI provides text output, but the human remains the manual, slow operator clicking every wallet approval." },
      { type: "heading", text: "Unrestricted Autonomous Custody" },
      {
        type: "paragraph",
        text: "Cloud bots take full possession of private keys, creating severe security vulnerabilities and regulatory centralization.",
      },
      { type: "heading", text: "Controlled Local Autonomy" },
      {
        type: "flow",
        items: [
          "Market Signal",
          "AI Reasoning",
          "Structured Intent",
          "Deterministic Policy Check",
          "Local Keystore Signing",
          "On-Chain Execution",
          "Reconciled Audit Record",
        ],
      },
      { type: "paragraph", text: "The intelligence layer and the signing authority layer remain strictly isolated." },
    ],
  },
  {
    id: "runtime",
    index: "03",
    kicker: "The Mirae Runtime",
    title: "A local-first execution environment.",
    blocks: [
      {
        type: "paragraph",
        text: "The Mirae Runtime is a high-performance, native desktop application (available for Linux and Windows, with macOS in development) and progressive web environment. It operates directly on the user's device, ensuring that private keys, policy configurations, session states, and SQLite databases remain encrypted under local AES-256-GCM encryption.",
      },
      {
        type: "paragraph",
        text: "Unlike cloud-hosted bot services, Mirae eliminates external custody. The local runtime communicates directly with RPC endpoints and protocol program interfaces to simulate, inspect, and broadcast transactions.",
      },
    ],
  },
  {
    id: "agent-engine",
    index: "04",
    kicker: "Agent Engine",
    title: "Objectives instead of individual clicks.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae agents operate around high-level objectives rather than micro-commands. Users describe intent using natural language (English or Indonesian) or configure structured mission parameters.",
      },
      {
        type: "note",
        title: "Example Objective",
        items: [
          "Supply 500 USDC to Kamino Obligate RWA to earn institutional yield.",
          "DCA 25 USDC into SOL every 4 hours with 10% take-profit and 5% stop-loss.",
          "Screen trending tokens on Pump.fun and execute a protected creator launch.",
          "Buy x402 premium market intelligence before opening an isolated perp position.",
        ],
      },
      { type: "heading", text: "The Autonomous Agent Lifecycle" },
      {
        type: "steps",
        items: [
          "Observe markets & protocol state",
          "Acquire verified data (including x402 paid feeds)",
          "Formulate trading hypothesis",
          "Simulate transaction via RPC preflight",
          "Validate against deterministic policy boundaries",
          "Execute on-chain via local vault",
          "Monitor position lifecycle & reconcile state",
        ],
      },
      { type: "heading", text: "Session Autonomy Modes" },
      { type: "heading", text: "Restricted Mode (Manual Gate)" },
      {
        type: "flow",
        items: ["AI Proposal", "Simulation Preview", "Master Password Gate", "Local Sign", "Broadcast"],
      },
      {
        type: "paragraph",
        text: "Every individual proposal requires explicit user review and master password entry. Ideal for high-stakes positions and manual spot actions.",
      },
      { type: "heading", text: "Full Access Mode (Autonomous Execution)" },
      {
        type: "flow",
        items: ["AI Proposal", "Simulation Preflight", "Policy Engine Verification", "Auto-Sign Local Vault", "Broadcast"],
      },
      {
        type: "paragraph",
        text: "Enables seamless, 1-click or prompt-to-chain automated execution. Grants are bounded by a 24-hour lifetime, hard spending limits, slippage caps, and emergency kill switches.",
      },
    ],
  },
  {
    id: "policy-engine",
    index: "05",
    kicker: "Policy and Risk",
    title: "The mathematical boundary between reasoning and capital.",
    blocks: [
      {
        type: "paragraph",
        text: "The Policy Engine enforces deterministic rules that cannot be bypassed by language model hallucinations or adversarial prompt injections. If an action violates policy constraints, the runtime fails closed.",
      },
      {
        type: "table",
        head: ["Validation Check", "Runtime Behavior", "Security Guarantee"],
        rows: [
          ["Within policy bounds", "Execute", "Simulated & signed locally"],
          ["Exceeds max slippage / spend", "Block", "Transaction rejected instantly"],
          ["Unlisted program ID / unknown contract", "Block", "Privilege escalation denied"],
          ["Emergency stop active", "Halt", "All execution gates frozen"],
        ],
      },
      { type: "heading", text: "Multi-Dimensional Risk Engine" },
      {
        type: "cards",
        items: [
          {
            title: "Position Limits",
            text: "Caps maximum notional size per order and per asset.",
          },
          {
            title: "Drawdown Controls",
            text: "Halts agent activity automatically upon reaching loss limits.",
          },
          {
            title: "Price Impact & Slippage",
            text: "Rejects trades where simulated slippage exceeds strict thresholds.",
          },
          {
            title: "Program Allowlisting",
            text: "Pins verifiable program addresses for Jupiter, Kamino, Drift, and Pump.fun.",
          },
          {
            title: "Session Expiry",
            text: "Restricts autonomous execution grants to short, time-bounded windows.",
          },
          {
            title: "Emergency Kill Switch",
            text: "Instant global termination of all active grants and pending transactions.",
          },
        ],
      },
    ],
  },
  {
    id: "intent-execution",
    index: "06",
    kicker: "Execution & Venues",
    title: "Multi-venue execution across spot, perps, RWA, and cross-chain.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae provides a modular execution router connecting leading decentralized protocols into a single conversational workspace.",
      },
      { type: "heading", text: "Supported Protocol Matrix" },
      {
        type: "table",
        head: ["Domain", "Integrated Protocols", "Capabilities"],
        rows: [
          ["RWA Lending", "Kamino Finance / Obligate ($oTFY)", "Institutional corporate bonds, 1-click supply, yield tracking, instant withdrawal"],
          ["Spot & DCA", "Jupiter Exchange", "Multi-route swaps, DCA scheduling, Limit Orders with TP/SL"],
          ["Token Launch", "Pump.fun Protocol", "Token intelligence, simulation, creator buy protections, create_v2 launch"],
          ["Perpetuals", "Drift Protocol & Hyperliquid", "Directional long/short orders, isolated margin, leverage controls"],
          ["Paid Intelligence", "x402 Protocol", "On-chain USDC micro-payments for premium data before execution"],
          ["Cross-Chain Bridge", "Relay Bridge & EVM", "Multi-chain routes between Solana, Robinhood Chain, Base, Arbitrum, Ethereum, etc."],
        ],
      },
      { type: "heading", text: "Institutional Real-World Asset (RWA) Lending" },
      {
        type: "paragraph",
        text: "Mirae natively integrates Kamino RWA pools, enabling users to earn real yield from tokenized corporate debt and commercial paper (such as Obligate's oTFY). The workspace calculates real-time accrued yields, manages position lifecycles, and enables 1-click liquidity withdrawals.",
      },
      { type: "heading", text: "x402 Agent Micro-Payments" },
      {
        type: "paragraph",
        text: "Mirae pioneers the x402 standard on Solana mainnet: AI agents can independently discover premium off-chain data sources, pay per request via micro-amounts of USDC directly on-chain, digest the intelligence, and trigger immediate trades in a single continuous flow.",
      },
    ],
  },
  {
    id: "local-custody",
    index: "07",
    kicker: "Local-First Custody",
    title: "Automation without custody.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae's desktop application is built with zero cloud custody. Private keys, mnemonics, execution logs, and session grants are encrypted locally using AES-256-GCM with a user-derived master password.",
      },
      {
        type: "note",
        title: "Zero Custodial Footprint",
        items: [
          "Mirae servers never hold or transmit user private keys.",
          "Transactions are constructed, simulated, and signed on your own hardware.",
          "Keystore resets, backups, and key imports remain completely in the user's control.",
        ],
      },
    ],
  },
  {
    id: "memory",
    index: "08",
    kicker: "Memory and Intelligence",
    title: "Context that survives the session.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae provides structured memory across operational contexts to enhance agent reasoning over time.",
      },
      {
        type: "cards",
        items: [
          { title: "Session Memory", text: "Live conversational context, draft states, and pending proposals." },
          {
            title: "Position Memory",
            text: "Persistent records of open spot, perp, and RWA positions with entry APY and yield calculations.",
          },
          {
            title: "Audit Log Memory",
            text: "Append-only structured records of all executed, blocked, and failed transactions.",
          },
        ],
      },
    ],
  },
  {
    id: "action-history",
    index: "09",
    kicker: "Auditable Action History",
    title: "Autonomy with complete accountability.",
    blocks: [
      {
        type: "paragraph",
        text: "Every autonomous intent produces a verifiable receipt containing transaction hashes, simulation preflight digests, block heights, and network fee metrics.",
      },
      {
        type: "paragraph",
        text: "Blocked actions and policy violations are logged with explicit rationale, ensuring the operator can inspect why an agent was prevented from taking a specific action.",
      },
    ],
  },
  {
    id: "revenue-model",
    index: "10",
    kicker: "Economics",
    title: "Fifty for building, fifty for burning.",
    blocks: [
      { type: "heading", text: "Protocol Revenue: Mirae Agent Fee" },
      {
        type: "paragraph",
        text: "The Mirae desktop runtime introduces a transparent agent fee on eligible on-chain execution actions. This fee serves as the sole protocol revenue source.",
      },
      { type: "heading", text: "Revenue Allocation Flywheel" },
      {
        type: "stats",
        items: [
          { value: "50%", label: "Development & Research" },
          { value: "50%", label: "Market Buyback & Burn" },
        ],
      },
      {
        type: "flow",
        items: [
          "On-Chain Execution",
          "Agent Fee Inflow",
          "50% Development",
          "50% Open Market Buyback",
          "Permanent $MIRAE Burn",
          "Deflationary Supply Reduction",
        ],
      },
      {
        type: "paragraph",
        text: "This architecture links real economic utility directly to token supply reduction, replacing inflationary emissions with genuine product cashflow.",
      },
    ],
  },
  {
    id: "mirae-token",
    index: "11",
    kicker: "$MIRAE Token",
    title: "Ninety seven percent to the community.",
    blocks: [
      {
        type: "paragraph",
        text: "$MIRAE is the native utility and governance token powering the Mirae ecosystem.",
      },
      { type: "heading", text: "Tokenomics & Fair Distribution" },
      {
        type: "stats",
        items: [
          { value: "100%", label: "Total Supply" },
          { value: "97%", label: "Community Fair Launch" },
          { value: "3%", label: "Public Development Wallet" },
        ],
      },
      {
        type: "table",
        head: ["Allocation", "Percentage", "Vesting / Terms"],
        rows: [
          ["Community Fair Launch", "97%", "100% unlocked via Pump.fun bonding curve"],
          ["Development Wallet", "3%", "Publicly identifiable, reserved for ongoing development"],
          ["VC / Private Sale", "0%", "No private rounds or insider allocations"],
          ["Presale / Advisors", "0%", "No early discounts or team dumping"],
        ],
      },
    ],
  },
  {
    id: "security-model",
    index: "12",
    kicker: "Security",
    title: "Minimize authority, not intelligence.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae's core security tenet is minimizing attack surfaces. Compromising the AI intelligence layer must never compromise vault custody.",
      },
      { type: "heading", text: "Deterministic Emergency Controls" },
      {
        type: "table",
        head: ["Emergency Stop State", "Runtime Impact"],
        rows: [
          ["Active Full Access Grants", "Immediately Revoked"],
          ["Pending Proposals", "Blocked"],
          ["Local Signing Engine", "Disabled"],
          ["Active Missions", "Paused"],
        ],
      },
    ],
  },
  {
    id: "roadmap",
    index: "13",
    kicker: "Roadmap",
    title: "Seven phases toward the autonomous agent economy.",
    blocks: [
      { type: "heading", text: "Phase 01 — Foundation [COMPLETED]" },
      {
        type: "list",
        items: [
          "Mirae core identity and chat interface",
          "Solana RPC integration & basic swap engine",
          "Deterministic intent formatting",
          "Web prototype validation",
        ],
      },
      { type: "heading", text: "Phase 02 — Agent Runtime & Policy Engine [COMPLETED]" },
      {
        type: "list",
        items: [
          "Structured intent parser & multi-lingual dispatchers (EN / ID)",
          "Restricted mode (master-password gated)",
          "Full Access mode (24h bounded session grants, capability ceilings)",
          "Multi-dimensional risk engine & emergency stop system",
          "Mission mode for recurring trading objectives",
        ],
      },
      { type: "heading", text: "Phase 03 — Local-First Desktop Architecture [COMPLETED]" },
      {
        type: "list",
        items: [
          "Native desktop application runtime",
          "Local encrypted vault (AES-256-GCM) for private keys and session records",
          "Zero-custody signing layer",
          "Encrypted local SQLite audit database",
        ],
      },
      { type: "heading", text: "Phase 04 — Desktop Distribution [LIVE & ACTIVE]" },
      {
        type: "list",
        items: [
          "Linux x64 and ARM64 AppImage and Debian packages released",
          "Windows portable desktop QA release live",
          "Auto-update version verification portal",
          "Performance tuning and UI refinement",
        ],
      },
      { type: "heading", text: "Phase 05 — Multi-Market & Protocol Expansion [SHIPPED & EXPANDING]" },
      {
        type: "list",
        items: [
          "Institutional RWA Lending (Kamino Finance & Obligate oTFY) — Live",
          "Perpetual Futures Engine (Drift Protocol & Hyperliquid) — Live",
          "x402 Decentralized Pay-per-request Intelligence — Live",
          "Multi-Chain & EVM Bridge (Robinhood Chain, Relay Bridge across 8 chains) — Live",
          "Jupiter Limit Orders & DCA Scheduling with TP/SL — Live",
          "Pump.fun zero-lookup token launch & creator buy protection — Live",
        ],
      },
      { type: "heading", text: "Phase 06 — Agent Network & Strategy Ecosystem [IN DEVELOPMENT]" },
      {
        type: "list",
        items: [
          "Verifiable on-chain agent performance records",
          "Strategy discovery and community agent templates",
          "Public agent reputation registries",
          "Multi-agent collaborative execution",
        ],
      },
      { type: "heading", text: "Phase 07 — The Mirae Economy [UPCOMING]" },
      {
        type: "list",
        items: [
          "Automated protocol revenue accounting",
          "Public, verifiable Buyback & Burn dashboard",
          "Periodic market purchases of $MIRAE funded by agent fees",
          "Permanent token burn verification on-chain",
        ],
      },
    ],
  },
  {
    id: "principles",
    index: "14",
    kicker: "Principles",
    title: "What Mirae optimizes for.",
    blocks: [
      {
        type: "cards",
        items: [
          { title: "Local over Custodial", text: "Keep signing keys and authority on the operator's machine." },
          {
            title: "Policy over Prompt",
            text: "Prompts express desire; mathematical policies enforce permissions.",
          },
          { title: "Verification over Trust", text: "Every action must produce auditable on-chain proof." },
          {
            title: "Autonomy with Limits",
            text: "Automation must never mean boundless custody or uncontrolled risk.",
          },
          {
            title: "Real Yield over Inflation",
            text: "Sustainable economics through actual protocol usage and institutional assets.",
          },
          {
            title: "Zero AI Slop",
            text: "Clean, high-performance interfaces built for serious operators.",
          },
        ],
      },
    ],
  },
];
