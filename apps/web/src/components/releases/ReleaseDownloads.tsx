import { Apple, ArrowDownToLine, CheckCircle2, Clock3, FileKey2, Laptop, MonitorDown } from "lucide-react";

import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { Button } from "@/components/ui/button";

const windowsArtifacts = [
  { label: "Windows v0.1.0 · x64 (.exe)", href: "https://github.com/mirae-trade/mirae/releases/download/v0.1.0/Mirae-0.1.0-windows-x64-setup.exe", primary: true },
] as const;

const linuxArtifacts = [
  { label: "AppImage · x64", href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.1/Mirae-0.2.1-x86_64.AppImage", primary: true },
  { label: "AppImage · ARM64", href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.1/Mirae-0.2.1-arm64.AppImage", primary: false },
  { label: "Debian · x64", href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.1/Mirae-0.2.1-amd64.deb", primary: false },
  { label: "Debian · ARM64", href: "https://github.com/mirae-trade/mirae/releases/download/v0.2.1/Mirae-0.2.1-arm64.deb", primary: false },
] as const;

const upcoming = [
  { platform: "macOS", detail: "Apple Silicon & Intel", note: "Pending signing and compatibility validation", icon: Apple },
] as const;

export function ReleaseDownloads() {
  return (
    <section id="downloads" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-28">
      <CurrentReveal className="releaseDownloadHeading">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--sc-orange)]">Release artifacts / 0.2.1 + legacy 0.1.0</p>
          <h2 className="mt-5 text-5xl font-bold tracking-[-0.06em] sm:text-6xl">Install Mirae Desktop.</h2>
        </div>
        <p>Choose the artifact that matches your operating system. Every transaction keeps local key storage and requires an explicit wallet review.</p>
      </CurrentReveal>

      <div className="grid gap-6 mt-10">
        {/* Windows Release Card */}
        <div className="releaseDownloadConsole">
          <CurrentReveal className="releaseLinuxFeature" delay={0.04}>
            <div className="releaseLinuxIdentity">
              <div className="releasePlatformIcon"><Laptop /></div>
              <div><span>LEGACY AVAILABLE</span><h3>Windows</h3><p>v0.1.0 signed installer · v0.2.1 signing pending</p></div>
            </div>
            <div className="releaseBuildLedger">
              <span>VERSION <strong>0.1.0</strong></span><span>CHANNEL <strong>Legacy Official</strong></span><span>EXECUTION <strong>Local Encrypted Vault</strong></span>
            </div>
            <div className="releaseArtifactGrid">
              {windowsArtifacts.map((artifact) => (
                <Button key={artifact.label} asChild variant={artifact.primary ? undefined : "outline"} className={artifact.primary ? "solarPrimaryButton" : "outlineButton"}>
                  <a href={artifact.href} download>{artifact.label}<ArrowDownToLine className="ml-3 size-4" /></a>
                </Button>
              ))}
            </div>
            <p className="releaseVerifyNote"><FileKey2 /> Verify the selected artifact against SHA256SUMS.txt before installation.</p>
          </CurrentReveal>

          <CurrentReveal className="releaseUpcoming" delay={0.08}>
            <div className="releaseUpcomingHeader"><span>OTHER PLATFORMS</span><Clock3 /></div>
            {upcoming.map((build) => {
              const Icon = build.icon;
              return <article key={build.platform} className="releaseUpcomingRow"><Icon /><div><h3>{build.platform}</h3><p>{build.detail}</p></div><span>COMING SOON</span><small>{build.note}</small></article>;
            })}
            <div className="releaseAvailabilityNote"><CheckCircle2 /> Linux v0.2.1 is current; signed Windows v0.1.0 remains available.</div>
          </CurrentReveal>
        </div>

        {/* Linux Release Card */}
        <div className="releaseDownloadConsole">
          <CurrentReveal className="releaseLinuxFeature" delay={0.12}>
            <div className="releaseLinuxIdentity">
              <div className="releasePlatformIcon"><MonitorDown /></div>
              <div><span>AVAILABLE NOW</span><h3>Linux</h3><p>AppImage and Debian · x64 and ARM64</p></div>
            </div>
            <div className="releaseBuildLedger">
              <span>VERSION <strong>0.2.1</strong></span><span>CHANNEL <strong>Latest</strong></span><span>EXECUTION <strong>Perps + Wallet Review</strong></span>
            </div>
            <div className="releaseArtifactGrid">
              {linuxArtifacts.map((artifact) => (
                <Button key={artifact.label} asChild variant={artifact.primary ? undefined : "outline"} className={artifact.primary ? "solarPrimaryButton" : "outlineButton"}>
                  <a href={artifact.href} download>{artifact.label}<ArrowDownToLine className="ml-3 size-4" /></a>
                </Button>
              ))}
            </div>
            <p className="releaseVerifyNote"><FileKey2 /> Verify the selected artifact against SHA256SUMS.txt before installation.</p>
          </CurrentReveal>
        </div>
      </div>
    </section>
  );
}
