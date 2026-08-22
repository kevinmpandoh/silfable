"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { MIRAE_X_URL } from "@/lib/social-links";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Changelog", href: "/releases" },
];

const communityLinks = [
  { label: "X", href: MIRAE_X_URL, external: true, soon: false },
  { label: "Discord", href: "#", external: false, soon: true },
];

const downloadLinks = [
  {
    label: "Windows",
    href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.0/Mirae-0.2.0-windows-x64-setup.exe",
    external: true,
    download: true,
    soon: false,
  },
  {
    label: "Linux",
    href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.0/Mirae-0.2.0-x86_64.AppImage",
    external: true,
    download: true,
    soon: false,
  },
  { label: "macOS", href: "#", external: false, soon: true },
];

const linkClass =
  "font-display text-sm font-semibold text-black transition-colors hover:text-primary";

function NavDropdown({
  label,
  items,
  external,
}: {
  label: string;
  items: Array<{ label: string; href?: string; external?: boolean; download?: boolean; soon?: boolean }>;
  external?: boolean;
}) {
  return (
    <div className="group relative">
      <button type="button" className={linkClass}>
        {label}
      </button>
      <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
        <div className="flex min-w-[9rem] flex-col rounded-2xl border border-primary/25 bg-gradient-to-b from-background/95 to-primary/10 p-2 shadow-soft backdrop-blur-md">
          {items.map((item) => {
            const disabled = item.soon === true;
            return (
              <a
                key={item.label}
                href={disabled ? undefined : item.href}
                aria-disabled={disabled || undefined}
                {...(external && !disabled ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-center font-display text-sm font-semibold text-black transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {item.label}
                {disabled && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary/70">
                    Soon
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className={`publicNav${mobileOpen ? " mobileOpen" : ""}`}>
      <div className="publicNavInner">
        <Link href="/" className="brightWordmark" aria-label="Mirae home" onClick={closeMobile}>
          <span aria-hidden="true">MIR</span>
          <span aria-hidden="true">Λ</span>
          <span aria-hidden="true">E</span>
        </Link>
        <nav aria-label="Primary navigation" className="brightNavLinks">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
          <NavDropdown label="Community" items={communityLinks} external />
          <NavDropdown label="Download" items={downloadLinks} />
        </nav>
        <button
          type="button"
          className="brightMobileToggle"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="mirae-mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <nav id="mirae-mobile-navigation" aria-label="Mobile navigation" className="brightMobileMenu">
        <div className="brightMobilePrimary">
          {navLinks.map((link, index) => (
            <Link key={link.label} href={link.href} onClick={closeMobile}>
              <span>0{index + 1}</span>
              {link.label}
              <ArrowGlyph />
            </Link>
          ))}
        </div>
        <div className="brightMobileGroups">
          <div>
            <p>Community</p>
            {communityLinks.map((item) => (
              <a
                key={item.label}
                href={item.soon ? undefined : item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                onClick={closeMobile}
                className="flex items-center justify-between"
              >
                <span>{item.label}</span>
                {item.soon && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary/70">
                    Soon
                  </span>
                )}
              </a>
            ))}
          </div>
          <div>
            <p>Download</p>
            {downloadLinks.map((item) => (
              <a
                key={item.label}
                href={item.soon ? undefined : item.href}
                download={item.download || undefined}
                onClick={closeMobile}
                className="flex items-center justify-between"
              >
                <span>{item.label}</span>
                {item.soon && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary/70">
                    Soon
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}

function ArrowGlyph() {
  return <span aria-hidden="true" className="brightMobileArrow">↗</span>;
}
