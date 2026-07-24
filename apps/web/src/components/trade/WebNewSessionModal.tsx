"use client";

import React, { useState } from "react";

interface WebNewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRestrictedSession: (session: {
    title: string;
    workspace: "general" | "pump";
    mode: "agent" | "mission";
  }) => void;
  onSelectFullAccess: () => void;
}

export function WebNewSessionModal({
  isOpen,
  onClose,
  onCreateRestrictedSession,
  onSelectFullAccess,
}: WebNewSessionModalProps) {
  const [workspace, setWorkspace] = useState<"general" | "pump">("general");
  const [title, setTitle] = useState("New Mainnet session");
  const [mode, setMode] = useState<"agent" | "mission">("agent");
  const [permission, setPermission] = useState<"restricted" | "full_access">("restricted");

  if (!isOpen) return null;

  function handleSubmit() {
    if (permission === "full_access") {
      onClose();
      onSelectFullAccess();
    } else {
      onCreateRestrictedSession({
        title: title.trim() || "New Mainnet session",
        workspace,
        mode,
      });
      onClose();
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <section className="sessionModal">
        <header className="sessionModalHeader">
          <div>
            <p className="kicker">New session</p>
            <h2>Your goal. Your rules.</h2>
            <p>Define how the AI agent may reason, plan, and use your Mainnet context.</p>
          </div>
          <button className="modalClose" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="sessionModalBody">
          {/* 01 WORKSPACE */}
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>01</span>
              <strong>Workspace</strong>
              <small>Choose the market context for this session.</small>
            </div>
            <div className="choiceGrid">
              <button
                type="button"
                className={workspace === "general" ? "active" : ""}
                onClick={() => {
                  setWorkspace("general");
                  setMode("agent");
                }}
              >
                <span className="choiceNumber">01</span>
                <strong>General agent</strong>
                <small>Wallet analysis, research, and ordinary restricted Mainnet planning.</small>
              </button>

              <button
                type="button"
                className={workspace === "pump" ? "active pumpChoice" : "pumpChoice"}
                onClick={() => {
                  setWorkspace("pump");
                  setMode("mission");
                }}
              >
                <span className="choiceNumber">02</span>
                <strong>Pump.fun agent</strong>
                <small>Exact-mint monitoring and proposal-only Pump/PumpSwap analysis.</small>
              </button>
            </div>
          </section>

          {/* 02 SESSION NAME */}
          <section className="sessionConfigSection">
            <div className="sectionLegend">
              <span>02</span>
              <strong>Session name</strong>
              <small>Used in your session history.</small>
            </div>
            <div>
              <input
                type="text"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this session a short name"
              />
              <div className="fieldMeta">
                <span>You can start chatting after creation.</span>
                <span>{title.length} / 80</span>
              </div>
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
                className={workspace === "pump" ? "unavailableChoice" : mode === "agent" ? "active" : ""}
                disabled={workspace === "pump"}
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
                className={permission === "restricted" ? "active" : ""}
                onClick={() => setPermission("restricted")}
              >
                <span className="choiceNumber">01</span>
                <strong>Restricted</strong>
                <small>Every future transaction requires deterministic checks and your approval.</small>
              </button>

              <button
                type="button"
                className={permission === "full_access" ? "active" : ""}
                onClick={() => setPermission("full_access")}
              >
                <span className="choiceNumber">02</span>
                <strong>Full access (24/7 Cloud)</strong>
                <small>Autonomous execution using a dedicated session Ephemeral Vault with drawdown limits.</small>
              </button>
            </div>
          </section>
        </div>

        <footer className="sessionModalFooter">
          <span>MAINNET — {permission.toUpperCase()}</span>
          <div className="flex items-center gap-3">
            <button type="button" className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="createBtn" onClick={handleSubmit}>
              {permission === "full_access" ? "Next: Configure Cloud Worker" : "Create Session"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
