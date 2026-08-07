"use client";

import { useState } from "react";
import { ImagePlus, ShieldAlert, UploadCloud } from "lucide-react";

export type PublishedTokenMetadata = {
  metadataUri: string;
  metadataGatewayUrl: string;
  metadataSha256: string;
};

export function TokenLaunchPanel({
  creatorWallet,
  walletReady,
  onClose,
  onPublished,
}: {
  creatorWallet: string;
  walletReady: boolean;
  onClose: () => void;
  onPublished: (metadata: PublishedTokenMetadata, name: string, symbol: string) => void;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = walletReady && name.trim().length > 0 && symbol.trim().length > 0 && Boolean(image) && acknowledged;

  async function publish(): Promise<void> {
    if (!valid || !image) return;
    setBusy(true);
    setError(null);
    try {
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
      if (!response.ok || !result.metadataUri || !result.metadataGatewayUrl || !result.metadataSha256) {
        throw new Error(result.error || "Token metadata could not be published.");
      }
      onPublished({ metadataUri: result.metadataUri, metadataGatewayUrl: result.metadataGatewayUrl, metadataSha256: result.metadataSha256 }, name.trim(), symbol.trim().toUpperCase());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Token metadata could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 w-full max-w-3xl rounded-xl border border-cyan-400/25 bg-slate-950/80 p-4 shadow-2xl">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-cyan-300">TOKEN LAUNCH · METADATA DRAFT</p>
          <h2 className="mt-1 text-base font-semibold text-white">Prepare Pump.fun launch metadata</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Publishing stores public, immutable metadata on IPFS. It does not create, sign, or broadcast a token transaction.</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-white">Close</button>
      </header>
      {!walletReady && <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">Connect the Solana wallet bound to this session before publishing metadata.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">Name<input maxLength={32} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300">Symbol<input maxLength={10} value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/gu, ""))} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300 sm:col-span-2">Description<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300 sm:col-span-2">Token image (PNG, JPEG, GIF, or WebP; max 10 MB)<span className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-cyan-400/35 bg-cyan-400/5 px-3 py-2 text-sm text-cyan-100"><ImagePlus className="size-4" />{image ? image.name : "Choose image"}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /></span></label>
        <label className="text-xs text-slate-300">Website (optional)<input type="url" placeholder="https://..." value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300">X profile (optional)<input type="url" placeholder="https://x.com/..." value={xUrl} onChange={(event) => setXUrl(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300 sm:col-span-2">Telegram (optional)<input type="url" placeholder="https://t.me/..." value={telegramUrl} onChange={(event) => setTelegramUrl(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
      </div>
      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-300"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" /><span>I understand this upload is public and cannot be removed by Silfable. It is metadata only, not a token launch.</span></label>
      {error && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
      <footer className="mt-4 flex items-center justify-between border-t border-white/10 pt-3"><span className="flex items-center gap-1 text-[10px] text-slate-500"><ShieldAlert className="size-3.5" /> Browser-wallet launch execution remains separately gated.</span><button type="button" disabled={!valid || busy} onClick={() => void publish()} className="primaryButton inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"><UploadCloud className="size-3.5" />{busy ? "Publishing..." : "Publish metadata"}</button></footer>
    </section>
  );
}
