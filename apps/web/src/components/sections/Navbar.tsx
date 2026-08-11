import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StatusMarker } from "@/components/atlas/AtlasPrimitives";

const navLinks = [{ label: "Workflows", href: "/#networks" }, { label: "Docs", href: "/docs" }, { label: "Releases", href: "/releases" }];

export function Navbar() {
  return (
    <header className="publicNav fixed inset-x-0 top-0 z-50">
      <div className="section-shell publicNavInner flex items-center justify-between gap-5">
        <Link href="/" className="brandWordmark flex items-center gap-3" aria-label="Silfable home"><Image src="/logo.png" alt="" width={34} height={34} priority /><span>Silfable</span></Link>
        <nav aria-label="Primary navigation" className="atlasNavLinks hidden items-center lg:flex">{navLinks.map(link => <Link key={link.label} href={link.href} className="atlasNavLink">{link.label}</Link>)}</nav>
        <div className="flex items-center gap-3">
          <span className="atlasNavStatus hidden sm:block"><StatusMarker>Robinhood · 4663</StatusMarker></span>
          <Link href="/connect" className="atlasPrimaryButton inline-flex h-11 items-center gap-2 px-5 text-[10px] uppercase tracking-[.12em]">Open workspace <ArrowUpRight className="size-3.5" /></Link>
        </div>
      </div>
    </header>
  );
}
