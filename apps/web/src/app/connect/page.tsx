"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function ConnectContent() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/trade";

  useEffect(() => {
    if (connected && publicKey) {
      router.replace(next);
    }
  }, [connected, publicKey, router, next]);

  const features = [
    {
      icon: Wallet,
      title: "Your wallet opens the workspace",
      text: "Your public Solana address identifies your active Silfable web session and keeps each workspace separate.",
    },
    {
      icon: KeyRound,
      title: "Your private key stays in your wallet",
      text: "Silfable never asks for a seed phrase or private key. Your wallet signs only after you approve.",
    },
    {
      icon: ShieldCheck,
      title: "Policy checks before execution",
      text: "Silfable prepares Solana trades within your configured limits and keeps final transaction approval in your hands.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-16 text-[#f4f4f5] sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">
            Silfable Web Workspace
          </p>
          <h1 className="font-serif text-5xl font-normal leading-none text-white sm:text-7xl">
            Connect your wallet to begin.
          </h1>
          <p className="mt-6 max-w-xl font-sans text-sm leading-relaxed text-zinc-500">
            Use a Solana wallet to open your private Silfable workspace. Silfable can prepare trades, but every
            transaction still requires your approval in the wallet.
          </p>

          <button
            type="button"
            onClick={() => setVisible(true)}
            className="mt-8 inline-flex min-w-56 items-center justify-center gap-3 bg-blue-600 px-8 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        </div>

        <div className="border border-[#1a1a24] bg-[#0a0a0f]">
          {features.map((item) => {
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
              After connecting
            </p>
            <p className="mt-3 font-serif text-2xl">
              Continue to your Silfable trading workspace.
              <ArrowRight className="ml-2 inline h-5 w-5" />
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-500">
          Loading workspace...
        </div>
      }
    >
      <ConnectContent />
    </Suspense>
  );
}
