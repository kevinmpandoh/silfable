import { AlertTriangle, Check, ExternalLink, ArrowDownLeft, ShieldCheck, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { KaminoRwaWithdrawProposal, KaminoRwaWithdrawReceipt } from "@mirae/contracts";
import { KAMINO_RWA_USDC_DECIMALS } from "@mirae/contracts";

const USDC_BASE = 10n ** BigInt(KAMINO_RWA_USDC_DECIMALS);

const executedWithdrawProposalIds = new Set<string>();

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

function friendlyError(cause: unknown, defaultMsg: string) {
  const raw = cause instanceof Error ? cause.message : defaultMsg;
  if (/Keystore file is invalid/iu.test(raw)) return "The local vault uses an older record format. Restart with the latest Mirae build; do not reset or recreate your wallet.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

export function KaminoRwaWithdrawCard({
  sessionId,
  walletAddress,
  restricted,
  proposal,
  onExecuted,
}: {
  sessionId: string;
  walletAddress: string;
  restricted: boolean;
  proposal?: KaminoRwaWithdrawProposal | undefined;
  onExecuted?: ((receipt: KaminoRwaWithdrawReceipt) => void) | undefined;
}) {
  const [lendingMarket] = useState(proposal?.lendingMarket ?? "3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH");
  const [marketName] = useState(proposal?.marketName ?? "Obligate Market");
  const [rwaReason] = useState(proposal?.rwaReason ?? "Backed by oTFY — tokenized corporate bonds and commercial paper via Obligate");
  const [amount, setAmount] = useState(proposal?.displayAmount ?? "10.00");
  const [password, setPassword] = useState("");
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<KaminoRwaWithdrawReceipt | null>(proposal?.receipt ?? null);
  const inFlight = useRef(false);

  const isAlreadyExecuted = Boolean(
    proposal?.status === "executed" ||
    proposal?.status === "confirmed" ||
    proposal?.receipt ||
    (proposal?.id && executedWithdrawProposalIds.has(proposal.id)) ||
    receipt
  );
  const autoExecutedRef = useRef(isAlreadyExecuted);

  const amountAtomic = toAtomic(amount);
  const amountValid = amountAtomic !== null;

  const submitWithdraw = async () => {
    if (inFlight.current || !amountValid || (restricted && !password)) return;
    if (proposal?.id && executedWithdrawProposalIds.has(proposal.id)) return;
    if (proposal?.id) executedWithdrawProposalIds.add(proposal.id);
    inFlight.current = true;
    setError(null);
    setExecuting(true);
    try {
      const prepRes = await window.mirae.prepareKaminoRwaWithdraw({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId,
        walletAddress,
        lendingMarket,
        amountAtomic: amountAtomic!,
      });

      const execRes = await window.mirae.executeKaminoRwaWithdraw({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        planId: prepRes.plan.id,
        sessionId,
        walletAddress,
        approved: true,
        masterPassword: restricted ? password : undefined,
      });

      setReceipt(execRes.receipt);
      setPassword("");
      onExecuted?.(execRes.receipt);
    } catch (cause) {
      if (proposal?.id) executedWithdrawProposalIds.delete(proposal.id);
      setError(friendlyError(cause, "Withdraw transaction failed."));
    } finally {
      setExecuting(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (
      proposal &&
      proposal.status !== "executed" &&
      proposal.status !== "confirmed" &&
      !proposal.receipt &&
      (!proposal.id || !executedWithdrawProposalIds.has(proposal.id)) &&
      !restricted &&
      amountValid &&
      !executing &&
      !receipt &&
      !error &&
      !autoExecutedRef.current
    ) {
      autoExecutedRef.current = true;
      void submitWithdraw();
    }
  }, [proposal, restricted, amountValid, executing, receipt, error]);

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white text-[#20212a] shadow-[0_18px_45px_-32px_rgba(32,33,42,0.5)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 bg-[#fffaf6] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#df6b22]/20 bg-[#fff3e9] text-[#df6b22]">
            <ArrowDownLeft size={16} />
          </span>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#df6b22]">
              Solana Kamino · RWA Withdrawal
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-[#20212a]">Withdraw USDC from {marketName}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#686970]">
              {restricted
                ? "Enter your master password and withdraw USDC in 1 click."
                : "Withdraw USDC in 1 click with Full Access."}
            </p>
          </div>
        </div>
        <span className="rounded border border-[#df6b22]/30 bg-[#fff8f3] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#b44f10]">
          {restricted ? "Restricted · manual" : executing ? "Full Access · Executing…" : receipt ? "Full Access · Completed" : "Full Access · Automatic"}
        </span>
      </header>

      <div className="p-4 sm:p-5">
        <div className="rounded-xl border border-[#df6b22] bg-[#fffaf6] p-3.5 shadow-[inset_3px_0_0_#df6b22]">
          <strong className="text-sm font-semibold text-[#20212a]">{marketName}</strong>
          <p className="mt-1 text-xs leading-relaxed text-[#55565e]">{rwaReason}</p>
        </div>

        {receipt && receipt.status === "CONFIRMED" ? (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3.5">
            <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800">
              <Check size={12} strokeWidth={3} />
              Withdrawal confirmed
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-950">
              Withdrew <strong>{fromAtomic(receipt.amountWithdrawnAtomic)} USDC</strong> from {marketName}.
            </p>
            {receipt.signature && (
              <a
                className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-800 underline hover:text-emerald-900"
                href={`https://solscan.io/tx/${receipt.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>View transaction on Solscan</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">
                Amount to withdraw · USDC
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  disabled={executing}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="10.00"
                  className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3.5 py-2 text-sm outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10 disabled:opacity-60"
                />
                <span className="absolute right-3.5 top-2.5 font-mono text-xs font-semibold text-[#686970] pointer-events-none">
                  USDC
                </span>
              </div>
              {!amountValid && amount.length > 0 && (
                <p className="mt-1 text-[10px] text-rose-600">Enter a valid positive USDC amount.</p>
              )}
            </div>

            {restricted ? (
              <div>
                <label className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-wider text-[#686970]">
                  Master password · required to confirm
                </label>
                <input
                  type="password"
                  value={password}
                  disabled={executing}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-black/15 bg-[#f8f8f6] px-3.5 py-2 text-sm outline-none focus:border-[#df6b22] focus:ring-2 focus:ring-[#df6b22]/10 disabled:opacity-60"
                />
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900">
                <ShieldCheck size={14} />
                {executing
                  ? `Full Access is active. Auto-withdrawing ${amount} USDC from ${marketName} on Solana…`
                  : "Full Access is active. Automated withdrawal execution without password prompt."}
              </p>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!receipt && (
        <footer className="flex flex-col gap-3 border-t border-black/10 bg-[#fffaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-[#686970]">Market</p>
            <p className="mt-0.5 text-sm font-semibold text-[#20212a]">{marketName}</p>
          </div>

          <button
            type="button"
            disabled={executing || !amountValid || (restricted && !password)}
            onClick={() => void submitWithdraw()}
            className="min-w-[200px] rounded-lg bg-[#e85d04] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c94e00] disabled:cursor-not-allowed disabled:bg-[#e8e5e1] disabled:text-[#55565e] disabled:shadow-none cursor-pointer"
          >
            {executing ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Processing on Solana…</span>
              </span>
            ) : (
              `Withdraw ${amount || "0"} USDC`
            )}
          </button>
        </footer>
      )}
    </section>
  );
}
