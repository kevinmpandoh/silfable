import type { Metadata } from "next";

import { DocsContent } from "@/components/docs/DocsContent";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const metadata: Metadata = {
  title: "Documentation - Silfable",
  description: "Install Silfable, configure wallets and providers, run restricted Mainnet sessions, and inspect execution receipts.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="section-shell pt-20">
        <div className="lg:hidden"><DocsSidebar /></div>
        <div className="grid gap-16 py-16 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:py-24">
          <div className="hidden lg:block"><DocsSidebar /></div>
          <div className="prose prose-invert min-w-0 max-w-none prose-headings:font-serif prose-headings:text-ink prose-p:text-black/55 prose-strong:text-ink prose-li:text-black/55 prose-code:font-mono">
            <DocsContent />
          </div>
        </div>
      </div>
    </main>
  );
}
