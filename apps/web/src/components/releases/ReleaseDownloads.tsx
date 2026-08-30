import { Apple, CheckCircle2, Clock3, FileKey2, Laptop, MonitorDown } from "lucide-react";

import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { CURRENT_DESKTOP_RELEASE, LEGACY_SIGNED_WINDOWS_RELEASE } from "@/lib/desktop-releases";
import { TokenGateBanner } from "@/components/releases/TokenGateBanner";
import { GatedDownloadButton } from "@/components/releases/GatedDownloadButton";

const windowsArtifacts = [
  { label: `${CURRENT_DESKTOP_RELEASE.windows.label} · x64 unsigned (.zip)`, href: CURRENT_DESKTOP_RELEASE.windows.url, primary: true },
  { label: `${LEGACY_SIGNED_WINDOWS_RELEASE.label} · x64 (.exe)`, href: LEGACY_SIGNED_WINDOWS_RELEASE.url, primary: false },
] as const;

const linuxArtifacts = [
  { label: "AppImage · x64", href: CURRENT_DESKTOP_RELEASE.linux.appImageX64Url, primary: true },
  { label: "AppImage · ARM64", href: CURRENT_DESKTOP_RELEASE.linux.appImageArm64Url, primary: false },
  { label: "Debian · x64", href: CURRENT_DESKTOP_RELEASE.linux.debX64Url, primary: false },
  { label: "Debian · ARM64", href: CURRENT_DESKTOP_RELEASE.linux.debArm64Url, primary: false },
] as const;

const upcoming = [
  { platform: "macOS", detail: "Apple Silicon & Intel", note: "Pending signing and compatibility validation", icon: Apple },
] as const;

export function ReleaseDownloads() {
  return (
    <section id="downloads" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-28">
      <CurrentReveal className="releaseDownloadHeading">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--sc-orange)]">Release artifacts / {CURRENT_DESKTOP_RELEASE.version} + legacy {LEGACY_SIGNED_WINDOWS_RELEASE.version}</p>
          <h2 className="mt-5 text-5xl font-bold tracking-[-0.06em] sm:text-6xl">Install Mirae Desktop.</h2>
        </div>
        <p>Choose the artifact that matches your operating system. Desktop access requires holding 100,000 $MIRAE tokens in your connected Solana wallet.</p>
      </CurrentReveal>

      {/* Token Gate Verification Banner */}
      <div className="mt-10">
        <TokenGateBanner />
      </div>

      <div className="grid gap-6 mt-4">
        {/* Windows Release Card */}
        <div id="windows" className="releaseDownloadConsole scroll-mt-24">
          <CurrentReveal className="releaseLinuxFeature" delay={0.04}>
            <div className="releaseLinuxIdentity">
              <div className="releasePlatformIcon"><Laptop /></div>
              <div><span>AVAILABLE NOW</span><h3>Windows</h3><p>v{CURRENT_DESKTOP_RELEASE.version} unsigned portable build · SmartScreen warning expected</p></div>
            </div>
            <div className="releaseBuildLedger">
              <span>VERSION <strong>{CURRENT_DESKTOP_RELEASE.version}</strong></span><span>CHANNEL <strong>Unsigned QA</strong></span><span>EXECUTION <strong>Local Encrypted Vault</strong></span>
            </div>
            <div className="releaseArtifactGrid">
              {windowsArtifacts.map((artifact) => (
                <GatedDownloadButton
                  key={artifact.label}
                  href={artifact.href}
                  label={artifact.label}
                  primary={artifact.primary}
                />
              ))}
            </div>
            <p className="releaseVerifyNote"><FileKey2 /> v{CURRENT_DESKTOP_RELEASE.version} is unsigned and may trigger Windows SmartScreen. Verify it against SHA256SUMS-WINDOWS-QA.txt before running.</p>
          </CurrentReveal>

          <CurrentReveal className="releaseUpcoming" delay={0.08}>
            <div className="releaseUpcomingHeader"><span>OTHER PLATFORMS</span><Clock3 /></div>
            {upcoming.map((build) => {
              const Icon = build.icon;
              return <article key={build.platform} className="releaseUpcomingRow"><Icon /><div><h3>{build.platform}</h3><p>{build.detail}</p></div><span>COMING SOON</span><small>{build.note}</small></article>;
            })}
            <div className="releaseAvailabilityNote"><CheckCircle2 /> Windows and Linux v{CURRENT_DESKTOP_RELEASE.version} are available; Windows v{CURRENT_DESKTOP_RELEASE.version} is explicitly unsigned.</div>
          </CurrentReveal>
        </div>

        {/* Linux Release Card */}
        <div id="linux" className="releaseDownloadConsole scroll-mt-24">
          <CurrentReveal className="releaseLinuxFeature" delay={0.12}>
            <div className="releaseLinuxIdentity">
              <div className="releasePlatformIcon"><MonitorDown /></div>
              <div><span>AVAILABLE NOW</span><h3>Linux</h3><p>AppImage and Debian · x64 and ARM64</p></div>
            </div>
            <div className="releaseBuildLedger">
              <span>VERSION <strong>{CURRENT_DESKTOP_RELEASE.version}</strong></span><span>CHANNEL <strong>Latest</strong></span><span>EXECUTION <strong>Perps Chat + Wallet Review</strong></span>
            </div>
            <div className="releaseArtifactGrid">
              {linuxArtifacts.map((artifact) => (
                <GatedDownloadButton
                  key={artifact.label}
                  href={artifact.href}
                  label={artifact.label}
                  primary={artifact.primary}
                />
              ))}
            </div>
            <p className="releaseVerifyNote"><FileKey2 /> Verify the selected artifact against SHA256SUMS.txt before installation.</p>
          </CurrentReveal>
        </div>
      </div>
    </section>
  );
}
