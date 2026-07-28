import { ArrowDownToLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const releases = [
  {
    version: "0.1.0",
    date: "Linux preview",
    status: "Preview",
    summary: "Restricted Mainnet foundation",
    added: ["Linux AppImage and Debian preview builds", "Solana Mainnet wallet onboarding", "Encrypted local session and receipt storage"],
    changed: ["Jupiter swaps require deterministic checks and explicit approval", "Pump.fun is defined as Token Launch, not generic auto-trading", "EVM and Bridge states are shown without implying production clearance"],
    fixed: ["Fail-closed provider and policy handling", "Desktop privilege-boundary audits", "Linux package compatibility checks"],
  },
] as const;

export function ReleaseHistory() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mb-14 grid gap-7 border-b border-black/20 pb-10 lg:grid-cols-[1fr_0.6fr] lg:items-end">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">Release timeline</p>
          <h2 className="mt-5 font-serif text-5xl tracking-[-0.05em] sm:text-7xl">Version history</h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-black/50 lg:justify-self-end">The current preview milestone, with Linux available first and more desktop platforms planned.</p>
      </div>

      <div className="relative space-y-10 before:absolute before:bottom-0 before:left-[7px] before:top-0 before:w-px before:bg-black/20 sm:before:left-[10.5rem]">
        {releases.map((release) => (
          <article key={release.version} className="relative grid gap-5 pl-10 sm:grid-cols-[9rem_1fr] sm:gap-12 sm:pl-0">
            <span className="absolute left-0 top-8 size-[15px] rounded-full border-4 border-paper bg-electric sm:left-[10.05rem]" />
            <div className="pt-7">
              <p className="font-mono text-2xl tracking-[-0.05em] text-electric">v{release.version}</p>
              <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.15em] text-black/30">{release.date}</p>
            </div>

            <Card className="border-black/15 bg-white text-ink">
              <CardHeader className="border-b border-black/10 p-7 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-serif text-3xl tracking-[-0.04em] sm:text-4xl">{release.summary}</h3>
                  <Badge className="border-blue-200 bg-blue-50 text-electric">{release.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-7 sm:p-9">
                <div className="grid gap-8 md:grid-cols-3">
                  <ChangeList title="Added" items={release.added} />
                  <ChangeList title="Changed" items={release.changed} />
                  <ChangeList title="Fixed" items={release.fixed} />
                </div>
                <div className="mt-9 border-t border-black/10 pt-7">
                  <Button asChild variant="blue">
                    <a href="#downloads" aria-label={`View downloads for Silfable version ${release.version}`}>
                      Download v{release.version} <ArrowDownToLine className="ml-3 size-3.5" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChangeList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.17em] text-black/35">{title}</p>
      <ul className="space-y-3">
        {items.map((item) => <li key={item} className="border-l border-black/15 pl-4 text-xs leading-6 text-black/50">{item}</li>)}
      </ul>
    </div>
  );
}
