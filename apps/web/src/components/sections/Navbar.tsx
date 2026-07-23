import Link from "next/link";
import { Download, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "Releases", href: "/releases" },
  { label: "GitHub", href: "https://github.com/kevinmpandoh/silfable" },
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-ink/75 text-paper backdrop-blur-xl">
      <div className="section-shell grid h-20 grid-cols-[1fr_auto_1fr] items-center">
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

        <Link href="/" className="font-serif text-2xl tracking-[-0.04em]" aria-label="Silfable home">
          Silfable
        </Link>

        <div className="flex items-center justify-end gap-3 sm:gap-5">
          <Link
            href="https://x.com/silfable"
            aria-label="Follow Silfable on X"
            className="hidden text-white/60 transition-colors hover:text-white sm:block"
          >
            <X className="size-4" strokeWidth={1.5} />
          </Link>
          <Link
            href="/connect"
            className="hidden h-10 items-center bg-electric px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-blue-500 md:inline-flex"
          >
            Get started
          </Link>
          <Link
            href="/#download"
            className="inline-flex h-10 items-center gap-2 border border-white/35 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-paper hover:text-ink sm:px-5"
          >
            <Download className="size-3.5" />
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
