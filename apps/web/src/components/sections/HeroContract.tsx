"use client";

import { useState } from "react";

const CONTRACT_ADDRESS = "A4axW4db7Tdu7Yu3NyxqZ7ZDWVxUNBC8VXyzYE2upump";

export function HeroContract() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="brightHeroCa" onClick={copy} aria-label={`Copy contract address ${CONTRACT_ADDRESS}`}>
      <span className="brightHeroCaLabel">CA</span>
      <span className="brightHeroCaValue">{CONTRACT_ADDRESS}</span>
      <span className="brightHeroCaState">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
