import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Whitepaper - Silfable",
  description:
    "Silfable whitepaper covering the restricted Mainnet architecture, current execution scope, web and desktop differences, and Pump.fun roadmap.",
};

const statusRows = [
  ["Live", "Restricted Jupiter swap", "Solana Mainnet swap preview, simulation, wallet approval, broadcast receipt."],
  ["Live", "Portfolio reads", "Connected-wallet SOL balance and activity snapshots from configured Mainnet RPC."],
  ["Preview", "Pump.fun", "Research and proposal flow only on web. No Pump.fun signing or broadcast yet."],
  ["Planned", "Full Access", "No silent signing, autonomous broadcast, EVM, bridge, Hyperliquid, or limit orders in production today."],
] as const;

const principles = [
  {
    icon: ShieldCheck,
    title: "Reasoning is not authority",
    text: "The AI may analyze markets and draft actions, but supported transactions still pass policy checks and user approval.",
  },
  {
    icon: LockKeyhole,
    title: "Keys stay local",
    text: "Desktop uses local vault flows. Web can encrypt a same-address signer locally, but Pump.fun broadcast remains disabled until guards are complete.",
  },
  {
    icon: CheckCircle2,
    title: "Receipts matter",
    text: "Every quote, simulation, confirmation, rejection, and failure should be readable after restart.",
  },
  {
    icon: TriangleAlert,
    title: "Fail closed",
    text: "Unknown RPC state, fee spikes, missing route evidence, stale quote data, or policy ambiguity blocks execution.",
  },
] as const;

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-black/15 pt-36">
        <div className="section-shell pb-20 sm:pb-28">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Whitepaper / v0.1.0</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.48fr] lg:items-end">
            <h1 className="max-w-5xl font-serif text-6xl font-normal leading-[0.9] tracking-normal sm:text-7xl lg:text-8xl">
              Guarded AI trading for Solana Mainnet.
            </h1>
            <p className="max-w-lg text-base leading-8 text-black/55 lg:justify-self-end">
              Silfable is built around a simple boundary: the agent can reason and prepare work, but money only moves through explicit policy checks, simulation evidence, and user approval.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-black/15">
        <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
          <SectionLabel number="01" title="Current Status" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-black/20 font-mono text-[9px] uppercase tracking-[0.16em] text-black/35">
                <tr>
                  <th className="py-4 font-normal">Status</th>
                  <th className="py-4 font-normal">Capability</th>
                  <th className="py-4 font-normal">Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {statusRows.map(([status, capability, scope]) => (
                  <tr key={capability}>
                    <td className="py-5 font-mono text-[10px] uppercase tracking-[0.12em] text-electric">{status}</td>
                    <td className="py-5 font-medium">{capability}</td>
                    <td className="py-5 leading-7 text-black/55">{scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-black/15">
        <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
          <SectionLabel number="02" title="Architecture" />
          <div className="grid gap-5 sm:grid-cols-2">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <article key={principle.title} className="border border-black/15 p-6">
                  <Icon className="size-5 text-electric" strokeWidth={1.5} />
                  <h2 className="mt-8 font-serif text-3xl font-normal tracking-normal">{principle.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-black/55">{principle.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-black/15">
        <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
          <SectionLabel number="03" title="Pump.fun Roadmap" />
          <div>
            <p className="max-w-3xl text-lg leading-8 text-black/60">
              Pump.fun is intentionally not marked live yet. The next production path is preview, simulation, fee guard, final revalidation, password or wallet approval, broadcast, receipt, and automatic position refresh.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ["Preview", "Token discovery, mint validation, spend limits, take profit, stop loss, and DCA settings."],
                ["Guard", "Program allowlist, transaction inspection, fee ceiling, slippage bounds, rent visibility, and route freshness."],
                ["Execute", "Explicit final approval, local signing, broadcast reconciliation, and persisted success or failure receipt."],
              ].map(([title, text]) => (
                <div key={title} className="border-t border-black/20 pt-5">
                  <h3 className="font-serif text-2xl font-normal tracking-normal">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-black/55">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
          <SectionLabel number="04" title="Web And Desktop" />
          <div className="grid gap-5 md:grid-cols-2">
            <div className="border border-black/15 p-6">
              <h2 className="font-serif text-3xl font-normal tracking-normal">Desktop</h2>
              <p className="mt-4 text-sm leading-7 text-black/55">
                Best for local vault workflows, encrypted receipts, main setup, and stricter machine-level control. It is the reference surface for production hardening.
              </p>
            </div>
            <div className="border border-black/15 p-6">
              <h2 className="font-serif text-3xl font-normal tracking-normal">Web</h2>
              <p className="mt-4 text-sm leading-7 text-black/55">
                Best for browser-wallet approval and shared UI parity. It supports restricted Jupiter execution today, while Pump.fun transaction signing remains behind future guards.
              </p>
            </div>
          </div>
          <div className="lg:col-start-2">
            <Link
              href="/trade"
              className="inline-flex items-center gap-3 bg-electric px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-blue-500"
            >
              Open Trade Workspace <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">{number}</p>
      <h2 className="mt-3 font-serif text-3xl font-normal tracking-normal">{title}</h2>
    </div>
  );
}
