import { ArrowDownToLine, FileKey2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const builds = [
  { platform: "Linux", target: "Universal", file: "silfable-1.2.0-x86_64.AppImage", size: "146 MB", checksum: "ab72…4f10" },
  { platform: "Linux", target: "Debian", file: "silfable_1.2.0_amd64.deb", size: "139 MB", checksum: "6e20…bc49" },
] as const;

export function ReleaseDownloads() {
  return (
    <section id="downloads" className="scroll-mt-24 border-b border-black/15 py-20 sm:py-28">
      <div className="flex flex-col gap-8 border-b border-black/20 pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">Artifacts / 1.2.0</p>
          <h2 className="mt-5 font-serif text-5xl tracking-[-0.05em] sm:text-6xl">Downloads</h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-black/50">Choose AppImage for broad distribution compatibility or Debian for apt-based Linux systems.</p>
      </div>

      <Table className="min-w-[50rem]">
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Platform</TableHead><TableHead>Target</TableHead><TableHead>Filename</TableHead><TableHead>Size</TableHead><TableHead>SHA-256</TableHead><TableHead className="text-right">Artifact</TableHead></TableRow></TableHeader>
        <TableBody>
          {builds.map((build) => (
            <TableRow key={build.file}>
              <TableCell className="py-7 font-medium">{build.platform}</TableCell>
              <TableCell className="py-7 font-serif text-xl">{build.target}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-black/45">{build.file}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-black/45">{build.size}</TableCell>
              <TableCell className="py-7 font-mono text-[10px] text-electric">{build.checksum}</TableCell>
              <TableCell className="py-7 text-right"><Button asChild variant="blue" className="h-10 px-4"><a href={`#${build.file}`} aria-label={`Download ${build.file}`}>Download <ArrowDownToLine className="ml-3 size-3.5" /></a></Button></TableCell>
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
