"use client";

import { useState } from "react";
import { ArrowRightLeft, ChevronDown } from "lucide-react";

const destinations = [
  ["base", "Base"],
  ["arbitrum", "Arbitrum"],
  ["ethereum", "Ethereum"],
  ["optimism", "Optimism"],
  ["polygon", "Polygon"],
  ["avalanche", "Avalanche"],
  ["robinhood", "Robinhood Chain"],
] as const;

export type SolanaBridgeRequest = {
  destination: (typeof destinations)[number][0];
  destinationRecipient: string;
  amountUsdc: string;
};

export function SolanaBridgePanel({
  onPrepare,
  busy,
}: {
  onPrepare: (request: SolanaBridgeRequest) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<SolanaBridgeRequest["destination"]>("base");
  const [destinationRecipient, setDestinationRecipient] = useState("");
  const [amountUsdc, setAmountUsdc] = useState("");

  async function submit() {
    await onPrepare({ destination, destinationRecipient: destinationRecipient.trim(), amountUsdc: amountUsdc.trim() });
  }

  return (
    <section className="webBridgePanel">
      <button type="button" className="webBridgeToggle" onClick={() => setOpen((value) => !value)}>
        <span><ArrowRightLeft className="size-3.5" /> Bridge USDC to EVM</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="webBridgeFields">
          <p>Bridge USDC from this connected Solana wallet. The quote creates one unsigned transaction; your wallet remains the only signer.</p>
          <div className="webBridgeGrid">
            <label>
              <span>Destination</span>
              <select value={destination} onChange={(event) => setDestination(event.target.value as SolanaBridgeRequest["destination"])}>
                {destinations.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>USDC amount</span>
              <input value={amountUsdc} onChange={(event) => setAmountUsdc(event.target.value)} placeholder="25.00" inputMode="decimal" />
            </label>
          </div>
          <label>
            <span>EVM recipient address</span>
            <input value={destinationRecipient} onChange={(event) => setDestinationRecipient(event.target.value)} placeholder="0x..." spellCheck={false} autoComplete="off" />
          </label>
          <div className="webBridgeActions">
            <small>Minimum 0.01 USDC · maximum 1,000 USDC per bridge.</small>
            <button type="button" disabled={busy || !amountUsdc.trim() || !destinationRecipient.trim()} onClick={() => void submit()}>
              {busy ? "Preparing quote…" : "Review in wallet"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
