"use client";

import { useMemo, useRef, useState } from "react";
import type { InvestmentAllocation, InvestmentRiskProfile, WebProposal } from "@/lib/db";
import styles from "./InvestmentRecommendationCard.module.css";

type PrepareInput = {
  recommendationId: string;
  profileId: InvestmentRiskProfile;
  allocationIndex: number;
  tokenizedStockAcknowledged: boolean;
};

interface Props {
  proposal: WebProposal;
  busyKey: string | null;
  onPrepare: (input: PrepareInput) => Promise<void>;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function priceUsd(value: number | null): string {
  if (value == null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 8 : 2,
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span className={styles.metric}><small>{label}</small><strong>{value}</strong></span>;
}

function Allocation({ allocation, canPrepare, busy, onPrepare }: {
  allocation: InvestmentAllocation;
  canPrepare: boolean;
  busy: boolean;
  onPrepare: () => void;
}) {
  const tokenized = allocation.assetClass.startsWith("tokenized");
  return <article className={styles.allocation}>
    <div className={styles.allocationHead}>
      <div>
        <span className={styles.assetClass}>{allocation.assetClass.replaceAll("_", " ")}</span>
        <h4>{allocation.symbol}{allocation.underlyingTicker ? ` · ${allocation.underlyingTicker}` : ""}</h4>
        <p>{allocation.name}{allocation.issuer ? ` · ${allocation.issuer}` : ""}</p>
      </div>
      <div className={styles.weight}><strong>{allocation.percentage}%</strong><span>{usd.format(allocation.amountUsd)}</span></div>
    </div>
    <div className={styles.metrics}>
      <Metric label="Price" value={priceUsd(allocation.priceUsd)} />
      <Metric label="Liquidity" value={allocation.liquidityUsd == null ? "Unavailable" : `$${compact.format(allocation.liquidityUsd)}`} />
      <Metric label="24h volume" value={allocation.volume24hUsd == null ? "Unavailable" : `$${compact.format(allocation.volume24hUsd)}`} />
      <Metric label="24h move" value={allocation.priceChange24hPct == null ? "Unavailable" : `${allocation.priceChange24hPct.toFixed(2)}%`} />
    </div>
    <p className={styles.rationale}>{allocation.rationale}</p>
    {allocation.riskFlags.map((flag) => <p className={styles.risk} key={flag}>⚠ {flag}</p>)}
    <div className={styles.allocationFoot}>
      <span>{allocation.sources.join(" + ")} · {allocation.verified ? "verified" : "filtered fresh"}</span>
      <button type="button" disabled={!canPrepare || busy} onClick={onPrepare}>
        {busy ? "REFRESHING…" : tokenized ? "ACKNOWLEDGE & PREPARE" : "PREPARE ALLOCATION"}
      </button>
    </div>
  </article>;
}

export function InvestmentRecommendationCard({ proposal, busyKey, onPrepare }: Props) {
  const recommendation = proposal.investmentRecommendation;
  const [selected, setSelected] = useState<InvestmentRiskProfile>("moderate");
  const [acknowledged, setAcknowledged] = useState(false);
  const [disclosureError, setDisclosureError] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const disclosureRef = useRef<HTMLLabelElement | null>(null);
  const profile = useMemo(() => recommendation?.profiles.find((item) => item.id === selected), [recommendation, selected]);
  if (!recommendation || !profile) return null;
  const expired = Date.parse(recommendation.expiresAt) <= renderedAt;
  const hasTokenized = profile.allocations.some((item) => item.assetClass.startsWith("tokenized"));

  return <section className={styles.card}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>LIVE MARKET RESEARCH</span><h3>{usd.format(recommendation.budgetUsd)} allocation</h3></div>
      <time>{new Date(recommendation.generatedAt).toLocaleString()}</time>
    </header>
    <div className={styles.controls}>
      <div className={styles.recommendedProfile}>
        <span>RECOMMENDED PROFILE</span>
        <strong>{profile.label}</strong>
        <p>{profile.summary}</p>
      </div>
      <details className={styles.riskPicker}>
        <summary>Change risk level</summary>
        <div role="radiogroup" aria-label="Risk level">
          {recommendation.profiles.map((item) => <button key={item.id} type="button" role="radio" aria-checked={selected === item.id} onClick={(event) => {
            setSelected(item.id);
            setAcknowledged(false);
            event.currentTarget.closest("details")?.removeAttribute("open");
          }}>{item.label}</button>)}
        </div>
      </details>
      {expired && <strong className={styles.expired}>RESEARCH EXPIRED — ASK MIRAE TO REFRESH</strong>}
    </div>
    {hasTokenized && <label ref={disclosureRef} className={`${styles.disclosure} ${disclosureError ? styles.disclosureAttention : ""}`}>
      <input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setDisclosureError(false); }} />
      <span><strong>Tokenized-stock acknowledgment.</strong> {recommendation.tokenizedStockDisclosure}</span>
    </label>}
    {disclosureError && <p className={styles.disclosureMessage}>Check the disclosure above before preparing a tokenized-stock route.</p>}
    <div className={styles.allocations}>
      {profile.allocations.map((item) => {
        const key = `${profile.id}:${item.index}`;
        const tokenized = item.assetClass.startsWith("tokenized");
        return <Allocation key={item.mint} allocation={item} busy={busyKey === key} canPrepare={!expired} onPrepare={() => {
          if (tokenized && !acknowledged) {
            setDisclosureError(true);
            disclosureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          void onPrepare({ recommendationId: recommendation.id, profileId: profile.id, allocationIndex: item.index, tokenizedStockAcknowledged: tokenized ? acknowledged : false });
        }} />;
      })}
    </div>
    {recommendation.dataWarnings.map((warning) => <p className={styles.warning} key={warning}>{warning}</p>)}
    <footer className={styles.footer}>Mirae automatically uses available USDC first, then SOL when needed. This research is informational and does not guarantee performance.</footer>
  </section>;
}

export type { PrepareInput as InvestmentPrepareInput };
