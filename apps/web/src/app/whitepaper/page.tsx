import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  ServerCrash,
  BrainCircuit,
  Database,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Whitepaper - Silfable",
  description:
    "Silfable whitepaper covering restricted Mainnet architecture, venue-specific release gates, web and desktop authority, Token Launch, Solana Swap, EVM Swap, and Bridge.",
};

const statusRows = [
  ["Verified restricted", "Jupiter Solana Swap", "Controlled SOL-to-USDC and USDC-to-SOL Mainnet swaps have completed. Every new swap still requires a fresh quote, deterministic checks, explicit wallet approval, one-attempt broadcast, and receipt reconciliation."],
  ["Verified restricted", "Pump.fun Token Launch", "Controlled Mainnet token launches have completed through metadata publication, create_v2 preflight, exact final review, wallet approval, broadcast, and receipt verification."],
  ["Verified restricted", "Robinhood Chain Swap", "Controlled ETH-to-USDG and USDG-to-ETH swaps have completed. The active desktop EVM scope is Robinhood Chain only, using a verified Robinhood RPC and a pinned Uniswap-compatible route."],
  ["Verified restricted", "Solana-Robinhood Bridge", "Controlled Solana USDC-to-Robinhood USDG and Robinhood USDG-to-Solana USDC bridges have completed in web and desktop. Each transfer remains route-, liquidity-, RPC-, wallet-, and receipt-dependent."],
  ["Verified restricted", "Auto DCA", "Controlled DCA cycles have detected a due schedule, obtained a fresh quote, completed only after explicit wallet approval, and been reconciled on Mainnet. The schedule never signs on the user's behalf."],
  ["Verified restricted", "TP/SL & Exits", "Controlled TP/SL conditions have triggered a bounded Mainnet exit proposal and completed only after explicit wallet approval and receipt reconciliation. Triggering a condition never grants unattended signing authority."],
] as const;

const principles = [
  {
    icon: ShieldCheck,
    title: "Separated Transaction Authority",
    text: "Desktop keys remain in the local encrypted vault. On web, Phantom or Solflare retains signing authority and the server never creates a production signer.",
  },
  {
    icon: LockKeyhole,
    title: "Restricted Execution",
    text: "The connected browser wallet must explicitly approve every production web transaction. Full Access cloud execution is unavailable.",
  },
  {
    icon: CheckCircle2,
    title: "Persistent Strategies",
    text: "DCA and TP/SL strategies persist with bounded amounts, schedules, pause and revoke controls. The active web or desktop runtime can prepare a fresh proposal, while transaction signing always remains with the user.",
  },
  {
    icon: TriangleAlert,
    title: "Deterministic Safety Gate",
    text: "Fee, slippage, allowlist, balance, and freshness checks must pass before a restricted transaction can reach final user approval.",
  },
] as const;

import { PageTransition } from "@/components/ui/PageTransition";

export default function WhitepaperPage() {
  return (
    <PageTransition>
      <main className="publicPage whitepaperTheme min-h-screen bg-paper text-ink">
        <section className="border-b border-black/15 pt-36">
          <div className="section-shell pb-20 sm:pb-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Whitepaper / v0.2.0</p>
            <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.48fr] lg:items-end">
              <h1 className="max-w-5xl font-serif text-6xl font-normal leading-[0.9] tracking-normal sm:text-7xl lg:text-8xl">
                Guarded AI-assisted execution across explicit Mainnet lanes.
              </h1>
              <p className="max-w-lg text-base leading-8 text-black/55 lg:justify-self-end">
                An early-stage, open-source project separating AI reasoning, venue policy, signing authority, and settlement evidence across Solana and a Robinhood Chain-focused EVM workflow.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15 bg-black/[0.02]">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="00" title="Important Notice" />
            <div className="space-y-6 text-sm leading-7 text-black/70">
              <p className="font-medium text-black">Silfable is an early-stage open-source project.</p>
              <p>
                This document distinguishes implemented code from production clearance. Guarded transaction paths exist, but each venue remains subject to its own signed-build, controlled Mainnet acceptance, recovery, and security gates. A preview artifact or passing simulation is not blanket production approval.
              </p>
              <p>Silfable is not currently:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A standalone blockchain.</li>
                <li>A custodian of real-world assets.</li>
                <li>A fully unconstrained AI trading platform.</li>
                <li>A guarantee of financial returns.</li>
              </ul>
              <p className="text-rose-600 font-medium bg-rose-50 p-4 border border-rose-200 mt-6">
                Cryptocurrency trading involves substantial risk of loss. The AI agents within Silfable act as deterministic co-pilots and researchers. They do not possess inherent legal authority, nor do they bypass strict, hard-coded drawdown and fee limits.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="01" title="Executive Summary" />
            <div className="space-y-6 text-sm leading-7 text-black/70">
              <p>
                The decentralized finance (DeFi) ecosystem is becoming increasingly agentic. AI agents are beginning to search for information, analyze tokens, draft limit orders, and perform economic tasks for humans and businesses.
              </p>
              <p>
                However, the infrastructure required for this economy remains inherently contradictory: giving AI the freedom to trade usually means handing over permanent custody of private keys to an unpredictable black box.
              </p>
              <p>
                Silfable is built around four core ideas:
              </p>
              <ul className="list-decimal pl-5 space-y-4 text-black">
                <li><strong>Intent-based research, deterministic execution:</strong> The AI may analyze markets and draft actions, but supported transactions must pass strict, hard-coded deterministic policy checks before execution.</li>
                <li><strong>Separated transaction authority:</strong> Desktop keys remain in the local encrypted vault; web signing remains in the connected browser wallet.</li>
                <li><strong>Transparent Execution Receipts:</strong> Every quote, simulation, confirmation, rejection, and failure should be readable and independently reconciled. Desktop receipts remain encrypted locally.</li>
                <li><strong>Restricted execution:</strong> Every supported web transaction requires explicit browser-wallet approval. Full Access cloud execution is unavailable.</li>
                <li><strong>Wallet-scoped authentication:</strong> Web access requires an expiring, one-time wallet challenge signature. It authenticates the workspace but never authorizes a transaction.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="02" title="Current Status" />
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
            <SectionLabel number="03" title="The Problem" />
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <BrainCircuit className="size-6 text-electric mb-4" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl mb-2">Unconstrained Risk</h3>
                <p className="text-sm leading-6 text-black/60">When AI agents are given raw private keys to execute trades, they are prone to hallucinations. They may bypass slippage guards or execute a mathematically disastrous trade due to a misunderstood prompt.</p>
              </div>
              <div>
                <LockKeyhole className="size-6 text-electric mb-4" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl mb-2">Fragmented Custody</h3>
                <p className="text-sm leading-6 text-black/60">Providing an AI agent with access to a primary wallet violates fundamental security practices. Users must manually juggle burner wallets and seed phrases to interact safely.</p>
              </div>
              <div>
                <ServerCrash className="size-6 text-electric mb-4" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl mb-2">The Always-On Dilemma</h3>
                <p className="text-sm leading-6 text-black/60">Browser-based AI agents sleep when the user closes their laptop. True algorithmic trading requires persistent, secure server-side execution without exposing plaintext keys to cloud providers.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15 bg-black/[0.02]">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="04" title="Silfable's Vision" />
            <div className="space-y-6 text-sm leading-7 text-black/70">
              <p className="text-lg text-black font-medium leading-relaxed">
                Silfable aims to become an open environment where humans and software agents can express an intended outcome, research the market, and securely execute that outcome without compromising custody.
              </p>
              <p>A request may be expressed as:</p>
              <div className="bg-white border border-black/10 p-5 font-mono text-[11px] text-electric space-y-2">
                <p>&gt; &ldquo;Draft the immutable metadata and bounded fee plan for a Pump.fun Token Launch.&rdquo;</p>
                <p>&gt; &ldquo;Prepare a USDC-to-SOL swap proposal with slippage capped at 1%.&rdquo;</p>
              </div>
              <p>Silfable coordinates the human requester, AI provider, deterministic venue policy, local or browser-wallet signer, network-specific protocol, and independently verified receipt without treating AI output as transaction authority.</p>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="05" title="Design Principles" />
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
            <SectionLabel number="06" title="System Architecture" />
            <div className="grid gap-8">
              <div className="flex gap-4">
                <Database className="size-6 text-electric shrink-0" strokeWidth={1.5} />
                <div>
                  <h3 className="font-serif text-xl mb-1">Encrypted Cloud State Layer</h3>
                  <p className="text-sm leading-6 text-black/60">A cloud database for bounded user preferences, chat state, and proposal metadata. Production transaction keys are not part of the web cloud authority.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <ServerCrash className="size-6 text-electric shrink-0" strokeWidth={1.5} />
                <div>
                  <h3 className="font-serif text-xl mb-1">High-Throughput Task Queue</h3>
                  <p className="text-sm leading-6 text-black/60">A task queue foundation for bounded monitoring and proposal intents. Execution jobs are frozen.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/15 bg-black/[0.02]">
          <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
            <SectionLabel number="07" title="Venue Model" />
            <div>
              <p className="max-w-3xl text-lg leading-8 text-black/60">
                Pump.fun is the Token Launch lane, not a generic AI auto-trading venue. Existing Solana assets swap through Jupiter; the active EVM product scope is Robinhood Chain through a pinned Uniswap-compatible route; bridge support is explicitly limited to Solana USDC and Robinhood USDG in either direction.
              </p>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  ["Token Launch", "AI may help draft public metadata, but the user confirms exact immutable content, creator wallet, fee caps, and the final launch approval."],
                  ["Swap", "Jupiter Solana swaps and Robinhood Chain swaps use separate typed contracts, provider evidence, policy, signer boundaries, and receipt recovery."],
                  ["Bridge", "Solana USDC to Robinhood USDG and the reverse direction have completed controlled web and desktop flows. No universal any-chain bridge claim is made."],
                  ["Auto DCA & Exits", "The active web or desktop runtime can monitor conditions, fetch a fresh quote, and open a bounded action for review. Each resulting transaction still requires explicit wallet approval."],
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
            <SectionLabel number="08" title="Web And Desktop" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="border border-black/15 p-6 bg-white">
                <h2 className="font-serif text-3xl font-normal tracking-normal">Desktop</h2>
                <p className="mt-4 text-sm leading-7 text-black/55">
                  The reference surface for encrypted local-vault signing, guarded Jupiter Swap, Pump.fun Token Launch, Robinhood Chain swaps, and two-way Solana-Robinhood bridges. Other EVM chains are outside the active desktop product scope.
                </p>
              </div>
              <div className="border border-black/15 p-6 bg-white">
                <h2 className="font-serif text-3xl font-normal tracking-normal">Web</h2>
                <p className="mt-4 text-sm leading-7 text-black/55">
                  Uses the single connected browser wallet for approval. It does not collect a secret key and does not yet provide execution parity with every desktop venue.
                </p>
              </div>
            </div>
            <div className="lg:col-start-2 mt-4">
              <Link
                href="/trade"
                className="inline-flex items-center gap-3 bg-electric px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
              >
                Open Trade Workspace <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PageTransition>
  );
}

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">[{number}]</p>
      <h2 className="mt-3 font-serif text-3xl font-normal tracking-normal">{title}</h2>
    </div>
  );
}
