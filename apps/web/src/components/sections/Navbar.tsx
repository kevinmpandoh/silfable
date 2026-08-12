import Image from "next/image";
import Link from "next/link";


const navLinks = [{ label: "Workflows", href: "/#networks" }, { label: "Documentation", href: "/docs" }, { label: "Changelog", href: "/releases" }];

export function Navbar() {
  return (
    <header className="publicNav fixed inset-x-0 top-0 z-50">
      <div className="section-shell publicNavInner flex items-center justify-between gap-5">
        <Link href="/" className="brandWordmark flex items-center gap-3" aria-label="Silfable home"><Image src="/logo.png" alt="" width={34} height={34} priority /><span>Silfable</span></Link>
        <nav aria-label="Primary navigation" className="atlasNavLinks hidden items-center lg:flex">{navLinks.map(link => <Link key={link.label} href={link.href} className="atlasNavLink">{link.label}</Link>)}</nav>

        

      </div>
    </header>
  );
}
