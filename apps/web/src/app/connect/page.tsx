"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { requestEvmAccount, signEvmAuthenticationMessage } from "@/lib/evm-browser-wallet";

function ConnectContent() {
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") || "/trade";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/trade";
  const [authState, setAuthState] = useState<"ready" | "signing-solana" | "signing-evm">("ready");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/wallet/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (cancelled) return;
        if (session.authenticated === true) {
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
  }, [router, next]);

  const authenticateSolanaWallet = useCallback(async () => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!signMessage) {
      setAuthError("This wallet does not support message signing. Use Phantom or Solflare.");
      return;
    }
    setAuthState("signing-solana");
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
        throw new Error(challenge.error || "Authentication challenge is unavailable.");
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
        throw new Error(verified.error || "Wallet signature could not be verified.");
      }
      router.replace(next);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Autentikasi wallet gagal.");
      setAuthState("ready");
    }
  }, [connected, publicKey, router, setVisible, signMessage, next]);

  const authenticateEvmWallet = useCallback(async () => {
    setAuthState("signing-evm");
    setAuthError(null);
    try {
      const account = await requestEvmAccount();
      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address, namespace: "evm", chainId: account.chainId }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok || typeof challenge.message !== "string") throw new Error(challenge.error || "EVM authentication challenge is unavailable.");
      const signature = await signEvmAuthenticationMessage(account.address, challenge.message);
      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, walletAddress: account.address, signature }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok || verified.authenticated !== true) throw new Error(verified.error || "EVM signature could not be verified.");
      router.replace(next);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Autentikasi EVM gagal.");
      setAuthState("ready");
    }
  }, [next, router]);

  const features = [
    {
      icon: Wallet,
      title: "One address opens your workspace",
      text: "Verify a Solana or EVM address to access your Silfable account and the wallets linked to it.",
    },
    {
      icon: KeyRound,
      title: "Sign in without sending a transaction",
      text: "The authentication signature proves wallet ownership. It does not move funds or authorize a later trade.",
    },
    {
      icon: ShieldCheck,
      title: "Review each transaction separately",
      text: "After sign-in, Silfable prepares supported swaps, bridges, launches, and strategy actions for a separate wallet confirmation.",
    },
  ];

  return (
    <main className="publicPage connectPage flex min-h-screen items-center px-4 py-28 sm:px-6">
      <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-[var(--line)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgb(32_201_151_/_0.18),transparent_26rem),var(--panel)] p-7 sm:p-12 lg:p-16">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full border-b border-l border-[var(--line)]" />
          <p className="relative mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-electric">
            Wallet sign-in / Silfable Web
          </p>
          <h1 className="relative max-w-xl text-5xl font-bold leading-[0.94] tracking-[-0.065em] text-[var(--paper)] sm:text-7xl">
            Connect once.<br />Review every action.
          </h1>
          <p className="relative mt-7 max-w-xl text-base leading-7 text-[var(--muted)]">
            Use a Solana wallet or an EVM wallet such as MetaMask or Rabby to open your account. The sign-in message only authenticates you; each transaction is reviewed and confirmed separately in its source wallet.
          </p>

          <div className="relative mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void authenticateSolanaWallet()} disabled={authState !== "ready"} className="auroraButton inline-flex min-h-14 items-center justify-center gap-3 px-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white disabled:opacity-60">
              <Wallet className="h-4 w-4" />
              {authState === "signing-solana" ? "Awaiting Solana Signature" : connected ? "Sign In With Solana" : "Connect Solana Wallet"}
            </button>
            <button type="button" onClick={() => void authenticateEvmWallet()} disabled={authState !== "ready"} className="outlineButton inline-flex min-h-14 items-center justify-center gap-3 px-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-60">
              <Wallet className="h-4 w-4" />
              {authState === "signing-evm" ? "Awaiting EVM Signature" : "Connect EVM Wallet"}
            </button>
          </div>
          {authError && (
            <p className="relative mt-4 max-w-xl rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-relaxed text-rose-300">{authError}</p>
          )}
          {connected && publicKey && authState === "ready" && (
            <p className="relative mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Connected {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)} · authentication signature only
            </p>
          )}
        </div>

        <div className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_72%,#020b10)] lg:border-l lg:border-t-0">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="border-b border-[var(--line)] p-7 sm:p-9 last:border-b-0">
                <Icon className="mb-5 h-6 w-6 text-electric" />
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--paper)]">{item.title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{item.text}</p>
              </div>
            );
          })}
          <div className="bg-[var(--aurora)] p-7 text-white sm:p-9">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">
              After connecting
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              Verify your wallet, enter the workspace, and choose the workflow you want to prepare.
              <ArrowRight className="ml-2 inline h-5 w-5" />
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

import { PageTransition } from "@/components/ui/PageTransition";

export default function ConnectPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-500">
            Loading workspace...
          </div>
        }
      >
        <ConnectContent />
      </Suspense>
    </PageTransition>
  );
}
