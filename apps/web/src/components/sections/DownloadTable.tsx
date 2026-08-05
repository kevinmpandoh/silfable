import { ArrowDownToLine, Clock3, Laptop, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function DownloadTable() {
  let version = "0.1.0";
  let tag = "v0.1.0";
  
  try {
    const res = await fetch("https://api.github.com/repos/kevinmpandoh/silfable/releases/latest", {
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.tag_name) {
        tag = data.tag_name;
        version = tag.replace(/^v/, "");
      }
    }
  } catch {
    // Fallback to default
  }

  const releases = [
    {
      os: "Linux",
      build: "Universal",
      format: ".AppImage",
      architecture: "x64",
      href: `https://github.com/kevinmpandoh/silfable/releases/download/${tag}/Silfable-${version}-x86_64.AppImage`,
      available: true,
    },
    {
      os: "Linux",
      build: "Debian",
      format: ".deb",
      architecture: "x64",
      href: `https://github.com/kevinmpandoh/silfable/releases/download/${tag}/Silfable-${version}-amd64.deb`,
      available: true,
    },
    {
      os: "macOS",
      build: "Apple Silicon & Intel",
      format: ".dmg",
      architecture: "Universal",
      href: null,
      available: false,
    },
    {
      os: "Windows",
      build: "Installer",
      format: ".exe",
      architecture: "x64",
      href: null,
      available: false,
    },
  ] as const;

  return (
    <section id="download" className="border-t border-white/10 bg-[#080b18] text-[#eef2ff]">
      <div className="section-shell py-24 sm:py-32 lg:py-44">
        <div className="grid gap-10 border-b border-white/15 pb-14 lg:grid-cols-[1fr_0.75fr] lg:items-end lg:pb-20">
          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-electric">
              Release {version} / Desktop
            </p>
            <h2 className="font-serif text-[clamp(3.4rem,7vw,7.8rem)] leading-[0.85] tracking-[-0.06em]">
              Run it on <em className="text-electric">your</em> machine.
            </h2>
          </div>
          <div className="max-w-lg lg:justify-self-end">
            <p className="text-base leading-8 text-white/55">
              Download the local runtime. Your policies, signing flow, and execution history remain under your control.
            </p>
            <div className="mt-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
              <PackageOpen className="size-4 text-electric" /> Linux builds available first
            </div>
          </div>
        </div>

        <Table className="min-w-[46rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[18%]">Operating system</TableHead>
              <TableHead className="w-[27%]">Build</TableHead>
              <TableHead className="w-[17%]">Format</TableHead>
              <TableHead className="w-[18%]">Architecture</TableHead>
              <TableHead className="text-right">Release</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((release) => (
              <TableRow key={`${release.os}-${release.build}`} className={!release.available ? "text-white/35" : undefined}>
                <TableCell className="py-7 sm:py-8">
                  <span className="flex items-center gap-3 font-medium">
                    <Laptop className="size-4" strokeWidth={1.5} /> {release.os}
                  </span>
                </TableCell>
                <TableCell className="py-7 font-serif text-xl sm:py-8 sm:text-2xl">{release.build}</TableCell>
                <TableCell className="py-7 font-mono text-xs text-white/50 sm:py-8">{release.format}</TableCell>
                <TableCell className="py-7 font-mono text-xs text-white/50 sm:py-8">{release.architecture}</TableCell>
                <TableCell className="py-7 text-right sm:py-8">
                  {release.available && release.href ? (
                    <Button asChild variant="blue" className="h-10 px-4">
                      <a
                        href={release.href}
                        aria-label={`Download Silfable for ${release.os} ${release.build}`}
                        download
                      >
                        Download <ArrowDownToLine className="ml-3 size-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="blue" className="h-10 px-4">
                      Coming soon <Clock3 className="ml-3 size-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex flex-col gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>Linux requires a modern x86_64 distribution</span>
          <a href="/releases" className="text-electric transition-colors hover:text-cyan-300">
            View checksums and release notes
          </a>
        </div>
      </div>
    </section>
  );
}
