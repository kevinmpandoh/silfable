import { ArrowDownToLine, Clock3, FileKey2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const builds = [
  { platform: "Linux", target: "Universal", file: "Silfable-0.1.0-x86_64.AppImage", size: "See GitHub", checksum: "SHA256SUMS.txt", href: "https://github.com/kevinmpandoh/silfable/releases/download/v0.1.0/Silfable-0.1.0-x86_64.AppImage", available: true },
  { platform: "Linux", target: "Debian", file: "Silfable-0.1.0-amd64.deb", size: "See GitHub", checksum: "SHA256SUMS.txt", href: "https://github.com/kevinmpandoh/silfable/releases/download/v0.1.0/Silfable-0.1.0-amd64.deb", available: true },
  { platform: "macOS", target: "Apple Silicon & Intel", file: "Coming soon", size: "—", checksum: "—", href: null, available: false },
  { platform: "Windows", target: "Installer", file: "Coming soon", size: "—", checksum: "—", href: null, available: false },
] as const;

export function ReleaseDownloads() {
  return (
    <section id="downloads" className="scroll-mt-24 border-b border-black/15 py-20 sm:py-28">
      <div className="flex flex-col gap-8 border-b border-black/20 pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">Artifacts / 0.1.0</p>
          <h2 className="mt-5 font-serif text-5xl tracking-[-0.05em] sm:text-6xl">Downloads</h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-black/50">Linux preview artifacts are available as AppImage and Debian packages. They are evaluation builds; venue-specific Mainnet release gates still apply.</p>
      </div>

      <Table className="min-w-[50rem]">
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Platform</TableHead><TableHead>Target</TableHead><TableHead>Filename</TableHead><TableHead>Size</TableHead><TableHead>SHA-256</TableHead><TableHead className="text-right">Artifact</TableHead></TableRow></TableHeader>
        <TableBody>
          {builds.map((build) => (
            <TableRow key={`${build.platform}-${build.target}`} className={!build.available ? "text-black/35" : undefined}>
              <TableCell className="py-7 font-medium">{build.platform}</TableCell>
              <TableCell className="py-7 font-serif text-xl">{build.target}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-black/45">{build.file}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-black/45">{build.size}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-electric">{build.checksum}</TableCell>
              <TableCell className="py-7 text-right">
                {build.available && build.href ? (
                  <Button asChild variant="blue" className="h-10 px-4">
                    <a href={build.href} aria-label={`Download ${build.file}`} download>Download <ArrowDownToLine className="ml-3 size-3.5" /></a>
                  </Button>
                ) : (
                  <Button disabled variant="blue" className="h-10 px-4">Coming soon <Clock3 className="ml-3 size-3.5" /></Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-black/35">
        <FileKey2 className="size-4 text-electric" /> Full checksums are included in SHA256SUMS.txt
      </div>
    </section>
  );
}
