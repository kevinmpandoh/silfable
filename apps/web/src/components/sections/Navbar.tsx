import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";

import { XLogo } from "@/components/ui/x-logo";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Releases", href: "/releases" },
];

export function Navbar() {
  return (
    <header className="publicNav fixed inset-x-0 top-0 z-50">
      <div className="section-shell flex h-20 items-center justify-between gap-6">
        <Link href="/" className="brandWordmark flex items-center gap-3 text-xl font-bold tracking-[-0.04em]" aria-label="Silfable home">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
          <span>Silfable</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/docs"
            className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white lg:inline-flex"
          >
            Documentation
          </Link>
          <Link
            href="https://x.com/silfable"
            aria-label="Follow Silfable on X"
            className="hidden text-white/60 transition-colors hover:text-white sm:block"
          >
            <XLogo className="size-4" />
          </Link>
          <Link
            href="/#download"
            className="outlineButton inline-flex h-10 items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] sm:px-5"
          >
            <Download className="size-3.5" />
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
