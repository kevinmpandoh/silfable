import { Apple, ArrowDownToLine, Clock3, FileKey2, Laptop } from "lucide-react";

import { Button } from "@/components/ui/button";

const builds = [
  { platform: "macOS", detail: "Apple Silicon & Intel", file: "Signed package in preparation", requirement: "Will be published after platform signing and compatibility validation.", href: null },
  { platform: "Windows", detail: "x64 installer", file: "Installer in preparation", requirement: "Will follow the Linux preview acceptance process.", href: null },
  { platform: "Linux", detail: "AppImage & Debian", file: "Silfable-0.1.0-x86_64.AppImage", requirement: "AppImage and Debian x64 artifacts are available now, with SHA256SUMS.txt in the release.", href: "https://github.com/kevinmpandoh/silfable/releases/download/v0.1.0/Silfable-0.1.0-x86_64.AppImage" },
] as const;

export function ReleaseDownloads() {
  return (
    <section id="downloads" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-28">
      <div className="grid gap-8 border-b border-[var(--line)] pb-11 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">Release artifacts / 0.1.0</p><h2 className="mt-5 text-5xl font-bold tracking-[-0.06em] sm:text-6xl">Choose your platform.</h2></div>
        <p className="text-sm leading-7 text-[var(--muted)]">Every download is labelled by release state, supported platform, and verification requirements. Installing a build does not enable unattended transactions.</p>
      </div>
      <div className="mt-10 grid border-t border-l border-[var(--line)] lg:grid-cols-3">
        {builds.map((build) => {
          const Icon = build.platform === "macOS" ? Apple : Laptop;
          const available = Boolean(build.href);
          return <article key={build.platform} className="flex min-h-[25rem] flex-col border-r border-b border-[var(--line)] p-6 sm:p-8">
            <div className="flex items-center gap-3 text-lg font-semibold"><Icon className="size-5 text-electric" /> {build.platform}</div>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--blue-2)]">{build.detail}</p>
            <div className="mt-9 grid gap-3">
              {available ? <Button asChild className="auroraButton w-full"><a href={build.href ?? undefined} download>Download for x64 <ArrowDownToLine className="ml-3 size-4" /></a></Button> : <Button disabled className="w-full">Coming soon <Clock3 className="ml-3 size-4" /></Button>}
              {available ? <Button asChild variant="outline" className="outlineButton w-full"><a href="https://github.com/kevinmpandoh/silfable/releases/download/v0.1.0/Silfable-0.1.0-amd64.deb" download>Download Debian</a></Button> : <Button disabled variant="outline" className="outlineButton w-full">Release notes</Button>}
            </div>
            <div className="mt-auto border-t border-[var(--line)] pt-6"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--blue-2)]">Build details</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{build.requirement}</p></div>
          </article>;
        })}
      </div>
      <p className="mt-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]"><FileKey2 className="size-4 text-electric" /> Verify each downloaded artifact against SHA256SUMS.txt.</p>
    </section>
  );
}
