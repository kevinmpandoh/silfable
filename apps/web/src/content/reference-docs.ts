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
        text: "Mirae is an execution workspace for on-chain operators. It reads an objective, prepares a route, presents the exact calls it intends to make, waits for a wallet signature, executes through supported protocols, verifies the resulting state, and stores what is worth remembering for the next run.",
      },
      {
        type: "paragraph",
        text: "The product is built around one principle. Automation should remove the mechanical work of trading, launching, bridging and monitoring, and it should never remove the operator from the moment of approval. Mirae assembles the path. The wallet decides whether that path is taken.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Prepared execution",
            text: "Every action arrives as a reviewable plan with the route, the venue, the expected outcome and the failure conditions written out before anything is signed.",
          },
          {
            title: "Local runtime",
            text: "The workspace runs on your machine. Keys stay in your wallet, session data stays local, and no intermediate custodian sits between the plan and the chain.",
          },
          {
            title: "Verified state",
            text: "After settlement the workspace reconciles the on-chain result against the intent it was given and records the difference instead of assuming success.",
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
          { value: "Swaps", label: "Routed across supported venues" },
          { value: "Launch", label: "Token creation and first liquidity" },
          { value: "Bridge", label: "Connected routes between chains" },
          { value: "Automation", label: "Recurring and conditional runs" },
        ],
      },
    ],
  },
  {
    id: "status",
    index: "02",
    kicker: "Status",
    title: "Read this before anything else.",
    blocks: [
      {
        type: "paragraph",
        text: "This documentation describes the intended behaviour of the Mirae workspace and the operating model around it. Unless a capability is separately announced and observable in a released build, treat it as planned rather than shipped.",
      },
      {
        type: "note",
        title: "Planned capabilities",
        items: [
          "Conditional automation with unattended scheduling is planned.",
          "Cross chain bridging beyond the initial supported routes is planned.",
          "Team workspaces with shared policy files are planned.",
          "Public execution reporting and exportable audit history are planned.",
          "Third party protocol adapters beyond the current set are planned.",
        ],
      },
      {
        type: "paragraph",
        text: "Nothing in this document is financial advice, a performance claim, a promise of returns, a listing commitment or a guarantee that any specific venue, chain or provider will remain supported. Markets change, protocols deprecate endpoints, and the workspace will follow those changes rather than pretend they do not happen.",
      },
    ],
  },
  {
    id: "architecture",
    index: "03",
    kicker: "Architecture",
    title: "Six stages, one loop.",
    blocks: [
      {
        type: "paragraph",
        text: "An objective enters the workspace as plain language or as a saved routine. It leaves as a settled transaction with a verified receipt. Between those two points the runtime moves through six stages, and every stage can stop the run.",
      },
      {
        type: "flow",
        items: [
          "Intent captured from the operator",
          "Context gathered from market and wallet state",
          "Route planned across supported venues",
          "Plan presented for wallet approval",
          "Execution submitted and monitored",
          "Result verified and written to memory",
        ],
      },
      {
        type: "heading",
        text: "Why the loop is explicit",
      },
      {
        type: "paragraph",
        text: "A single opaque agent call is easy to demonstrate and difficult to trust. Splitting the run into named stages makes each failure legible. A route that cannot be built fails at planning. A quote that drifts past tolerance fails before signing. A transaction that lands with an unexpected balance fails at verification and is reported as such instead of being silently marked complete.",
      },
      {
        type: "table",
        head: ["Stage", "Owner", "Stops the run when"],
        rows: [
          ["Intent", "Operator", "The objective is ambiguous or out of scope"],
          ["Context", "Runtime", "Required market or wallet data is unavailable"],
          ["Plan", "Runtime", "No route satisfies the stated constraints"],
          ["Approval", "Wallet", "The operator declines or the plan expires"],
          ["Execution", "Protocol", "Simulation or submission fails"],
          ["Verification", "Runtime", "Final state does not match the intent"],
        ],
      },
    ],
  },
  {
    id: "approval",
    index: "04",
    kicker: "Approval model",
    title: "Signing in is not signing off.",
    blocks: [
      {
        type: "lead",
        text: "Connecting a wallet proves identity for the session. It does not pre authorise a later transaction, it does not grant a standing allowance, and it does not let the workspace act while the operator is away unless an automation policy was created and approved for exactly that purpose.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Scoped session",
            text: "A session grants read access to public wallet state so the runtime can price and simulate. Nothing spendable is unlocked by connecting.",
          },
          {
            title: "Per action approval",
            text: "Each prepared plan produces its own signature request with the venue, the amounts, the slippage bound and the expiry visible before confirmation.",
          },
          {
            title: "Expiring plans",
            text: "A plan that is not signed within its validity window is discarded and rebuilt against fresh state rather than executed against stale quotes.",
          },
        ],
      },
      {
        type: "heading",
        text: "What the operator sees before signing",
      },
      {
        type: "list",
        items: [
          "The exact protocol or program that will be called.",
          "Input asset, output asset and the amounts on both sides.",
          "Price impact, slippage tolerance and the worst acceptable outcome.",
          "Network fees and any application fee applied to the action.",
          "The conditions under which the runtime will abandon the attempt.",
        ],
      },
    ],
  },
  {
    id: "execution",
    index: "05",
    kicker: "Execution",
    title: "Routes are built, not guessed.",
    blocks: [
      {
        type: "paragraph",
        text: "Routing is a search problem with hard constraints. The runtime enumerates the venues that can serve the request, prices each candidate against live liquidity, discards paths that violate the stated bounds, and ranks the remainder on expected output after fees rather than on headline quotes.",
      },
      {
        type: "steps",
        items: [
          "Normalise the request into assets, amounts and constraints.",
          "Query supported venues for executable liquidity.",
          "Price each candidate path including fees and expected impact.",
          "Simulate the leading path against current chain state.",
          "Present the surviving plan with its worst case outcome.",
          "Submit on approval and monitor until settlement.",
          "Reconcile the receipt against the promised bounds.",
        ],
      },
      {
        type: "heading",
        text: "Failure handling",
      },
      {
        type: "paragraph",
        text: "Failures are treated as information rather than noise. A rejected simulation, a reverted call or a partial fill is recorded with its reason and surfaced in the run history. Where a retry is safe the runtime rebuilds the plan from fresh state and asks again. Where a retry would change the economics it stops and hands the decision back to the operator.",
      },
    ],
  },
  {
    id: "automation",
    index: "06",
    kicker: "Automation",
    title: "Policies, not blank cheques.",
    blocks: [
      {
        type: "lead",
        text: "Automation in Mirae is a bounded policy that the operator writes once and approves once. The policy states what may happen, how often, within which limits and until when. Anything outside those bounds returns to manual review.",
      },
      {
        type: "table",
        head: ["Policy field", "Purpose", "Example bound"],
        rows: [
          ["Trigger", "Defines when a run may start", "Price crosses a level or a schedule fires"],
          ["Scope", "Limits which assets and venues are allowed", "One pair on one supported venue"],
          ["Size", "Caps the value of a single run", "A fixed notional per execution"],
          ["Budget", "Caps cumulative spend for the policy", "A total ceiling across the period"],
          ["Expiry", "Forces the policy to be renewed", "A fixed end date or run count"],
        ],
      },
      {
        type: "paragraph",
        text: "A policy is revocable at any time and revocation takes effect before the next trigger evaluation. Policies are stored locally with the workspace, are versioned, and any edit produces a new approval request instead of silently widening an existing permission.",
      },
    ],
  },
  {
    id: "memory",
    index: "07",
    kicker: "Memory",
    title: "Remember what changed the outcome.",
    blocks: [
      {
        type: "paragraph",
        text: "A runtime that stores everything becomes slow and confidently wrong. Mirae keeps a narrow memory of facts that measurably improve later runs and discards the rest. Each retained item carries where it came from, when it was observed and how long it stays valid.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Operational memory",
            text: "Venue reliability, typical slippage on a pair, and routes that repeatedly fail under specific conditions.",
          },
          {
            title: "Operator preferences",
            text: "Default tolerances, preferred venues and confirmation habits that shape how plans are proposed.",
          },
          {
            title: "Run history",
            text: "A verifiable record of intents, approvals, receipts and reconciliations that can be exported for review.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Memory never holds private keys, seed phrases or signed payloads. It can be inspected, edited and cleared by the operator, and clearing it degrades convenience rather than access.",
      },
    ],
  },
  {
    id: "local",
    index: "08",
    kicker: "Local runtime",
    title: "Your machine is the server.",
    blocks: [
      {
        type: "paragraph",
        text: "Mirae installs and runs locally on Linux, Windows and macOS. The workspace communicates with public RPC endpoints, supported protocol APIs and the wallet on the same machine. There is no hosted queue holding your intents and no remote operator able to submit a transaction on your behalf.",
      },
      {
        type: "stats",
        items: [
          { value: "Local", label: "Runtime and session data" },
          { value: "Wallet", label: "Sole holder of signing authority" },
          { value: "Public", label: "RPC and protocol endpoints only" },
          { value: "Exportable", label: "History owned by the operator" },
        ],
      },
      {
        type: "heading",
        text: "Operational responsibilities",
      },
      {
        type: "list",
        items: [
          "Keep the workspace build current so protocol adapters stay valid.",
          "Verify download signatures against the addresses published by the project.",
          "Use a dedicated operating wallet rather than a long term storage wallet.",
          "Review automation policies on a regular schedule and let unused ones expire.",
        ],
      },
    ],
  },
  {
    id: "fees",
    index: "09",
    kicker: "Fees",
    title: "One line, stated up front.",
    blocks: [
      {
        type: "paragraph",
        text: "Costs are shown inside the plan before approval and never introduced afterwards. Two components exist and they are always displayed separately so the operator can see what the network charged and what the application charged.",
      },
      {
        type: "table",
        head: ["Component", "Charged by", "Shown"],
        rows: [
          ["Network fee", "The underlying chain", "In the plan, in native gas terms"],
          ["Protocol fee", "The venue serving the route", "In the quoted output"],
          ["Application fee", "Mirae, on supported actions", "As a separate line in the plan"],
        ],
      },
      {
        type: "paragraph",
        text: "Where an application fee applies it is expressed as a rate on the action rather than as a spread hidden inside the quote. Runs that fail before submission carry no application fee.",
      },
    ],
  },
  {
    id: "security",
    index: "10",
    kicker: "Security",
    title: "Assume the network is hostile.",
    blocks: [
      {
        type: "lead",
        text: "The workspace is designed so that a compromise of any single component does not become a compromise of the operator funds. Signing authority is never delegated, plans are never executed without a fresh approval, and every submitted call is reconciled against what was promised.",
      },
      {
        type: "list",
        items: [
          "Keys and seed phrases are never requested, stored, transmitted or logged.",
          "Simulation precedes submission so a malformed call fails locally rather than on-chain.",
          "Quotes expire, and an expired plan is rebuilt instead of reused.",
          "Approvals are scoped to a single action unless a policy explicitly says otherwise.",
          "Unexpected results are reported as failures rather than resolved silently.",
        ],
      },
      {
        type: "note",
        title: "Reporting a vulnerability",
        items: [
          "Contact the project through the official channels listed on the site.",
          "Include reproduction steps and the build version you observed.",
          "Do not publish an exploitable detail before a fix is available.",
        ],
      },
    ],
  },
  {
    id: "roadmap",
    index: "11",
    kicker: "Roadmap",
    title: "Depth before surface.",
    blocks: [
      {
        type: "paragraph",
        text: "Development priority goes to reliability of the execution loop before expansion of the feature surface. A route that settles predictably is worth more than a menu of venues that occasionally works.",
      },
      {
        type: "table",
        head: ["Track", "Direction", "State"],
        rows: [
          ["Execution", "Deeper venue coverage and better route ranking", "Active"],
          ["Automation", "Conditional policies with unattended runs", "Planned"],
          ["Bridging", "Additional connected routes between chains", "Planned"],
          ["Reporting", "Exportable audit history and run analytics", "Planned"],
          ["Workspaces", "Shared policy files for small teams", "Exploring"],
        ],
      },
      {
        type: "paragraph",
        text: "Items move from exploring to planned once the design is settled, and from planned to active once the work is underway in a released build. Nothing is marked complete until it is observable by an operator.",
      },
    ],
  },
  {
    id: "glossary",
    index: "12",
    kicker: "Glossary",
    title: "Terms used across these pages.",
    blocks: [
      {
        type: "table",
        head: ["Term", "Meaning"],
        rows: [
          ["Intent", "The objective an operator gives the workspace before any route exists"],
          ["Plan", "A concrete, priced and bounded proposal awaiting a signature"],
          ["Route", "The ordered set of protocol calls that fulfils a plan"],
          ["Policy", "A bounded permission that lets automation run without a new approval"],
          ["Reconciliation", "The comparison of settled state against the promised bounds"],
          ["Run history", "The stored record of intents, approvals and verified outcomes"],
        ],
      },
    ],
  },
];

