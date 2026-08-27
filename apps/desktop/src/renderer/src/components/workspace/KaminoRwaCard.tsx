import { AlertTriangle, Check, CircleDollarSign, Coins, ExternalLink, LoaderCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KaminoRwaPool, KaminoRwaPosition, KaminoRwaSupplyPlan } from "@mirae/contracts";
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

function friendlyPrepareError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "Preparing the supply transaction failed.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

function friendlyExecuteError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "Approval was rejected.";
  if (/Keystore file is invalid/iu.test(raw)) return "The local vault uses an older record format. Restart with the latest Mirae build; do not reset or recreate your wallet.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

export function KaminoRwaCard({ sessionId, walletAddress, restricted, onExecuted }: {
  sessionId: string;
  walletAddress: string;
  restricted: boolean;
  onExecuted: (position: KaminoRwaPosition) => void;
}) {
  const [pools, setPools] = useState<KaminoRwaPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [amount, setAmount] = useState("10.00");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<KaminoRwaSupplyPlan | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<KaminoRwaPosition | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
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
  }, []);

  const selectedPool = pools.find((pool) => pool.lendingMarket === selectedMarket) ?? null;
  const maxSupplyUsdc = fromAtomic(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC);
  const amountAtomic = toAtomic(amount);
  const amountValid = amountAtomic !== null && BigInt(amountAtomic) <= MAX_SUPPLY_ATOMIC;

  const selectPool = (lendingMarket: string) => {
    if (preparing || executing) return;
    setSelectedMarket(lendingMarket);
    setPlan(null);
    setPosition(null);
    setError(null);
  };

  const submitPrepare = async () => {
    if (inFlight.current || !selectedPool) return;
    const atomic = toAtomic(amount);
    if (atomic === null) { setError("Enter a valid USDC amount."); return; }
    if (BigInt(atomic) > MAX_SUPPLY_ATOMIC) { setError(`Amount exceeds the ${maxSupplyUsdc} USDC session limit.`); return; }
    inFlight.current = true;
    setError(null);
    setPreparing(true);
    setPlan(null);
    setPosition(null);
    try {
      const response = await window.mirae.prepareKaminoRwa({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId,
        walletAddress,
        lendingMarket: selectedPool.lendingMarket,
        amountAtomic: atomic,
        maxSupplyAtomic: KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC,
      });
      setPlan(response.plan);
    } catch (cause) {
      setError(friendlyPrepareError(cause));
    } finally {
      setPreparing(false);
      inFlight.current = false;
    }
  };

  const submitExecute = async () => {
    if (inFlight.current || !plan || (restricted && !password)) return;
    inFlight.current = true;
    setError(null);
    setExecuting(true);
    try {
      const response = await window.mirae.executeKaminoRwa({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        planId: plan.id,
        sessionId,
        walletAddress,
        approved: true,
        masterPassword: restricted ? password : undefined,
      });
      setPosition(response.position);
      onExecuted(response.position);
    } catch (cause) {
      setError(friendlyExecuteError(cause));
    } finally {
      setExecuting(false);
      setPassword("");
      inFlight.current = false;
    }
  };

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[rgb(32_33_42_/_0.12)] bg-white text-[#20212a] shadow-[0_18px_45px_-32px_rgba(32,33,42,0.5)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 bg-[#f6f8ff] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#3457d5]/25 bg-[#eaefff] text-[#3457d5]"><Coins size={17} /></span>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#3457d5]">Solana Kamino · Real-world asset lending</p>
            <h3 className="mt-1 text-base font-semibold">Supply USDC to a Kamino RWA pool</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#686970]">{restricted ? "Choose a curated real-world-asset market, review the simulated fee, then confirm with your master password." : "Choose a curated real-world-asset market and review the simulated fee before supplying."}</p>
          </div>
        </div>
        <span className="rounded border border-[#3457d5]/30 bg-[#eef1ff] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#2941a8]">{restricted ? "Restricted · manual" : "Full Access"}</span>
      </header>
      <div className="p-4 sm:p-5">
        {loadingPools ? (
          <div className="flex items-center gap-3 rounded-lg border border-[#3457d5]/25 bg-[#f6f8ff] px-3 py-2.5">
            <LoaderCircle className="animate-spin text-[#3457d5]" size={16} />
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
              <button key={pool.lendingMarket} type="button" disabled={preparing || executing} onClick={() => selectPool(pool.lendingMarket)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${checked ? "border-[#3457d5] bg-[#f2f4ff] shadow-[inset_3px_0_0_#3457d5]" : "border-black/10 bg-[#fcfcfb] hover:border-[#3457d5]/40 hover:bg-[#f8f9ff]"} disabled:cursor-not-allowed disabled:opacity-70`}>
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${checked ? "border-[#3457d5] bg-[#3457d5] text-white" : "border-black/15 bg-[#f4f2ef] text-transparent"}`}><Check size={12} strokeWidth={3} /></span>
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
            <input type="text" inputMode="decimal" value={amount} disabled={preparing || executing} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="10.00" className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm outline-none focus:border-[#3457d5] focus:ring-2 focus:ring-[#3457d5]/10 disabled:opacity-60" />
            {!amountValid && amount.length > 0 ? <p className="mt-1 text-[10px] text-rose-600">Enter a positive amount up to {maxSupplyUsdc} USDC.</p> : null}

            {plan ? (
              <div className="mt-3 rounded-lg border border-[#3457d5]/25 bg-[#f6f8ff] px-3 py-2.5">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#2941a8]">Simulated plan</p>
                <p className="mt-1 text-xs leading-relaxed text-[#3a3b42]">Supplying {fromAtomic(plan.amountAtomic)} USDC at {(plan.supplyApyAtPrepare * 100).toFixed(2)}% APY · estimated network fee {plan.estimatedNetworkFeeLamports} lamports · plan expires {new Date(plan.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ) : null}

            {restricted ? (
              <div className="mt-3">
                <label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">Master password · required to confirm</label>
                <input type="password" value={password} disabled={executing} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="Enter master password" autoComplete="current-password" className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3 py-2 text-sm outline-none focus:border-[#3457d5] focus:ring-2 focus:ring-[#3457d5]/10 disabled:opacity-60" />
              </div>
            ) : !plan ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900"><ShieldCheck size={14} />Full Access is active. Review the simulated fee, then confirm to supply.</p>
            ) : null}

            {position ? (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2.5">
                <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800"><Check size={11} strokeWidth={3} />Position {position.status.toLowerCase()}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">Supplied {fromAtomic(position.amountSuppliedAtomic)} USDC to {position.marketName}.</p>
                {position.signature ? <a className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-800 underline" href={`https://solscan.io/tx/${position.signature}`}>View transaction on Solscan <ExternalLink size={10} /></a> : null}
              </div>
            ) : null}

            {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700">{error}</p> : null}
          </div>
        ) : null}
      </div>
      {selectedPool ? (
        <footer className="flex flex-col gap-3 border-t border-black/10 bg-[#f6f8ff] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 text-[#3457d5]" size={16} />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#686970]">Selected market</p>
              <p className="mt-0.5 text-sm font-semibold text-[#20212a]">{selectedPool.name} <span className="font-normal text-[#777880]">· {(selectedPool.supplyApy * 100).toFixed(2)}% APY</span></p>
            </div>
          </div>
          {!plan ? (
            <button type="button" disabled={preparing || !amountValid} onClick={() => void submitPrepare()} className="min-w-[200px] rounded-lg bg-[#3457d5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2941a8] disabled:cursor-not-allowed disabled:bg-[#e8e5e1] disabled:text-[#55565e] disabled:shadow-none disabled:opacity-100">{preparing ? "Simulating…" : "Prepare supply"}</button>
          ) : !position ? (
            <button type="button" disabled={executing || (restricted && !password)} onClick={() => void submitExecute()} className="min-w-[200px] rounded-lg bg-[#3457d5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2941a8] disabled:cursor-not-allowed disabled:bg-[#e8e5e1] disabled:text-[#55565e] disabled:shadow-none disabled:opacity-100">{executing ? "Confirming…" : `Confirm & supply · ${fromAtomic(plan.amountAtomic)} USDC`}</button>
          ) : (
            <button type="button" onClick={() => { setPlan(null); setPosition(null); }} className="min-w-[200px] rounded-lg border border-[#3457d5]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#3457d5] shadow-sm transition hover:bg-[#eef1ff]">Supply another amount</button>
          )}
        </footer>
      ) : null}
    </section>
  );
}
