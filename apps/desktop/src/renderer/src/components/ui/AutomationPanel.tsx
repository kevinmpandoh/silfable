import { useEffect, useState } from "react";
import { Play, Pause, XCircle, RefreshCw, Bot, Clock, Timer, Layers, MessageSquare } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";

type Strategy = {
  id: string;
  sessionId?: string;
  kind: "DCA" | "EXIT";
  status: "ACTIVE" | "PAUSED" | "AWAITING_APPROVAL" | "EXPIRED" | "CANCELLED" | "EMERGENCY_STOPPED";
  inputMint: string;
  outputMint: string;
  nextWakeAt: string | null;
  lastEvaluatedAt: string | null;
  createdAt: string;
  orderAmountRaw?: string;
  maximumTotalRaw?: string;
  intervalSeconds?: number;
  completedExecutions?: number;
  maximumExecutions?: number;
  amountRaw?: string;
  entryPriceUsd?: number;
  stopLossPriceUsd?: number | null;
  takeProfitPriceUsd?: number | null;
  trailingStopPercent?: number | null;
};

type Proposal = {
  id: string;
  strategyId: string;
  sessionId?: string;
  reason: "DCA_DUE" | "STOP_LOSS" | "TAKE_PROFIT" | "TRAILING_STOP";
  observedPriceUsd: number | null;
  status: "AWAITING_APPROVAL" | "REJECTED" | "CONSUMED" | "EXPIRED";
  createdAt: string;
};

const KNOWN_TOKENS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
};

export function AutomationPanel({ sessionId, onReloadSessions }: { sessionId?: string; onReloadSessions?: () => Promise<void> }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [filterMode, setFilterMode] = useState<"ALL" | "SESSION">("ALL");

  const fetchAutomationData = async () => {
    try {
      setLoading(true);
      if ((window as any).silfable?.listAutomationStrategies) {
        const res = await (window as any).silfable.listAutomationStrategies();
        setStrategies(res.strategies as Strategy[]);
        setProposals(res.proposals as Proposal[]);
      }
    } catch (err) {
      console.error("Failed to load automation strategies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomationData();
    const interval = setInterval(fetchAutomationData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStatusChange = async (id: string, action: "PAUSE" | "RESUME" | "CANCEL" | "APPROVE_PROPOSAL" | "REJECT_PROPOSAL") => {
    try {
      setActionLoading(id);
      if ((window as any).silfable?.setAutomationStatus) {
        await (window as any).silfable.setAutomationStatus({
          schemaVersion: 1,
          requestId: crypto.randomUUID(),
          id,
          sessionId,
          action,
        });
        await fetchAutomationData();
        if (action === "APPROVE_PROPOSAL" && onReloadSessions) {
          await onReloadSessions();
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} strategy:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: Strategy["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "PAUSED":
        return <Badge variant="warning">Paused</Badge>;
      case "AWAITING_APPROVAL":
        return <Badge variant="info">Awaiting Approval</Badge>;
      case "CANCELLED":
        return <Badge variant="danger">Cancelled</Badge>;
      case "EXPIRED":
        return <Badge variant="neutral">Expired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const truncate = (str: string, length = 12) => {
    if (!str) return "";
    return str.length > length ? `${str.slice(0, 6)}...${str.slice(-4)}` : str;
  };

  const getSymbol = (mint: string) => {
    if (!mint) return "???";
    return KNOWN_TOKENS[mint] || truncate(mint, 8);
  };

  const formatPair = (inputMint: string, outputMint: string) => {
    return `${getSymbol(inputMint)} ➔ ${getSymbol(outputMint)}`;
  };

  const formatOrderAmount = (rawAmount?: string, inputMint?: string) => {
    if (!rawAmount) return "-";
    const num = Number(rawAmount);
    if (isNaN(num)) return rawAmount;
    if (inputMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" || (!inputMint && num >= 1000)) {
      const formatted = (num / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      return `${formatted} USDC`;
    }
    return `${num.toLocaleString()} raw units`;
  };

  const formatCountdown = (nextWakeAt: string | null, status: Strategy["status"]) => {
    if (status !== "ACTIVE" || !nextWakeAt) return null;
    const diffMs = Date.parse(nextWakeAt) - currentTime;
    if (diffMs <= 0) return "Evaluating now...";
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
    return `${pad(mins)}:${pad(secs)}`;
  };

  const currentSessionStrategies = sessionId
    ? strategies.filter(s => s.sessionId === sessionId || !s.sessionId)
    : strategies;

  const displayStrategies = filterMode === "SESSION" && sessionId
    ? currentSessionStrategies
    : strategies;

  const displayProposals = filterMode === "SESSION" && sessionId
    ? proposals.filter(p => currentSessionStrategies.some(s => s.id === p.strategyId) || p.sessionId === sessionId)
    : proposals;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bot className="h-6 w-6 text-cyan-400" />
            Autonomous Capital Execution
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Background strategies (DCA, Take Profit, Stop Loss) executed autonomously by system workers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterMode === "ALL"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              All Sessions ({strategies.filter(s => s.status !== "CANCELLED").length})
            </button>
            {sessionId && (
              <button
                onClick={() => setFilterMode("SESSION")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterMode === "SESSION"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Current Session ({currentSessionStrategies.filter(s => s.status !== "CANCELLED").length})
              </button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={fetchAutomationData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-cyan-200/90 flex items-start gap-3">
        <Bot className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-cyan-300">How to Create Strategies:</span> Ask the AI Assistant in chat (e.g. <em>"Setup DCA to buy Solana 10 USDC every day"</em> or <em>"Set Take Profit at $200 for SOL"</em>). New strategies will automatically register and appear below for monitoring and pause/cancel management.
        </div>
      </div>

      {/* Active Strategies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Active Strategies ({displayStrategies.filter(s => s.status !== "CANCELLED").length})
          </h3>
          {filterMode === "SESSION" && (
            <span className="text-xs text-slate-400 font-medium">
              Showing strategies created in this session
            </span>
          )}
        </div>

        {displayStrategies.filter(s => s.status !== "CANCELLED").length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-800 bg-slate-900/30">
            <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              {filterMode === "SESSION" ? "No Active Automation Strategies for This Session" : "No Active Automation Strategies"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {filterMode === "SESSION" ? (
                <>
                  Click <button onClick={() => setFilterMode("ALL")} className="text-cyan-400 underline font-semibold">All Sessions</button> to view strategies created in other chat sessions.
                </>
              ) : (
                "Start by chatting with the AI Assistant to configure your first DCA or TP/SL trigger."
              )}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayStrategies.filter(s => s.status !== "CANCELLED").map((strategy) => {
              const matchingProposal = displayProposals.find(p => p.strategyId === strategy.id && p.status === "AWAITING_APPROVAL");
              const countdown = formatCountdown(strategy.nextWakeAt, strategy.status);
              return (
                <Card key={strategy.id} variant="elevated" className="relative border-slate-800/80 bg-slate-900/60">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {strategy.kind}
                      </span>
                      <CardTitle className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                        {formatPair(strategy.inputMint, strategy.outputMint)}
                      </CardTitle>
                    </div>
                    {getStatusBadge(strategy.status)}
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-slate-300">
                    {strategy.kind === "DCA" && (
                      <>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Execution Progress:</span>
                          <span className="font-semibold text-slate-200">
                            {strategy.completedExecutions ?? 0} / {strategy.maximumExecutions ?? "-"} cycles
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Order Amount:</span>
                          <span className="font-mono text-cyan-300 font-semibold">
                            {formatOrderAmount(strategy.orderAmountRaw, strategy.inputMint)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Interval:</span>
                          <span className="text-slate-200">Every {Math.round((strategy.intervalSeconds ?? 0) / 60)} mins</span>
                        </div>
                        {countdown && (
                          <div className="flex justify-between pb-1.5 items-center">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5 text-cyan-400" /> Next Run in:
                            </span>
                            <span className="font-mono text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                              {countdown}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {strategy.kind === "EXIT" && (
                      <>
                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                          <span className="text-slate-400">Entry Price:</span>
                          <span className="font-mono text-slate-200">${strategy.entryPriceUsd}</span>
                        </div>
                        {strategy.takeProfitPriceUsd && (
                          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                            <span className="text-slate-400">Take Profit:</span>
                            <span className="font-mono text-emerald-400">${strategy.takeProfitPriceUsd}</span>
                          </div>
                        )}
                        {strategy.stopLossPriceUsd && (
                          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                            <span className="text-slate-400">Stop Loss:</span>
                            <span className="font-mono text-red-400">${strategy.stopLossPriceUsd}</span>
                          </div>
                        )}
                        {countdown && (
                          <div className="flex justify-between pb-1.5 items-center">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5 text-cyan-400" /> Next Check in:
                            </span>
                            <span className="font-mono text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                              {countdown}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Actions */}
                    <div className="pt-3 flex gap-2 justify-end items-center flex-wrap">
                      {matchingProposal ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                          disabled={actionLoading === matchingProposal.id}
                          onClick={() => handleStatusChange(matchingProposal.id, "APPROVE_PROPOSAL")}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Approve Execution
                        </Button>
                      ) : strategy.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionLoading === strategy.id}
                          onClick={() => handleStatusChange(strategy.id, "PAUSE")}
                        >
                          <Pause className="h-3.5 w-3.5 mr-1 text-amber-400" />
                          Pause
                        </Button>
                      ) : strategy.status === "PAUSED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionLoading === strategy.id}
                          onClick={() => handleStatusChange(strategy.id, "RESUME")}
                        >
                          <Play className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                          Resume
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === strategy.id}
                        onClick={() => handleStatusChange(strategy.id, "CANCEL")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution Proposals Log Section */}
      {displayProposals.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Execution Proposals & History ({displayProposals.length})
          </h3>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/50 text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Trigger Reason</th>
                  <th className="p-3">Observed Price</th>
                  <th className="p-3">Proposal Status</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {displayProposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-semibold text-slate-200">{prop.reason}</td>
                    <td className="p-3 font-mono">{prop.observedPriceUsd ? `$${prop.observedPriceUsd}` : "-"}</td>
                    <td className="p-3 font-semibold">
                      <span className={prop.status === "AWAITING_APPROVAL" ? "text-amber-400 font-semibold" : prop.status === "CONSUMED" ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                        {prop.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {prop.status === "AWAITING_APPROVAL" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 text-[11px] h-7 font-medium"
                            disabled={actionLoading === prop.id}
                            onClick={() => handleStatusChange(prop.id, "APPROVE_PROPOSAL")}
                          >
                            Approve Execution
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="px-2 py-1 text-[11px] h-7"
                            disabled={actionLoading === prop.id}
                            onClick={() => handleStatusChange(prop.id, "REJECT_PROPOSAL")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">{new Date(prop.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
