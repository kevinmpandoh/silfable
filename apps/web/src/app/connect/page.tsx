"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { isUserRejectedWalletRequest } from "@/lib/wallet-errors";

type AuthResponse = {
  authenticated?: boolean;
  challengeId?: string;
  message?: string;
  error?: string;
};

async function readAuthResponse(response: Response, fallback: string): Promise<AuthResponse> {
  const raw = await response.text();
  if (!raw) {
    throw new Error(`${fallback} (HTTP ${response.status}, empty response).`);
  }
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    throw new Error(
      `${fallback} (HTTP ${response.status}; server returned ${contentType} instead of JSON).`,
    );
  }
}

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") || "/trade";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/trade";
  const {
    wallet,
    publicKey,
    connected,
    connecting,
    connect,
    signMessage,
  } = useWallet();
  const { setVisible: setSolanaWalletVisible } = useWalletModal();
  const [authState, setAuthState] = useState<"ready" | "signing-solana">("ready");
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectRequested, setConnectRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/wallet/session", { cache: "no-store" })
      .then((response) => readAuthResponse(response, "Wallet session check failed"))
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
    setAuthError(null);
    if (!connected || !publicKey) {
      setConnectRequested(true);
      if (!wallet) setSolanaWalletVisible(true);
      return;
    }
    if (!signMessage) {
      setAuthError("This Solana wallet does not support message signing.");
      return;
    }
    setConnectRequested(false);
    setAuthState("signing-solana");
    try {
      const walletAddress = publicKey.toBase58();
      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, namespace: "solana" }),
      });
      const challenge = await readAuthResponse(challengeResponse, "Solana authentication challenge is unavailable");
      if (!challengeResponse.ok || typeof challenge.message !== "string") throw new Error(challenge.error || "Solana authentication challenge is unavailable.");
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(challenge.message)));
      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, walletAddress, signature }),
      });
      const verified = await readAuthResponse(verifyResponse, "Solana signature verification is unavailable");
      if (!verifyResponse.ok || verified.authenticated !== true) throw new Error(verified.error || "Solana signature could not be verified.");
      router.replace(next);
    } catch (error) {
      setConnectRequested(false);
      setAuthError(
        isUserRejectedWalletRequest(error)
          ? "Signature request was cancelled in your wallet. Nothing was signed."
          : error instanceof Error ? error.message : "Solana authentication failed.",
      );
      setAuthState("ready");
    }
  }, [connected, next, publicKey, router, setSolanaWalletVisible, signMessage, wallet]);

  useEffect(() => {
    if (!connectRequested || !wallet || connected || connecting) return;
    void connect().catch((cause) => {
      setConnectRequested(false);
      setAuthError(
        isUserRejectedWalletRequest(cause)
          ? "Wallet connection was cancelled. Press Connect wallet to try again."
          : cause instanceof Error ? cause.message : "Solana wallet could not be connected.",
      );
    });
  }, [connect, connectRequested, connected, connecting, wallet]);

  useEffect(() => {
    if (!connectRequested || !connected || !publicKey || authState !== "ready") return;
    const authentication = window.setTimeout(() => {
      void authenticateSolanaWallet();
    }, 0);
    return () => window.clearTimeout(authentication);
  }, [authState, authenticateSolanaWallet, connectRequested, connected, publicKey]);

  const assurances = [
    {
      icon: KeyRound,
      title: "Authentication only",
      text: "The sign-in signature proves wallet ownership. It does not move funds or approve a later trade.",
    },
    {
      icon: ShieldCheck,
      title: "Confirmation stays separate",
      text: "Every prepared market action still requires its own review and wallet confirmation.",
    },
  ];

  return (
    <main className="publicPage connectPage flex min-h-screen items-start px-4 pb-10 pt-24 sm:px-6 lg:h-dvh lg:min-h-0 lg:items-center lg:overflow-hidden lg:pb-5 lg:pt-24">
      <div className="connectInstrument mx-auto grid w-full max-w-6xl overflow-hidden border lg:max-h-[calc(100dvh-7rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="connectInstrumentMain relative overflow-hidden p-7 sm:p-9 lg:p-10">
          <p className="connectPlainLabel">Mirae Web Wallet Sign In</p>
          <h1 className="relative max-w-xl text-5xl font-bold leading-[0.94] tracking-[-0.065em] text-[var(--paper)] sm:text-7xl">
            Enter the current.<br />Operate on Solana first.
          </h1>
          <p className="relative mt-7 max-w-xl text-base leading-7 text-[var(--muted)]">
            Connect a Solana wallet to enter the workspace. Additional wallets can be linked only when you create a compatible session. Authentication never approves a transaction.
          </p>

          <div className="connectStepLabel"><span>01</span><strong>Authenticate account access</strong></div>
          <div className="relative mt-4 max-w-xl">
            <button type="button" onClick={() => void authenticateSolanaWallet()} disabled={authState !== "ready"} className="connectEcosystem isSolana inline-flex min-h-16 w-full items-center justify-center gap-3 px-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-60">
              <Wallet className="h-4 w-4" />
              <span>{authState === "signing-solana" ? "Awaiting signature..." : "Connect wallet"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Choose Phantom or Solflare in the wallet dialog. After connecting, Mirae requests one authentication signature and continues automatically.</p>
          </div>
          {authError && (
            <p className="relative mt-4 max-w-xl rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-relaxed text-rose-300">{authError}</p>
          )}
        </div>

        <div className="connectInstrumentGuide border-t border-[var(--line)] lg:border-l lg:border-t-0">
          <div className="connectFlow p-7 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <p className="connectPlainLabel isOrange">Two authority checkpoints</p>
              <p className="connectPlainStatus">No transaction</p>
            </div>
            <div className="connectRoutePair mt-7 grid gap-5 sm:grid-cols-2">
              <div className="connectRouteItem"><strong>01 Authentication</strong><span>Proves wallet ownership</span></div>
              <div className="connectRouteItem"><strong>02 Transaction</strong><span>Confirmed later per action</span></div>
            </div>
          </div>
          <div className="connectAssuranceGrid grid sm:grid-cols-2">
          {assurances.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="connectAssurance border-b border-[var(--line)] p-7 sm:p-8">
                <Icon className="mb-5 h-5 w-5 text-[var(--sc-violet)]" />
                <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--paper)]">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.text}</p>
              </div>
            );
          })}
          </div>
          <div className="connectAfter p-7 sm:p-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">
              After connecting
            </p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Verify your wallet, then choose the workflow you want to prepare.
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
