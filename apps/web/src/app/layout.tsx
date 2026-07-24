import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";

import { ConditionalFooter } from "@/components/sections/ConditionalFooter";
import { ConditionalNavbar } from "@/components/sections/ConditionalNavbar";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silfable - AI Trading, Within Your Limits",
  description:
    "Restricted AI trading runtime for Solana Mainnet missions with local policy checks and explicit approval.",
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
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
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
