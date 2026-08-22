import { Apple, ArrowDownToLine, Clock3, Laptop } from "lucide-react";
import { CurrentReveal } from "@/components/motion/CurrentMotion";
import { CurrentLabel, StatusSignal } from "@/components/solar/SolarPrimitives";
import { Button } from "@/components/ui/button";

type PlatformRelease = {
  platform: string;
  detail: string;
  requirement: string;
  primaryLabel: string;
  href?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export async function DownloadTable() {
  let version = "0.1.0";
  let tag = "v0.2.0";

  try {
    const response = await fetch("https://api.github.com/repos/mirae-trade/mirae/releases/latest", {
      next: { revalidate: 3600 },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.tag_name) {
        tag = data.tag_name;
        version = tag.replace(/^v/, "");
      }
    }
  } catch {}

  const releases: PlatformRelease[] = [
    {
      platform: "Windows",
      detail: "x64 installer",
      requirement: "Windows 10 / 11 64-bit.",
      primaryLabel: "Setup · x64 (.exe)",
      href: `https://github.com/mirae-trade/mirae/releases/download/${tag}/Mirae-${version}-windows-x64-setup.exe`,
    },
    {
      platform: "Linux",
      detail: "AppImage · x64 + ARM64",
      requirement: "Choose x64 for Intel/AMD or ARM64 for aarch64 systems.",
      primaryLabel: "AppImage · x64",
      href: `https://github.com/mirae-trade/mirae/releases/download/${tag}/Mirae-${version}-x86_64.AppImage`,
      secondaryLabel: "AppImage · ARM64",
      secondaryHref: `https://github.com/mirae-trade/mirae/releases/download/${tag}/Mirae-${version}-arm64.AppImage`,
    },
    {
      platform: "macOS",
      detail: "Apple Silicon & Intel",
      requirement: "Signed package in preparation.",
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
            Desktop keeps its encrypted vault, checks, and activity records local. Each platform shows its actual distribution state.
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
                    <Button asChild>
                      <a href={release.href} download>
                        {release.primaryLabel}
                        <ArrowDownToLine className="ml-2 size-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button disabled>
                      {release.primaryLabel}
                      <Clock3 className="ml-2 size-4" />
                    </Button>
                  )}
                  {release.secondaryHref && (
                    <Button asChild variant="outline">
                      <a href={release.secondaryHref} download>
                        {release.secondaryLabel}
                        <ArrowDownToLine className="ml-2 size-4" />
                      </a>
                    </Button>
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
