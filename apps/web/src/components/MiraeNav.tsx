import Link from "next/link";

import { NAV_DOWNLOAD_LINKS } from "@/lib/desktop-releases";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Changelog", href: "/releases" },
];
const communityLinks: { label: string; href?: string; available?: boolean }[] = [
  { label: "X", href: "https://x.com/projectmirae", available: true },
  { label: "Discord", available: false },
];
const downloadLinks = NAV_DOWNLOAD_LINKS.map((item) => ({
  label: item.label,
  href: item.href,
  available: !item.soon,
}));

const linkClass =
  "font-display text-sm font-semibold text-black transition-colors hover:text-primary";

function Dropdown({
  label,
  items,
  external,
}: {
  label: string;
  items: { label: string; href?: string; available?: boolean }[];
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
            const disabled = item.available === false;
            if (external) {
              return (
                <a
                  key={item.label}
                  href={disabled ? undefined : item.href}
                  aria-disabled={disabled || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
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
            }
            return (
              <Link
                key={item.label}
                href={disabled || !item.href ? "#" : item.href}
                aria-disabled={disabled || undefined}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-center font-display text-sm font-semibold text-black transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {item.label}
                {disabled && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary/70">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MiraeNav() {
  return (
    <header className="flex w-full max-w-4xl items-center justify-between gap-2 rounded-full border border-primary/25 bg-gradient-to-r from-primary/15 via-background/85 to-primary/15 shadow-soft py-2 px-5 backdrop-blur-md sm:gap-6 sm:px-7">
      <Link
        href="/"
        aria-label="Mirae"
        className="font-display text-sm font-bold uppercase tracking-[0.28em] text-black"
      >
        <span aria-hidden="true">Mir</span>
        <span aria-hidden="true" className="inline-block">
          &#923;
        </span>
        <span aria-hidden="true">e</span>
      </Link>

      <nav className="hidden items-center gap-7 md:flex">
        {navLinks.map((link) => (
          <Link key={link.label} href={link.href} className={linkClass}>
            {link.label}
          </Link>
        ))}
        <Dropdown label="Community" items={communityLinks} external />
        <Dropdown label="Download" items={downloadLinks} />
      </nav>
    </header>
  );
}
