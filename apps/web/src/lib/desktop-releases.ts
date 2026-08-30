const RELEASE_BASE_URL = "https://github.com/mirae-trade/mirae-desktop-releases/releases";

function releaseAsset(tag: string, filename: string): string {
  return `${RELEASE_BASE_URL}/download/${tag}/${filename}`;
}

export const CURRENT_DESKTOP_RELEASE = {
  version: "0.4.1",
  tag: "v0.4.1",
  releaseUrl: `${RELEASE_BASE_URL}/tag/v0.4.1`,
  windows: {
    label: "Windows v0.4.1",
    detail: "x64 portable build",
    filename: "Mirae-0.4.1-windows-x64-unsigned-qa.zip",
    url: releaseAsset(
      "v0.4.1",
      "Mirae-0.4.1-windows-x64-unsigned-qa.zip",
    ),
    checksumUrl: releaseAsset("v0.4.1", "SHA256SUMS-WINDOWS-QA.txt"),
    signed: false,
  },
  linux: {
    label: "Linux v0.4.1",
    appImageX64Url: releaseAsset("v0.4.1", "Mirae-0.4.1-x86_64.AppImage"),
    appImageArm64Url: releaseAsset("v0.4.1", "Mirae-0.4.1-arm64.AppImage"),
    debX64Url: releaseAsset("v0.4.1", "Mirae-0.4.1-amd64.deb"),
    debArm64Url: releaseAsset("v0.4.1", "Mirae-0.4.1-arm64.deb"),
    checksumUrl: releaseAsset("v0.4.1", "SHA256SUMS.txt"),
  },
} as const;

export const LEGACY_SIGNED_WINDOWS_RELEASE = {
  version: "0.1.0",
  label: "Windows v0.1.0",
  url: releaseAsset("v0.1.0", "Mirae-0.1.0-windows-x64-setup.exe"),
} as const;

export const NAV_DOWNLOAD_LINKS = [
  {
    label: CURRENT_DESKTOP_RELEASE.windows.label,
    href: "/releases#downloads",
    external: false,
    download: false,
    soon: false,
  },
  {
    label: CURRENT_DESKTOP_RELEASE.linux.label,
    href: "/releases#downloads",
    external: false,
    download: false,
    soon: false,
  },
  {
    label: "All versions",
    href: "/releases#history",
    external: false,
    download: false,
    soon: false,
  },
  { label: "macOS", href: "#", external: false, download: false, soon: true },
] as const;
