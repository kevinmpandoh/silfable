import type { Metadata } from "next";
import { Azeret_Mono, DM_Sans, Fraunces } from "next/font/google";

import { ConditionalFooter } from "@/components/sections/ConditionalFooter";
import { ConditionalNavbar } from "@/components/sections/ConditionalNavbar";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import "./globals.css";
import "./living-atlas-public.css";
import "./living-atlas-workspace.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silfable - Robinhood Chain Trading Workspace",
  description:
    "Prepare Robinhood Chain swaps, bridge between Robinhood and Solana, and track every supported Mainnet transaction from route to settlement.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} data-theme="dark" data-scroll-behavior="smooth">
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
