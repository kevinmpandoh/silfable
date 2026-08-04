"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";

function ConnectContent() {
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") || "/trade";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/trade";
  const [authState, setAuthState] = useState<"ready" | "signing">("ready");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!connected || !publicKey) {
      return () => {
        cancelled = true;
      };
    }
    fetch("/api/auth/wallet/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (cancelled) return;
        if (session.authenticated === true && session.walletAddress === publicKey.toBase58()) {
          router.replace(next);
          return;
        }
        setAuthState("ready");
      })
      .catch(() => {
        if (!cancelled) setAuthState("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, router, next]);

  const authenticateWallet = useCallback(async () => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!signMessage) {
      setAuthError("Wallet ini tidak mendukung message signing. Gunakan Phantom atau Solflare.");
      return;
    }
    setAuthState("signing");
    setAuthError(null);
    try {
      const walletAddress = publicKey.toBase58();
      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok || typeof challenge.message !== "string") {
        throw new Error(challenge.error || "Challenge autentikasi tidak tersedia.");
      }
      const signatureBytes = await signMessage(new TextEncoder().encode(challenge.message));
      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          walletAddress,
          signature: bs58.encode(signatureBytes),
        }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok || verified.authenticated !== true) {
        throw new Error(verified.error || "Signature wallet tidak dapat diverifikasi.");
      }
      router.replace(next);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Autentikasi wallet gagal.");
      setAuthState("ready");
    }
  }, [connected, publicKey, router, setVisible, signMessage, next]);

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
      text: "Silfable prepares cross-chain trades and DCA plans within your configured limits, keeping final transaction approval in your hands.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-16 text-[#f4f4f5] sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-electric">
            Silfable Web Workspace
          </p>
          <h1 className="font-serif text-5xl font-normal leading-none text-white sm:text-7xl">
            Connect your wallet to begin.
          </h1>
          <p className="mt-6 max-w-xl font-sans text-sm leading-relaxed text-zinc-500">
            Use a Solana wallet to open your private Silfable workspace. Silfable can prepare multi-chain trades, bridge flows, and DCA plans, but every transaction still requires your explicit approval.
          </p>

          <button
            type="button"
            onClick={() => void authenticateWallet()}
            disabled={authState === "signing"}
            className="mt-8 inline-flex min-w-56 items-center justify-center gap-3 bg-electric px-8 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          >
            <Wallet className="h-4 w-4" />
            {!connected
              ? "Connect Wallet"
              : authState === "signing"
                ? "Awaiting Signature"
                : "Sign In With Wallet"}
          </button>
          {authError && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-rose-400">{authError}</p>
          )}
          {connected && publicKey && authState === "ready" && (
            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              Connected {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)} · authentication signature only
            </p>
          )}
        </div>

        <div className="border border-[#1a1a24] bg-[#0a0a0f]">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="border-b border-[#1a1a24] p-6 last:border-b-0">
                <Icon className="mb-5 h-6 w-6 text-electric" />
                <h2 className="font-serif text-2xl text-white">{item.title}</h2>
                <p className="mt-3 font-sans text-sm leading-relaxed text-zinc-500">{item.text}</p>
              </div>
            );
          })}
          <div className="border-t border-[#1a1a24] bg-electric p-6 text-white">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
              After connecting
            </p>
            <p className="mt-3 font-serif text-2xl">
              Connect, sign the authentication message, then continue to the restricted workspace.
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
