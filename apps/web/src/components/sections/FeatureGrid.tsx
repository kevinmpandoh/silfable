"use client";

import { motion } from "framer-motion";
import { Bot, Crosshair, LockKeyhole, Maximize2 } from "lucide-react";

const features = [
  {
    eyebrow: "01 / The worker",
    title: "Agent",
    description: "An AI assistant that researches, asks for missing values, and drafts typed proposals. It does not receive signing authority.",
    detail: "Drafts proposals",
    icon: Bot,
  },
  {
    eyebrow: "02 / The objective",
    title: "Mission",
    description: "A wallet-scoped objective with an explicit outcome. Supported Mainnet actions remain bound to deterministic venue policy.",
    detail: "Wallet scoped",
    icon: Crosshair,
  },
  {
    eyebrow: "03 / Default posture",
    title: "Restricted",
    description: "Every mission starts inside a hard safety envelope: approved markets, maximum size, allowed actions, and stop conditions.",
    detail: "Deny by default",
    icon: LockKeyhole,
  },
  {
    eyebrow: "04 / Your decision",
    title: "Full",
    description: "Reserved for future policy contracts. Today, production Mainnet flows stay restricted and require explicit approval.",
    detail: "Not live yet",
    icon: Maximize2,
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
            Intelligence is not transaction <em className="text-electric">authority.</em>
          </h2>
          <p className="max-w-lg text-sm leading-7 text-white/50 lg:justify-self-end">
            Silfable separates who is acting, what they are trying to achieve, and exactly how much authority they receive.
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
