"use client";

import { motion } from "framer-motion";
import { ArrowDownRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen overflow-hidden border-b border-white/15 bg-ink pt-20">
      <div className="pointer-events-none absolute inset-y-0 right-[24%] hidden w-px bg-white/10 xl:block" />
      <div className="section-shell flex flex-1 flex-col justify-between py-12 sm:py-16 lg:py-20">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.12, delayChildren: 0.15 }}
          className="flex flex-1 flex-col justify-center"
        >
          <motion.p
            variants={reveal}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45"
          >
            Autonomous execution / Human-defined limits
          </motion.p>

          <motion.h1
            variants={reveal}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1350px] font-serif text-[clamp(4.2rem,10.3vw,10.5rem)] leading-[0.78] font-normal tracking-[-0.065em] text-paper"
          >
            STOP BABYSITTING
            <span className="block pl-[7vw] italic text-electric">EVERY TRADE.</span>
          </motion.h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid gap-8 border-t border-white/15 pt-8 lg:grid-cols-[1fr_auto] lg:items-end"
        >
          <div>
            <p className="max-w-md text-lg leading-relaxed text-white/65 sm:text-xl">
              The safety gate never clocks out.
            </p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/35">
              Give your agent a mission. Silfable enforces the rules, records the proof, and keeps execution local.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="#download">
                Download for Linux
                <ArrowDownRight className="ml-4 size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#token">Buy $SILF</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
