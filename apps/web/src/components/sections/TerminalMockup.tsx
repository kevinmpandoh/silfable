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
              Product view / Desktop workspace
            </p>
            <h2 className="text-[clamp(3.2rem,6.2vw,6.8rem)] font-bold leading-[0.9] tracking-[-0.065em]">
              The whole trade,<br /><em className="text-electric">in view.</em>
            </h2>
          </div>
          <p className="max-w-xl text-base leading-8 text-white/55 lg:justify-self-end">
            Move from conversation to a typed transaction preview without jumping between disconnected tools. Silfable keeps wallet context, route checks, limits, and final status together for supported Jupiter swaps, Pump.fun launches, Robinhood swaps, and two-way Solana–Robinhood bridges.
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
            src="/hero-app.png"
            alt="Silfable Desktop Application Interface"
            width={1920}
            height={1080}
            className="w-full object-cover"
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
