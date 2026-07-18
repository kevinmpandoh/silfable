import { ArrowDownToLine, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ReleaseHero() {
  return (
    <section className="border-b border-white/15 bg-ink text-paper">
      <div className="section-shell pb-20 pt-36 sm:pb-28 sm:pt-44 lg:pb-36">
        <div className="grid gap-14 lg:grid-cols-[1fr_0.65fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Linux preview</Badge>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Release pending</span>
            </div>
            <h1 className="mt-8 font-serif text-[clamp(4.5rem,11vw,11rem)] leading-[0.75] tracking-[-0.07em]">
              Silfable <em className="block pl-[8vw] text-electric">0.1.0</em>
            </h1>
          </div>
          <div className="border-t border-white/15 pt-7 lg:mb-2">
            <p className="text-lg leading-8 text-white/60">
              Safer mission recovery, faster policy compilation, and clearer proof for every rejected route.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-400" /> AppImage</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-400" /> Debian</span>
              <span>macOS & Windows: Coming soon</span>
            </div>
            <Button asChild size="lg" className="mt-9 w-full sm:w-auto">
              <a href="#downloads">Download for Linux <ArrowDownToLine className="ml-4 size-4" /></a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
