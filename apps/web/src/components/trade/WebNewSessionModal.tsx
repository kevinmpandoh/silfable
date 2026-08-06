"use client";

import React, { useMemo, useState } from "react";
import { WEB_EVM_CHAINS, type WebEvmChainKey } from "@/lib/evm-chains";
import { requestEvmAccount, signEvmAuthenticationMessage } from "@/lib/evm-browser-wallet";

export type LinkedWebWallet = {
  id: string;
  namespace: "solana" | "evm";
  address: string;
  label?: string | null;
  verifiedAt: string;
};

interface WebNewSessionModalProps {
  isOpen: boolean;
  walletAddress: string;
  linkedWallets: LinkedWebWallet[];
  onWalletLinked: (wallet: LinkedWebWallet) => void;
  onClose: () => void;
  onCancel: () => void;
  onCreateRestrictedSession: (session: {
    title: string;
    mode: "agent" | "mission";
    workspace: "solana" | "evm" | "bridge";
    chainKey?: WebEvmChainKey;
    sessionWalletAddress: string;
  }) => Promise<void>;
}

export function WebNewSessionModal({
  isOpen,
  walletAddress,
  linkedWallets,
  onWalletLinked,
  onClose,
  onCancel,
  onCreateRestrictedSession,
}: WebNewSessionModalProps) {
  const [title, setTitle] = useState("New Mainnet session");
  const [mode, setMode] = useState<"agent" | "mission">("agent");
  const [workspace, setWorkspace] = useState<"solana" | "evm" | "bridge">("solana");
  const [chainKey, setChainKey] = useState<WebEvmChainKey>("robinhood");
  const [selectedEvmAddress, setSelectedEvmAddress] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evmWallets = useMemo(() => linkedWallets.filter((wallet) => wallet.namespace === "evm"), [linkedWallets]);
  const effectiveEvmAddress = selectedEvmAddress || evmWallets[0]?.address || "";
  if (!isOpen) return null;

  async function linkEvmWallet() {
    setLinking(true);
    setError(null);
    try {
      const account = await requestEvmAccount();
      const challengeResponse = await fetch("/api/wallets/evm/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok || typeof challenge.message !== "string") throw new Error(challenge.error || "EVM verification challenge tidak tersedia.");
      const signature = await signEvmAuthenticationMessage(account.address, challenge.message);
      const verifyResponse = await fetch("/api/wallets/evm/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, address: account.address, signature, label: "Browser EVM wallet" }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok || !result.wallet) throw new Error(result.error || "EVM wallet tidak dapat ditautkan.");
      onWalletLinked(result.wallet as LinkedWebWallet);
      setSelectedEvmAddress(result.wallet.address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "EVM wallet tidak dapat ditautkan.");
    } finally {
      setLinking(false);
    }
  }

  async function handleSubmit() {
    const sessionWalletAddress = workspace === "evm" ? effectiveEvmAddress : walletAddress;
    if (!sessionWalletAddress) {
      setError("Tautkan dan pilih wallet EVM sebelum membuat session.");
      return;
    }
    await onCreateRestrictedSession({
      title: title.trim() || "New Mainnet session",
      mode,
      workspace,
      chainKey: workspace === "solana" ? undefined : chainKey,
      sessionWalletAddress,
    });
    onClose();
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="sessionModal">
        <header className="sessionModalHeader">
          <div>
            <p className="kicker">New session</p>
            <h2>Your goal. Your wallet. One chain.</h2>
            <p>Every session is bound to one source wallet so the signer can never change silently.</p>
          </div>
          <button className="modalClose" aria-label="Close" onClick={onCancel}>×</button>
        </header>

        <div className="sessionModalBody">
          <section className="sessionConfigSection">
            <div className="sectionLegend"><span>01</span><strong>Session name</strong><small>Used in your session history.</small></div>
            <div>
              <input type="text" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Give this session a short name" />
              <div className="fieldMeta"><span>You can start chatting after creation.</span><span>{title.length} / 80</span></div>
            </div>
          </section>

          <section className="sessionConfigSection">
            <div className="sectionLegend"><span>02</span><strong>Workspace</strong><small>Choose the source execution environment.</small></div>
            <div className="choiceGrid sessionWorkspaceChoices">
              {(["solana", "evm", "bridge"] as const).map((value, index) => (
                <button type="button" key={value} className={workspace === value ? "active" : ""} onClick={() => setWorkspace(value)}>
                  <span className="choiceNumber">0{index + 1}</span>
                  <strong>{value === "solana" ? "Solana" : value === "evm" ? "EVM" : "Bridge"}</strong>
                  <small>{value === "solana" ? "Solana browser wallet" : value === "evm" ? "Linked EVM browser wallet" : "Solana source to an EVM chain"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="sessionConfigSection">
            <div className="sectionLegend"><span>03</span><strong>Wallet and chain</strong><small>The binding is persisted with this session.</small></div>
            <div className="sessionWalletBinding">
              {workspace === "solana" ? (
                <div className="boundWallet"><strong>Primary Solana</strong><span>{shortAddress(walletAddress)}</span></div>
              ) : workspace === "bridge" ? (
                <div className="boundWallet"><strong>Source · Solana</strong><span>{shortAddress(walletAddress)}</span></div>
              ) : (
                <>
                  {evmWallets.length > 0 && (
                    <label><span>Execution wallet</span><select value={effectiveEvmAddress} onChange={(event) => setSelectedEvmAddress(event.target.value)}>
                      {evmWallets.map((wallet) => <option key={wallet.id} value={wallet.address}>{wallet.label || "EVM wallet"} · {shortAddress(wallet.address)}</option>)}
                    </select></label>
                  )}
                  <button type="button" className="linkWalletButton" disabled={linking} onClick={() => void linkEvmWallet()}>{linking ? "Awaiting wallet signature…" : "+ Link another EVM wallet"}</button>
                </>
              )}
              {workspace !== "solana" && (
                <label><span>{workspace === "bridge" ? "Destination chain" : "Execution chain"}</span><select value={chainKey} onChange={(event) => setChainKey(event.target.value as WebEvmChainKey)}>
                  {WEB_EVM_CHAINS.map((chain) => <option key={chain.key} value={chain.key}>{chain.name} · {chain.nativeSymbol}</option>)}
                </select></label>
              )}
              {error && <p className="sessionBindingError">{error}</p>}
            </div>
          </section>

          <section className="sessionConfigSection">
            <div className="sectionLegend"><span>04</span><strong>Mode</strong><small>Choose the agent lifecycle.</small></div>
            <div className="choiceGrid">
              <button type="button" className={mode === "agent" ? "active" : ""} onClick={() => setMode("agent")}><span className="choiceNumber">01</span><strong>Agent</strong><small>Interactive analysis and one approved action at a time.</small></button>
              <button type="button" className={mode === "mission" ? "active" : ""} onClick={() => setMode("mission")}><span className="choiceNumber">02</span><strong>Mission</strong><small>Goal-driven workflow with explicit limits and stop conditions.</small></button>
            </div>
          </section>

          <section className="sessionConfigSection">
            <div className="sectionLegend"><span>05</span><strong>Permission</strong><small>Restricted browser-wallet authority.</small></div>
            <div className="choiceGrid"><button type="button" className="active"><span className="choiceNumber">01</span><strong>Restricted</strong><small>Every transaction requires deterministic checks and approval in the bound wallet.</small></button><button type="button" className="unavailableChoice" disabled><span className="choiceNumber">02 · LOCKED</span><strong>Full access</strong><small>Cloud signing and private-key storage remain disabled.</small></button></div>
          </section>
        </div>

        <footer className="sessionModalFooter"><span>MAINNET — RESTRICTED</span><div className="flex items-center gap-3"><button type="button" className="cancelBtn" onClick={onCancel}>Cancel</button><button type="button" className="createBtn" onClick={() => void handleSubmit()}>Create Session</button></div></footer>
      </section>
    </div>
  );
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";
}
