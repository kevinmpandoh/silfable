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
    id: "overview",
    index: "01",
    kicker: "Overview",
    title: "The workspace behind every signature.",
    blocks: [
      {
        type: "lead",
        text: "Mirae is an execution workspace for on-chain operators. It reads an objective, prepares a verified route, presents exact simulated calls, executes via local keystores, reconciles resulting state, and tracks positions across spot, perps, launches, and institutional RWA lending.",
      },
      {
        type: "paragraph",
        text: "The product is built around one principle: automation should remove the mechanical friction of trading, launching, bridging, and yield management, while keeping the operator in complete control of authority boundaries.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Prepared Execution",
            text: "Every action arrives as a reviewable plan with route, venue, expected output, and fee calculations before signing.",
          },
          {
            title: "Local Vault Runtime",
            text: "Runs on your machine with AES-256-GCM encrypted keystores. Keys never touch cloud servers.",
          },
          {
            title: "Multi-Venue Settlement",
            text: "Native execution across Jupiter, Kamino RWA, Drift Perps, Pump.fun, and Relay Cross-Chain Bridge.",
          },
        ],
      },
      {
        type: "heading",
        text: "What the workspace covers today",
      },
      {
        type: "stats",
        items: [
          { value: "Spot & DCA", label: "Jupiter swaps, limits & recurring orders" },
          { value: "RWA Yield", label: "Kamino & Obligate corporate debt yields" },
          { value: "Perpetuals", label: "Drift & Hyperliquid isolated long/short" },
          { value: "Token Launch", label: "Pump.fun creation & creator buy protections" },
          { value: "x402 Intel", label: "Pay-per-request decentralized intelligence" },
          { value: "Multi-Chain", label: "Relay bridge across EVM & Solana" },
        ],
      },
    ],
  },
  {
    id: "status",
    index: "02",
    kicker: "Status",
    title: "Active Capabilities & Roadmap.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae v0.4.x is currently active on desktop (Linux and Windows) with native support for Solana mainnet and EVM cross-chain routing.",
      },
      {
        type: "note",
        title: "Active & Shipped Capabilities",
        items: [
          "Real-World Asset (RWA) lending and yield tracking via Kamino Finance & Obligate.",
          "x402 on-chain USDC data micro-payments for autonomous market intelligence.",
          "Cross-chain bridging between Solana, Robinhood Chain, Base, Arbitrum, and Ethereum.",
          "Directional perpetual order preparation and execution via Drift Protocol.",
          "Full Access session grants with 24-hour bounding and automatic execution.",
        ],
      },
      {
        type: "note",
        title: "Upcoming Milestones",
        items: [
          "macOS desktop build distribution.",
          "Verifiable on-chain agent performance records and strategy marketplace.",
          "Automated protocol fee accounting and public buyback-and-burn dashboard.",
        ],
      },
    ],
  },
];
