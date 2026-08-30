import { Apple, Clock3, Laptop } from "lucide-react";
import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { CurrentLabel, StatusSignal } from "@/components/solar/SolarPrimitives";
import { Button } from "@/components/ui/button";
import { CURRENT_DESKTOP_RELEASE } from "@/lib/desktop-releases";
import { GatedDownloadButton } from "@/components/releases/GatedDownloadButton";

type PlatformRelease = {
  platform: string;
  detail: string;
  requirement: string;
  primaryLabel: string;
  href?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function DownloadTable() {
  const version = CURRENT_DESKTOP_RELEASE.version;
  const releases: PlatformRelease[] = [
    {
      platform: "Windows",
      detail: CURRENT_DESKTOP_RELEASE.windows.detail,
      requirement: "Windows 10 / 11 64-bit.",
      primaryLabel: "Portable · x64 (.zip)",
      href: CURRENT_DESKTOP_RELEASE.windows.url,
    },
    {
      platform: "Linux",
      detail: "AppImage · x64 + ARM64",
      requirement: "Choose x64 or ARM64. Hold 100,000 $MIRAE to download.",
      primaryLabel: "AppImage · x64",
      href: CURRENT_DESKTOP_RELEASE.linux.appImageX64Url,
      secondaryLabel: "AppImage · ARM64",
      secondaryHref: CURRENT_DESKTOP_RELEASE.linux.appImageArm64Url,
    },
    {
      platform: "macOS",
      detail: "Apple Silicon & Intel",
      requirement: "macOS package in preparation.",
      primaryLabel: "Coming soon",
    },
  ];

  return (
    <section id="download" className="operatorSection">
      <div className="section-shell">
        <CurrentReveal className="operatorSectionHeader">
          <div>
            <CurrentLabel tone="violet">Desktop release / {version}</CurrentLabel>
            <h2>
              Run the current
              <br />
              on your machine.
            </h2>
          </div>
          <p>
            Desktop keeps its encrypted vault, checks, and activity records local. Downloading desktop builds requires holding 100,000 $MIRAE tokens.
          </p>
        </CurrentReveal>
        <CurrentReveal className="downloadInstrument" delay={0.08}>
          {releases.map((release) => {
            const Icon = release.platform === "macOS" ? Apple : Laptop;
            return (
              <article className="downloadUnit" key={release.platform}>
                <div className="flex items-center justify-between">
                  <Icon className="size-5" />
                  <StatusSignal state={release.href ? "verified" : "muted"}>
                    {release.href ? "Available" : "Planned"}
                  </StatusSignal>
                </div>
                <h3>{release.platform}</h3>
                <p>{release.detail}</p>
                <p className="mt-6 text-xs leading-6">{release.requirement}</p>
                <div className="downloadActions grid gap-2">
                  {release.href ? (
                    <GatedDownloadButton
                      href={release.href}
                      label={release.primaryLabel}
                      primary
                    />
                  ) : (
                    <Button disabled>
                      {release.primaryLabel}
                      <Clock3 className="ml-2 size-4" />
                    </Button>
                  )}
                  {release.secondaryHref && (
                    <GatedDownloadButton
                      href={release.secondaryHref}
                      label={release.secondaryLabel || ""}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </CurrentReveal>
      </div>
    </section>
  );
}
