import Link from "next/link";

import { CurrentLabel, StatusSignal } from "@/components/solar/SolarPrimitives";

export function Footer() {
  return (
    <footer className="operatorFooter">
      <div className="section-shell operatorFooterGrid">
        <div className="operatorFooterBrand">
          <CurrentLabel>Operator current / Solana</CurrentLabel>
          <h2>Intent in.<br />Authority stays yours.</h2>
          <div className="mt-8"><StatusSignal state="verified">Solana Mainnet available</StatusSignal></div>
        </div>
        <div className="operatorFooterGroup"><h3>Product</h3><Link href="/#networks">Capabilities</Link><Link href="/connect">Web workspace</Link><Link href="/#download">Desktop</Link></div>
        <div className="operatorFooterGroup"><h3>Reference</h3><Link href="/docs">Documentation</Link><Link href="/whitepaper">Whitepaper</Link><Link href="/releases">Changelog</Link></div>
      </div>
      <div className="section-shell operatorFooterBottom"><Link href="/" className="miraeFooterBrand"><span className="miraeWordmark"><strong>MIRAE</strong></span></Link><span>© 2026 Mirae · Markets involve risk · Verify every transaction</span></div>
    </footer>
  );
}
