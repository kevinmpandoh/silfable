"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

export const MIRAE_TOKEN_MINT = "A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";
export const REQUIRED_TOKEN_BALANCE = 100_000;
export const PUMPFUN_URL = "https://pump.fun/coin/A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";
export const JUPITER_BUY_URL = "https://jup.ag/swap/SOL-A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";

export type TokenGateState = {
  connected: boolean;
  walletAddress: string | null;
  balance: number;
  loading: boolean;
  isVerified: boolean;
  requiredBalance: number;
  mintAddress: string;
  error: string | null;
  refresh: () => Promise<void>;
  connectWallet: () => void;
};

export function useMiraeTokenGate(): TokenGateState {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();

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
      const mintPubkey = new PublicKey(MIRAE_TOKEN_MINT);
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
      console.warn("Client RPC token balance check failed, trying API...", clientErr);
      try {
        const res = await fetch(`/api/token-gate/balance?address=${publicKey.toBase58()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Server HTTP ${res.status}`);
        const data = await res.json();
        setBalance(typeof data.balance === "number" ? data.balance : 0);
      } catch (serverErr) {
        console.error("Token balance query error:", serverErr);
        setError("Failed to verify on-chain balance. Please click refresh.");
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

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

  const isVerified = connected && balance >= REQUIRED_TOKEN_BALANCE;

  return {
    connected,
    walletAddress: publicKey ? publicKey.toBase58() : null,
    balance,
    loading,
    isVerified,
    requiredBalance: REQUIRED_TOKEN_BALANCE,
    mintAddress: MIRAE_TOKEN_MINT,
    error,
    refresh: fetchBalance,
    connectWallet,
  };
}