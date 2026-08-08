import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { XLogo } from "@/components/ui/x-logo";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Releases", href: "/releases" },
  { label: "Privacy", href: "#privacy" },
];

export function Footer() {
  return (
    <footer id="support" className="border-t border-[var(--line)] bg-[radial-gradient(circle_at_78%_18%,rgb(89_222_192_/_0.18),transparent_28%),radial-gradient(circle_at_18%_74%,rgb(32_201_151_/_0.18),transparent_30%),#06121a] text-white">
      <div className="section-shell flex min-h-[78vh] flex-col justify-between py-20 sm:py-24 lg:min-h-screen lg:py-28">
        <div className="flex items-center justify-between border-b border-white/30 pb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-white/70">The mission starts here</p>
          <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/65">
            <span className="size-1.5 rounded-full bg-white" /> Runtime available
          </span>
        </div>

        <div className="py-20 lg:py-28">
          <h2 className="text-[clamp(4rem,11vw,11rem)] font-bold leading-[0.78] tracking-[-0.075em]">
            <span className="block">YOUR AI.</span>
            <span className="auroraText block pl-[7vw]">YOUR LIMITS.</span>
            <span className="block text-right">Your receipts.</span>
          </h2>

          <div className="mt-16 flex flex-col gap-3 sm:flex-row sm:justify-end lg:mt-24">
            <Button asChild size="lg" className="auroraButton text-white">
              <Link href="/#download">
                Download Silfable <Download className="ml-4 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/55">
              <a href="https://x.com/silfable" target="_blank" rel="noreferrer">
                Follow @silfable <XLogo className="ml-4 size-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 border-t border-white/30 pt-7 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Link href="/" className="flex items-center gap-3 font-serif text-2xl tracking-[-0.04em]" aria-label="Silfable home">
            <Image src="/logo.png" alt="Silfable Logo" width={28} height={28} className="h-7 w-7 rounded-md" />
            Silfable
          </Link>

          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 md:justify-center">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/55 md:text-right">
            Copyright 2026 Silfable Labs. Markets involve risk.
          </p>
        </div>
      </div>
    </footer>
  );
}
