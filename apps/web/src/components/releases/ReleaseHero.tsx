import { ArrowDownToLine, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrentReveal } from "@/components/motion/CurrentMotion";

export function ReleaseHero() {
  return (
    <section className="operatorReleaseHero border-b border-[var(--line)] text-paper">
      <div className="section-shell releaseConsoleHero">
        <CurrentReveal className="releaseConsoleHeroGrid grid gap-10 lg:grid-cols-[.72fr_1fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>v0.2.0 Release</Badge>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Windows & Linux Available</span>
            </div>
            <h1 className="releaseStamp mt-7 text-[clamp(3.6rem,7vw,7rem)] leading-[0.84] tracking-[-0.07em]">
              Changelog <em className="block">0.1.0</em>
            </h1>
          </div>
          <div className="releaseConsoleSummary border-l border-white/15 pl-7 lg:mb-2">
            <p className="text-lg leading-8 text-white/60">
              Mirae 0.1.0 is the official desktop release for Windows and Linux: a Solana-first workspace for Jupiter swaps, Tokenized Stocks, Pump.fun launches, portfolio visibility, and wallet-reviewed automation. Connected EVM routes remain available as a secondary network path.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> Windows (.exe)</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> AppImage</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> Debian</span>
              <span>macOS: Coming soon</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="solarPrimaryButton w-full sm:w-auto">
                <a href="https://github.com/mirae-trade/mirae/releases/download/v0.2.0/Mirae-0.2.0-windows-x64-setup.exe" download>
                  Download for Windows <ArrowDownToLine className="ml-3 size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="outlineButton w-full sm:w-auto">
                <a href="#downloads">
                  Linux & All Downloads <ArrowDownToLine className="ml-3 size-4" />
                </a>
              </Button>
            </div>
          </div>
        </CurrentReveal>
      </div>
    </section>
  );
}
