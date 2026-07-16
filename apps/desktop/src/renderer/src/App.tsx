import { useEffect, useState } from "react";

import type {
  AiDraftDcaResponse,
  AiProvider,
  AiProviderSetting,
  DcaSimulationRequest,
  DcaSimulationResponse,
  DcaCycleAudit,
  MissionView,
  RuntimeStatus,
  WalletBalanceResponse,
  WalletCreateResponse,
} from "@silfable/contracts";

export function App() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<DcaSimulationResponse | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      window.silfable
        .getRuntimeStatus()
        .then((nextStatus) => active && setStatus(nextStatus))
        .catch(() => active && setError("Runtime status is unavailable."));
    };
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">Silfable</span>
        <div className="topbarActions">
          <span className="environment">Devnet Simulation</span>
          {status?.keystore === "unlocked" && (
            <button
              type="button"
              onClick={() => {
                window.silfable
                  .lockWalletKeystore({ schemaVersion: 1, requestId: crypto.randomUUID() })
                  .then(() => window.silfable.getRuntimeStatus())
                  .then(setStatus)
                  .catch(() => setError("Explicit lock failed."));
              }}
            >
              Lock keystore
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Desktop runtime foundation</p>
        <h1>Autonomy starts locked.</h1>
        <p className="lede">
          Wallet signing and live execution remain disabled. The safety simulator exercises the same deterministic DCA and Desk Rule boundary without creating a transaction.
        </p>
      </section>

      <WalletOnboarding status={status} refreshStatus={() => window.silfable.getRuntimeStatus().then(setStatus)} />

      <MissionPanel status={status} />

      <section className="simulator">
        <div>
          <p className="eyebrow">Fail-closed proof</p>
          <h2>Simulate one due cycle.</h2>
          <p>
            The current shell starts offline and locked, so the expected result is Halted. No signing API exists in this build.
          </p>
        </div>
        <div className="simulatorAction">
          <button type="button" onClick={() => void runSimulation(status, setSimulation, setError)}>
            Run safety simulation
          </button>
          {simulation !== null && (
            <output>
              <strong>{simulation.outcome}</strong>
              <span>{simulation.denialCodes.join(" · ") || "all rules passed"}</span>
              <span>Signing attempted: {String(simulation.signingAttempted)}</span>
            </output>
          )}
        </div>
      </section>

      <section className="statusGrid" aria-label="Runtime status">
        <StatusCell label="Profile" value={status?.profile ?? "Loading"} />
        <StatusCell label="Network" value={status?.networkHealth ?? "Loading"} />
        <StatusCell label="Keystore" value={status?.keystore ?? "Loading"} />
        <StatusCell label="Wallet" value={status?.wallet ?? "Loading"} />
        <StatusCell label="Missions" value={String(status?.activeMissionCount ?? 0)} />
      </section>

      {error !== null && <p className="error">{error}</p>}
    </main>
  );
}

function WalletOnboarding({
  status,
  refreshStatus,
}: {
  status: RuntimeStatus | null;
  refreshStatus: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"create" | "mnemonic" | "private-key">("create");
  const [secret, setSecret] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<WalletCreateResponse | null>(null);
  const [balance, setBalance] = useState<WalletBalanceResponse | null>(null);
  const [airdropAcknowledged, setAirdropAcknowledged] = useState(false);

  if (status?.wallet === "configured" && created === null) {
    return (
      <section className="walletPanel configured walletRuntime">
        <div>
          <p className="eyebrow">Mission wallet</p>
          <h2>Dedicated Devnet wallet configured.</h2>
          <p>Private key material remains encrypted. Balance access requires an unlocked keystore, while signing remains disabled.</p>
        </div>
        <div className="walletForm">
          {status.keystore === "locked" ? (
            <button type="button" disabled={busy} onClick={() => void unlock()}>
              Unlock to read balance
            </button>
          ) : (
            <>
              <button type="button" disabled={busy || status.networkHealth !== "healthy"} onClick={() => void refreshBalance()}>
                Refresh confirmed balance
              </button>
              {balance !== null && (
                <output className="balanceBox">
                  <span>Confirmed Devnet balance</span>
                  <strong>{formatSol(balance.lamportsAtomic)} SOL</strong>
                  <small>{balance.address} · {balance.observedAt}</small>
                </output>
              )}
              <label className="riskAck">
                <input
                  type="checkbox"
                  checked={airdropAcknowledged}
                  onChange={(event) => setAirdropAcknowledged(event.target.checked)}
                />
                <span>I understand this requests exactly 1 test SOL on Devnet and has no real-world value.</span>
              </label>
              <button
                type="button"
                disabled={busy || !airdropAcknowledged || status.networkHealth !== "healthy"}
                onClick={() => void requestAirdrop()}
              >
                Request 1 Devnet SOL
              </button>
            </>
          )}
          {status.networkHealth !== "healthy" && <p className="formMessage">RPC is not healthy. Balance and faucet actions are fail-closed.</p>}
          {message !== null && <p className="formMessage">{message}</p>}
        </div>
      </section>
    );
  }

  async function unlock(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.unlockWalletKeystore({ schemaVersion: 1, requestId: crypto.randomUUID() });
      await refreshStatus();
    } catch {
      setMessage("Secure OS key storage is unavailable. Wallet onboarding remains locked.");
    } finally {
      setBusy(false);
    }
  }

  async function onboard(): Promise<void> {
    if (!acknowledged) {
      setMessage("Acknowledge the hot-wallet warning before continuing.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const base = {
      schemaVersion: 1 as const,
      requestId: crypto.randomUUID(),
      acknowledgedHotWalletRisk: true as const,
    };
    try {
      if (mode === "create") {
        setCreated(await window.silfable.createWallet(base));
      } else if (mode === "mnemonic") {
        const result = await window.silfable.importWalletMnemonic({ ...base, mnemonic: secret });
        setMessage(`Wallet ${result.address} imported into the encrypted keystore.`);
      } else {
        const result = await window.silfable.importWalletPrivateKey({ ...base, privateKey: secret });
        setMessage(`Wallet ${result.address} imported into the encrypted keystore.`);
      }
      setSecret("");
      await refreshStatus();
    } catch {
      setSecret("");
      setMessage("Wallet onboarding failed. Check the input and confirm no Devnet wallet already exists.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalance(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      setBalance(await window.silfable.getWalletBalance({ schemaVersion: 1, requestId: crypto.randomUUID() }));
    } catch {
      setMessage("Confirmed balance is unavailable. The request failed closed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestAirdrop(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.silfable.requestDevnetAirdrop({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        acknowledgedDevnetOnly: true,
      });
      setMessage(`Devnet faucet accepted the request. Signature: ${result.signature}`);
      setAirdropAcknowledged(false);
    } catch {
      setMessage("Devnet faucet request failed or is rate-limited. No retry was attempted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="walletPanel">
      <div className="walletIntro">
        <p className="eyebrow">Local encrypted keystore</p>
        <h2>Use a dedicated mission wallet.</h2>
        <p className="walletWarning">
          Silfable is a hot wallet. Never import your primary wallet, hardware-wallet recovery phrase, or cold-wallet key. Fund this wallet only with an amount you can afford to expose to automated execution.
        </p>
      </div>

      <div className="walletForm">
        {status?.keystore !== "unlocked" ? (
          <button type="button" disabled={busy} onClick={() => void unlock()}>
            Unlock secure keystore
          </button>
        ) : created !== null ? (
          <div className="recoveryBox">
            <span>Shown once · store offline</span>
            <strong>{created.recoveryMnemonic}</strong>
            <small>{created.derivationPath} · {created.address}</small>
            <button type="button" onClick={() => setCreated(null)}>I stored the recovery phrase</button>
          </div>
        ) : (
          <>
            <div className="modeTabs" role="tablist" aria-label="Wallet onboarding method">
              {(["create", "mnemonic", "private-key"] as const).map((item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  className={mode === item ? "active" : ""}
                  onClick={() => {
                    setMode(item);
                    setSecret("");
                  }}
                  key={item}
                >
                  {item === "private-key" ? "Private key" : item}
                </button>
              ))}
            </div>
            {mode !== "create" && (
              <textarea
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={
                  mode === "mnemonic"
                    ? "Enter BIP39 recovery phrase"
                    : "Enter base58 key or Solana JSON byte array"
                }
                autoComplete="off"
                spellCheck={false}
                rows={4}
              />
            )}
            <label className="riskAck">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>I understand this is a hot wallet and will use a new, dedicated Devnet wallet.</span>
            </label>
            <button
              type="button"
              disabled={busy || (mode !== "create" && secret.trim().length === 0)}
              onClick={() => void onboard()}
            >
              {busy ? "Working…" : mode === "create" ? "Create dedicated wallet" : "Import into encrypted keystore"}
            </button>
          </>
        )}
        {message !== null && <p className="formMessage">{message}</p>}
      </div>
    </section>
  );
}

function MissionPanel({ status }: { status: RuntimeStatus | null }) {
  const [missions, setMissions] = useState<MissionView[]>([]);
  const [amountSol, setAmountSol] = useState("0.1");
  const [intervalHours, setIntervalHours] = useState("1");
  const [maxCycles, setMaxCycles] = useState("12");
  const [dailyLimitSol, setDailyLimitSol] = useState("1.2");
  const [reserveSol, setReserveSol] = useState("0.5");
  const [slippageBps, setSlippageBps] = useState("100");
  const [priceImpactBps, setPriceImpactBps] = useState("50");
  const [authorizationAck, setAuthorizationAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState<DcaCycleAudit[]>([]);
  const [aiSettings, setAiSettings] = useState<AiProviderSetting[]>([]);
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gpt-5.6-luna");
  const [aiPrompt, setAiPrompt] = useState("Buy SOL gradually with 0.05 SOL every 6 hours for 30 cycles. Keep at least 0.5 SOL in reserve and use conservative slippage and price-impact limits.");
  const [aiConsent, setAiConsent] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraftDcaResponse | null>(null);
  const current = missions[0] ?? null;

  useEffect(() => {
    if (status?.keystore !== "unlocked") {
      setMissions([]);
      setAudit([]);
      return;
    }
    let active = true;
    const refresh = () => {
      window.silfable
        .listMissions()
        .then(async (result) => {
          if (!active) return;
          setMissions(result.missions);
          const mission = result.missions[0];
          if (mission === undefined) setAudit([]);
          else {
            const response = await window.silfable.getMissionAudit({
              schemaVersion: 1,
              requestId: crypto.randomUUID(),
              missionId: mission.id,
            });
            if (active) setAudit(response.cycles);
          }
        })
        .catch(() => active && setMessage("Mission store is unavailable."));
    };
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [status?.keystore]);

  useEffect(() => {
    if (status?.keystore !== "unlocked") {
      setAiSettings([]);
      setAiApiKey("");
      setAiDraft(null);
      return;
    }
    let active = true;
    window.silfable
      .getAiSettings()
      .then((result) => active && setAiSettings(result.providers))
      .catch(() => active && setMessage("AI provider settings are unavailable."));
    return () => {
      active = false;
    };
  }, [status?.keystore]);

  useEffect(() => {
    const selected = aiSettings.find((setting) => setting.provider === aiProvider);
    if (selected !== undefined) setAiModel(selected.model);
  }, [aiProvider, aiSettings]);

  useEffect(() => {
    if (current === null) return;
    setAmountSol(formatSol(current.plan.amountPerCycleAtomic));
    setIntervalHours(String(current.plan.intervalSeconds / 3_600));
    setMaxCycles(String(current.plan.maxCycles ?? 12));
    setDailyLimitSol(formatSol(current.plan.dailySpendLimitAtomic));
    setReserveSol(formatSol(current.plan.minimumWalletReserveAtomic));
    setSlippageBps(String(current.plan.maxSlippageBps));
    setPriceImpactBps(String(current.plan.maxPriceImpactBps));
  }, [current?.id, current?.revision]);

  if (status?.wallet !== "configured") return null;

  async function refreshMissions(): Promise<void> {
    const result = await window.silfable.listMissions();
    setMissions(result.missions);
    const mission = result.missions[0];
    if (mission === undefined) setAudit([]);
    else {
      setAudit(
        (
          await window.silfable.getMissionAudit({
            schemaVersion: 1,
            requestId: crypto.randomUUID(),
            missionId: mission.id,
          })
        ).cycles,
      );
    }
  }

  async function saveDraft(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const missionId = current?.id ?? crypto.randomUUID();
      const startAt =
        current?.state === "draft" ? current.plan.startAt : new Date(Date.now() + 5_000).toISOString();
      await window.silfable.saveMissionDraft({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        ...(current === null ? {} : { expectedRevision: current.revision }),
        plan: {
          schemaVersion: 1,
          id: missionId,
          profile: "devnet-simulation",
          inputMint: "11111111111111111111111111111111",
          outputMint: "22222222222222222222222222222222",
          amountPerCycleAtomic: parseSolToLamports(amountSol),
          intervalSeconds: Number(intervalHours) * 3_600,
          startAt,
          maxCycles: Number(maxCycles),
          maxSlippageBps: Number(slippageBps),
          maxPriceImpactBps: Number(priceImpactBps),
          maxFeeLamports: "5000",
          dailySpendLimitAtomic: parseSolToLamports(dailyLimitSol),
          minimumWalletReserveAtomic: parseSolToLamports(reserveSol),
          missedCyclePolicy: "skip",
          failurePolicy: "halt",
        },
      });
      setAuthorizationAck(false);
      setMessage("Draft revision saved. Review its digest before authorization.");
      await refreshMissions();
    } catch {
      setMessage("Draft was rejected. Use valid positive values, an interval of at least one hour, and review revision state.");
    } finally {
      setBusy(false);
    }
  }

  async function authorize(): Promise<void> {
    if (current === null || !authorizationAck) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.authorizeMission({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        missionId: current.id,
        expectedRevision: current.revision,
        expectedPlanDigest: current.planDigest,
        acknowledgedSimulationOnly: true,
      });
      setAuthorizationAck(false);
      setMessage("Exact revision authorized for simulation only.");
      await refreshMissions();
    } catch {
      setMessage("Authorization failed because the revision or digest changed.");
    } finally {
      setBusy(false);
    }
  }

  async function command(action: "start" | "halt"): Promise<void> {
    if (current === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const request = {
        schemaVersion: 1 as const,
        requestId: crypto.randomUUID(),
        missionId: current.id,
        expectedRevision: current.revision,
      };
      if (action === "start") await window.silfable.startMission(request);
      else await window.silfable.haltMission(request);
      setMessage(action === "start" ? "Simulation scheduler started." : "Mission halted manually.");
      await refreshMissions();
    } catch {
      setMessage(`${action === "start" ? "Start" : "Halt"} failed closed. Check network, keystore, wallet, and revision state.`);
    } finally {
      setBusy(false);
    }
  }

  async function refreshAiSettings(): Promise<void> {
    setAiSettings((await window.silfable.getAiSettings()).providers);
  }

  async function saveAiProvider(): Promise<void> {
    if (!aiConsent) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveAiProvider({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel,
        acknowledgedExternalProcessing: true,
      });
      setAiApiKey("");
      await refreshAiSettings();
      setMessage(`${aiProvider} key encrypted in the local OS keystore. It will never be displayed again.`);
    } catch {
      setAiApiKey("");
      setMessage("AI provider configuration was rejected or secure storage is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAiProvider(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.deleteAiProvider({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: aiProvider,
      });
      setAiApiKey("");
      setAiDraft(null);
      await refreshAiSettings();
      setMessage(`${aiProvider} key removed from the local keystore.`);
    } catch {
      setMessage("AI provider could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateAiDraft(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.silfable.draftDcaWithAi({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: aiProvider,
        prompt: aiPrompt,
        acknowledgedExternalProcessing: true,
      });
      setAiDraft(result);
      setMessage("AI returned a validated draft only. Review it, apply it to the form, then save and authorize separately.");
    } catch {
      setAiDraft(null);
      setMessage("AI draft generation failed closed. No mission was changed and no execution was attempted.");
    } finally {
      setBusy(false);
    }
  }

  function applyAiDraft(): void {
    if (aiDraft === null) return;
    const intent = aiDraft.intent;
    setAmountSol(intent.amountPerCycleSol);
    setIntervalHours(String(intent.intervalHours));
    setMaxCycles(String(intent.maxCycles));
    setDailyLimitSol(intent.dailyLimitSol);
    setReserveSol(intent.minimumWalletReserveSol);
    setSlippageBps(String(intent.maxSlippageBps));
    setPriceImpactBps(String(intent.maxPriceImpactBps));
    setAuthorizationAck(false);
    setMessage("AI values applied locally. The mission is still unchanged until you save a draft revision.");
  }

  return (
    <section className="missionPanel">
      <div className="missionIntro">
        <p className="eyebrow">Auto DCA · simulation only</p>
        <h2>Authorize the limits, not the outcome.</h2>
        <p>
          Every edit creates a new immutable revision. The scheduler records encrypted simulation receipts and never constructs or signs a transaction.
        </p>
        {current !== null && (
          <dl className="missionMeta">
            <div><dt>State</dt><dd>{current.state}</dd></div>
            <div><dt>Revision</dt><dd>v{current.revision}</dd></div>
            <div><dt>Cycles</dt><dd>{current.completedCycles}</dd></div>
            <div><dt>Halt reason</dt><dd>{current.haltReason ?? "—"}</dd></div>
          </dl>
        )}
      </div>

      <div className="missionForm">
        <section className="aiPanel" aria-label="External AI draft provider">
          <div className="aiPanelHeading">
            <div>
              <span>Hybrid AI runtime</span>
              <strong>Draft intent only</strong>
            </div>
            <em>{aiSettings.find((setting) => setting.provider === aiProvider)?.configured ? "configured" : "not configured"}</em>
          </div>
          <div className="modeTabs" role="tablist" aria-label="AI provider">
            {(["openai", "anthropic"] as const).map((provider) => (
              <button
                type="button"
                role="tab"
                aria-selected={aiProvider === provider}
                className={aiProvider === provider ? "active" : ""}
                onClick={() => setAiProvider(provider)}
                key={provider}
              >
                {provider}
              </button>
            ))}
          </div>
          <div className="aiCredentialGrid">
            <label>
              <span>Model</span>
              <input value={aiModel} onChange={(event) => setAiModel(event.target.value)} spellCheck={false} />
            </label>
            <label>
              <span>API key · encrypted locally</span>
              <input
                type="password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="Never displayed after save"
              />
            </label>
          </div>
          <div className="aiActions">
            <button type="button" disabled={busy || !aiConsent || aiApiKey.trim().length < 8} onClick={() => void saveAiProvider()}>
              Encrypt provider key
            </button>
            {aiSettings.find((setting) => setting.provider === aiProvider)?.configured && (
              <button type="button" disabled={busy} onClick={() => void deleteAiProvider()}>Remove key</button>
            )}
          </div>
          <label className="aiPrompt">
            <span>Natural-language DCA brief</span>
            <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={5} maxLength={4_000} />
          </label>
          <label className="riskAck">
            <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
            <span>I understand DCA prompts are sent to the selected external AI provider. API keys stay encrypted locally; Silfable sends no wallet key material, address, or balance.</span>
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !aiConsent ||
              aiPrompt.trim().length < 10 ||
              status?.networkHealth !== "healthy" ||
              !aiSettings.find((setting) => setting.provider === aiProvider)?.configured
            }
            onClick={() => void generateAiDraft()}
          >
            Generate validated draft
          </button>
          {aiDraft !== null && (
            <div className="aiDraftBox">
              <span>{aiDraft.provider} · {aiDraft.model} · execution attempted: false</span>
              <strong>{aiDraft.intent.rationale}</strong>
              <code>
                {aiDraft.intent.amountPerCycleSol} SOL / {aiDraft.intent.intervalHours}h · {aiDraft.intent.maxCycles} cycles · daily cap {aiDraft.intent.dailyLimitSol} SOL
              </code>
              <ul>{aiDraft.intent.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
              <button type="button" disabled={busy || current?.state === "running"} onClick={applyAiDraft}>Apply to local form</button>
            </div>
          )}
        </section>

        <div className="fieldGrid">
          <MissionField label="Amount / cycle (SOL)" value={amountSol} onChange={setAmountSol} />
          <MissionField label="Interval (hours)" value={intervalHours} onChange={setIntervalHours} />
          <MissionField label="Maximum cycles" value={maxCycles} onChange={setMaxCycles} />
          <MissionField label="Daily cap (SOL)" value={dailyLimitSol} onChange={setDailyLimitSol} />
          <MissionField label="Wallet reserve (SOL)" value={reserveSol} onChange={setReserveSol} />
          <MissionField label="Max slippage (bps)" value={slippageBps} onChange={setSlippageBps} />
          <MissionField label="Max price impact (bps)" value={priceImpactBps} onChange={setPriceImpactBps} />
        </div>

        <button type="button" disabled={busy || current?.state === "running"} onClick={() => void saveDraft()}>
          {current === null ? "Create draft" : "Save as new revision"}
        </button>

        {current !== null && (
          <div className="digestBox">
            <span>SHA-256 plan digest · revision {current.revision}</span>
            <code>{current.planDigest}</code>
          </div>
        )}

        {current?.state === "draft" && (
          <>
            <label className="riskAck">
              <input type="checkbox" checked={authorizationAck} onChange={(event) => setAuthorizationAck(event.target.checked)} />
              <span>I reviewed this exact digest and authorize only deterministic Devnet simulation.</span>
            </label>
            <button type="button" disabled={busy || !authorizationAck} onClick={() => void authorize()}>
              Authorize revision
            </button>
          </>
        )}

        {(current?.state === "authorized" || current?.state === "halted") && (
          <button type="button" disabled={busy || status?.networkHealth !== "healthy"} onClick={() => void command("start")}>
            Start simulation scheduler
          </button>
        )}
        {current?.state === "running" && (
          <button type="button" disabled={busy} onClick={() => void command("halt")}>Halt mission</button>
        )}
        {message !== null && <p className="formMessage">{message}</p>}
      </div>

      <div className="auditPanel">
        <div className="auditHeading">
          <div>
            <p className="eyebrow">Encrypted audit trail</p>
            <h3>Cycles and receipts</h3>
          </div>
          <span>{audit.length} records</span>
        </div>
        {audit.length === 0 ? (
          <p className="auditEmpty">No simulation cycles have been recorded.</p>
        ) : (
          <div className="auditList">
            {audit.map((cycle) => (
              <article className="auditRow" key={cycle.id}>
                <div>
                  <span>Revision {cycle.revision} · Cycle {cycle.cycle}</span>
                  <strong>{cycle.state}</strong>
                </div>
                <div>
                  <span>Due</span>
                  <code>{cycle.dueAt}</code>
                </div>
                <div>
                  <span>{cycle.receipt === null ? "Reason" : "Receipt"}</span>
                  <code>
                    {cycle.receipt === null
                      ? cycle.reason ?? "—"
                      : `${cycle.receipt.receiptId.slice(0, 8)} · signed=${String(cycle.receipt.signingAttempted)}`}
                  </code>
                </div>
                {cycle.receipt !== null && (
                  <div>
                    <span>Plan digest</span>
                    <code>{cycle.receipt.planDigest}</code>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MissionField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="missionField">
      <span>{label}</span>
      <input type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function parseSolToLamports(value: string): string {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,9}))?$/u.exec(value.trim());
  if (match === null) throw new Error("Invalid SOL amount");
  const whole = BigInt(match[1] ?? "0") * 1_000_000_000n;
  const fraction = BigInt((match[2] ?? "").padEnd(9, "0") || "0");
  const result = whole + fraction;
  if (result <= 0n) throw new Error("SOL amount must be positive");
  return result.toString();
}

function formatSol(lamportsAtomic: string): string {
  const lamports = BigInt(lamportsAtomic);
  const whole = lamports / 1_000_000_000n;
  const fraction = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/u, "");
  return fraction.length === 0 ? whole.toString() : `${whole}.${fraction}`;
}

async function runSimulation(
  status: RuntimeStatus | null,
  setSimulation: (result: DcaSimulationResponse) => void,
  setError: (message: string | null) => void,
): Promise<void> {
  const now = new Date();
  const request: DcaSimulationRequest = {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    completedCycles: 0,
    lastSchedulerTickAt: new Date(now.getTime() - 1_000).toISOString(),
    now: now.toISOString(),
    plan: {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      profile: "devnet-simulation",
      inputMint: "11111111111111111111111111111111",
      outputMint: "22222222222222222222222222222222",
      amountPerCycleAtomic: "1000000",
      intervalSeconds: 3_600,
      startAt: now.toISOString(),
      maxCycles: 12,
      maxSlippageBps: 100,
      maxPriceImpactBps: 50,
      maxFeeLamports: "5000",
      dailySpendLimitAtomic: "12000000",
      minimumWalletReserveAtomic: "5000000",
      missedCyclePolicy: "skip",
      failurePolicy: "halt",
    },
    snapshot: {
      observedAt: now.toISOString(),
      quoteExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
      networkHealth: status?.networkHealth === "healthy" ? "healthy" : "offline",
      keystoreUnlocked: status?.keystore === "unlocked",
      globalKillSwitch: false,
      missionKillSwitch: false,
      walletBalanceAtomic: "100000000",
      spentTodayAtomic: "0",
      price: "1",
      priceImpactBps: 10,
      feeLamports: "1000",
      inputMintAllowed: true,
      outputMintAllowed: true,
      marketEligible: true,
      simulationSucceeded: true,
    },
  };

  try {
    setError(null);
    setSimulation(await window.silfable.simulateDca(request));
  } catch {
    setError("Safety simulation is unavailable.");
  }
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="statusCell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
