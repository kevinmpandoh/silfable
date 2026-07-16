"use client";

import { motion } from "framer-motion";
import { Activity, Check, ChevronRight, Circle, Command, ShieldCheck, TerminalSquare } from "lucide-react";

const ruleLines = [
  ["01", "mission", "rebalance_silf_usdc"],
  ["02", "market", "SOL / USDC"],
  ["03", "max_position", "$2,500.00"],
  ["04", "max_slippage", "0.40%"],
  ["05", "daily_loss", "-$180.00"],
  ["06", "require", "verified_liquidity"],
  ["07", "on_violation", "HALT + NOTIFY"],
];

const logLines = [
  { time: "09:42:08", state: "SCAN", text: "Evaluating 18 available routes" },
  { time: "09:42:09", state: "PASS", text: "Liquidity threshold verified" },
  { time: "09:42:09", state: "PASS", text: "Position within Desk Rule" },
  { time: "09:42:10", state: "SIGN", text: "Awaiting local authorization" },
];

export function TerminalMockup() {
  return (
    <section className="overflow-hidden bg-paper text-ink">
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
            <h2 className="font-serif text-[clamp(3.2rem,6.2vw,6.8rem)] leading-[0.9] tracking-[-0.055em]">
              Rules the agent <em className="text-electric">cannot</em> negotiate.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-8 text-black/55 lg:justify-self-end">
            Define the operating envelope once. Every proposed trade is checked locally before signing, with a readable receipt for every pass or rejection.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 36 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[1.25rem] border border-blue-950/50 bg-[#07101f] text-slate-200 ring-1 ring-black/10 sm:rounded-[1.75rem]"
        >
          <div className="flex h-14 items-center border-b border-white/10 bg-[#0a1425] px-4 sm:px-6">
            <div className="flex gap-2" aria-hidden="true">
              <Circle className="size-2.5 fill-[#ff6258] text-[#ff6258]" />
              <Circle className="size-2.5 fill-[#ffbd2e] text-[#ffbd2e]" />
              <Circle className="size-2.5 fill-[#28c840] text-[#28c840]" />
            </div>
            <div className="mx-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500 sm:text-[10px]">
              <Command className="size-3" />
              Silfable / Mission Control
            </div>
            <span className="hidden items-center gap-2 font-mono text-[9px] text-emerald-400 sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Local
            </span>
          </div>

          <div className="grid min-h-[43rem] lg:grid-cols-[13rem_1fr] xl:grid-cols-[15rem_1fr]">
            <aside className="hidden border-r border-white/10 bg-[#08111f] p-4 lg:flex lg:flex-col">
              <p className="px-3 pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Workspace</p>
              <nav className="mt-5 space-y-1 text-xs">
                <div className="flex items-center gap-3 rounded-md bg-blue-500/10 px-3 py-3 text-blue-300">
                  <ShieldCheck className="size-4" /> Desk Rule
                </div>
                <div className="flex items-center gap-3 px-3 py-3 text-slate-500">
                  <Activity className="size-4" /> Mission
                </div>
                <div className="flex items-center gap-3 px-3 py-3 text-slate-500">
                  <TerminalSquare className="size-4" /> Receipts
                </div>
              </nav>

              <div className="mt-auto border-t border-white/10 px-3 pt-5">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  <span>Runtime</span>
                  <span className="text-emerald-400">Healthy</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-[72%] bg-blue-500" />
                </div>
              </div>
            </aside>

            <div className="grid min-w-0 xl:grid-rows-[1fr_15rem]">
              <div className="grid min-w-0 xl:grid-cols-[1fr_19rem]">
                <div className="min-w-0 border-b border-white/10 xl:border-r xl:border-b-0">
                  <div className="flex h-12 items-center justify-between border-b border-white/10 px-5 sm:px-7">
                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                      <ShieldCheck className="size-3.5 text-blue-400" /> desk-rule.silf
                    </div>
                    <span className="font-mono text-[9px] text-slate-600">Saved 09:41:52</span>
                  </div>

                  <div className="overflow-x-auto px-4 py-7 font-mono text-[11px] leading-8 sm:px-7 sm:text-xs sm:leading-9">
                    <p className="mb-4 text-slate-600"># Hard limits for autonomous execution</p>
                    {ruleLines.map(([number, key, value]) => (
                      <div key={number} className="grid min-w-[31rem] grid-cols-[2rem_9rem_1rem_1fr] sm:grid-cols-[2.5rem_11rem_1.5rem_1fr]">
                        <span className="select-none text-slate-700">{number}</span>
                        <span className="text-sky-400">{key}</span>
                        <span className="text-slate-600">:</span>
                        <span className={value.includes("HALT") ? "text-amber-300" : "text-emerald-300"}>&quot;{value}&quot;</span>
                      </div>
                    ))}
                    <div className="mt-5 flex min-w-[31rem] items-center gap-3 border-t border-white/5 pt-5 text-[10px] text-emerald-400">
                      <Check className="size-3.5" /> Policy compiled — 7 rules active
                    </div>
                  </div>
                </div>

                <aside className="p-5 sm:p-7">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Policy status</p>
                  <div className="mt-6 flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/5">
                    <ShieldCheck className="size-7 text-emerald-400" strokeWidth={1.4} />
                  </div>
                  <p className="mt-5 text-xl font-medium text-white">Protected</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">All execution paths are currently gated by Desk Rule.</p>

                  <div className="mt-8 space-y-4 border-t border-white/10 pt-6 font-mono text-[9px] uppercase tracking-[0.14em]">
                    <div className="flex justify-between text-slate-600"><span>Authority</span><span className="text-blue-300">Restricted</span></div>
                    <div className="flex justify-between text-slate-600"><span>Signer</span><span className="text-slate-300">Local</span></div>
                    <div className="flex justify-between text-slate-600"><span>Network</span><span className="text-slate-300">Solana</span></div>
                  </div>
                </aside>
              </div>

              <div className="border-t border-white/10 bg-[#050c17]">
                <div className="flex h-11 items-center gap-3 border-b border-white/10 px-5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600 sm:px-7">
                  <TerminalSquare className="size-3.5" /> Execution log
                </div>
                <div className="overflow-x-auto px-5 py-4 font-mono text-[10px] leading-7 sm:px-7">
                  {logLines.map((line, index) => (
                    <div key={`${line.time}-${line.state}-${index}`} className="grid min-w-[32rem] grid-cols-[5.5rem_4rem_1fr]">
                      <span className="text-slate-700">{line.time}</span>
                      <span className={line.state === "PASS" ? "text-emerald-400" : line.state === "SIGN" ? "text-amber-300" : "text-blue-400"}>
                        {line.state}
                      </span>
                      <span className="flex items-center gap-2 text-slate-400"><ChevronRight className="size-3" />{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
