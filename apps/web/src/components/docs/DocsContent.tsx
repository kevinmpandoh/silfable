import { AlertTriangle, ArrowRight, Check, KeyRound, Monitor, ShieldCheck, TerminalSquare } from "lucide-react";

import { CodeBlock } from "@/components/docs/CodeBlock";

const deskRuleExample = `mission: rebalance_silf_usdc
market: SOL / USDC
max_position: $2,500.00
max_slippage: 0.40%
daily_loss: -$180.00
require: verified_liquidity
on_violation: HALT + NOTIFY`;

const cliExample = `silfable mission create ./missions/rebalance.yaml
silfable rule apply ./rules/desk-rule.silf
silfable mission start rebalance_silf_usdc
silfable receipts tail --mission rebalance_silf_usdc`;

const concepts = [
  { icon: TerminalSquare, title: "Agent", text: "The local AI operator that evaluates conditions and proposes actions." },
  { icon: ArrowRight, title: "Mission", text: "A measurable objective, stop condition, and execution scope." },
  { icon: ShieldCheck, title: "Desk Rule", text: "The non-negotiable policy checked before every signed action." },
];

export function DocsContent() {
  return (
    <article className="min-w-0">
      <section id="introduction" className="scroll-mt-36 border-b border-black/15 pb-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Start here / v1.2.0</p>
        <h1 className="mt-7 max-w-4xl font-serif text-[clamp(3.1rem,7vw,7.5rem)] leading-[0.86] tracking-[-0.06em]">
          Silfable documentation.
        </h1>
        <p className="mt-9 max-w-2xl text-lg leading-8 text-black/55">
          Silfable is a local-first desktop runtime for AI trading missions. It separates autonomous reasoning from execution authority, so agents can work continuously without receiving unlimited control.
        </p>
        <div className="mt-10 grid border-t border-l border-black/15 sm:grid-cols-3">
          {["Local signing", "Policy enforced", "Receipt recorded"].map((item) => (
            <div key={item} className="flex items-center gap-3 border-r border-b border-black/15 p-5 text-xs font-medium">
              <Check className="size-4 text-electric" /> {item}
            </div>
          ))}
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="01" title="Quick start" />
        <p className="doc-lead">Install the desktop runtime, connect a supported wallet, define a Desk Rule, then start your first mission.</p>
        <ol className="mt-10 space-y-7">
          {[
            ["Install", "Download the signed Linux AppImage or Debian package, verify its checksum, then install it using your distribution's standard workflow."],
            ["Connect", "Choose a local wallet. Silfable requests only the permissions needed by the active mission."],
            ["Define", "Create a Desk Rule with maximum exposure, loss, slippage, markets, and violation behavior."],
            ["Run", "Review the compiled policy, authorize the mission, and watch its receipt stream."],
          ].map(([title, text], index) => (
            <li key={title} className="grid gap-3 border-t border-black/10 pt-6 sm:grid-cols-[3rem_8rem_1fr]">
              <span className="font-mono text-[9px] text-electric">{String(index + 1).padStart(2, "0")}</span>
              <strong className="font-serif text-xl font-normal">{title}</strong>
              <span className="text-sm leading-7 text-black/55">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="core-concepts" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="02" title="Core concepts" />
        <p className="doc-lead">Three objects define how work moves from an objective to a market action.</p>
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
        <DocHeading number="03" title="Desk Rule" />
        <p className="doc-lead">Desk Rule is evaluated locally before signing. A mission may reason freely, but it cannot negotiate or rewrite these limits.</p>
        <CodeBlock label="desk-rule.silf" code={deskRuleExample} />
        <div className="border-l-2 border-electric bg-blue-50 p-5 text-sm leading-7 text-blue-950">
          Rules use deny-by-default semantics. If a proposed action cannot be proven compliant, Silfable rejects it.
        </div>
      </section>

      <section id="mission-lifecycle" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="04" title="Mission lifecycle" />
        <p className="doc-lead">Every mission moves through five explicit states. State changes are written to its receipt stream.</p>
        <div className="mt-10 space-y-0 border-t border-black/15">
          {[
            ["Draft", "Objective and policy are editable."],
            ["Compiled", "The runtime validates dependencies and Desk Rule syntax."],
            ["Authorized", "A local signer grants scoped execution authority."],
            ["Running", "The agent observes, proposes, checks, and executes."],
            ["Halted", "A stop condition, policy violation, or user action ends execution."],
          ].map(([state, description], index) => (
            <div key={state} className="grid grid-cols-[2.5rem_7rem_1fr] gap-3 border-b border-black/15 py-5 sm:grid-cols-[4rem_10rem_1fr]">
              <span className="font-mono text-[9px] text-black/25">0{index + 1}</span>
              <strong className="text-sm font-medium">{state}</strong>
              <span className="text-sm leading-6 text-black/50">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="scroll-mt-36 border-b border-black/15 py-16">
        <DocHeading number="05" title="Security model" />
        <p className="doc-lead">Silfable is designed so that custody, policy, and execution evidence remain separable.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[
            { icon: KeyRound, title: "Keys stay local", text: "Private keys remain in your wallet or local signer. They are never uploaded to Silfable services." },
            { icon: ShieldCheck, title: "Least authority", text: "Each mission receives only the markets, sizes, and actions explicitly allowed by its policy." },
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
        <p className="doc-lead">A receipt is an append-only record of what the agent observed, proposed, proved, signed, or rejected.</p>
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
        <DocHeading number="07" title="CLI reference" />
        <p className="doc-lead">The desktop app ships with a companion CLI for scripted setup, mission control, and receipt inspection.</p>
        <CodeBlock label="terminal" code={cliExample} />
      </section>

      <section id="troubleshooting" className="scroll-mt-36 py-16">
        <DocHeading number="08" title="Troubleshooting" />
        <div className="mt-10 divide-y divide-black/15 border-t border-black/15">
          {[
            ["Mission will not compile", "Validate Desk Rule field names, numeric formats, and that every required market adapter is installed."],
            ["Wallet signature is not requested", "Confirm the mission reached Authorized state and the proposed action passed every policy check."],
            ["Runtime shows stale market data", "Pause the mission, verify network connectivity, then restart the relevant market adapter."],
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
      <span className="font-mono text-[9px] tracking-[0.18em] text-electric">{number}</span>
      <h2 className="font-serif text-4xl tracking-[-0.045em] sm:text-5xl">{title}</h2>
    </div>
  );
}
