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
    <section id="top" className="relative flex min-h-screen overflow-hidden border-b border-white/15 bg-ink pt-20">
      <div className="pointer-events-none absolute inset-y-0 right-[24%] hidden w-px bg-white/10 xl:block" />
      <div className="section-shell flex min-h-[calc(100vh-5rem)] flex-col justify-between py-14 sm:py-18 lg:py-20">
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
            Agentic planning / Human-defined limits
          </motion.p>

          <motion.h1
            variants={reveal}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1480px] font-serif text-7xl font-normal leading-[0.84] tracking-normal text-paper sm:text-8xl md:text-9xl xl:text-[8.4rem] 2xl:text-[9rem]"
          >
            STOP BABYSITTING
            <span className="block italic text-electric sm:pl-16 lg:pl-28">EVERY TRADE.</span>
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
              Mainnet actions stay gated.
            </p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/35">
              Give the agent a mission. Silfable checks policy, records evidence, and asks for approval before any supported transaction.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="hover:!text-white">
              <Link href="/connect">
                Get started
                <ArrowDownRight className="ml-4 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg">
              <a href="#download" className="border border-white/30 bg-transparent text-white hover:bg-white hover:!text-black">
                Download desktop app
                <ArrowDownRight className="ml-4 size-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
