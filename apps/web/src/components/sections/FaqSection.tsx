import { ArrowUpRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "What can I do in Silfable today?",
    answer:
      "Supported workflows include Jupiter swaps, Pump.fun Token Launch, Robinhood Chain swaps, two-way Solana–Robinhood bridges, and reviewed DCA or TP/SL actions. Availability differs between web and desktop.",
  },
  {
    question: "How does signing differ between web and desktop?",
    answer:
      "Web transactions are confirmed in the connected browser wallet. Desktop can sign supported transactions through its encrypted local vault. Silfable does not ask you to upload a seed phrase to the web service.",
  },
  {
    question: "What will I see before confirming a transaction?",
    answer:
      "The review depends on the workflow, but includes the source wallet, network, exact assets, amount, expected output, route, fees, timing, and the checks required for that venue.",
  },
  {
    question: "What happens when route data is incomplete or out of date?",
    answer:
      "Silfable stops the action and explains which input needs attention. You may need to refresh the quote, correct the wallet or asset, adjust a limit, or start a new review before continuing.",
  },
  {
    question: "Which networks and desktop platforms are supported?",
    answer:
      "Desktop and web contain guarded Jupiter swaps, restricted Pump.fun Token Launch paths, Robinhood Chain swaps, and two-way Solana-USDC/Robinhood-USDG bridge flows. Every web transaction uses explicit browser-wallet approval. Other EVM chains, Hyperliquid, autonomous signing, and unattended Full Access are outside the active production scope.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-[#070a16] text-[#eef2ff]">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <div className="grid gap-14 lg:grid-cols-[0.72fr_1fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-electric">Questions / Answers</p>
            <h2 className="font-serif text-[clamp(3.8rem,7vw,7.8rem)] leading-[0.84] tracking-[-0.06em]">
              Know before<br /><em className="text-electric">you connect.</em>
            </h2>
            <p className="mt-8 max-w-sm text-sm leading-7 text-white/50">
              Practical answers about available workflows, wallet confirmation, route reviews, and current platform coverage.
            </p>
            <a
              href="/docs"
              className="mt-8 inline-flex items-center gap-3 border-b border-white/30 pb-2 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:border-electric hover:text-electric"
            >
              Read documentation <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="border-t border-white/15">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`item-${index + 1}`}>
                  <AccordionTrigger className="gap-8 py-7 text-lg tracking-[-0.02em] sm:py-8 sm:text-xl">
                    <span className="flex items-start gap-5 sm:gap-8">
                      <span className="mt-1 font-mono text-[9px] tracking-[0.16em] text-white/30">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{faq.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="max-w-2xl pl-10 pr-8 text-base leading-8 text-white/60 sm:pl-16">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
