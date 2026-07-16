"use client";

import { motion } from "framer-motion";

const articles = [
  {
    number: "I",
    title: "Enforce",
    statement: (
      <>
        Every action passes through <em className="font-serif text-electric">your rules</em> before it reaches the market.
      </>
    ),
  },
  {
    number: "II",
    title: "Prove",
    statement: (
      <>
        Every decision leaves <em className="font-serif text-electric">a receipt</em> you can inspect, replay, and verify.
      </>
    ),
  },
  {
    number: "III",
    title: "Local",
    statement: (
      <>
        Your keys and strategy stay <em className="font-serif text-electric">on your machine</em>, not ours.
      </>
    ),
  },
];

const reveal = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

export function ValueProps() {
  return (
    <section id="docs" className="bg-paper text-ink">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.1 }}
        >
          <motion.div
            variants={reveal}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-14 flex items-center gap-4 border-b border-black/15 pb-5 sm:mb-20"
          >
            <span className="size-2 rounded-full bg-electric" />
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/50">
              A runtime, not a conversation
            </p>
          </motion.div>

          <motion.h2
            variants={reveal}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1320px] font-serif text-[clamp(3.1rem,7.1vw,7.6rem)] leading-[0.96] font-normal tracking-[-0.055em]"
          >
            Not a chatbot. A desktop runtime that runs missions against real markets, inside boundaries you define.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.12 }}
          className="mt-24 border-t border-black/20 lg:mt-36"
        >
          {articles.map((article) => (
            <motion.article
              key={article.number}
              variants={reveal}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-5 border-b border-black/20 py-8 sm:grid-cols-[8rem_1fr] sm:py-10 lg:grid-cols-[12rem_18rem_1fr] lg:items-baseline"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/40">
                Article {article.number}
              </p>
              <h3 className="font-serif text-3xl tracking-[-0.04em] sm:text-4xl">{article.title}</h3>
              <p className="max-w-2xl text-base leading-7 text-black/65 sm:text-lg sm:leading-8 lg:justify-self-end">
                {article.statement}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
