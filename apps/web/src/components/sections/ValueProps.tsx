"use client";

import { CheckCircle2, Fingerprint, WalletCards } from "lucide-react";
import { motion } from "framer-motion";

const safeguards = [
  {
    step: "01",
    icon: CheckCircle2,
    eyebrow: "Exact inputs",
    title: "Know what will be sent",
    text: "Review the wallet, asset, amount, route, fees, and expected result together before a transaction reaches confirmation.",
  },
  {
    step: "02",
    icon: Fingerprint,
    eyebrow: "Visible progress",
    title: "Follow every stage",
    text: "Quotes, simulations, confirmations, broadcasts, and final outcomes remain distinct, so you can see exactly how far an action has progressed.",
  },
  {
    step: "03",
    icon: WalletCards,
    eyebrow: "Two surfaces",
    title: "Use web or desktop",
    text: "Confirm with a connected browser wallet on web, or use the encrypted local vault in the desktop app for supported workflows.",
  },
];

const reveal = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export function ValueProps() {
  return (
    <section id="docs" className="relative overflow-hidden border-y border-[var(--line)] bg-[var(--ink)] text-[var(--paper)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_60%,rgb(32_201_151_/_0.11),transparent_25rem),radial-gradient(circle_at_90%_15%,rgb(98_217_223_/_0.08),transparent_22rem)]" />
      <div className="section-shell relative py-24 sm:py-32 lg:py-40">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={{ staggerChildren: 0.1 }}>
          <motion.p variants={reveal} transition={{ duration: 0.55 }} className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--blue-2)]">
            From request to transaction record
          </motion.p>
          <motion.div variants={reveal} transition={{ duration: 0.7 }} className="mt-5 grid gap-6 border-b border-[var(--line)] pb-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
            <h2 className="max-w-4xl text-[clamp(3rem,6.5vw,6.75rem)] font-bold leading-[0.93] tracking-[-0.065em]">
              See the route.<br /><span className="auroraText">Understand the outcome.</span>
            </h2>
            <p className="max-w-md text-base leading-7 text-[var(--muted)] lg:pb-1">
              Silfable brings market research, transaction preparation, wallet confirmation, and settlement tracking into one readable workflow.
            </p>
          </motion.div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={{ staggerChildren: 0.1 }} className="mt-10 grid gap-4 lg:grid-cols-3">
          {safeguards.map(({ step, icon: Icon, eyebrow, title, text }) => (
            <motion.article key={step} variants={reveal} transition={{ duration: 0.55 }} className="group rounded-2xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_88%,transparent)] p-6 transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--electric)_60%,var(--line))] hover:shadow-[0_18px_48px_rgb(17_213_171_/_0.10)] sm:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--blue-2)]">{step}</span>
                <span className="grid size-10 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--electric)_30%,transparent)] bg-[color-mix(in_srgb,var(--electric)_10%,transparent)] text-[var(--electric)]"><Icon className="size-4" /></span>
              </div>
              <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--blue-2)]">{eyebrow}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{text}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
