import { ArrowDownToLine } from "lucide-react";

import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const releases = [{
  version: "0.2.0",
  date: "Perpetuals Release",
  status: "Latest",
  summary: "Guarded Solana Perpetuals & Market Workspace",
  added: [
    "Solana perpetuals market workspace with live charts",
    "Long, Short, and reduce-only Close review flows",
    "Collateral, free collateral, health, and open-position visibility",
    "Deterministic preflight checks before wallet confirmation",
  ],
  changed: [
    "Perpetual actions can be reviewed directly inside the market panel",
    "Managed provider defaults make first-run desktop setup optional",
    "Release downloads distinguish current and legacy builds",
  ],
  fixed: [
    "Perpetual preflight session validation",
    "Market-data rate-limit fallback and candle loading",
    "Tokenized-asset portfolio metadata resolution",
  ],
  windowsHref: null,
  releaseHref: "https://github.com/mirae-trade/mirae/releases/tag/v0.2.0",
}, {
  version: "0.1.0",
  date: "Windows & Linux Release",
  status: "Official",
  summary: "Multi-network execution foundation & Desktop Runtime",
  added: [
    "Windows x64 setup installer (.exe)",
    "Linux AppImage and Debian builds",
    "Solana Jupiter swaps & Tokenized Stocks trading",
    "Pump.fun launches and on-chain intelligence",
    "Encrypted local session and transaction-record storage",
    "Connected Robinhood Chain wallet onboarding on chain ID 4663",
  ],
  changed: [
    "Solana and connected EVM workflows keep wallet confirmation separate from preparation",
    "Two-way Solana and Robinhood bridge transfers reconcile each side independently",
    "Pinned EVM routes require explicit wallet confirmation",
  ],
  fixed: [
    "Provider errors and incomplete route data now stop safely",
    "Desktop privilege-boundary audits",
    "Windows & Linux package compatibility checks",
  ],
  windowsHref: "https://github.com/mirae-trade/mirae/releases/download/v0.1.0/Mirae-0.1.0-windows-x64-setup.exe",
  releaseHref: "https://github.com/mirae-trade/mirae/releases/tag/v0.1.0",
}] as const;

export function ReleaseHistory() {
  return (
    <section className="py-20 sm:py-28">
      <CurrentReveal className="mb-14 grid gap-7 border-b border-black/20 pb-10 lg:grid-cols-[1fr_0.6fr] lg:items-end">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--sc-orange)]">Changelog timeline</p>
          <h2 className="mt-5 font-display text-5xl tracking-[-0.05em] sm:text-7xl">Version history</h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-black/50 lg:justify-self-end">
          v0.2.0 is the current Perps milestone. The complete v0.1.0 Windows and Linux artifacts remain available below.
        </p>
      </CurrentReveal>

      <div className="releaseLedger releaseConsoleLedger relative grid gap-5">
        {releases.map((release, index) => <CurrentReveal key={release.version} delay={index * 0.05}>
          <article className="releaseConsoleEntry relative grid gap-5">
            <span className="releaseConsoleNode absolute left-0 top-0 size-[9px] bg-[var(--sc-orange)]" />
            <div className="releaseVersionMeta border-b border-black/15 pb-5 pl-6">
              <p className="font-mono text-2xl tracking-[-0.05em] text-[var(--sc-orange)]">v{release.version}</p>
              <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.15em] text-black/30">{release.date}</p>
            </div>
            <Card className="border-black/15 bg-white text-ink">
              <CardHeader className="border-b border-black/10 p-7 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-display text-3xl tracking-[-0.04em] sm:text-4xl">{release.summary}</h3>
                  <Badge>{release.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-7 sm:p-9">
                <div className="grid gap-8 md:grid-cols-3">
                  <ChangeList title="Added" items={release.added} />
                  <ChangeList title="Changed" items={release.changed} />
                  <ChangeList title="Fixed" items={release.fixed} />
                </div>
                <div className="mt-9 border-t border-black/10 pt-7 flex flex-wrap gap-4">
                  {release.windowsHref ? <Button asChild className="solarPrimaryButton">
                    <a href={release.windowsHref} download>
                      Download Windows (v{release.version})<ArrowDownToLine className="ml-3 size-3.5" />
                    </a>
                  </Button> : <Button asChild className="solarPrimaryButton">
                    <a href={release.releaseHref}>View v{release.version} artifacts<ArrowDownToLine className="ml-3 size-3.5" /></a>
                  </Button>}
                  <Button asChild variant="outline">
                    <a href="#downloads">
                      All Downloads & Linux<ArrowDownToLine className="ml-3 size-3.5" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </article>
        </CurrentReveal>)}
      </div>
    </section>
  );
}

function ChangeList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.17em] text-black/35">{title}</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="border-l border-black/15 pl-4 text-xs leading-6 text-black/50">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
