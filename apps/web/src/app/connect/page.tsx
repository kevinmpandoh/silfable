"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck, Wallet, Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic<React.HTMLAttributes<HTMLButtonElement>>(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

function ConnectContent() {
  const { connected, publicKey, select, wallets: availableWallets } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/trade";

  // If connected, automatically redirect to /trade
  useEffect(() => {
    if (connected && publicKey) {
      router.replace(next);
    }
  }, [connected, publicKey, router, next]);

  const handleConnectWallet = async (walletName?: string) => {
    setError(null);
    setIsConnecting(true);
    try {
      if (walletName) {
        const target = availableWallets.find((w) =>
          w.adapter.name.toLowerCase().includes(walletName.toLowerCase())
        );
        if (target) {
          select(target.adapter.name);
        } else {
          setError(`${walletName} wallet extension not detected. Please install the ${walletName} browser extension.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-16 text-[#f4f4f5] sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left Column */}
        <div>
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">
            Identity Wallet
          </p>
          <h1 className="font-serif text-5xl font-normal leading-none text-white sm:text-7xl">
            Connect before the agent console.
          </h1>
          <p className="mt-6 max-w-xl font-sans text-sm leading-relaxed text-zinc-500">
            Your connected wallet is used as identity only. It creates a private workspace scope for your trading proposals,
            browser-wallet approvals, RPC endpoints, and risk settings.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => handleConnectWallet("Phantom")}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 px-8 py-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {connected ? "Reconnect Phantom" : "Connect Phantom"}
            </button>

            <button
              type="button"
              onClick={() => handleConnectWallet("Solflare")}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2 border border-[#1a1a24] bg-[#0a0a0f] px-8 py-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400 transition-colors hover:border-amber-400/50 hover:bg-[#12121a]"
            >
              <Zap className="h-4 w-4" />
              Connect Solflare
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 border border-[#1a1a24] bg-[#0a0a0f] px-8 py-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-white"
            >
              Back to Site
            </Link>
          </div>

          <div className="mt-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600 block mb-2">
              — OR SELECT OTHER SOLANA WALLET —
            </span>
            <WalletMultiButton className="walletBtnOverride" />
          </div>

          {error && (
            <p className="mt-5 border border-red-500/20 bg-red-500/5 p-4 font-sans text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Right Column Feature Card */}
        <div className="border border-[#1a1a24] bg-[#0a0a0f]">
          {[
            {
              icon: Wallet,
              title: "Wallet as identity",
              text: "The public wallet address maps to your active session and private trading workspace namespace.",
            },
            {
              icon: KeyRound,
              title: "No private key in browser required",
              text: "Silfable prepares restricted Mainnet proposals, then your Phantom or Solflare wallet signs only after you approve.",
            },
            {
              icon: ShieldCheck,
              title: "Per-user settings & guards",
              text: "Risk bounds, custom RPC nodes, API keys, and execution receipts are strictly filtered by your connected wallet.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="border-b border-[#1a1a24] p-6 last:border-b-0">
                <Icon className="mb-5 h-6 w-6 text-blue-500" />
                <h2 className="font-serif text-2xl text-white">{item.title}</h2>
                <p className="mt-3 font-sans text-sm leading-relaxed text-zinc-500">{item.text}</p>
              </div>
            );
          })}
          <div className="border-t border-[#1a1a24] bg-blue-600 p-6 text-white">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">
              After connect
            </p>
            <p className="mt-3 font-serif text-2xl">
              Trading workspace follows the wallet session.
              <ArrowRight className="ml-2 inline h-5 w-5" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] text-zinc-500 flex items-center justify-center">Loading portal...</div>}>
      <ConnectContent />
    </Suspense>
  );
}
