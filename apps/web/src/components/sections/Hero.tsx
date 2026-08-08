"use client";

import { motion } from "framer-motion";
import { ArrowDownRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section id="top" className="heroAurora relative overflow-hidden">
      <div className="heroGrid pointer-events-none absolute inset-0" />
      <div className="heroOrb heroOrbOne pointer-events-none absolute" />
      <div className="heroOrb heroOrbTwo pointer-events-none absolute" />
      <div className="section-shell flex min-h-[44rem] flex-col justify-between py-16 sm:min-h-[48rem] sm:py-20 lg:min-h-[52rem] lg:py-24">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.12, delayChildren: 0.15 }}
          className="flex flex-1 flex-col justify-center"
        >
          <motion.p
            variants={reveal}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--blue-2)]"
          >
            Secure AI trading / Wallet-approved execution
          </motion.p>

          <motion.h1
            variants={reveal}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1200px] text-6xl font-bold leading-[0.92] tracking-[-0.07em] text-paper sm:text-8xl md:text-9xl xl:text-[8.15rem]"
          >
            TRADE WITH CLARITY.
            <span className="auroraText block sm:pl-14 lg:pl-24">APPROVE WITH CONTROL.</span>
          </motion.h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid gap-8 border-t border-[var(--line)] pt-8 lg:grid-cols-[1fr_auto] lg:items-end"
        >
          <div>
            <p className="max-w-md text-lg leading-relaxed text-[var(--paper)] sm:text-xl">
              AI can plan the move. Your wallet still makes the decision.
            </p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
              Swap, bridge, and automation proposals stay bound to your session, policy, and explicit wallet approval before any supported Mainnet action.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="auroraButton hover:!text-white">
              <Link href="/connect">
                Get started
                <ArrowDownRight className="ml-4 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" className="outlineButton">
              <a href="#docs" className="bg-transparent">
                Explore safety model
                <ArrowDownRight className="ml-4 size-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
