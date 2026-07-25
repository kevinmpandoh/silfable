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
    "Silfable whitepaper covering the restricted Mainnet architecture, current execution scope, web and desktop differences, and Pump.fun roadmap.",
};

const statusRows = [
  ["Live", "Restricted Jupiter swap", "Solana Mainnet swap preview, deterministic simulation, wallet approval, broadcast, and verified receipt generation."],
  ["Live", "24/7 Autonomous Cloud Worker", "Background AI trading via distributed task queues with zero-click Mainnet signing within bounded risk limits."],
  ["Live", "Centralized State Sync", "User settings, active sessions, and trading histories synced across high-availability Cloud Storage for persistent cross-platform access."],
  ["Live", "Pump.fun Guarded Trading", "Autonomous and manual Pump.fun bonding-curve trading guarded by live Fee Guards, Slippage Validation, and Receipt Reconciliation."],
  ["Planned", "Cross-Chain EVM", "Layer-2 EVM bridging, execution, and Hyperliquid integrations remain in the planning phase."],
] as const;

const principles = [
  {
    icon: ShieldCheck,
    title: "Secure Ephemeral Vaults",
    text: "Web autonomous trading uses strictly isolated, AES-256 encrypted keypairs per session. Your main wallet's seed phrase is never requested.",
  },
  {
    icon: LockKeyhole,
    title: "Dual-Mode Execution",
    text: "Choose between 'Restricted Mode' (Phantom wallet pop-up approval) or 'Full Access 24/7 Mode' (Autonomous server execution with drawdown limits).",
  },
  {
    icon: CheckCircle2,
    title: "Persistent Memory",
    text: "With enterprise cloud storage and distributed task queues, your AI agents never sleep. They remember past context and operate 24/7 even when your browser is closed.",
  },
  {
    icon: TriangleAlert,
    title: "Automated Kill Switch",
    text: "Full access sessions run with hard-coded max drawdown limits. If breached, the AI revokes its own keys to fail safely.",
  },
] as const;

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-black/15 pt-36">
        <div className="section-shell pb-20 sm:pb-28">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Whitepaper / v0.2.0</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.48fr] lg:items-end">
            <h1 className="max-w-5xl font-serif text-6xl font-normal leading-[0.9] tracking-normal sm:text-7xl lg:text-8xl">
              Guarded AI trading for Solana Mainnet.
            </h1>
            <p className="max-w-lg text-base leading-8 text-black/55 lg:justify-self-end">
              An early-stage, open-source, Solana-first project exploring how AI agents, human users, zero-click autonomous cloud workers, and deterministic security boundaries can coordinate through a modular execution environment.
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
              This document describes its current architecture, live components, development principles, security models, and roadmap. Some components described in this document are already represented in production-ready Solana Mainnet execution via Jupiter Swap. Other components remain planned, experimental, or dependent on future technical and security development.
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
              <li><strong>Ephemeral Vault Architecture:</strong> Zero-click autonomous trading uses strictly isolated, AES-256 encrypted keypairs that live only for the duration of a session.</li>
              <li><strong>Transparent Execution Receipts:</strong> Every quote, simulation, confirmation, rejection, and failure should be readable, verified on-chain, and persistently synced via encrypted cloud database.</li>
              <li><strong>Dual-Mode Execution:</strong> Users can choose between Restricted Mode (traditional browser-wallet approval) or Full Access Mode (24/7 autonomous cloud execution).</li>
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
              <p>&gt; "Monitor the Solana mempool for trending tokens under $10M market cap and propose a $10 DCA entry."</p>
              <p>&gt; "Execute a swap from USDC to SOL, ensuring slippage does not exceed 1%."</p>
            </div>
            <p>Silfable aims to perfectly coordinate the human requester, the AI intelligence provider (LLM), the deterministic policy engine, the ephemeral wallet, the Solana program, and the resulting receipt.</p>
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
                <p className="text-sm leading-6 text-black/60">A high-availability cloud database that stores user preferences, chat session history, execution receipts, and AES-256-GCM encrypted Ephemeral Vault keys.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <ServerCrash className="size-6 text-electric shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-serif text-xl mb-1">High-Throughput Task Queue</h3>
                <p className="text-sm leading-6 text-black/60">An in-memory event and task queue that bridges the Web Client and the Cloud Worker for 24/7 autonomous monitoring intents.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <BrainCircuit className="size-6 text-electric shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-serif text-xl mb-1">The Cloud Worker Daemon</h3>
                <p className="text-sm leading-6 text-black/60">A persistent cloud worker operating continuously. It pulls intents from the message queue, builds Solana transactions, decrypts the session's Ephemeral Vault in memory, signs the transaction, and broadcasts to Mainnet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/15 bg-black/[0.02]">
        <div className="section-shell grid gap-10 py-16 lg:grid-cols-[18rem_1fr] lg:py-20">
          <SectionLabel number="07" title="Pump.fun Roadmap" />
          <div>
            <p className="max-w-3xl text-lg leading-8 text-black/60">
              Pump.fun introduces unique risks due to extreme volatility, frequent rug-pulls, and custom bonding-curve smart contracts. Live execution remains in preview until the following gates are met.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ["Preview", "Token discovery, mint validation, spend limits, take profit, stop loss, and DCA settings."],
                ["Guard", "Program allowlist, transaction inspection, fee ceiling, slippage bounds, rent visibility, and route freshness."],
                ["Execute", "Explicit final approval, wallet-adapter signing, broadcast reconciliation, and persisted success or failure receipt."],
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
                Best for local vault workflows, encrypted receipts, main setup, and stricter machine-level control. It is the reference surface for production hardening.
              </p>
            </div>
            <div className="border border-black/15 p-6 bg-white">
              <h2 className="font-serif text-3xl font-normal tracking-normal">Web</h2>
              <p className="mt-4 text-sm leading-7 text-black/55">
                Best for 24/7 Cloud Worker execution, cloud state synchronization, and shared UI parity. It supports full Ephemeral Vault autonomous execution today.
              </p>
            </div>
          </div>
          <div className="lg:col-start-2 mt-4">
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
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">[{number}]</p>
      <h2 className="mt-3 font-serif text-3xl font-normal tracking-normal">{title}</h2>
    </div>
  );
}
