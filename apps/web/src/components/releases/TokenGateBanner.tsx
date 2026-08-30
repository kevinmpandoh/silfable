"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Coins, ExternalLink, Lock, RefreshCw, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMiraeTokenGate } from "@/hooks/useMiraeTokenGate";

export function TokenGateBanner() {
  const { disconnect } = useWallet();
  const {
    connected,
    walletAddress,
    balance,
    loading,
    isVerified,
    requiredBalance,
    symbol,
    jupiterBuyUrl,
    pumpfunUrl,
    refresh,
    connectWallet,
  } = useMiraeTokenGate();

  const formattedBalance = balance.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  const formattedRequired = requiredBalance.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  const percentProgress = Math.min(100, Math.round((balance / requiredBalance) * 100));

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Left Side: Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                ACCESS GRANTED · HOLDER VERIFIED
              </span>
            ) : connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <ShieldAlert className="size-3.5" />
                HOLD {formattedRequired} {symbol} TO UNLOCK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sc-orange)]/10 px-3 py-1 text-xs font-semibold text-[var(--sc-orange)]">
                <Lock className="size-3.5" />
                TOKEN GATED DOWNLOADS
              </span>
            )}
          </div>

          <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            {isVerified
              ? "Your Wallet is Verified for Desktop Access"
              : `Desktop Builds Require ${formattedRequired} ${symbol} Token`}
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            {isVerified ? (
              <>
                Holding <strong className="text-[var(--foreground)]">{formattedBalance} {symbol}</strong> in wallet{" "}
                <span className="font-mono text-xs">{shortAddress}</span>. All desktop release artifacts are unlocked for download.
              </>
            ) : connected ? (
              <>
                Connected wallet holds <strong className="text-[var(--foreground)]">{formattedBalance} / {formattedRequired} {symbol}</strong>. Please acquire additional tokens to unlock desktop installation packages.
              </>
            ) : (
              <>
                Connect your Solana wallet holding at least{" "}
                <strong className="text-[var(--foreground)]">{formattedRequired} {symbol}</strong> to verify ownership and unlock Linux & Windows desktop releases.
              </>
            )}
          </p>

          {/* Progress bar if connected but insufficient */}
          {connected && !isVerified && (
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] font-mono mb-1.5">
                <span>Holdings: {formattedBalance} {symbol}</span>
                <span>{percentProgress}% of {formattedRequired}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${percentProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {!connected ? (
            <Button
              onClick={connectWallet}
              className="solarPrimaryButton flex items-center gap-2"
            >
              <Wallet className="size-4" />
              Connect Wallet to Verify
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void refresh()}
                disabled={loading}
                className="h-10 px-4 flex items-center gap-2 text-xs"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Verifying..." : "Refresh"}
              </Button>
              <button
                type="button"
                onClick={() => void disconnect()}
                className="h-10 px-3 text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Disconnect ({shortAddress})
              </button>
            </div>
          )}

          {(!connected || !isVerified) && (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="h-10 px-4 text-xs">
                <a href={jupiterBuyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  <Coins className="size-3.5 text-amber-500" />
                  Buy on Jupiter
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-10 px-4 text-xs">
                <a href={pumpfunUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  Pump.fun
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
