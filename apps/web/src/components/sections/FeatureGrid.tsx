"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Radar, Rocket, Route } from "lucide-react";

const features = [
  {
    eyebrow: "01 / Market context",
    title: "Discover",
    description: "Research tokens and market conditions, surface missing details, and turn an open-ended request into concrete inputs.",
    detail: "Research first",
    icon: Radar,
  },
  {
    eyebrow: "02 / Token creation",
    title: "Launch",
    description: "Prepare Pump.fun token metadata, economics, and creator details for an exact final review before publishing on Mainnet.",
    detail: "Exact metadata",
    icon: Rocket,
  },
  {
    eyebrow: "03 / Market execution",
    title: "Swap",
    description: "Prepare Jupiter swaps on Solana or supported Robinhood Chain swaps with fresh pricing, route details, and transaction limits.",
    detail: "Fresh route data",
    icon: ArrowLeftRight,
  },
  {
    eyebrow: "04 / Cross-chain flow",
    title: "Bridge",
    description: "Move between Solana USDC and Robinhood USDG through supported two-way routes, with source and destination progress tracked separately.",
    detail: "Track both sides",
    icon: Route,
  },
];

export function FeatureGrid() {
  return (
    <section className="border-y border-[var(--line)] bg-[var(--ink)] text-paper">
      <div className="section-shell py-24 sm:py-32 lg:py-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 grid gap-7 lg:mb-20 lg:grid-cols-[1fr_0.7fr] lg:items-end"
        >
          <h2 className="max-w-4xl text-[clamp(3rem,6vw,6.5rem)] font-bold leading-[0.9] tracking-[-0.06em]">
            Four workflows.<br />One <em className="text-electric">workspace.</em>
          </h2>
          <p className="max-w-lg text-sm leading-7 text-white/50 lg:justify-self-end">
            Start with the outcome you want. Silfable organizes the research, route details, confirmation, and transaction status around it.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
          transition={{ staggerChildren: 0.1 }}
          className="grid border-t border-l border-white/20 md:grid-cols-2"
        >
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <motion.article
                key={feature.title}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="group flex min-h-[25rem] flex-col border-r border-b border-white/20 p-7 transition-colors duration-500 hover:bg-white/[0.035] sm:p-10 lg:min-h-[31rem] lg:p-12"
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                    {feature.eyebrow}
                  </p>
                  <Icon className="size-5 text-electric" strokeWidth={1.4} />
                </div>

                <div className="mt-auto pt-24">
                  <h3 className="text-[clamp(4rem,7vw,7.5rem)] font-bold leading-none tracking-[-0.07em] transition-transform duration-500 group-hover:translate-x-2">
                    {feature.title}
                  </h3>
                  <div className="mt-8 grid gap-6 border-t border-white/15 pt-6 xl:grid-cols-[1fr_auto] xl:items-end">
                    <p className="max-w-md text-sm leading-7 text-white/55">{feature.description}</p>
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-electric">
                      {feature.detail}
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
