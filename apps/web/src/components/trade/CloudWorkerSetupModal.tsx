"use client";

import React, { useState } from "react";
import { AlertTriangle, Cpu, ShieldCheck, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

interface CloudWorkerSetupModalProps {
  walletAddress: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionStarted: (sessionId: string, agentPublicKey: string) => void;
}

async function getRobustLatestBlockhash(primaryConn: Connection) {
  try {
    return await primaryConn.getLatestBlockhash("confirmed");
  } catch {
    const fallbacks = [
      new Connection("https://rpc.ankr.com/solana", "confirmed"),
      new Connection("https://solana-rpc.publicnode.com", "confirmed"),
      new Connection("https://api.mainnet-beta.solana.com", "confirmed"),
    ];
    for (const fallbackConn of fallbacks) {
      try {
        return await fallbackConn.getLatestBlockhash("confirmed");
      } catch {
        continue;
      }
    }
    throw new Error("Unable to fetch recent blockhash from RPC providers.");
  }
}

export function CloudWorkerSetupModal({
  walletAddress,
  isOpen,
  onClose,
  onSessionStarted,
}: CloudWorkerSetupModalProps) {
  const [allocationSol, setAllocationSol] = useState("0.1");
  const [maxSingleTxSol, setMaxSingleTxSol] = useState("0.05");
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<"CONFIG" | "FUNDING">("CONFIG");
  const [agentPubKey, setAgentPubKey] = useState<string>("");
  const [createdSessionId, setCreatedSessionId] = useState<string>("");

  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();

  if (!isOpen) return null;

  async function handleStartWorker() {
    setLoading(true);
    setError(null);

    try {
      const allocationLamports = (parseFloat(allocationSol) * 1e9).toString();
      const singleTxLamports = (parseFloat(maxSingleTxSol) * 1e9).toString();
      const drawdownBps = Math.round(parseFloat(maxDrawdownPercent) * 100);

      const res = await fetch("/api/agent/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          maxAllocationLamports: allocationLamports,
          maxSingleTxLamports: singleTxLamports,
          maxDrawdownBps: drawdownBps,
          maxTxPerHour: 10,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start 24/7 Cloud Worker agent.");
      }

      setAgentPubKey(data.agentPublicKey);
      setCreatedSessionId(data.sessionId);
      setStep("FUNDING");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeposit() {
    if (!publicKey || !agentPubKey) {
      setError("Wallet not connected or agent key missing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const lamports = Math.floor(parseFloat(allocationSol) * 1e9);
      const { blockhash, lastValidBlockHeight } = await getRobustLatestBlockhash(connection);

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(agentPubKey),
          lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }).catch(() => null);

      onSessionStarted(createdSessionId, agentPubKey);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to send SOL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sessionModalBackdrop" role="dialog" aria-modal="true">
      <div className="sessionModal max-w-lg">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs tracking-wider uppercase mb-1">
              <Cpu className="size-4" /> 24/7 Autonomous Cloud Worker
            </div>
            <h2 className="text-xl font-bold text-white">Full Access Deployment</h2>
          </div>
          <button
            className="modalClose text-slate-400 hover:text-white text-2xl"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {step === "CONFIG" ? (
          <>
            <div className="sessionModalBody py-4 space-y-4 text-sm text-slate-300">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg flex items-start gap-3">
                <ShieldCheck className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200/90 leading-relaxed">
                  <strong>Isolated Ephemeral Key Vault:</strong> Your main wallet remains secure. A dedicated, encrypted agent keypair will execute trades 24/7 on distributed Cloud infrastructure even when your browser is closed.
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Initial Deposit Allocation (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                    value={allocationSol}
                    onChange={(e) => setAllocationSol(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Max Single Tx (SOL)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                      value={maxSingleTxSol}
                      onChange={(e) => setMaxSingleTxSol(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Max Drawdown (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                      value={maxDrawdownPercent}
                      onChange={(e) => setMaxDrawdownPercent(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <footer className="modalFooter flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
              <span className="text-xs text-slate-500">Automated Kill Switch Active</span>
              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  onClick={handleStartWorker}
                  disabled={loading}
                >
                  <Zap className="size-3.5 fill-black" />
                  {loading ? "Creating Vault..." : "Next: Fund Agent"}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <div className="sessionModalBody py-4 space-y-4 text-sm text-slate-300">
              <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-center space-y-2">
                <div className="inline-flex items-center justify-center size-10 rounded-full bg-emerald-950 text-emerald-400 mb-2">
                  <ArrowRight className="size-5" />
                </div>
                <h3 className="text-white font-semibold">Agent Vault Created</h3>
                <p className="text-xs text-slate-400 px-4">
                  Your 24/7 cloud worker is ready. Please fund the isolated agent wallet with <strong>{allocationSol} SOL</strong> to activate trading.
                </p>
                <div className="mt-3 p-2 bg-black/50 border border-slate-800 rounded font-mono text-[10px] text-emerald-400/70 break-all select-all">
                  {agentPubKey}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <footer className="modalFooter flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
              <span className="text-xs text-slate-500">Mainnet Transaction required</span>
              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  onClick={() => {
                    onSessionStarted(createdSessionId, agentPubKey);
                    onClose();
                  }}
                  disabled={loading}
                >
                  Fund Later
                </button>
                <button
                  className="px-4 py-2 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  onClick={handleDeposit}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 fill-black" />}
                  Deposit {allocationSol} SOL
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
