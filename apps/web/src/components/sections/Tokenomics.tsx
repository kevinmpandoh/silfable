"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const CONTRACT_ADDRESS = "SiLF7Yp4mX9q2Kf8Nz6Ea3Vb1Ru5TcWd8Hs0JgQnLk2";

const tokenFacts = [
  { label: "Network", value: "Solana" },
  { label: "Ticker", value: "$SILF" },
  { label: "Supply", value: "1.00B" },
];

export function Tokenomics() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyContract() {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = CONTRACT_ADDRESS;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopied(true);
  }

  return (
    <section id="token" className="overflow-hidden border-y border-white/15 bg-ink text-paper">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-10 border-b border-white/15 pb-16 lg:grid-cols-[1fr_0.8fr] lg:items-end lg:pb-24"
        >
          <div>
            <Badge>Utility, not access</Badge>
            <h2 className="mt-8 max-w-4xl font-serif text-[clamp(3.4rem,6.9vw,7.6rem)] leading-[0.88] tracking-[-0.06em]">
              THE APP IS THE PRODUCT.
            </h2>
          </div>
          <p className="max-w-xl font-serif text-3xl leading-tight tracking-[-0.035em] text-white/60 sm:text-4xl lg:justify-self-end">
            The token powers <em className="text-electric">the network.</em>
          </p>
        </motion.div>

        <div className="grid border-b border-white/15 py-16 lg:grid-cols-[1fr_auto] lg:items-end lg:py-24">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">Current market price</p>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 font-mono text-[clamp(3.8rem,11vw,11rem)] leading-none tracking-[-0.075em] text-electric"
            >
              $0.006198
            </motion.p>
          </div>
          <div className="mt-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.17em] lg:mb-3 lg:mt-0">
            <span className="text-red-400">−27.56%</span>
            <span className="text-white/30">24h</span>
            <Badge variant="outline">Static preview</Badge>
          </div>
        </div>

        <div className="grid gap-8 pt-16 lg:grid-cols-[1.25fr_0.75fr] lg:pt-24">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-white/10 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">Smart contract</p>
                <Badge variant="outline">Verified</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <button
                type="button"
                onClick={copyContract}
                className="group flex w-full items-center justify-between gap-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                aria-label="Copy smart contract address"
              >
                <span className="min-w-0 break-all font-mono text-sm leading-7 text-blue-300 sm:text-lg">
                  {CONTRACT_ADDRESS}
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center border border-white/20 text-white/55 transition-colors group-hover:border-electric group-hover:text-electric">
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </span>
              </button>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
                <span aria-live="polite">{copied ? "Copied to clipboard" : "Click address to copy"}</span>
                <a href="#explorer" className="flex items-center gap-2 transition-colors hover:text-electric">
                  Explorer <ExternalLink className="size-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 border-t border-l border-white/15 lg:grid-cols-1">
            {tokenFacts.map((fact) => (
              <div key={fact.label} className="border-r border-b border-white/15 p-5 sm:p-7 lg:flex lg:items-end lg:justify-between">
                <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-white/30 sm:text-[9px]">{fact.label}</p>
                <p className="mt-3 font-mono text-sm text-white/80 sm:text-base lg:mt-0">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
