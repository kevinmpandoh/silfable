import { useState, useEffect, useCallback, useRef } from "react";
import { Coins, TrendingUp, ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, Check, AlertTriangle, CircleDollarSign, LoaderCircle } from "lucide-react";
import { Modal, Button, Badge } from "../ui";
import type { KaminoRwaPosition, KaminoRwaPool, KaminoRwaWithdrawReceipt } from "@mirae/contracts";
import { KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC, KAMINO_RWA_USDC_DECIMALS, KAMINO_RWA_MARKET_CATALOG } from "@mirae/contracts";

const MAX_SUPPLY_ATOMIC = BigInt(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC);
const KAMINO_USDC_BASE = 10n ** BigInt(KAMINO_RWA_USDC_DECIMALS);

function toAtomic(amount: string): string | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(amount)) return null;
  const [whole = "0", fraction = ""] = amount.split(".");
  const raw = BigInt(whole) * KAMINO_USDC_BASE + BigInt(fraction.padEnd(KAMINO_RWA_USDC_DECIMALS, "0"));
  return raw > 0n ? raw.toString() : null;
}

function fromAtomic(atomic: string): string {
  const value = BigInt(atomic);
  const whole = value / KAMINO_USDC_BASE;
  const fraction = value % KAMINO_USDC_BASE;
  return `${whole}.${fraction.toString().padStart(KAMINO_RWA_USDC_DECIMALS, "0")}`;
}

function kaminoAccruedYieldUsd(position: KaminoRwaPosition, apy: number): number | null {
  const amountSupplied = Number(fromAtomic(position.amountSuppliedAtomic));
  if (!Number.isFinite(amountSupplied)) return null;
  const elapsedDays = Math.max(0, (Date.now() - new Date(position.createdAt).getTime()) / 86_400_000);
  const value = amountSupplied * apy * (elapsedDays / 365);
  return Number.isFinite(value) ? value : null;
}

function formatUsd(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "$0.00"
    : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

function friendlyError(cause: unknown, defaultMsg: string) {
  const raw = cause instanceof Error ? cause.message : defaultMsg;
  if (/Keystore file is invalid/iu.test(raw)) return "The local vault uses an older record format. Restart with the latest Mirae build; do not reset or recreate your wallet.";
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/iu, "");
}

export function KaminoRwaWorkspaceModal({
  isOpen,
  onClose,
  sessionId,
  walletAddress,
  restricted,
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  walletAddress: string;
  restricted: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"supply" | "positions" | "withdraw">("supply");
  const [positions, setPositions] = useState<KaminoRwaPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [livePools, setLivePools] = useState<KaminoRwaPool[]>([]);

  // Supply Tab State
  const [supplyMarket, setSupplyMarket] = useState<string>("3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH");
  const [supplyAmount, setSupplyAmount] = useState<string>("10.00");
  const [supplyPassword, setSupplyPassword] = useState<string>("");
  const [supplyExecuting, setSupplyExecuting] = useState(false);
  const [supplyError, setSupplyError] = useState<string | null>(null);
  const [lastSuppliedPosition, setLastSuppliedPosition] = useState<KaminoRwaPosition | null>(null);

  // Withdraw Tab State
  const [withdrawMarket, setWithdrawMarket] = useState<string>("3hd61ZpG35tBwrmDvdmYVJoazC2mjJxHb6rEYEWs4QhH");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("10.00");
  const [withdrawPassword, setWithdrawPassword] = useState<string>("");
  const [withdrawExecuting, setWithdrawExecuting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [lastWithdrawReceipt, setLastWithdrawReceipt] = useState<KaminoRwaWithdrawReceipt | null>(null);

  const supplyInFlight = useRef(false);
  const withdrawInFlight = useRef(false);

  const loadData = useCallback(async () => {
    setLoadingPositions(true);
    try {
      const [posRes, poolRes] = await Promise.allSettled([
        window.mirae.listKaminoRwaPositions(),
        window.mirae.discoverKaminoRwa({ schemaVersion: 1, requestId: crypto.randomUUID() }),
      ]);
      if (posRes.status === "fulfilled") {
        const walletPositions = posRes.value.positions.filter(
          (p) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase() && p.status === "CONFIRMED",
        );
        setPositions(walletPositions);
      }
      if (poolRes.status === "fulfilled") {
        setLivePools(poolRes.value.pools);
      }
    } catch {
      // Ignore background error
    } finally {
      setLoadingPositions(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  const poolApyMap = new Map<string, number>(livePools.map((p) => [p.lendingMarket, p.supplyApy]));

  const totalSuppliedUsdc = positions.reduce(
    (sum, pos) => sum + Number(fromAtomic(pos.amountSuppliedAtomic)),
    0,
  );

  const totalAccruedYieldUsd = positions.reduce((sum, pos) => {
    const apy = poolApyMap.get(pos.lendingMarket) ?? pos.supplyApyAtEntry;
    const yieldVal = kaminoAccruedYieldUsd(pos, apy) ?? 0;
    return sum + yieldVal;
  }, 0);

  // Supply helpers
  const selectedSupplyPool = livePools.find((p) => p.lendingMarket === supplyMarket) ?? {
    lendingMarket: supplyMarket,
    name: KAMINO_RWA_MARKET_CATALOG.find((c) => c.lendingMarket === supplyMarket)?.name ?? "Obligate Market",
    rwaReason: KAMINO_RWA_MARKET_CATALOG.find((c) => c.lendingMarket === supplyMarket)?.rwaReason ?? "Corporate Credit",
    supplyApy: 0.0824,
    totalSupplyUsd: 5_100_000,
    utilization: 0.89,
    highUtilizationWarning: true,
  };

  const supplyAmountAtomic = toAtomic(supplyAmount);
  const supplyAmountValid = supplyAmountAtomic !== null && BigInt(supplyAmountAtomic) <= MAX_SUPPLY_ATOMIC;

  // 1-Click Supply Handler (seamless prepare + execute)
  const handleSupply = async () => {
    if (supplyInFlight.current || !supplyAmountValid || (restricted && !supplyPassword)) return;
    supplyInFlight.current = true;
    setSupplyError(null);
    setSupplyExecuting(true);
    setLastSuppliedPosition(null);
    try {
      // 1. Prepare Plan (simulate on RPC)
      const prepRes = await window.mirae.prepareKaminoRwa({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId,
        walletAddress,
        lendingMarket: supplyMarket,
        amountAtomic: supplyAmountAtomic!,
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
        masterPassword: restricted ? supplyPassword : undefined,
      });

      setLastSuppliedPosition(execRes.position);
      setSupplyPassword("");
      void loadData();
    } catch (cause) {
      setSupplyError(friendlyError(cause, "Supply transaction failed."));
    } finally {
      setSupplyExecuting(false);
      supplyInFlight.current = false;
    }
  };

  // Withdraw helpers
  const selectedWithdrawPosition = positions.find((p) => p.lendingMarket === withdrawMarket);
  const selectedWithdrawPool = livePools.find((p) => p.lendingMarket === withdrawMarket);
  const withdrawMarketName = selectedWithdrawPosition?.marketName ?? selectedWithdrawPool?.name ?? "Obligate Market";

  const withdrawAmountAtomic = toAtomic(withdrawAmount);
  const withdrawAmountValid = withdrawAmountAtomic !== null;

  // 1-Click Withdraw Handler (seamless prepare + execute)
  const handleWithdraw = async () => {
    if (withdrawInFlight.current || !withdrawAmountValid || (restricted && !withdrawPassword)) return;
    withdrawInFlight.current = true;
    setWithdrawError(null);
    setWithdrawExecuting(true);
    setLastWithdrawReceipt(null);
    try {
      // 1. Prepare Plan (simulate on RPC)
      const prepRes = await window.mirae.prepareKaminoRwaWithdraw({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId,
        walletAddress,
        lendingMarket: withdrawMarket,
        amountAtomic: withdrawAmountAtomic!,
      });

      // 2. Immediately execute on-chain
      const execRes = await window.mirae.executeKaminoRwaWithdraw({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        planId: prepRes.plan.id,
        sessionId,
        walletAddress,
        approved: true,
        masterPassword: restricted ? withdrawPassword : undefined,
      });

      setLastWithdrawReceipt(execRes.receipt);
      setWithdrawPassword("");
      void loadData();
    } catch (cause) {
      setWithdrawError(friendlyError(cause, "Withdraw transaction failed."));
    } finally {
      setWithdrawExecuting(false);
      withdrawInFlight.current = false;
    }
  };

  const handleStartWithdrawForPosition = (pos: KaminoRwaPosition) => {
    setWithdrawMarket(pos.lendingMarket);
    setWithdrawAmount(fromAtomic(pos.amountSuppliedAtomic));
    setWithdrawError(null);
    setLastWithdrawReceipt(null);
    setActiveTab("withdraw");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Real-World Asset (RWA) Lending"
      subtitle="Supply USDC to institutional corporate credit and gold pools on Solana."
      maxWidth="780px"
      className="kaminoRwaModal"
    >
      <div className="flex flex-col gap-4 text-[#20212a]">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[rgb(32_33_42_/_0.12)] pb-3">
          <div className="flex items-center gap-1 bg-[#f3f4f6] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("supply")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "supply"
                  ? "bg-[#FFF3EB] text-[#DF6B22] border border-[#DF6B22]/30 shadow-xs"
                  : "text-[#686970] hover:text-[#20212a] hover:bg-white/50"
              }`}
            >
              <ArrowUpRight className="size-3.5" />
              <span>Supply USDC</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("positions");
                void loadData();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "positions"
                  ? "bg-[#FFF3EB] text-[#DF6B22] border border-[#DF6B22]/30 shadow-xs"
                  : "text-[#686970] hover:text-[#20212a] hover:bg-white/50"
              }`}
            >
              <TrendingUp className="size-3.5" />
              <span>Active Positions ({positions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("withdraw")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "withdraw"
                  ? "bg-[#FFF3EB] text-[#DF6B22] border border-[#DF6B22]/30 shadow-xs"
                  : "text-[#686970] hover:text-[#20212a] hover:bg-white/50"
              }`}
            >
              <ArrowDownLeft className="size-3.5" />
              <span>Withdraw USDC</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <span className="text-[#686970] block text-[9px] font-mono uppercase tracking-wider">TOTAL SUPPLIED</span>
              <strong className="text-[#20212a] font-mono text-xs">{totalSuppliedUsdc.toFixed(4)} USDC</strong>
            </div>
            <div className="text-right">
              <span className="text-[#686970] block text-[9px] font-mono uppercase tracking-wider">EST. YIELD</span>
              <strong className="text-emerald-600 font-mono text-xs">+{formatUsd(totalAccruedYieldUsd)}</strong>
            </div>
          </div>
        </div>

        {/* TAB 1: SUPPLY */}
        {activeTab === "supply" && (
          <div className="flex flex-col gap-4 py-1">
            <div>
              <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]">
                1. Select Curated RWA Market
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {KAMINO_RWA_MARKET_CATALOG.map((market) => {
                  const pool = livePools.find((p) => p.lendingMarket === market.lendingMarket);
                  const apy = pool ? pool.supplyApy : (market.name.includes("Obligate") ? 0.0824 : 0.045);
                  const isSelected = supplyMarket === market.lendingMarket;

                  return (
                    <button
                      key={market.lendingMarket}
                      type="button"
                      onClick={() => {
                        setSupplyMarket(market.lendingMarket);
                        setSupplyError(null);
                        setLastSuppliedPosition(null);
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        isSelected
                          ? "border-[#DF6B22] bg-[#FFF9F5] shadow-[inset_3px_0_0_#DF6B22]"
                          : "border-[rgb(32_33_42_/_0.12)] bg-white hover:border-[#DF6B22]/40 hover:bg-[#FAF9F7]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                          isSelected
                            ? "border-[#DF6B22] bg-[#DF6B22] text-white"
                            : "border-black/15 bg-[#F4F2EF] text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-semibold text-[#20212a]">{market.name}</strong>
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-700">
                            <TrendingUp size={11} />
                            {(apy * 100).toFixed(2)}% APY
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[#686970]">
                          {market.rwaReason}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {lastSuppliedPosition && lastSuppliedPosition.status === "CONFIRMED" ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <Check size={14} strokeWidth={3} />
                  <span>Position Confirmed on Solana Mainnet</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                  Successfully supplied {fromAtomic(lastSuppliedPosition.amountSuppliedAtomic)} USDC to{" "}
                  {lastSuppliedPosition.marketName}.
                </p>
                {lastSuppliedPosition.signature && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-emerald-800 underline hover:text-emerald-900"
                    href={`https://solscan.io/tx/${lastSuppliedPosition.signature}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>View on Solscan</span>
                    <ExternalLink size={11} />
                  </a>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setLastSuppliedPosition(null);
                    }}
                  >
                    Supply Again
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs"
                    onClick={() => setActiveTab("positions")}
                  >
                    View Active Positions
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]"
                      htmlFor="kamino-supply-modal-amount"
                    >
                      2. Amount to Supply · USDC
                    </label>
                    <span className="font-mono text-[9px] text-[#686970]">
                      Session limit: {fromAtomic(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC)} USDC
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        id="kamino-supply-modal-amount"
                        type="text"
                        inputMode="decimal"
                        value={supplyAmount}
                        disabled={supplyExecuting}
                        onChange={(e) => {
                          setSupplyAmount(e.target.value);
                          setSupplyError(null);
                        }}
                        placeholder="10.00"
                        className="w-full rounded-lg border border-[rgb(32_33_42_/_0.15)] bg-[#F8F8F6] px-3 py-2 text-sm outline-none focus:border-[#DF6B22] focus:ring-2 focus:ring-[#DF6B22]/10 disabled:opacity-60"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-semibold text-[#686970] pointer-events-none">
                        USDC
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {["5", "10", "25", "50"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={supplyExecuting}
                          onClick={() => {
                            setSupplyAmount(preset);
                            setSupplyError(null);
                          }}
                          className="px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[rgb(32_33_42_/_0.12)] bg-white text-[#686970] hover:border-[#DF6B22] hover:text-[#DF6B22] transition cursor-pointer disabled:opacity-50"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!supplyAmountValid && supplyAmount.length > 0 && (
                    <p className="mt-1 text-[10px] text-rose-600">
                      Enter a positive amount up to {fromAtomic(KAMINO_RWA_DEFAULT_MAX_SUPPLY_ATOMIC)} USDC.
                    </p>
                  )}
                </div>

                {restricted ? (
                  <div>
                    <label
                      className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]"
                      htmlFor="kamino-supply-modal-pwd"
                    >
                      3. Master Password · Required to Confirm
                    </label>
                    <input
                      id="kamino-supply-modal-pwd"
                      type="password"
                      value={supplyPassword}
                      disabled={supplyExecuting}
                      onChange={(e) => setSupplyPassword(e.target.value)}
                      placeholder="Enter master password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-[rgb(32_33_42_/_0.15)] bg-[#F8F8F6] px-3 py-2 text-sm outline-none focus:border-[#DF6B22] focus:ring-2 focus:ring-[#DF6B22]/10 disabled:opacity-60"
                    />
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium py-1">
                    <Check size={13} strokeWidth={3} />
                    <span>Full Access active · 1-click instant execution</span>
                  </p>
                )}

                {supplyError && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{supplyError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[rgb(32_33_42_/_0.1)] pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="text-[#DF6B22] size-4" />
                    <span className="text-xs font-semibold text-[#20212a]">{selectedSupplyPool.name}</span>
                  </div>
                  <Button
                    variant="primary"
                    disabled={supplyExecuting || !supplyAmountValid || (restricted && !supplyPassword)}
                    onClick={() => void handleSupply()}
                    className="min-w-[200px] text-xs font-semibold"
                  >
                    {supplyExecuting ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin mr-1.5" />
                        <span>Processing on Solana...</span>
                      </>
                    ) : (
                      `Supply ${supplyAmount || "0"} USDC`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE POSITIONS */}
        {activeTab === "positions" && (
          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#686970] uppercase tracking-wider font-mono text-[9px]">
                Your Confirmed Solana Kamino Positions
              </span>
              <button
                type="button"
                onClick={() => void loadData()}
                className="inline-flex items-center gap-1 text-xs text-[#686970] hover:text-[#20212a] cursor-pointer"
                disabled={loadingPositions}
              >
                <RefreshCw className={`size-3 ${loadingPositions ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[rgb(32_33_42_/_0.15)] text-center bg-[#FAF9F7]">
                <Coins className="size-8 text-[#686970] mb-2 opacity-50" />
                <h5 className="text-sm font-semibold text-[#20212a]">No active RWA positions yet</h5>
                <p className="text-xs text-[#686970] mt-1 max-w-sm">
                  Supply USDC to Obligate Market or PAXG Market to start earning real-world on-chain yield.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4 text-xs font-semibold"
                  onClick={() => setActiveTab("supply")}
                >
                  Supply USDC Now
                </Button>
              </div>
            ) : (
              positions.map((pos) => {
                const amount = fromAtomic(pos.amountSuppliedAtomic);
                const liveApy = poolApyMap.get(pos.lendingMarket);
                const apyUsed = liveApy ?? pos.supplyApyAtEntry;
                const accruedYield = kaminoAccruedYieldUsd(pos, apyUsed);

                return (
                  <div
                    key={pos.id}
                    className="flex flex-col gap-2.5 p-4 rounded-xl border border-[rgb(32_33_42_/_0.12)] bg-white hover:border-[#DF6B22]/30 transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#20212a]">{pos.marketName}</span>
                        <Badge variant="success" className="text-[9px] py-0.5">
                          ACTIVE
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 font-mono">
                          {(apyUsed * 100).toFixed(2)}% APY
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs py-2 border-t border-b border-[rgb(32_33_42_/_0.08)] bg-[#FAF9F7] rounded-lg px-3 my-0.5">
                      <div>
                        <span className="text-[#686970] text-[9px] font-mono uppercase block">Supplied Amount</span>
                        <strong className="font-mono text-xs text-[#20212a]">{amount} USDC</strong>
                      </div>
                      <div>
                        <span className="text-[#686970] text-[9px] font-mono uppercase block">Est. Accrued Yield</span>
                        <strong className="font-mono text-xs text-emerald-600">
                          +{formatUsd(accruedYield)}
                        </strong>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[#686970] text-[9px] font-mono uppercase block">Deposited At</span>
                        <span className="text-[#686970] font-mono text-xs">
                          {new Date(pos.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      {pos.signature ? (
                        <a
                          href={`https://solscan.io/tx/${pos.signature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#686970] hover:text-[#20212a] hover:underline"
                        >
                          <span>View on Solscan</span>
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold"
                        onClick={() => handleStartWithdrawForPosition(pos)}
                      >
                        <ArrowDownLeft className="size-3 mr-1" />
                        Withdraw
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: WITHDRAW */}
        {activeTab === "withdraw" && (
          <div className="flex flex-col gap-4 py-1">
            <div>
              <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]">
                1. Select Market or Position to Withdraw
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {KAMINO_RWA_MARKET_CATALOG.map((market) => {
                  const matchingPos = positions.find((p) => p.lendingMarket === market.lendingMarket);
                  const isSelected = withdrawMarket === market.lendingMarket;

                  return (
                    <button
                      key={market.lendingMarket}
                      type="button"
                      onClick={() => {
                        setWithdrawMarket(market.lendingMarket);
                        if (matchingPos) {
                          setWithdrawAmount(fromAtomic(matchingPos.amountSuppliedAtomic));
                        }
                        setWithdrawError(null);
                        setLastWithdrawReceipt(null);
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        isSelected
                          ? "border-[#DF6B22] bg-[#FFF9F5] shadow-[inset_3px_0_0_#DF6B22]"
                          : "border-[rgb(32_33_42_/_0.12)] bg-white hover:border-[#DF6B22]/40 hover:bg-[#FAF9F7]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                          isSelected
                            ? "border-[#DF6B22] bg-[#DF6B22] text-white"
                            : "border-black/15 bg-[#F4F2EF] text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-semibold text-[#20212a]">{market.name}</strong>
                          {matchingPos ? (
                            <Badge variant="success" className="text-[9px]">
                              {fromAtomic(matchingPos.amountSuppliedAtomic)} USDC
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-[#686970] font-mono">0.00 USDC</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[#686970] line-clamp-1">
                          {market.rwaReason}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {lastWithdrawReceipt && lastWithdrawReceipt.status === "CONFIRMED" ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <Check size={14} strokeWidth={3} />
                  <span>Withdrawal Confirmed on Solana Mainnet</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                  Successfully withdrew {fromAtomic(lastWithdrawReceipt.amountWithdrawnAtomic)} USDC from{" "}
                  {withdrawMarketName}.
                </p>
                {lastWithdrawReceipt.signature && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-emerald-800 underline hover:text-emerald-900"
                    href={`https://solscan.io/tx/${lastWithdrawReceipt.signature}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>View on Solscan</span>
                    <ExternalLink size={11} />
                  </a>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setLastWithdrawReceipt(null);
                    }}
                  >
                    Withdraw More
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs"
                    onClick={() => setActiveTab("positions")}
                  >
                    View Active Positions
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]"
                      htmlFor="kamino-withdraw-modal-amount"
                    >
                      2. Amount to Withdraw · USDC
                    </label>
                    {selectedWithdrawPosition && (
                      <span className="font-mono text-[9px] text-[#686970]">
                        Available: {fromAtomic(selectedWithdrawPosition.amountSuppliedAtomic)} USDC
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        id="kamino-withdraw-modal-amount"
                        type="text"
                        inputMode="decimal"
                        value={withdrawAmount}
                        disabled={withdrawExecuting}
                        onChange={(e) => {
                          setWithdrawAmount(e.target.value);
                          setWithdrawError(null);
                        }}
                        placeholder="10.00"
                        className="w-full rounded-lg border border-[rgb(32_33_42_/_0.15)] bg-[#F8F8F6] px-3 py-2 text-sm outline-none focus:border-[#DF6B22] focus:ring-2 focus:ring-[#DF6B22]/10 disabled:opacity-60"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-semibold text-[#686970] pointer-events-none">
                        USDC
                      </span>
                    </div>
                    {selectedWithdrawPosition && (
                      <button
                        type="button"
                        disabled={withdrawExecuting}
                        onClick={() => {
                          setWithdrawAmount(fromAtomic(selectedWithdrawPosition.amountSuppliedAtomic));
                          setWithdrawError(null);
                        }}
                        className="px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-[#DF6B22]/30 bg-[#FFF3EB] text-[#DF6B22] hover:bg-[#FFE8D6] transition cursor-pointer disabled:opacity-50"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                  {!withdrawAmountValid && withdrawAmount.length > 0 && (
                    <p className="mt-1 text-[10px] text-rose-600">Enter a valid positive USDC amount.</p>
                  )}
                </div>

                {restricted ? (
                  <div>
                    <label
                      className="mb-1 block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#686970]"
                      htmlFor="kamino-withdraw-modal-pwd"
                    >
                      3. Master Password · Required to Confirm
                    </label>
                    <input
                      id="kamino-withdraw-modal-pwd"
                      type="password"
                      value={withdrawPassword}
                      disabled={withdrawExecuting}
                      onChange={(e) => setWithdrawPassword(e.target.value)}
                      placeholder="Enter master password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-[rgb(32_33_42_/_0.15)] bg-[#F8F8F6] px-3 py-2 text-sm outline-none focus:border-[#DF6B22] focus:ring-2 focus:ring-[#DF6B22]/10 disabled:opacity-60"
                    />
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium py-1">
                    <Check size={13} strokeWidth={3} />
                    <span>Full Access active · 1-click instant execution</span>
                  </p>
                )}

                {withdrawError && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[rgb(32_33_42_/_0.1)] pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="text-[#DF6B22] size-4" />
                    <span className="text-xs font-semibold text-[#20212a]">{withdrawMarketName}</span>
                  </div>
                  <Button
                    variant="primary"
                    disabled={withdrawExecuting || !withdrawAmountValid || (restricted && !withdrawPassword)}
                    onClick={() => void handleWithdraw()}
                    className="min-w-[200px] text-xs font-semibold"
                  >
                    {withdrawExecuting ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin mr-1.5" />
                        <span>Processing on Solana...</span>
                      </>
                    ) : (
                      `Withdraw ${withdrawAmount || "0"} USDC`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

