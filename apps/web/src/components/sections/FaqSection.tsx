import { ArrowUpRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "Can Silfable move funds without me?",
    answer:
      "No supported production flow moves funds silently. Restricted Mainnet actions require policy checks and explicit approval before signing or broadcast.",
  },
  {
    question: "Where do my private keys live?",
    answer:
      "On your machine or inside the wallet you connect. Silfable does not upload, store, or custody your private keys. Signing remains part of your local execution flow.",
  },
  {
    question: "Is Silfable a trading chatbot?",
    answer:
      "No. It is a trading workspace for agent-assisted missions. The agent can reason, draft, preview, and monitor, while production execution stays inside the policy envelope.",
  },
  {
    question: "What happens when a rule is violated?",
    answer:
      "The proposed action is halted locally and recorded in the mission receipt. Depending on your configuration, Silfable can notify you, pause the mission, or require fresh authorization before continuing.",
  },
  {
    question: "Which markets and operating systems are supported?",
    answer:
      "The current Mainnet path supports restricted Solana/Jupiter swaps. Pump.fun is preview-only on web, while bridge, EVM, Hyperliquid, autonomous signing, and Full Access remain planned.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-paper text-ink">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <div className="grid gap-14 lg:grid-cols-[0.72fr_1fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-electric">Questions / Answers</p>
            <h2 className="font-serif text-[clamp(3.8rem,7vw,7.8rem)] leading-[0.84] tracking-[-0.06em]">
              Read the <em className="text-electric">fine print.</em>
            </h2>
            <p className="mt-8 max-w-sm text-sm leading-7 text-black/50">
              Autonomy should be legible. These are the direct answers that matter before software touches a market.
            </p>
            <a
              href="#support"
              className="mt-8 inline-flex items-center gap-3 border-b border-black/30 pb-2 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:border-electric hover:text-electric"
            >
              Read documentation <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="border-t border-black/20">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`item-${index + 1}`}>
                  <AccordionTrigger className="gap-8 py-7 text-lg tracking-[-0.02em] sm:py-8 sm:text-xl">
                    <span className="flex items-start gap-5 sm:gap-8">
                      <span className="mt-1 font-mono text-[9px] tracking-[0.16em] text-black/30">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{faq.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="max-w-2xl pl-10 pr-8 text-base leading-8 sm:pl-16">
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
