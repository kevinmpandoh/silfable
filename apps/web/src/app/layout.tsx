import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { ConditionalFooter } from "@/components/sections/ConditionalFooter";
import { ConditionalNavbar } from "@/components/sections/ConditionalNavbar";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silfable - From Market Idea to Visible Transaction",
  description:
    "Research tokens, prepare launches, swap, bridge, and track supported Mainnet transactions across Solana and Robinhood Chain.",
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="dark">
      <body>
        <ThemeProvider>
          <SolanaProvider>
            <ConditionalNavbar />
            {children}
            <ConditionalFooter />
          </SolanaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
