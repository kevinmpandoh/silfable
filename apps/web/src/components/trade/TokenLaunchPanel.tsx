"use client";

import { useEffect, useState } from "react";
import { ImagePlus, ShieldAlert, UploadCloud } from "lucide-react";
import { automaticLaunchLimits } from "@/lib/token-launch-limits";

export type PublishedTokenMetadata = {
  imageUri: string;
  metadataUri: string;
  metadataGatewayUrl: string;
  metadataSha256: string;
};

export type PublishedTokenLaunchDraft = PublishedTokenMetadata & {
  name: string;
  symbol: string;
  description: string;
  creatorBuyLamports: string;
  maxCreatorOutflowLamports: string;
  maxPriorityFeeLamports: string;
};

export function TokenLaunchPanel({
  creatorWallet,
  onClose,
  onPublished,
}: {
  creatorWallet: string;
  onClose: () => void;
  onPublished: (draft: PublishedTokenLaunchDraft) => void;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [creatorBuySol, setCreatorBuySol] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && symbol.trim().length > 0 && Boolean(image) && acknowledged;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onClose]);

  async function publish(): Promise<void> {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (!image) throw new Error("Choose a token image to upload through Pinata.");
      const creatorBuyLamports = solToLamports(creatorBuySol, true);
      const { maxCreatorOutflowLamports, maxPriorityFeeLamports } = automaticLaunchLimits(creatorBuyLamports);
      const form = new FormData();
      form.set("walletAddress", creatorWallet);
      form.set("name", name.trim());
      form.set("symbol", symbol.trim().toUpperCase());
      form.set("description", description.trim());
      form.set("websiteUrl", websiteUrl.trim());
      form.set("xUrl", xUrl.trim());
      form.set("telegramUrl", telegramUrl.trim());
      form.set("image", image);
      const response = await fetch("/api/token-launch/metadata", { method: "POST", body: form });
      const result = await response.json() as { error?: string } & Partial<PublishedTokenMetadata>;
      if (!response.ok || !result.imageUri || !result.metadataUri || !result.metadataGatewayUrl || !result.metadataSha256) {
        throw new Error(result.error || "Token metadata could not be published.");
      }
      onPublished({
        imageUri: result.imageUri,
        metadataUri: result.metadataUri,
        metadataGatewayUrl: result.metadataGatewayUrl,
        metadataSha256: result.metadataSha256,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        creatorBuyLamports,
        maxCreatorOutflowLamports,
        maxPriorityFeeLamports,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Token metadata could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgb(32,33,42,0.35)] p-3 backdrop-blur-md sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[rgb(223,107,34,0.34)] bg-white text-[#20212a] shadow-[0_32px_90px_-34px_rgba(32,33,42,0.42)] sm:max-h-[calc(100vh-3rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-launch-modal-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-5 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#df6b22] uppercase">TOKEN LAUNCH · METADATA DRAFT</p>
            <h2 id="token-launch-modal-title" className="mt-1 text-lg font-semibold text-[#20212a]">Prepare Pump.fun launch metadata</h2>
            <p className="mt-1 text-xs leading-5 text-[#686970]">The token image and metadata JSON are uploaded to public IPFS through Pinata. This step does not create, sign, or broadcast a token transaction.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-[rgb(32,33,42,0.12)] bg-[#f4f4f1] text-base text-[#686970] transition hover:border-[rgb(223,107,34,0.4)] hover:bg-[#fff1e8] hover:text-[#df6b22] disabled:opacity-40"
            aria-label="Close Token Launch modal"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-5 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#20212a]">
              Name
              <input
                maxLength={32}
                placeholder="e.g. Mirae Solana"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a]">
              Symbol
              <input
                maxLength={10}
                placeholder="e.g. MIRAE"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/gu, ""))}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a] sm:col-span-2">
              Description
              <textarea
                maxLength={500}
                placeholder="Describe the token, goal, and roadmap..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a] sm:col-span-2">
              Token image via Pinata (PNG, JPEG, GIF, or WebP; max 10 MB)
              <span className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#df6b22]/40 bg-[#fff8f3] px-3 py-2.5 text-sm font-medium text-[#df6b22] hover:border-[#df6b22] hover:bg-[#fff1e8] transition-colors">
                <ImagePlus className="size-4 shrink-0" />
                {image ? image.name : "Choose image file"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="sr-only"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-[#20212a]">
              Website (optional)
              <input
                type="url"
                placeholder="https://..."
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a]">
              X profile (optional)
              <input
                type="url"
                placeholder="https://x.com/..."
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a] sm:col-span-2">
              Telegram (optional)
              <input
                type="url"
                placeholder="https://t.me/..."
                value={telegramUrl}
                onChange={(event) => setTelegramUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
            </label>
            <label className="text-xs font-semibold text-[#20212a] sm:col-span-2">
              Creator buy (SOL, optional)
              <input
                inputMode="decimal"
                value={creatorBuySol}
                onChange={(event) => setCreatorBuySol(sanitizeSol(event.target.value))}
                className="mt-1 w-full rounded-lg border border-[rgb(32,33,42,0.14)] bg-[#f8f8f6] px-3 py-2 text-sm text-[#20212a] placeholder:text-[#929399] focus:border-[#df6b22] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#df6b22]/15 transition-all"
              />
              <span className="mt-1 block text-[10px] leading-4 text-[#686970]">
                Use 0 for launch only. Mirae automatically reserves a guarded allowance for slippage, account rent, and network fees. The exact creator token amount and total wallet cost are shown after unsigned simulation.
              </span>
            </label>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-xs leading-5 text-[#4e5058]">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-4 rounded border-[rgb(32,33,42,0.2)] text-[#df6b22] accent-[#df6b22]"
            />
            <span>
              I understand the metadata upload is public and irreversible. Publishing creates a review draft; launching still requires preflight, final review, and explicit wallet approval.
            </span>
          </label>

          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-[rgb(32,33,42,0.12)] bg-[#fffaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-1.5 text-[11px] leading-4 text-[#686970]">
            <ShieldAlert className="size-3.5 shrink-0 text-[#df6b22]" />
            Metadata can be drafted while the wallet is disconnected. Execution still requires the bound wallet and a passing simulation.
          </span>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-full border border-[rgb(32,33,42,0.16)] bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#686970] hover:border-[#df6b22]/40 hover:text-[#df6b22] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid || busy || !isSolValue(creatorBuySol, true)}
              onClick={() => void publish()}
              className="primaryButton inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <UploadCloud className="size-3.5" />
              {busy ? "Publishing..." : "Publish & create draft"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function sanitizeSol(value: string): string {
  const normalized = value.replace(/,/gu, ".").replace(/[^\d.]/gu, "");
  const [whole = "", ...fractions] = normalized.split(".");
  return fractions.length === 0 ? whole : `${whole}.${fractions.join("").slice(0, 9)}`;
}

function isSolValue(value: string, allowZero: boolean): boolean {
  try {
    const lamports = BigInt(solToLamports(value, allowZero));
    return allowZero ? lamports >= 0n : lamports > 0n;
  } catch {
    return false;
  }
}

function solToLamports(value: string, allowZero: boolean): string {
  if (!/^(?:\d+)(?:\.\d{0,9})?$/u.test(value)) throw new Error("Enter a valid SOL amount with at most 9 decimals.");
  const [whole, fraction = ""] = value.split(".");
  const lamports = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0") || "0");
  if (allowZero ? lamports < 0n : lamports <= 0n) throw new Error("Enter a positive SOL amount.");
  return lamports.toString();
}
