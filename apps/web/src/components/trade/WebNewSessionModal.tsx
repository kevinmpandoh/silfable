"use client";

import React, { useState } from "react";

interface WebNewSessionModalProps {
  isOpen: boolean;
  walletAddress: string;
  onClose: () => void;
  onCancel: () => void;
  onCreateRestrictedSession: (session: {
    title: string;
    mode: "agent" | "mission";
  }) => Promise<void>;
}

export function WebNewSessionModal({
  isOpen,
  walletAddress,
  onClose,
  onCancel,
  onCreateRestrictedSession,
}: WebNewSessionModalProps) {
  const [title, setTitle] = useState("New Mainnet session");
  const [mode, setMode] = useState<"agent" | "mission">("agent");
  if (!isOpen) return null;

  async function handleSubmit() {
    await onCreateRestrictedSession({
      title: title.trim() || "New Mainnet session",
      mode,
    });
    onClose();
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <section className="sessionModal">
        <header className="sessionModalHeader">
          <div>
            <p className="kicker">New session</p>
            <h2>Your goal. Your rules.</h2>
            <p>Define how the AI agent may reason, plan, and use your Mainnet context.</p>
          </div>
          <button className="modalClose" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </header>

        <div className="sessionModalBody">
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>01</span>
              <strong>Session name</strong>
              <small>Used in your session history.</small>
            </div>
            <div>
              <input
                type="text"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Give this session a short name"
              />
              <div className="fieldMeta">
                <span>You can start chatting after creation.</span>
                <span>{title.length} / 80</span>
              </div>
            </div>
          </section>
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>02</span>
              <strong>Wallet network</strong>
              <small>Web sessions use the browser wallet currently connected to Silfable.</small>
            </div>
            <div className="choiceGrid">
              <button type="button" className="active">
                <span className="choiceNumber">01</span>
                <strong>Connected Solana wallet</strong>
                <small>{shortAddress(walletAddress)} · signing stays inside your wallet extension.</small>
              </button>
              <button type="button" className="unavailableChoice" disabled>
                <span className="choiceNumber">02 · DESKTOP</span>
                <strong>Local EVM wallet</strong>
                <small>EVM wallet generation and encrypted multi-wallet management are available in Desktop only.</small>
              </button>
            </div>
          </section>

          {/* 03 MODE */}
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>03</span>
              <strong>Mode</strong>
              <small>Choose the agent lifecycle.</small>
            </div>
            <div className="choiceGrid">
              <button
                type="button"
                className={mode === "agent" ? "active" : ""}
                onClick={() => setMode("agent")}
              >
                <span className="choiceNumber">01</span>
                <strong>Agent</strong>
                <small>Interactive conversation for analysis, planning, and one task at a time.</small>
              </button>

              <button
                type="button"
                className={mode === "mission" ? "active" : ""}
                onClick={() => setMode("mission")}
              >
                <span className="choiceNumber">02</span>
                <strong>Mission</strong>
                <small>Goal-driven workflow with explicit limits, checkpoints, and stop conditions.</small>
              </button>
            </div>
          </section>

          {/* 04 PERMISSION */}
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>04</span>
              <strong>Permission</strong>
              <small>Control mutating operations.</small>
            </div>
            <div className="choiceGrid">
              <button
                type="button"
                className="active"
              >
                <span className="choiceNumber">01</span>
                <strong>Restricted</strong>
                <small>Every future transaction requires deterministic checks and your approval.</small>
              </button>

              <button
                type="button"
                className="unavailableChoice"
                disabled
              >
                <span className="choiceNumber">02 · LOCKED</span>
                <strong>Full access</strong>
                <small>Unavailable on web. Cloud signing, broadcast, and private-key storage are disabled.</small>
              </button>
            </div>
          </section>
        </div>

        <footer className="sessionModalFooter">
          <span>MAINNET — RESTRICTED</span>
          <div className="flex items-center gap-3">
            <button type="button" className="cancelBtn" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="createBtn" onClick={handleSubmit}>
              Create Session
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
