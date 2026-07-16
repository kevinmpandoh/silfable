import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { DownloadTable } from "@/components/sections/DownloadTable";
import { FaqSection } from "@/components/sections/FaqSection";
import { TerminalMockup } from "@/components/sections/TerminalMockup";
import { Tokenomics } from "@/components/sections/Tokenomics";
import { Ticker } from "@/components/sections/Ticker";
import { ValueProps } from "@/components/sections/ValueProps";

export default function Home() {
  return (
    <main>
      <Hero />
      <Ticker />
      <ValueProps />
      <FeatureGrid />
      <TerminalMockup />
      <DownloadTable />
      <Tokenomics />
      <FaqSection />
    </main>
  );
}
