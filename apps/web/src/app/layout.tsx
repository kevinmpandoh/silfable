import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from "next/font/google";
import "@fontsource-variable/instrument-sans";
import "@fontsource/instrument-serif/400.css";

import { ConditionalFooter } from "@/components/sections/ConditionalFooter";
import { ConditionalNavbar } from "@/components/sections/ConditionalNavbar";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import "./globals.css";
import "./solar-current-public.css";
import "./solar-current-workspace.css";
import "./bright-rebuild-theme.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

function resolveMetadataBase(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    try {
      return new URL(configuredUrl);
    } catch {
      // A malformed deployment variable must not make static metadata fail the build.
    }
  }

  const vercelHost = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || ""
  ).trim();

  if (vercelHost) {
    const normalizedHost = vercelHost.replace(/^https?:\/\//u, "");
    return new URL(`https://${normalizedHost}`);
  }

  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Mirae",
  description:
    "Plan Solana swaps, token launches, automations, and connected routes—then review every transaction before wallet approval.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Mirae",
    title: "Mirae",
    description:
      "Plan Solana swaps, token launches, automations, and connected routes—then review every transaction before wallet approval.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@ProjectMirae",
    creator: "@ProjectMirae",
    title: "Mirae",
    description:
      "Plan Solana swaps, token launches, automations, and connected routes—then review every transaction before wallet approval.",
  },
  icons: {
    icon: "/mirae-logo.png?v=mirae-1",
    shortcut: "/mirae-logo.png?v=mirae-1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} data-theme="bright" data-scroll-behavior="smooth">
      <body>
        <SolanaProvider>
          <ConditionalNavbar />
          {children}
          <ConditionalFooter />
        </SolanaProvider>
      </body>
    </html>
  );
}
