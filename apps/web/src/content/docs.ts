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
        text: "Your machine. Your capital. Your rules. Your agent.\nMirae is a local-first autonomous trading infrastructure that turns artificial intelligence from a market assistant into a controlled execution layer, separating reasoning, authorization, signing and execution into independent layers.",
      },
      {
        type: "list",
        items: [
          "The AI can think.",
          "The AI can discover.",
          "The AI can propose.",
          "The Mirae Runtime decides what is actually allowed to happen.",
        ],
      },
      {
        type: "paragraph",
        text: "The next generation of financial interfaces will not require users to manually monitor charts, compare markets, calculate positions and execute every transaction themselves. Users will increasingly delegate these processes to autonomous software agents. However, giving an AI unrestricted access to a wallet creates a fundamental security problem. Mirae approaches this differently.",
      },
      {
        type: "note",
        title: "Core principle",
        items: [
          "AI determines what it wants to do.",
          "The runtime determines what it is allowed to do.",
          "This separation allows autonomous trading without requiring unrestricted autonomous custody.",
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
        text: "AI can already analyze enormous amounts of financial information, including price movements, liquidity, market structure, wallet activity, volatility, technical indicators, narratives, historical performance, portfolio exposure and risk conditions.",
      },
      { type: "lead", text: "The bottleneck is no longer intelligence. The bottleneck is trusted execution." },
      { type: "heading", text: "Advisory AI" },
      { type: "paragraph", text: "The AI provides information, but the human still performs the transaction." },
      { type: "heading", text: "Unrestricted autonomous AI" },
      {
        type: "paragraph",
        text: "This provides automation but creates dangerous authority concentration.",
      },
      { type: "heading", text: "Controlled autonomy" },
      {
        type: "flow",
        items: [
          "Market",
          "AI Reasoning",
          "Intent",
          "Deterministic Policy",
          "Local Signing",
          "Execution",
          "Verifiable Record",
        ],
      },
      { type: "paragraph", text: "The intelligence layer and the authority layer remain separate." },
    ],
  },
  {
    id: "runtime",
    index: "03",
    kicker: "The Mirae Runtime",
    title: "A financial agent environment, on the web and beyond.",
    blocks: [
      {
        type: "paragraph",
        text: "The Mirae Runtime is the execution environment responsible for translating agent decisions into controlled financial actions. Mirae runs in the browser today, with a long-term path toward native desktop apps that keep more of the execution stack on your own device.",
      },
      {
        type: "paragraph",
        text: "The native desktop architecture is intended to minimize the amount of sensitive execution infrastructure that must be delegated to a centralized service, while the web experience is available now.",
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
        text: "Mirae agents operate around objectives rather than individual clicks. Instead of instructing the system to buy a specific token, a user could eventually define an objective.",
      },
      {
        type: "note",
        title: "Example objective",
        items: [
          "Allocate $1,000 across high-liquidity Solana assets over the next seven days.",
          "Maximum position size $200.",
          "Maximum portfolio loss 10%.",
          "Avoid tokens below $1M liquidity.",
          "Stop trading if daily loss exceeds $100.",
        ],
      },
      { type: "heading", text: "The agent converts the objective into smaller tasks" },
      {
        type: "steps",
        items: [
          "Observe markets",
          "Collect data",
          "Identify opportunities",
          "Evaluate risk",
          "Generate intent",
          "Execute when permitted",
          "Monitor position",
          "Re-evaluate",
        ],
      },
      {
        type: "paragraph",
        text: "Agents may remain dormant when conditions are not satisfied rather than continuously generating unnecessary actions.",
      },
      { type: "heading", text: "Mission Mode" },
      { type: "paragraph", text: "A Mission represents a persistent trading objective." },
      {
        type: "paragraph",
        text: "A mission continuously evaluates its environment until a termination condition occurs.",
      },
      {
        type: "cards",
        items: [
          { title: "Goal reached", text: "The defined objective has been achieved." },
          { title: "Maximum loss reached", text: "Risk limits prevent further trading." },
          { title: "Deadline reached", text: "The mission duration has expired." },
          {
            title: "Capital constraint",
            text: "Available capital falls below operational requirements.",
          },
          { title: "No valid opportunity", text: "No market action satisfies the policy." },
          { title: "Emergency stop", text: "The user manually terminates the mission." },
        ],
      },
      { type: "heading", text: "Autonomy Modes" },
      { type: "heading", text: "Restricted mode" },
      {
        type: "flow",
        items: ["AI", "Intent", "Policy Check", "User Confirmation", "Execution"],
      },
      {
        type: "paragraph",
        text: "Transactions require user authorization. This is intended for users who want AI-assisted execution while retaining transaction-level control.",
      },
      { type: "heading", text: "Autonomous mode" },
      {
        type: "flow",
        items: ["AI", "Intent", "Policy Check", "Automatic Authorization", "Execution"],
      },
      {
        type: "paragraph",
        text: "No manual confirmation is required for actions already covered by the user's policy. Autonomous Mode does not mean unlimited authority. The agent remains constrained by the policy engine.",
      },
    ],
  },
  {
    id: "policy-engine",
    index: "05",
    kicker: "Policy and Risk",
    title: "The boundary between reasoning and capital.",
    blocks: [
      {
        type: "paragraph",
        text: "The Policy Engine is the boundary between AI reasoning and capital. Possible policy parameters include:",
      },
      {
        type: "paragraph",
        text: "The agent cannot override these constraints simply because its reasoning model believes an opportunity is attractive. The system should therefore fail closed.",
      },
      {
        type: "table",
        head: ["Validation result", "Runtime behavior"],
        rows: [
          ["Valid", "Execute"],
          ["Invalid", "Block"],
          ["Unknown", "Block"],
        ],
      },
      { type: "heading", text: "Risk Engine" },
      {
        type: "paragraph",
        text: "Before execution, every intent can be evaluated against multiple risk dimensions.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Position risk",
            text: "Determines whether the proposed position exceeds configured limits.",
          },
          {
            title: "Portfolio risk",
            text: "Measures aggregate exposure rather than evaluating trades independently.",
          },
          {
            title: "Drawdown risk",
            text: "Prevents the agent from continuously trading after predefined losses.",
          },
          { title: "Liquidity risk", text: "Can reject markets with insufficient liquidity." },
          {
            title: "Slippage risk",
            text: "Prevents execution when expected price impact exceeds tolerance.",
          },
          {
            title: "Contract risk",
            text: "Allows the runtime to restrict interactions to approved programs and contracts.",
          },
          {
            title: "Behavioral risk",
            text: "The runtime may identify abnormal execution patterns such as excessive trade frequency or repeated losing actions.",
          },
        ],
      },
    ],
  },
  {
    id: "intent-execution",
    index: "06",
    kicker: "Execution",
    title: "Agents produce intents, never signatures.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae agents should never directly manipulate private keys. Instead, they produce structured intents.",
      },
      {
        type: "paragraph",
        text: "The runtime independently validates the intent. Only after validation can the signing layer authorize execution. This creates a fundamental security boundary.",
      },
      { type: "paragraph", text: "The AI produces intentions. The runtime controls authority." },
      { type: "heading", text: "Execution Router" },
      {
        type: "paragraph",
        text: "Mirae is intended to become protocol-agnostic. Rather than coupling the agent to a single exchange, an execution router can determine where an approved action should be performed.",
      },
      {
        type: "paragraph",
        text: "The architecture enables future expansion without requiring the reasoning layer to be rebuilt for every venue.",
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
        text: "Mirae runs in the browser today and is designed toward a local-first desktop architecture over time. Sensitive execution material should remain on the user's device whenever technically possible.",
      },
      {
        type: "note",
        title: "The objective is simple",
        items: ["Mirae should not need custody of user funds to automate user capital."],
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
        text: "An autonomous agent becomes more useful when it can preserve relevant context. Mirae's planned memory architecture can be separated into three layers.",
      },
      {
        type: "cards",
        items: [
          { title: "Session memory", text: "Temporary information about the current operation." },
          {
            title: "Strategy memory",
            text: "Patterns and observations relevant to the user's strategy.",
          },
          {
            title: "Historical memory",
            text: "Longer-term records of previous decisions and outcomes.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Memory is intended to improve contextual decision-making. It does not guarantee profitable future performance.",
      },
      { type: "heading", text: "Market Intelligence" },
      { type: "paragraph", text: "Mirae agents may combine multiple information streams." },
      {
        type: "list",
        items: [
          "Price data, volume and volatility",
          "Liquidity and order-flow signals",
          "Wallet activity and technical indicators",
          "Funding rates and open interest",
          "Market sentiment",
          "Portfolio history and previous agent outcomes",
        ],
      },
      {
        type: "paragraph",
        text: "These signals become context for the reasoning engine. The final action must still satisfy deterministic execution policies.",
      },
    ],
  },
  {
    id: "action-history",
    index: "09",
    kicker: "Auditable Action History",
    title: "Autonomy with accountability.",
    blocks: [
      {
        type: "paragraph",
        text: "Autonomy without accountability creates a black box. Mirae therefore aims to maintain a complete execution history.",
      },
      { type: "paragraph", text: "Blocked actions should also remain visible." },
      {
        type: "paragraph",
        text: "Users should be able to understand not only what an agent executed, but also what it attempted and why actions were rejected.",
      },
    ],
  },
  {
    id: "revenue-model",
    index: "10",
    kicker: "Economics",
    title: "Fifty for building, fifty for burning.",
    blocks: [
      { type: "heading", text: "Primary revenue: Mirae agent fee" },
      {
        type: "paragraph",
        text: "Once the desktop runtime is operational, Mirae intends to introduce an agent fee on eligible actions executed through the Mirae runtime. The agent fee is the sole protocol revenue source.",
      },
      {
        type: "paragraph",
        text: "The exact agent fee rate may vary by product, market or execution venue and should be disclosed to users before activation.",
      },
      { type: "heading", text: "Revenue Flywheel" },
      {
        type: "paragraph",
        text: "Net agent fee revenue designated under the token economic program is intended to follow a simple allocation: 50% for buyback and burn, 50% for development.",
      },
      {
        type: "stats",
        items: [
          { value: "50%", label: "Development" },
          { value: "50%", label: "Buyback and burn" },
        ],
      },
      { type: "heading", text: "50% development" },
      {
        type: "list",
        items: [
          "Native desktop runtime for Linux, Windows, and macOS",
          "AI infrastructure and research",
          "Security and execution infrastructure",
          "Data infrastructure and protocol integrations",
          "Maintenance and product expansion",
        ],
      },
      { type: "heading", text: "50% buyback and burn" },
      {
        type: "paragraph",
        text: "The other half is intended to periodically acquire $MIRAE from the open market. Tokens acquired through the program are then permanently removed from circulation through burning.",
      },
      {
        type: "flow",
        items: [
          "Real product usage",
          "Transaction activity",
          "Agent fee revenue",
          "Market buyback",
          "$MIRAE acquired",
          "Burn",
          "Permanently removed",
        ],
      },
      {
        type: "paragraph",
        text: "This creates a potential relationship between product activity and token supply reduction. Buybacks should only occur from actual designated revenue and are not guaranteed to occur at any particular frequency, volume or market price.",
      },
      { type: "heading", text: "Economic Loop" },
      {
        type: "cards",
        items: [
          { title: "Users", text: "Receive autonomous trading infrastructure." },
          {
            title: "Developers",
            text: "Receive sustainable resources to improve the infrastructure.",
          },
          {
            title: "Token ecosystem",
            text: "Receives a revenue-linked buyback-and-burn mechanism.",
          },
        ],
      },
      { type: "heading", text: "Buyback Transparency" },
      {
        type: "paragraph",
        text: "Buyback and burn mechanisms are most credible when they are independently verifiable. Mirae should therefore aim to publish:",
      },
      {
        type: "list",
        items: [
          "Agent fee revenue generated",
          "Agent fee revenue allocated",
          "Tokens purchased",
          "Average purchase price",
          "Tokens burned",
          "Transaction hashes",
          "Cumulative burn",
        ],
      },
      {
        type: "paragraph",
        text: "Illustrative numbers only. This transforms buyback-and-burn from a marketing statement into an auditable economic process.",
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
        text: "$MIRAE is the native ecosystem token associated with the Mirae network and community. The token is designed to connect the broader community to the growth of the Mirae ecosystem without requiring inflationary emissions as the primary funding mechanism.",
      },
      {
        type: "paragraph",
        text: "Potential future utility may include ecosystem access, agent-related functionality, community programs or other mechanisms introduced as the product develops. Any additional utility should be implemented only when it provides genuine functionality rather than artificial token demand.",
      },
      { type: "heading", text: "Tokenomics" },
      {
        type: "stats",
        items: [
          { value: "100%", label: "Total supply" },
          { value: "97%", label: "Community fair launch" },
          { value: "3%", label: "Development wallet" },
        ],
      },
      { type: "heading", text: "97% community fair launch distribution" },
      {
        type: "paragraph",
        text: "97% of the supply is designated for community and public market distribution through the Pump.fun launch mechanism.",
      },
      {
        type: "list",
        items: [
          "No private sale.",
          "No VC allocation.",
          "No presale allocation.",
          "No team allocation beyond the disclosed 3% development wallet.",
        ],
      },
      { type: "heading", text: "3% development wallet" },
      {
        type: "paragraph",
        text: "3% of total supply is allocated to the Mirae development wallet. The wallet is intended to support long-term ecosystem operations and should be publicly identifiable for transparency.",
      },
      { type: "heading", text: "Fair Launch" },
      { type: "paragraph", text: "$MIRAE is intended to launch through Pump.fun." },
      {
        type: "table",
        head: ["Allocation", "Share"],
        rows: [
          ["Private round", "None"],
          ["Seed round", "None"],
          ["VC round", "None"],
          ["Presale", "None"],
          ["Community", "97%"],
          ["Development", "3%"],
        ],
      },
      {
        type: "paragraph",
        text: "Mirae does not promise a specific token price, market capitalization, return, liquidity level or exchange listing. The market determines the value of $MIRAE.",
      },
    ],
  },
  {
    id: "security-model",
    index: "12",
    kicker: "Security",
    title: "Minimize authority, not intelligence.",
    blocks: [
      { type: "paragraph", text: "Mirae's security philosophy is based on minimizing authority." },
      {
        type: "note",
        title: "Ultimate objective",
        items: [
          "Compromise of intelligence should not automatically mean compromise of custody.",
          "No software architecture eliminates all risk, and users remain responsible for understanding the permissions and capital they provide to autonomous systems.",
        ],
      },
      { type: "heading", text: "Emergency Control" },
      {
        type: "paragraph",
        text: "Every autonomous system should have a deterministic shutdown path. Mirae should include a global emergency stop capable of preventing new executions.",
      },
      {
        type: "table",
        head: ["Emergency stop", "State"],
        rows: [
          ["AI agents", "Blocked"],
          ["Missions", "Paused"],
          ["New trades", "Blocked"],
          ["Signing", "Disabled"],
        ],
      },
      {
        type: "paragraph",
        text: "Existing blockchain positions may still require user action to close depending on the market and implementation.",
      },
    ],
  },
  {
    id: "roadmap",
    index: "13",
    kicker: "Roadmap",
    title: "Seven phases toward the Mirae economy.",
    blocks: [
      { type: "heading", text: "Phase 01 foundation" },
      {
        type: "list",
        items: [
          "Mirae identity",
          "Agent interface",
          "Market data infrastructure",
          "Wallet architecture",
          "Solana execution",
          "Initial trading engine",
        ],
      },
      { type: "heading", text: "Phase 02 agent runtime" },
      {
        type: "list",
        items: [
          "Structured intents",
          "Risk engine",
          "Restricted execution",
          "Autonomous execution",
          "Persistent memory",
          "Execution history",
          "Mission system",
        ],
      },
      { type: "heading", text: "Phase 03 desktop" },
      {
        type: "list",
        items: [
          "Native runtime",
          "Local signing",
          "Encrypted wallet architecture",
          "Local logs",
          "Agent persistence",
          "Emergency controls",
        ],
      },
      { type: "heading", text: "Phase 04 Desktop Distribution" },
      {
        type: "list",
        items: [
          "Linux release available now",
          "Windows and macOS release",
          "Broader desktop distribution",
          "Performance optimization",
          "Transaction-based monetization",
          "Revenue dashboard",
        ],
      },
      { type: "heading", text: "Phase 05 market expansion" },
      {
        type: "list",
        items: [
          "Additional DEX integrations",
          "Perpetual markets",
          "Multi-market execution",
          "Portfolio agents",
          "Advanced strategy environments",
        ],
      },
      { type: "heading", text: "Phase 06 agent network" },
      {
        type: "list",
        items: [
          "Verifiable agent performance",
          "Public agent profiles",
          "Strategy reputation",
          "Agent marketplace",
          "Strategy discovery",
          "Optional copy-agent infrastructure",
        ],
      },
      { type: "heading", text: "Phase 07 Mirae economy" },
      {
        type: "list",
        items: [
          "Automated revenue accounting",
          "Public buyback dashboard",
          "Periodic $MIRAE buyback",
          "Verifiable token burns",
          "Expanded token utility",
        ],
      },
      { type: "heading", text: "The End State" },
      { type: "heading", text: "Today" },
      {
        type: "list",
        items: [
          "Human watches the market",
          "Human researches",
          "Human analyzes",
          "Human decides",
          "Human signs",
          "Human monitors",
        ],
      },
      { type: "heading", text: "Mirae's proposed future" },
      {
        type: "flow",
        items: ["Human", "Define objective", "Define limits", "Mirae"],
      },
      {
        type: "list",
        items: [
          "Mirae observes",
          "Mirae reasons",
          "Mirae executes",
          "Mirae monitors",
          "Mirae records",
          "Mirae learns",
        ],
      },
      {
        type: "paragraph",
        text: "The human moves from operating every transaction to defining the boundaries within which autonomous financial software can operate.",
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
          { title: "Local over custodial", text: "Keep critical authority close to the user." },
          {
            title: "Policy over prompt",
            text: "Prompts express intention. Policies define permission.",
          },
          { title: "Verification over trust", text: "Actions should produce records." },
          {
            title: "Autonomy with limits",
            text: "Automation should never mean unlimited authority.",
          },
          {
            title: "Product before token",
            text: "Sustainable token economics require a product people actually use.",
          },
          {
            title: "Revenue before emissions",
            text: "Long-term development should increasingly be supported by product activity rather than continuous token inflation.",
          },
        ],
      },
    ],
  },
];
