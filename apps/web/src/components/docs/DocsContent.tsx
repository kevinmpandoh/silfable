import { AlertTriangle, ArrowRight, Check, KeyRound, Monitor, ShieldCheck, TerminalSquare } from "lucide-react";
import Image from "next/image";

const concepts = [
  { icon: TerminalSquare, title: "Agent", text: "Researches, explains, and drafts typed proposals without receiving signing authority." },
  { icon: ArrowRight, title: "Session", text: "Locks a wallet network and preserves conversation, proposal, and receipt history." },
  { icon: ShieldCheck, title: "Policy gate", text: "Validates identity, amount, fee, route, freshness, and venue allowlists before approval." },
];

export function DocsContent() {
  return (
    <article className="min-w-0">
      <section id="introduction" className="scroll-mt-36 border-b border-black/15 pb-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Start here / v0.1.0</p>
        <h1 className="mt-7 max-w-4xl font-serif text-[clamp(3.1rem,7vw,7.5rem)] leading-[0.86] tracking-[-0.06em]">
          Silfable documentation
        </h1>
        <p className="mt-9 max-w-2xl text-lg leading-8 text-black/55">
          Silfable is a guarded Mainnet workspace for AI-assisted Token Launch, Solana swaps, EVM swap pilots, and cross-chain route review. Reasoning, deterministic policy, signing, and receipt verification remain separate authorities.
        </p>
        <div className="mt-10 grid border-t border-l border-black/15 sm:grid-cols-3">
          {["Mainnet only", "Policy enforced", "Receipt recorded"].map((item) => (
            <div key={item} className="flex items-center gap-3 border-r border-b border-black/15 p-5 text-xs font-medium text-black">
              <Check className="size-4 text-electric" /> {item}
            </div>
          ))}
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="01" title="Quick start" />
        <p className="doc-lead">Choose the surface that owns signing, configure only the providers required by your wallet network, then start a restricted Mainnet session.</p>
        <ol className="mt-10 space-y-7">
          {[
            ["Choose", "Use desktop for encrypted local-vault signing. Use web for the single connected browser wallet and explicit wallet approval."],
            ["Configure", "Desktop stores wallet, RPC, Jupiter or 0x credentials, inference provider, and global transaction limits in Settings."],
            ["Create", "Select a Solana or supported EVM wallet network. The task you enter determines the typed proposal; session creation does not authorize a transaction."],
            ["Review", "Inspect exact assets, amount, route, simulation, fees, and freshness. Approve only a supported lane and verify its persisted receipt."],
          ].map(([title, text], index) => (
            <li key={title} className="grid gap-3 border-t border-black/10 pt-6 sm:grid-cols-[3rem_8rem_1fr]">
              <span className="font-mono text-sm text-electric">{String(index + 1).padStart(2, "0")}</span>
              <strong className="font-serif text-xl font-normal">{title}</strong>
              <span className="text-sm leading-7 text-black/70">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="core-concepts" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="02" title="Core concepts" />
        <p className="doc-lead">Three objects define how work moves from a user instruction to a supported market action.</p>
        <div className="mt-10 grid border-t border-l border-black/15 md:grid-cols-3">
          {concepts.map((concept) => {
            const Icon = concept.icon;
            return (
              <div key={concept.title} className="border-r border-b border-black/15 p-6">
                <Icon className="size-5 text-electric" strokeWidth={1.5} />
                <h3 className="mt-12 font-serif text-3xl tracking-[-0.04em]">{concept.title}</h3>
                <p className="mt-4 text-sm leading-7 text-black/50">{concept.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="desk-rule" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="03" title="Transaction settings" />
        <p className="doc-lead">Global limits are evaluated before signing. The AI and the session cannot silently raise these values or bypass a blocked venue.</p>
        <div className="mt-8 mb-8 overflow-hidden rounded-xl border border-black/10 shadow-sm">
          <Image src="/setting.app.png" alt="Transaction Settings UI" width={1200} height={800} className="w-full object-cover" />
        </div>
        <div className="border-l-2 border-electric bg-blue-50 p-5 text-sm leading-7 text-blue-950">
          Rules use deny-by-default semantics. If a proposed action cannot be proven compliant, Silfable rejects it before signing.
        </div>
      </section>

      <section id="mission-lifecycle" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="04" title="Session lifecycle" />
        <p className="doc-lead">Every session moves through explicit states. State changes are written to its receipt stream.</p>
        <div className="mt-10 space-y-0 border-t border-black/15">
          {[
            ["Draft", "The AI gathers exact parameters and creates a typed, venue-specific proposal."],
            ["Checked", "Deterministic policy validates wallet, assets, amount, limits, route, and provider evidence."],
            ["Simulated", "An unsigned transaction is inspected and simulated where the venue supports it."],
            ["Approved", "Fresh revalidation passes and the user explicitly authorizes one signing attempt."],
            ["Reconciled", "Success, failure, or ambiguous broadcast state is independently verified and persisted."],
          ].map(([state, description], index) => (
            <div key={state} className="grid grid-cols-[2.5rem_7rem_1fr] gap-3 border-b border-black/15 py-5 sm:grid-cols-[4rem_10rem_1fr]">
              <span className="font-mono text-sm text-black/45">0{index + 1}</span>
              <strong className="text-sm font-medium text-black">{state}</strong>
              <span className="text-sm leading-6 text-black/70">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="05" title="Security model" />
        <p className="doc-lead">Silfable is designed so that custody, policy, and execution evidence remain separable.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[
            { icon: KeyRound, title: "Signing is separated", text: "Desktop keys remain in the encrypted local vault; web signing remains inside the connected browser wallet." },
            { icon: ShieldCheck, title: "Least authority", text: "Each session receives only the markets, sizes, and actions explicitly allowed by its policy." },
            { icon: Monitor, title: "Local enforcement", text: "Policy evaluation happens before signing, on the machine where the runtime is installed." },
            { icon: AlertTriangle, title: "Fail closed", text: "Unavailable price data, invalid routes, or policy ambiguity halt the action instead of bypassing checks." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="border border-black/15 p-6">
                <Icon className="size-5 text-electric" strokeWidth={1.5} />
                <h3 className="mt-8 font-serif text-2xl tracking-[-0.03em]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-black/50">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="receipts" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="06" title="Receipts" />
        <p className="doc-lead">A receipt records what was proposed, checked, simulated, approved, broadcast, and independently reconciled. A quote or simulation is never presented as settlement.</p>
        <div className="mt-9 overflow-x-auto">
          <table className="min-w-[42rem] w-full text-left text-sm">
            <thead className="border-b border-black/20 font-mono text-[9px] uppercase tracking-[0.17em] text-black/35">
              <tr><th className="py-4 font-normal">Event</th><th className="py-4 font-normal">Recorded data</th><th className="py-4 font-normal">Retention</th></tr>
            </thead>
            <tbody className="divide-y divide-black/10 text-black/55">
              <tr><td className="py-5 text-ink">Observation</td><td>Source, timestamp, market snapshot</td><td>Local</td></tr>
              <tr><td className="py-5 text-ink">Policy check</td><td>Rule inputs, result, reason</td><td>Local</td></tr>
              <tr><td className="py-5 text-ink">Execution</td><td>Route, signature, settlement state</td><td>Local + chain</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="cli" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="07" title="Capability status" />
        <p className="doc-lead">Implemented code is not the same as production clearance. Each mutable lane retains an independent release gate.</p>
        <div className="mt-9 overflow-x-auto">
          <table className="min-w-[48rem] w-full text-left text-sm">
            <thead className="border-b border-black/20 font-mono text-[9px] uppercase tracking-[0.17em] text-black/35">
              <tr><th className="py-4 font-normal">Lane</th><th className="py-4 font-normal">Current state</th><th className="py-4 font-normal">Release boundary</th></tr>
            </thead>
            <tbody className="divide-y divide-black/10 text-black/55">
              <tr><td className="py-5 text-ink">Solana Swap</td><td>Guarded desktop Jupiter path</td><td>Signed-build, recovery, and Mainnet acceptance gates remain</td></tr>
              <tr><td className="py-5 text-ink">Token Launch</td><td>Restricted Pump.fun desktop implementation</td><td>Controlled Mainnet acceptance and security review remain</td></tr>
              <tr><td className="py-5 text-ink">EVM Swap</td><td>Release-gated across supported EVM networks</td><td>Mainnet acceptance and recovery testing remain</td></tr>
              <tr><td className="py-5 text-ink">Bridge</td><td>Implemented cross-chain execution</td><td>Release-gated validation remains</td></tr>
              <tr><td className="py-5 text-ink">Auto DCA</td><td>Implemented deterministic recurring flows</td><td>Global limit verification remains</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="troubleshooting" className="scroll-mt-36 py-16">
        <DocHeading number="08" title="Troubleshooting" />
        <div className="mt-10 divide-y divide-black/15 border-t border-black/15">
          {[
            ["A proposal is blocked", "Confirm the wallet network, exact asset identity, amount, provider configuration, deadline, and global transaction limits."],
            ["Wallet signature is not requested", "Confirm the session reached approval state and the proposed action passed every policy check."],
            ["Runtime shows stale market data", "Refresh the wallet, verify RPC connectivity, and request a new quote. Never reuse stale simulation evidence."],
            ["A receipt is missing", "Check the local workspace path and available disk space. Silfable fails closed when receipt storage is unavailable."],
          ].map(([problem, answer]) => (
            <div key={problem} className="grid gap-3 py-6 sm:grid-cols-[14rem_1fr]">
              <strong className="text-sm font-medium">{problem}</strong>
              <p className="text-sm leading-7 text-black/50">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function DocHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-5">
      <span className="font-mono text-sm tracking-[0.18em] text-electric">{number}</span>
      <h2 className="font-serif text-4xl tracking-[-0.045em] sm:text-5xl">{title}</h2>
    </div>
  );
}
