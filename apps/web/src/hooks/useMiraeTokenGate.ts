"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

// Configurable via NEXT_PUBLIC_ environment variables
export const DEFAULT_MIRAE_TOKEN_MINT = "A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";
export const DEFAULT_REQUIRED_BALANCE = 100_000;
export const DEFAULT_TOKEN_SYMBOL = "$MIRAE";

export function getTokenGateConfig() {
  const mint = process.env.NEXT_PUBLIC_TOKEN_GATE_MINT?.trim() || DEFAULT_MIRAE_TOKEN_MINT;
  const rawBalance = process.env.NEXT_PUBLIC_TOKEN_GATE_REQUIRED_BALANCE?.trim();
  const requiredBalance = rawBalance && !isNaN(Number(rawBalance)) ? Number(rawBalance) : DEFAULT_REQUIRED_BALANCE;
  const symbol = process.env.NEXT_PUBLIC_TOKEN_GATE_SYMBOL?.trim() || DEFAULT_TOKEN_SYMBOL;

  const pumpfunUrl = `https://pump.fun/coin/${mint}`;
  const jupiterBuyUrl = `https://jup.ag/swap/SOL-${mint}`;

  return {
    mint,
    requiredBalance,
    symbol,
    pumpfunUrl,
    jupiterBuyUrl,
  };
}

export type TokenGateState = {
  connected: boolean;
  walletAddress: string | null;
  balance: number;
  loading: boolean;
  isVerified: boolean;
  requiredBalance: number;
  mintAddress: string;
  symbol: string;
  pumpfunUrl: string;
  jupiterBuyUrl: string;
  error: string | null;
  refresh: () => Promise<void>;
  connectWallet: () => void;
};

export function useMiraeTokenGate(): TokenGateState {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const config = getTokenGateConfig();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try client-side RPC query
      const mintPubkey = new PublicKey(config.mint);
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: mintPubkey,
      });

      let total = 0;
      for (const item of accounts.value) {
        const info = item.account.data.parsed?.info?.tokenAmount;
        if (typeof info?.uiAmount === "number") {
          total += info.uiAmount;
        } else if (info?.amount && typeof info?.decimals === "number") {
          total += Number(info.amount) / Math.pow(10, info.decimals);
        }
      }

      setBalance(total);
    } catch (clientErr) {
      console.warn("Client RPC token balance check failed, trying API fallback...", clientErr);
      try {
        // 2. Fallback to server API endpoint
        const res = await fetch(`/api/token-gate/balance?address=${publicKey.toBase58()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        const data = await res.json();
        setBalance(typeof data.balance === "number" ? data.balance : 0);
      } catch (serverErr) {
        console.error("Token balance query error:", serverErr);
        setError("Failed to verify on-chain balance. Please click refresh.");
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, config.mint]);

  useEffect(() => {
    if (connected && publicKey) {
      void fetchBalance();
    } else {
      setBalance(0);
      setLoading(false);
      setError(null);
    }
  }, [connected, publicKey, fetchBalance]);

  const connectWallet = useCallback(() => {
    setWalletModalVisible(true);
  }, [setWalletModalVisible]);

  const isVerified = connected && balance >= config.requiredBalance;

  return {
    connected,
    walletAddress: publicKey ? publicKey.toBase58() : null,
    balance,
    loading,
    isVerified,
    requiredBalance: config.requiredBalance,
    mintAddress: config.mint,
    symbol: config.symbol,
    pumpfunUrl: config.pumpfunUrl,
    jupiterBuyUrl: config.jupiterBuyUrl,
    error,
    refresh: fetchBalance,
    connectWallet,
  };
}
