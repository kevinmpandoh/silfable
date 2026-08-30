"use client";

import React from "react";
import { ArrowDownToLine, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMiraeTokenGate } from "@/hooks/useMiraeTokenGate";

export type GatedDownloadButtonProps = {
  href: string;
  label: string;
  primary?: boolean;
  className?: string;
};

export function GatedDownloadButton({
  href,
  label,
  primary = false,
  className,
}: GatedDownloadButtonProps) {
  const { connected, isVerified, connectWallet, balance } = useMiraeTokenGate();

  if (isVerified) {
    return (
      <Button
        asChild
        variant={primary ? undefined : "outline"}
        className={className || (primary ? "solarPrimaryButton" : "outlineButton")}
      >
        <a href={href} download>
          {label}
          <ArrowDownToLine className="ml-3 size-4" />
        </a>
      </Button>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!connected) {
      connectWallet();
    } else {
      const el = document.getElementById("downloads");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="outline"
      className={`opacity-85 hover:opacity-100 border-dashed ${className || ""}`}
      title={
        !connected
          ? "Connect wallet holding 100,000 $MIRAE to download"
          : `Requires 100,000 $MIRAE (Current: ${balance.toLocaleString()} $MIRAE)`
      }
    >
      <span className="flex items-center gap-2 truncate">
        <Lock className="size-3.5 text-amber-500 shrink-0" />
        <span>{label}</span>
      </span>
      <span className="ml-2 font-mono text-[10px] text-amber-600 dark:text-amber-400">
        [100k $MIRAE]
      </span>
    </Button>
  );
}