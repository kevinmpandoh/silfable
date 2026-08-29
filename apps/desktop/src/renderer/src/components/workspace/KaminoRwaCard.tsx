import { AlertTriangle, Check, ChevronDown, CircleDollarSign, Coins, ExternalLink, LoaderCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KaminoRwaPool, KaminoRwaPosition, KaminoRwaSupplyProposal } from "@mirae/contracts";
import { KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC, KAMINO_RWA_USDC_DECIMALS } from "@mirae/contracts";

const MAX_SUPPLY_ATOMIC = BigInt(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC);
const USDC_BASE = 10n ** BigInt(KAMINO_RWA_USDC_DECIMALS);

function toAtomic(amount: string): string | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(amount)) return null;
  const [whole = "0", fraction = ""] = amount.split(".");
  const raw = BigInt(whole) * USDC_BASE + BigInt(fraction.padEnd(KAMINO_RWA_USDC_DECIMALS, "0"));
  return raw > 0n ? raw.toString() : null;
}

function fromAtomic(atomic: string): string {
  const value = BigInt(atomic);
  const whole = value / USDC_BASE;
  const fraction = value % USDC_BASE;
  return `${whole}.${fraction.toString().padStart(KAMINO_RWA_USDC_DECIMALS, "0")}`;
}

function friendlyDiscoverError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "Could not load Kamino RWA pools.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

function friendlyExecuteError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "Approval was rejected.";
  if (/Keystore file is invalid/iu.test(raw)) return "The local vault uses an older record format. Restart with the latest Mirae build; do not reset or recreate your wallet.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

export function KaminoRwaCard({ sessionId, walletAddress, restricted, proposal, onExecuted }: {
  sessionId: string;
  walletAddress: string;
  restricted: boolean;
  proposal?: KaminoRwaSupplyProposal;
  onExecuted: (position: KaminoRwaPosition) => void;
}) {
  const [pools, setPools] = useState<KaminoRwaPool[]>(proposal?.pools ?? []);
  const [loadingPools, setLoadingPools] = useState(!proposal?.pools || proposal.pools.length === 0);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(proposal?.lendingMarket ?? null);
  const [amount, setAmount] = useState(proposal?.displayAmount ?? "10.00");
  const [password, setPassword] = useState("");
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<KaminoRwaPosition | null>(null);
  const [expanded, setExpanded] = useState(Boolean(proposal));
  const [discovered, setDiscovered] = useState(Boolean(proposal?.pools && proposal.pools.length > 0));
  const inFlight = useRef(false);

  useEffect(() => {
    if (!expanded || discovered) return;
    let live = true;
    setDiscovered(true);
    setLoadingPools(true);
    setDiscoverError(null);
    void window.mirae.discoverKaminoRwa({ schemaVersion: 1, requestId: crypto.randomUUID() })
      .then((response) => {
        if (!live) return;
        setPools(response.pools);
        setSelectedMarket((current) => current ?? response.pools[0]?.lendingMarket ?? null);
      })
      .catch((cause) => {
        if (!live) return;
        setDiscoverError(friendlyDiscoverError(cause));
      })
      .finally(() => { if (live) setLoadingPools(false); });
    return () => { live = false; };
  }, [expanded, discovered]);

  const selectedPool = pools.find((pool) => pool.lendingMarket === selectedMarket) ?? null;
  const maxSupplyUsdc = fromAtomic(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC);
  const amountAtomic = toAtomic(amount);
  const amountValid = amountAtomic !== null && BigInt(amountAtomic) <= MAX_SUPPLY_ATOMIC;

  const selectPool = (lendingMarket: string) => {
    if (executing) return;
    setSelectedMarket(lendingMarket);
    setPosition(null);
    setError(null);
  };

  const submitSupply = async () => {
    if (inFlight.current || !selectedPool || !amountValid || (restricted && !password)) return;
    const atomic = toAtomic(amount);
    if (atomic === null) { setError("Enter a valid USDC amount."); return; }
    if (BigInt(atomic) > MAX_SUPPLY_ATOMIC) { setError(`Amount exceeds the ${maxSupplyUsdc} USDC session limit.`); return; }
    inFlight.current = true;
    setError(null);
    setExecuting(true);
    setPosition(null);
    try {
      // 1. Prepare Plan (RPC simulation)
      const prepRes = await window.mirae.prepareKaminoRwa({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId,
        walletAddress,
        lendingMarket: selectedPool.lendingMarket,
        amountAtomic: atomic,
        maxSupplyAtomic: KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC,
      });

      // 2. Immediately execute on-chain
      const execRes = await window.mirae.executeKaminoRwa({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        planId: prepRes.plan.id,
        sessionId,
        walletAddress,
        approved: true,
        masterPassword: restricted ? password : undefined,
      });

      setPosition(execRes.position);
      setPassword("");
      onExecuted(execRes.position);
    } catch (cause) {
      setError(friendlyExecuteError(cause));
    } finally {
      setExecuting(false);
      inFlight.current = false;
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[#df6b22]/20 bg-[#fffaf6] px-5 py-3.5 text-left transition hover:border-[#df6b22]/40 hover:bg-[#fff8f3]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#df6b22]/25 bg-[#fff3e9] text-[#df6b22]"><Coins size={17} /></span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Solana Kamino · Real-world asset lending</p>
            <h3 className="mt-0.5 text-sm font-semibold text-[#20212a]">Supply USDC to a Kamino RWA pool</h3>
          </div>
        </div>
        <ChevronDown className="shrink-0 text-[#df6b22]" size={16} />
      </button>
    );
  }

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[rgb(32_33_42_/_0.12)] bg-white text-[#20212a] shadow-[0_18px_45px_-32px_rgba(32,33,42,0.5)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 bg-[#fffaf6] px-5 py-4">
        <button type="button" onClick={() => setExpanded(false)} className="flex min-w-0 items-start gap-3 text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#df6b22]/25 bg-[#fff3e9] text-[#df6b22]"><Coins size={17} /></span>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">Solana Kamino · Real-world asset lending</p>
            <h3 className="mt-1 text-base font-semibold">Supply USDC to a Kamino RWA pool</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#686970]">{restricted ? "Choose a curated real-world-asset market, enter your master password, and supply in 1 click." : "Choose a curated real-world-asset market and supply in 1 click with Full Access."}</p>
          </div>
        </button>
        <span className="rounded border border-[#df6b22]/30 bg-[#fff8f3] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#b44f10]">{restricted ? "Restricted · manual" : "Full Access"}</span>
      </header>
      <div className="p-4 sm:p-5">
        {loadingPools ? (
          <div className="flex items-center gap-3 rounded-lg border border-[#df6b22]/25 bg-[#fff8f3] px-3 py-2.5">
            <LoaderCircle className="animate-spin text-[#df6b22]" size={16} />
            <p className="text-xs text-[#55565e]">Discovering curated Kamino RWA pools…</p>
          </div>
        ) : discoverError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700">{discoverError}</p>
        ) : pools.length === 0 ? (
          <p className="rounded-lg border border-black/10 bg-[#f8f8f6] p-2.5 text-xs leading-relaxed text-[#55565e]">No curated Kamino RWA pools are currently available.</p>
        ) : (
          <div className="space-y-2.5">{pools.map((pool) => {
            const checked = pool.lendingMarket === selectedMarket;
            return (
              <button key={pool.lendingMarket} type="button" disabled={executing} onClick={() => selectPool(pool.lendingMarket)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${checked ? "border-[#e85d04] bg-[#fff1e6] shadow-[inset_3px_0_0_#e85d04]" : "border-black/10 bg-[#fcfcfb] hover:border-[#df6b22]/40 hover:bg-[#fffaf6]"} disabled:cursor-not-allowed disabled:opacity-70`}>
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${checked ? "border-[#e85d04] bg-[#e85d04] text-white" : "border-black/15 bg-[#f4f2ef] text-transparent"}`}><Check size={12} strokeWidth={3} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold text-[#20212a]">{pool.name}</strong>
                    {pool.highUtilizationWarning ? <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-amber-800"><AlertTriangle size={9} />High utilization</span> : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#55565e]">{pool.rwaReason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#777880]">
                    <span className="inline-flex items-center gap-1 text-emerald-700"><TrendingUp size={11} />{(pool.supplyApy * 100).toFixed(2)}% supply APY</span>
                    <span>TVL ${pool.totalSupplyUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span>Utilization {(pool.utilization * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </button>
            );
          })}</div>
        )}

        {selectedPool ? (
          <div className="mt-4 border-t border-black/10 pt-4">
            <label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">Amount to supply · USDC (max {maxSupplyUsdc})</label>
            <input type="text" inputMode="decimal" value={amount} disabled={executing} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="10.00" className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10 disabled:opacity-60" />
            {!amountValid && amount.length > 0 ? <p className="mt-1 text-[10px] text-rose-600">Enter a positive amount up to {maxSupplyUsdc} USDC.</p> : null}

            {restricted ? (
              <div className="mt-3">
                <label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">Master password · required to confirm</label>
                <input type="password" value={password} disabled={executing} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="Enter master password" autoComplete="current-password" className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10 disabled:opacity-60" />
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900"><ShieldCheck size={14} />Full Access is active. 1-click execution without password prompt.</p>
            )}

            {position ? (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2.5">
                <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800"><Check size={11} strokeWidth={3} />Position {position.status.toLowerCase()}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">Supplied {fromAtomic(position.amountSuppliedAtomic)} USDC to {position.marketName}.</p>
                {position.signature ? <a className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-800 underline" href={`https://solscan.io/tx/${position.signature}`} target="_blank" rel="noreferrer">View transaction on Solscan <ExternalLink size={10} /></a> : null}
              </div>
            ) : null}

            {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700">{error}</p> : null}
          </div>
        ) : null}
      </div>
      {selectedPool ? (
        <footer className="flex flex-col gap-3 border-t border-black/10 bg-[#fffaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 text-[#df6b22]" size={16} />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#686970]">Selected market</p>
              <p className="mt-0.5 text-sm font-semibold text-[#20212a]">{selectedPool.name} <span className="font-normal text-[#777880]">· {(selectedPool.supplyApy * 100).toFixed(2)}% APY</span></p>
            </div>
          </div>
          {!position ? (
            <button type="button" disabled={executing || !amountValid || (restricted && !password)} onClick={() => void submitSupply()} className="min-w-[200px] rounded-lg bg-[#e85d04] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c94e00] disabled:cursor-not-allowed disabled:bg-[#e8e5e1] disabled:text-[#55565e] disabled:shadow-none disabled:opacity-100">
              {executing ? "Processing on Solana…" : `Supply ${amount || "0"} USDC`}
            </button>
          ) : (
            <button type="button" onClick={() => { setPosition(null); }} className="min-w-[200px] rounded-lg border border-[#df6b22]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#df6b22] shadow-sm transition hover:bg-[#fff8f3]">Supply another amount</button>
          )}
        </footer>
      ) : null}
    </section>
  );
}
