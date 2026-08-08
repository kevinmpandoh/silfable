import { Apple, ArrowDownToLine, Clock3, Laptop, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

type PlatformRelease = {
  platform: string;
  detail: string;
  requirement: string;
  primaryLabel: string;
  secondaryLabel: string;
  href?: string;
};

const platformIcon = (platform: string) => platform === "macOS" ? Apple : Laptop;

export async function DownloadTable() {
  let version = "0.1.0";
  let tag = "v0.1.0";
  try {
    const res = await fetch("https://api.github.com/repos/kevinmpandoh/silfable/releases/latest", { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data.tag_name) { tag = data.tag_name; version = tag.replace(/^v/, ""); }
    }
  } catch {
    // The pinned release remains available as a safe fallback.
  }

  const releases: PlatformRelease[] = [
    { platform: "macOS", detail: "Apple Silicon & Intel", requirement: "Desktop packages are being prepared for signed distribution.", primaryLabel: "Coming soon", secondaryLabel: "Release notes" },
    { platform: "Windows", detail: "x64 installer", requirement: "Windows distribution is queued after the current Linux preview validation.", primaryLabel: "Coming soon", secondaryLabel: "Release notes" },
    { platform: "Linux", detail: "AppImage", requirement: "Modern x86_64 Linux distribution. AppImage runs without a package manager install.", primaryLabel: "Download AppImage", secondaryLabel: "Download Debian", href: `https://github.com/kevinmpandoh/silfable/releases/download/${tag}/Silfable-${version}-x86_64.AppImage` },
  ];

  return (
    <section id="download" className="border-y border-[var(--line)] bg-[var(--ink)] text-[var(--paper)]">
      <div className="section-shell py-24 sm:py-28 lg:py-32">
        <div className="grid gap-8 border-b border-[var(--line)] pb-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-electric">Desktop runtime / {version}</p>
            <h2 className="mt-5 max-w-4xl text-[clamp(3rem,6.3vw,6.6rem)] font-bold leading-[0.9] tracking-[-0.07em]">Download Silfable for your environment.</h2>
          </div>
          <div className="lg:pb-1">
            <p className="text-sm leading-7 text-[var(--muted)]">Local signing, policy checks, and receipt storage stay on your machine. Available builds are always clearly marked.</p>
            <a href="/releases" className="mt-5 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-electric hover:text-emerald-200">View release notes <ArrowDownToLine className="size-3.5" /></a>
          </div>
        </div>

        <div className="mt-10 grid border-t border-l border-[var(--line)] lg:grid-cols-3">
          {releases.map((release) => {
            const Icon = platformIcon(release.platform);
            const available = Boolean(release.href);
            return <article key={release.platform} className="flex min-h-[25rem] flex-col border-r border-b border-[var(--line)] p-6 sm:p-8">
              <div className="flex items-center gap-3 text-lg font-semibold"><Icon className="size-5 text-electric" />{release.platform}</div>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--blue-2)]">{release.detail}</p>
              <div className="mt-9 grid gap-3">
                {available ? <Button asChild className="auroraButton w-full"><a href={release.href} download>{release.primaryLabel}<ArrowDownToLine className="ml-3 size-4" /></a></Button> : <Button disabled className="w-full">{release.primaryLabel}<Clock3 className="ml-3 size-4" /></Button>}
                {available ? <Button asChild variant="outline" className="outlineButton w-full"><a href={`https://github.com/kevinmpandoh/silfable/releases/download/${tag}/Silfable-${version}-amd64.deb`} download>{release.secondaryLabel}</a></Button> : <Button asChild variant="outline" className="outlineButton w-full"><a href="/releases">{release.secondaryLabel}</a></Button>}
              </div>
              <div className="mt-auto border-t border-[var(--line)] pt-6"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--blue-2)]">Availability</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{release.requirement}</p></div>
            </article>;
          })}
        </div>
        <p className="mt-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]"><PackageOpen className="size-4 text-electric" /> Linux preview includes checksums and release notes.</p>
      </div>
    </section>
  );
}
