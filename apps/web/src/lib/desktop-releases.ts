const RELEASE_BASE_URL = "https://github.com/mirae-trade/mirae-desktop-releases/releases";

function releaseAsset(tag: string, filename: string): string {
  return `${RELEASE_BASE_URL}/download/${tag}/${filename}`;
}

export const CURRENT_DESKTOP_RELEASE = {
  version: "0.2.3",
  tag: "v0.2.3",
  releaseUrl: `${RELEASE_BASE_URL}/tag/v0.2.3`,
  windows: {
    label: "Windows v0.2.3",
    detail: "x64 unsigned portable build",
    filename: "Mirae-0.2.3-windows-x64-unsigned-qa.zip",
    url: releaseAsset(
      "v0.2.3",
      "Mirae-0.2.3-windows-x64-unsigned-qa.zip",
    ),
    checksumUrl: releaseAsset("v0.2.3", "SHA256SUMS-WINDOWS-QA.txt"),
    signed: false,
  },
  linux: {
    label: "Linux v0.2.3",
    appImageX64Url: releaseAsset("v0.2.3", "Mirae-0.2.3-x86_64.AppImage"),
    appImageArm64Url: releaseAsset("v0.2.3", "Mirae-0.2.3-arm64.AppImage"),
    debX64Url: releaseAsset("v0.2.3", "Mirae-0.2.3-amd64.deb"),
    debArm64Url: releaseAsset("v0.2.3", "Mirae-0.2.3-arm64.deb"),
    checksumUrl: releaseAsset("v0.2.3", "SHA256SUMS.txt"),
  },
} as const;

export const LEGACY_SIGNED_WINDOWS_RELEASE = {
  version: "0.1.0",
  label: "Windows v0.1.0 signed",
  url: releaseAsset("v0.1.0", "Mirae-0.1.0-windows-x64-setup.exe"),
} as const;

export const NAV_DOWNLOAD_LINKS = [
  {
    label: CURRENT_DESKTOP_RELEASE.windows.label,
    href: CURRENT_DESKTOP_RELEASE.windows.url,
    external: true,
    download: true,
    soon: false,
  },
  {
    label: CURRENT_DESKTOP_RELEASE.linux.label,
    href: CURRENT_DESKTOP_RELEASE.linux.appImageX64Url,
    external: true,
    download: true,
    soon: false,
  },
  {
    label: "All versions",
    href: "/releases",
    external: false,
    download: false,
    soon: false,
  },
  { label: "macOS", href: "#", external: false, download: false, soon: true },
] as const;
