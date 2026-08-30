import { ArrowDown, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { CURRENT_DESKTOP_RELEASE, LEGACY_SIGNED_WINDOWS_RELEASE } from "@/lib/desktop-releases";

export function ReleaseHero() {
  return (
    <section className="operatorReleaseHero border-b border-[var(--line)] text-paper">
      <div className="section-shell releaseConsoleHero">
        <CurrentReveal className="releaseConsoleHeroGrid grid gap-10 lg:grid-cols-[.72fr_1fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>v{CURRENT_DESKTOP_RELEASE.version} Release</Badge>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Windows & Linux Available</span>
            </div>
            <h1 className="releaseStamp mt-7 text-[clamp(3.6rem,7vw,7rem)] leading-[0.84] tracking-[-0.07em]">
              Changelog <em className="block">{CURRENT_DESKTOP_RELEASE.version}</em>
            </h1>
          </div>
          <div className="releaseConsoleSummary border-l border-white/15 pl-7 lg:mb-2">
            <p className="text-lg leading-8 text-white/60">
              Mirae {CURRENT_DESKTOP_RELEASE.version} brings Real-World Asset (RWA) institutional lending, refined desktop UX, and native Solana execution. Mirae {LEGACY_SIGNED_WINDOWS_RELEASE.version} remains available as an earlier Windows release option.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> Windows portable (.zip)</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> AppImage</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[var(--sc-ice)]" /> Debian</span>
              <span>macOS: Coming soon</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="solarPrimaryButton w-full sm:w-auto">
                <a href="#windows">
                  View v{CURRENT_DESKTOP_RELEASE.version} Downloads <ArrowDown className="ml-3 size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="outlineButton w-full sm:w-auto">
                <a href="#linux">
                  Linux & All Downloads <ArrowDown className="ml-3 size-4" />
                </a>
              </Button>
            </div>
          </div>
        </CurrentReveal>
      </div>
    </section>
  );
}
