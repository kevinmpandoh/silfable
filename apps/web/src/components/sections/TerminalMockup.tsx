"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function TerminalMockup() {
  return (
    <section className="overflow-hidden bg-[var(--ink)] text-[var(--paper)]">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 grid gap-8 lg:mb-20 lg:grid-cols-[0.8fr_1fr] lg:items-end"
        >
          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-electric">
              Desk Rule / Local policy engine
            </p>
            <h2 className="text-[clamp(3.2rem,6.2vw,6.8rem)] font-bold leading-[0.9] tracking-[-0.065em]">
              Rules the agent <em className="text-electric">cannot</em> negotiate.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-8 text-white/55 lg:justify-self-end">
            Define the operating envelope once. Every proposed trade is checked locally before signing, with a readable receipt for every pass or rejection.
            Controlled Mainnet acceptance is recorded per lane: Jupiter swaps, Pump.fun Token Launch, Robinhood swaps, and two-way Solana-Robinhood bridges. It is not blanket approval for other routes or assets.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 36 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[1.25rem] border border-emerald-300/20 bg-[var(--panel)] shadow-[0_26px_90px_rgb(0_0_0_/_0.35)] sm:rounded-[1.75rem]"
        >
          <Image
            src="/ss1.png"
            alt="Silfable Desktop Application Interface"
            width={1920}
            height={1080}
            className="emeraldMockup w-full object-cover"
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
