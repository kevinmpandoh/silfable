import { useEffect, useState } from "react";

import type {
  AiDraftDcaResponse,
  AiProposeShadowTradeResponse,
  AiProvider,
  AiProviderSetting,
  AiShadowTradeEvaluationView,
  AgentIntentEvaluationView,
  AgentDevnetSimulationView,
  AgentDevnetSigningArmView,
  AgentDevnetPreSignExecutionView,
  AgentSessionView,
  DevnetCanaryView,
  DevnetFixtureProvisionView,
  DevnetFixtureReviewView,
  DevnetFixtureTransferView,
  DevnetFixtureTransferApprovalView,
  GuardedMissionAuthorizationView,
  GuardedSchedulerArmView,
  GuardedExecutionView,
  JupiterShadowQuoteView,
  MarketObservationView,
  MarketWakeReceiptView,
  MarketWatchView,
  DcaSimulationRequest,
  DcaSimulationResponse,
  DcaCycleAudit,
  MissionView,
  RuntimeStatus,
  UpdateStatus,
  CrashReportView,
  TelemetrySettings,
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

      <JupiterShadowPanel status={status} />

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

      <UpdatePanel />

      <TelemetryPanel keystoreUnlocked={status?.keystore === "unlocked"} />

      {error !== null && <p className="error">{error}</p>}
    </main>
  );
}

function TelemetryPanel({ keystoreUnlocked }: { keystoreUnlocked: boolean }) {
  const [settings, setSettings] = useState<TelemetrySettings | null>(null);
  const [reports, setReports] = useState<CrashReportView[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.silfable.getTelemetrySettings().then((value) => active && setSettings(value)).catch(() => {
      if (active) setMessage("Local crash settings are unavailable.");
    });
    return () => { active = false; };
  }, []);

  async function changeConsent(consent: boolean): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.setTelemetryConsent({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        consent,
        acknowledgedCrashOnly: true,
      });
      setSettings(response.settings);
      if (!consent) setReports([]);
      setAcknowledged(false);
      setMessage(consent
        ? "Local encrypted crash journaling enabled. Network transmission remains disabled."
        : "Consent revoked and every local crash report deleted.");
    } catch {
      setMessage("Consent change failed closed.");
    } finally { setBusy(false); }
  }

  async function loadReports(): Promise<void> {
    setBusy(true);
    try {
      const response = await window.silfable.listCrashReports();
      setReports(response.reports);
      setMessage(response.reports.length === 0 ? "No crash reports are stored." : "Showing locally decrypted, bounded crash fields.");
    } catch {
      setMessage("Reports remain encrypted until the keystore is unlocked.");
    } finally { setBusy(false); }
  }

  async function deleteReports(): Promise<void> {
    setBusy(true);
    try {
      const response = await window.silfable.deleteCrashReports({ schemaVersion: 1, requestId: crypto.randomUUID() });
      setSettings(response.settings);
      setReports([]);
      setMessage("All local crash reports deleted.");
    } catch {
      setMessage("Crash report deletion failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="telemetryPanel">
      <div>
        <p className="eyebrow">Strict opt-in</p>
        <h2>Crash evidence without account evidence.</h2>
        <p>
          Only process category, allowlisted crash reason, exit code, app version, platform, and timestamp can be retained. Reports are encrypted locally and never transmitted in this build.
        </p>
      </div>
      <div className="telemetryControls">
        <dl>
          <div><dt>Consent</dt><dd>{settings?.consent ? "Granted" : "Not granted"}</dd></div>
          <div><dt>Local reports</dt><dd>{settings?.reportCount ?? 0}</dd></div>
          <div><dt>Endpoint</dt><dd>Not configured</dd></div>
          <div><dt>Transmission</dt><dd>Disabled</dd></div>
        </dl>
        {!settings?.consent && (
          <label className="riskAck">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>I opt in to encrypted local crash-only records. No wallet address, balance, private key, API key, stack dump, or environment variables may be collected.</span>
          </label>
        )}
        <div className="telemetryActions">
          {!settings?.consent ? (
            <button type="button" disabled={busy || !acknowledged} onClick={() => void changeConsent(true)}>Enable local crash journal</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void changeConsent(false)}>Revoke and purge</button>
          )}
          <button type="button" disabled={busy || !settings?.consent || !keystoreUnlocked} onClick={() => void loadReports()}>Preview local reports</button>
          <button type="button" disabled={busy || (settings?.reportCount ?? 0) === 0} onClick={() => void deleteReports()}>Delete reports</button>
        </div>
        {message !== null && <p className="formMessage">{message}</p>}
      </div>
      {reports.length > 0 && (
        <div className="telemetryReports">
          {reports.map((report) => (
            <article key={report.id}>
              <div><span>Process</span><strong>{report.processType}</strong></div>
              <div><span>Reason</span><strong>{report.reason}</strong></div>
              <div><span>Code</span><code>{report.errorCode}</code></div>
              <div><span>Runtime</span><code>{report.platform} · {report.appVersion}</code></div>
              <div><span>Observed</span><code>{new Date(report.createdAt).toLocaleString()}</code></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UpdatePanel() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.silfable.getUpdateStatus().then((value) => active && setStatus(value)).catch(() => {
      if (active) setMessage("Update status is unavailable.");
    });
    return () => { active = false; };
  }, []);

  async function check(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.checkForUpdate({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
      });
      setStatus(response.status);
      setMessage(
        response.status.state === "available"
          ? "A release is available for manual review. Nothing was downloaded."
          : response.status.state === "up-to-date"
            ? "This build matches the latest published release."
            : "GitHub Releases could not be reached. No update action was taken.",
      );
    } catch {
      setMessage("Update check failed closed. No download or installation was attempted.");
    } finally {
      setBusy(false);
    }
  }

  async function openReview(): Promise<void> {
    setBusy(true);
    try {
      await window.silfable.openUpdateReview({ schemaVersion: 1, requestId: crypto.randomUUID() });
      setMessage("Opened the fixed GitHub Releases review page in your browser.");
    } catch {
      setMessage("The release review page could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="updatePanel">
      <div>
        <p className="eyebrow">Notify and review</p>
        <h2>Updates never interrupt a mission.</h2>
      </div>
      <div className="updateDetails">
        <dl>
          <div><dt>Installed</dt><dd>{status?.currentVersion ?? "—"}</dd></div>
          <div><dt>Latest</dt><dd>{status?.latestVersion ?? "Not published"}</dd></div>
          <div><dt>Status</dt><dd>{status?.state ?? "Loading"}</dd></div>
          <div><dt>Automatic actions</dt><dd>Download false · Install false · Restart false</dd></div>
        </dl>
        <p>
          The checker reads public release metadata from the fixed Silfable GitHub repository. You choose whether to open, review, and download a release.
        </p>
        <div className="updateActions">
          <button type="button" disabled={busy} onClick={() => void check()}>Check GitHub Releases</button>
          <button type="button" disabled={busy} onClick={() => void openReview()}>Review releases</button>
        </div>
        {message !== null && <p className="formMessage">{message}</p>}
      </div>
    </section>
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
  const [canaryAcknowledged, setCanaryAcknowledged] = useState(false);
  const [canaries, setCanaries] = useState<DevnetCanaryView[]>([]);
  const [fixtureAcks, setFixtureAcks] = useState([false, false, false, false]);
  const [fixtureProvisions, setFixtureProvisions] = useState<DevnetFixtureProvisionView[]>([]);
  const [fixtureReviewAcks, setFixtureReviewAcks] = useState([false, false, false]);
  const [activeFixture, setActiveFixture] = useState<DevnetFixtureReviewView | null>(null);
  const [fixtureTransferAcks, setFixtureTransferAcks] = useState([false, false, false, false]);
  const [fixtureTransfers, setFixtureTransfers] = useState<DevnetFixtureTransferView[]>([]);
  const [fixtureTransferApprovalAcks, setFixtureTransferApprovalAcks] = useState([false, false, false]);
  const [fixtureTransferApproval, setFixtureTransferApproval] = useState<DevnetFixtureTransferApprovalView | null>(null);
  const confirmedFixtureTransfer = fixtureTransfers.find((transfer) => transfer.state === "confirmed") ?? null;
  const fixtureProvisionBlocked = fixtureProvisions.some((provision) =>
    ["proposed", "simulated", "signed", "broadcast", "confirmed", "ambiguous"].includes(provision.state),
  );
  const confirmedUnreviewedProvision = activeFixture === null
    ? fixtureProvisions.find((provision) => provision.state === "confirmed") ?? null
    : null;

  useEffect(() => {
    if (status?.wallet !== "configured" || status.keystore !== "unlocked") {
      setCanaries([]);
      setFixtureProvisions([]);
      setActiveFixture(null);
      setFixtureTransfers([]);
      setFixtureTransferApproval(null);
      return;
    }
    let active = true;
    window.silfable
      .listDevnetCanaries()
      .then((result) => active && setCanaries(result.executions))
      .catch(() => active && setMessage("Canary execution journal is unavailable."));
    window.silfable
      .listDevnetFixtureProvisions()
      .then((result) => active && setFixtureProvisions(result.provisions))
      .catch(() => active && setMessage("Fixture provisioning journal is unavailable."));
    window.silfable
      .getActiveDevnetFixture()
      .then((result) => active && setActiveFixture(result.fixture))
      .catch(() => active && setMessage("Active fixture review is unavailable."));
    window.silfable
      .listDevnetFixtureTransfers()
      .then((result) => active && setFixtureTransfers(result.transfers))
      .catch(() => active && setMessage("Guarded fixture transfer journal is unavailable."));
    window.silfable
      .getDevnetFixtureTransferApproval()
      .then((result) => active && setFixtureTransferApproval(result.approval))
      .catch(() => active && setMessage("Guarded fixture approval receipt is unavailable."));
    return () => {
      active = false;
    };
  }, [status?.wallet, status?.keystore]);

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
              <div className="canaryBox">
                <div>
                  <span>Signed execution canary</span>
                  <strong>0-lamport self-transfer</strong>
                  <small>Builds, simulates, signs, broadcasts, confirms, and journals one non-economic Devnet transaction. Network fee still applies.</small>
                </div>
                <label className="riskAck">
                  <input
                    type="checkbox"
                    checked={canaryAcknowledged}
                    onChange={(event) => setCanaryAcknowledged(event.target.checked)}
                  />
                  <span>I authorize one manual Devnet canary and understand the wallet will pay its network fee.</span>
                </label>
                <button
                  type="button"
                  disabled={busy || !canaryAcknowledged || status.networkHealth !== "healthy"}
                  onClick={() => void executeCanary()}
                >
                  Execute signed Devnet canary
                </button>
                {canaries.length > 0 && (
                  <div className="canaryList">
                    {canaries.slice(0, 5).map((execution) => (
                      <article key={execution.id}>
                        <div><span>State</span><strong>{execution.state}</strong></div>
                        <div><span>Simulation</span><code>{execution.simulationUnits ?? "—"} CU</code></div>
                        <div><span>Signature</span><code>{execution.signature?.slice(0, 16) ?? "—"}</code></div>
                        <div><span>Failure</span><code>{execution.failureCode ?? "—"}</code></div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <div className="canaryBox fixtureProvisionBox">
                <div>
                  <span>One-time fixture activation</span>
                  <strong>Create immutable SPL test fixture</strong>
                  <small>One atomic Devnet transaction creates a 6-decimal mint, two token accounts, a fixed 1,000-token supply, and permanently revokes mint and freeze authority. This pays real Devnet network fees but creates no asset with real-world value.</small>
                </div>
                {[
                  "I authorize creation of a new test-only SPL mint and token accounts on Devnet.",
                  "I understand this wallet pays rent and network fees from its Devnet SOL balance.",
                  "I understand mint and freeze authority revocation is permanent and cannot be undone.",
                  "I understand this only provisions a fixture and does not enable automatic trading or DCA signing.",
                ].map((copy, index) => (
                  <label className="riskAck" key={copy}>
                    <input
                      type="checkbox"
                      checked={fixtureAcks[index] ?? false}
                      onChange={(event) => setFixtureAcks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                    />
                    <span>{copy}</span>
                  </label>
                ))}
                <button
                  type="button"
                  disabled={busy || fixtureProvisionBlocked || !fixtureAcks.every(Boolean) || status.networkHealth !== "healthy"}
                  onClick={() => void executeFixtureProvision()}
                >
                  Provision immutable Devnet fixture
                </button>
                {fixtureProvisionBlocked && <small>A fixture already exists or has an ambiguous result requiring review. A second provisioning attempt is blocked.</small>}
                {confirmedUnreviewedProvision !== null && (
                  <div className="fixtureReviewPanel">
                    <span>Post-confirmation gate</span>
                    <strong>Review live accounts before activation</strong>
                    <small>Silfable will refetch the mint and both token accounts from one confirmed Devnet slot, decode them locally, and reject any active authority, delegate, owner mismatch, or changed instruction fingerprint.</small>
                    {[
                      "I authorize a fresh read-only on-chain review of the confirmed fixture accounts.",
                      "I understand activation applies only to guarded Devnet fixture execution.",
                      "I understand automatic trading and Auto DCA signing remain disabled after activation.",
                    ].map((copy, index) => (
                      <label className="riskAck" key={copy}>
                        <input
                          type="checkbox"
                          checked={fixtureReviewAcks[index] ?? false}
                          onChange={(event) => setFixtureReviewAcks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                        />
                        <span>{copy}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      disabled={busy || !fixtureReviewAcks.every(Boolean) || status.networkHealth !== "healthy"}
                      onClick={() => void activateFixtureReview(confirmedUnreviewedProvision.id)}
                    >
                      Review on-chain and activate fixture
                    </button>
                  </div>
                )}
                {activeFixture !== null && (
                  <div className="activeFixtureReceipt">
                    <span>Active guarded fixture</span>
                    <strong>{activeFixture.mintAddress}</strong>
                    <code>manifest {activeFixture.manifestDigest}</code>
                    <small>Observed at confirmed slot {activeFixture.observedSlot}. Auto DCA signing remains disabled.</small>
                    {fixtureTransfers.length === 0 && (
                      <div className="fixtureTransferPanel">
                        <span>Manual low-value proof</span>
                        <strong>Transfer exactly 1 test token</strong>
                        <small>This one-time action revalidates the active fixture twice, simulates the exact message, and only then signs. It transfers 1.000000 test token to the permanently fixed destination account.</small>
                        {[
                          "I authorize use of only the active, reviewed Devnet fixture manifest.",
                          "I understand exactly 1 test token will be transferred and cannot be recovered from the fixed destination.",
                          "I understand the mission wallet pays the Devnet transaction fee.",
                          "I understand this manual proof does not enable Auto DCA or unattended signing.",
                        ].map((copy, index) => (
                          <label className="riskAck" key={copy}>
                            <input
                              type="checkbox"
                              checked={fixtureTransferAcks[index] ?? false}
                              onChange={(event) => setFixtureTransferAcks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                            />
                            <span>{copy}</span>
                          </label>
                        ))}
                        <button
                          type="button"
                          disabled={busy || !fixtureTransferAcks.every(Boolean) || status.networkHealth !== "healthy"}
                          onClick={() => void executeFixtureTransfer()}
                        >
                          Execute one guarded Devnet transfer
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {fixtureTransfers.length > 0 && (
                  <div className="canaryList fixtureTransferReceipts">
                    {fixtureTransfers.slice(0, 5).map((transfer) => (
                      <article key={transfer.id}>
                        <div><span>Guarded transfer</span><strong>{transfer.state}</strong></div>
                        <div><span>Amount</span><code>1.000000 test token</code></div>
                        <div><span>Simulation</span><code>{transfer.simulationUnits ?? "—"} CU</code></div>
                        <div><span>Failure</span><code>{transfer.failureCode ?? "—"}</code></div>
                        <small>Manifest {transfer.fixtureManifestDigest.slice(0, 16)}… · {transfer.updatedAt}</small>
                      </article>
                    ))}
                    <small>This receipt does not enable Auto DCA. An ambiguous result must be reviewed on-chain and is never retried automatically.</small>
                  </div>
                )}
                {confirmedFixtureTransfer !== null && fixtureTransferApproval === null && (
                  <div className="fixtureReviewPanel fixtureApprovalPanel">
                    <span>Operator receipt gate</span>
                    <strong>Approve the confirmed manual proof</strong>
                    <small>Silfable will decrypt and verify the stored evidence, bind it to the active manifest, and query the signature confirmation again. This approval is local evidence only and cannot start Auto DCA.</small>
                    {[
                      "I reviewed the exact confirmed transfer receipt and its active manifest digest.",
                      "I authorize a fresh read-only Devnet confirmation check for the encrypted signature.",
                      "I understand this approval does not enable automatic trading or scheduler signing.",
                    ].map((copy, index) => (
                      <label className="riskAck" key={copy}>
                        <input
                          type="checkbox"
                          checked={fixtureTransferApprovalAcks[index] ?? false}
                          onChange={(event) => setFixtureTransferApprovalAcks((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                        />
                        <span>{copy}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      disabled={busy || !fixtureTransferApprovalAcks.every(Boolean) || status.networkHealth !== "healthy"}
                      onClick={() => void approveFixtureTransfer(confirmedFixtureTransfer.id)}
                    >
                      Verify on-chain and approve receipt
                    </button>
                  </div>
                )}
                {fixtureTransferApproval !== null && (
                  <div className="activeFixtureReceipt fixtureApprovalReceipt">
                    <span>Operator-approved proof</span>
                    <strong>Manual guarded path verified</strong>
                    <code>manifest {fixtureTransferApproval.fixtureManifestDigest}</code>
                    <small>Approved {fixtureTransferApproval.approvedAt}. Automatic trading enabled: no.</small>
                  </div>
                )}
                {fixtureProvisions.length > 0 && (
                  <div className="canaryList">
                    {fixtureProvisions.slice(0, 5).map((provision) => (
                      <article key={provision.id}>
                        <div><span>State</span><strong>{provision.state}</strong></div>
                        <div><span>Mint</span><code>{provision.mintAddress.slice(0, 16)}â€¦</code></div>
                        <div><span>Simulation</span><code>{provision.simulationUnits ?? "â€”"} CU</code></div>
                        <div><span>Failure</span><code>{provision.failureCode ?? "â€”"}</code></div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
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

  async function executeCanary(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.executeDevnetCanary({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        acknowledgedDevnetFee: true,
      });
      setCanaryAcknowledged(false);
      setCanaries((await window.silfable.listDevnetCanaries()).executions);
      setMessage(
        response.execution.state === "confirmed"
          ? "Devnet canary confirmed and journaled. This does not enable automatic DCA signing."
          : `Devnet canary ended ${response.execution.state}. Review the journal before another attempt.`,
      );
    } catch {
      setCanaryAcknowledged(false);
      setMessage("Devnet canary was rejected before execution or failed closed.");
    } finally {
      setBusy(false);
    }
  }

  async function executeFixtureProvision(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.executeDevnetFixtureProvision({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        acknowledgedCreatesDevnetMint: true,
        acknowledgedPaysNetworkFees: true,
        acknowledgedAuthorityRevocationIsPermanent: true,
        acknowledgedDoesNotEnableAutomaticTrading: true,
      });
      setFixtureAcks([false, false, false, false]);
      setFixtureProvisions((await window.silfable.listDevnetFixtureProvisions()).provisions);
      setMessage(
        response.provision.state === "confirmed"
          ? `Fixture mint ${response.provision.mintAddress} confirmed. Automatic trading remains disabled.`
          : `Fixture provisioning ended ${response.provision.state}. Do not retry an ambiguous execution.`,
      );
    } catch {
      setFixtureAcks([false, false, false, false]);
      setMessage("Fixture provisioning was rejected or failed closed. No automatic retry was attempted.");
    } finally {
      setBusy(false);
    }
  }

  async function activateFixtureReview(provisionId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.activateDevnetFixtureReview({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provisionId,
        acknowledgedFreshOnChainReview: true,
        acknowledgedGuardedDevnetOnly: true,
        acknowledgedAutomaticTradingRemainsDisabled: true,
      });
      setFixtureReviewAcks([false, false, false]);
      setActiveFixture(response.fixture);
      setMessage("Fixture provenance passed and the reviewed manifest is active. Automatic trading remains disabled.");
    } catch {
      setFixtureReviewAcks([false, false, false]);
      setMessage("Fixture activation failed closed because live provenance could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function executeFixtureTransfer(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.executeDevnetFixtureTransfer({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        acknowledgedUsesActiveReviewedFixture: true,
        acknowledgedFixedLowValueTransfer: true,
        acknowledgedPaysNetworkFee: true,
        acknowledgedAutomaticTradingRemainsDisabled: true,
      });
      setFixtureTransferAcks([false, false, false, false]);
      setFixtureTransfers((await window.silfable.listDevnetFixtureTransfers()).transfers);
      setMessage(
        response.transfer.state === "confirmed"
          ? "Guarded fixture transfer confirmed and journaled. Auto DCA signing remains disabled."
          : `Guarded fixture transfer ended ${response.transfer.state}. Never retry an ambiguous result.`,
      );
    } catch {
      setFixtureTransferAcks([false, false, false, false]);
      setMessage("Guarded fixture transfer was rejected or failed closed. No automatic retry was attempted.");
    } finally {
      setBusy(false);
    }
  }

  async function approveFixtureTransfer(transferId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.approveDevnetFixtureTransfer({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        transferId,
        acknowledgedReviewedExactReceipt: true,
        acknowledgedFreshOnChainConfirmation: true,
        acknowledgedAutomaticTradingRemainsDisabled: true,
      });
      setFixtureTransferApprovalAcks([false, false, false]);
      setFixtureTransferApproval(response.approval);
      setMessage("Confirmed proof approved and encrypted locally. Auto DCA signing remains disabled.");
    } catch {
      setFixtureTransferApprovalAcks([false, false, false]);
      setMessage("Receipt approval failed closed because its evidence or fresh on-chain confirmation could not be verified.");
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

function JupiterShadowPanel({ status }: { status: RuntimeStatus | null }) {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [direction, setDirection] = useState<"sol-to-usdc" | "usdc-to-sol">("sol-to-usdc");
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState("50");
  const [maxImpactBps, setMaxImpactBps] = useState("50");
  const [maxFeeBps, setMaxFeeBps] = useState("100");
  const [acknowledged, setAcknowledged] = useState(false);
  const [quotes, setQuotes] = useState<JupiterShadowQuoteView[]>([]);
  const [aiSettings, setAiSettings] = useState<AiProviderSetting[]>([]);
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiObjective, setAiObjective] = useState("Protect capital and hold unless this exact route offers a compelling risk-adjusted swap.");
  const [aiProposal, setAiProposal] = useState<AiProposeShadowTradeResponse | null>(null);
  const [aiEvaluations, setAiEvaluations] = useState<AiShadowTradeEvaluationView[]>([]);
  const [marketObservations, setMarketObservations] = useState<MarketObservationView[]>([]);
  const [marketWatches, setMarketWatches] = useState<MarketWatchView[]>([]);
  const [marketWakeReceipts, setMarketWakeReceipts] = useState<MarketWakeReceiptView[]>([]);
  const [watchCondition, setWatchCondition] = useState<"price-at-or-below" | "price-at-or-above">("price-at-or-below");
  const [watchThreshold, setWatchThreshold] = useState("140");
  const [watchImpactBps, setWatchImpactBps] = useState("50");
  const [watchIntervalMinutes, setWatchIntervalMinutes] = useState("5");
  const [watchAcknowledged, setWatchAcknowledged] = useState(false);
  const [agentSessions, setAgentSessions] = useState<AgentSessionView[]>([]);
  const [agentEvaluations, setAgentEvaluations] = useState<AgentIntentEvaluationView[]>([]);
  const [agentDevnetSimulations, setAgentDevnetSimulations] = useState<AgentDevnetSimulationView[]>([]);
  const [agentDevnetSigningArms, setAgentDevnetSigningArms] = useState<AgentDevnetSigningArmView[]>([]);
  const [agentDevnetPreSignExecutions, setAgentDevnetPreSignExecutions] = useState<AgentDevnetPreSignExecutionView[]>([]);
  const [agentSigningArmAcks, setAgentSigningArmAcks] = useState([false, false, false]);
  const [agentPreSignAcks, setAgentPreSignAcks] = useState([false, false, false]);
  const [agentObjective, setAgentObjective] = useState("Protect capital and propose a SOL action only when the validated observation fits conservative risk limits.");
  const [agentMaxNotional, setAgentMaxNotional] = useState("20");
  const [agentMaxImpactBps, setAgentMaxImpactBps] = useState("50");
  const [agentMaxVolatilityBps, setAgentMaxVolatilityBps] = useState("100");
  const [agentDurationHours, setAgentDurationHours] = useState("1");
  const [agentSessionAcknowledged, setAgentSessionAcknowledged] = useState(false);
  const [agentApprovalAcknowledged, setAgentApprovalAcknowledged] = useState(false);
  const [aiApprovalAcknowledged, setAiApprovalAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status?.keystore !== "unlocked") {
      setConfigured(false);
      setApiKey("");
      setQuotes([]);
      setAiSettings([]);
      setAiEvaluations([]);
      setMarketObservations([]);
      setMarketWatches([]);
      setMarketWakeReceipts([]);
      setAgentSessions([]);
      setAgentEvaluations([]);
      setAgentDevnetSimulations([]);
      setAgentDevnetSigningArms([]);
      setAgentDevnetPreSignExecutions([]);
      setAiProposal(null);
      return;
    }
    let active = true;
    Promise.all([
      window.silfable.getJupiterSettings(),
      window.silfable.listJupiterShadowQuotes(),
      window.silfable.getAiSettings(),
      window.silfable.listAiShadowTrades(),
      window.silfable.listMarketObservations(),
      window.silfable.listMarketWatches(),
      window.silfable.listAgentSessions(),
      window.silfable.listAgentDevnetSimulations(),
      window.silfable.listAgentDevnetSigningArms(),
      window.silfable.listAgentDevnetPreSignExecutions(),
    ])
      .then(([settings, history, providers, evaluations, observations, watches, agents, devnetSimulations, signingArms, preSignExecutions]) => {
        if (!active) return;
        setConfigured(settings.configured);
        setQuotes(history.quotes);
        setAiSettings(providers.providers);
        setAiEvaluations(evaluations.evaluations);
        setMarketObservations(observations.observations);
        setMarketWatches(watches.watches);
        setMarketWakeReceipts(watches.wakeReceipts);
        setAgentSessions(agents.sessions);
        setAgentEvaluations(agents.evaluations);
        setAgentDevnetSimulations(devnetSimulations.simulations);
        setAgentDevnetSigningArms(signingArms.arms);
        setAgentDevnetPreSignExecutions(preSignExecutions.executions);
      })
      .catch(() => active && setMessage("Jupiter shadow settings are unavailable."));
    const timer = window.setInterval(() => {
      Promise.all([
        window.silfable.listMarketWatches(),
        window.silfable.listAgentSessions(),
        window.silfable.listAgentDevnetSimulations(),
        window.silfable.listAgentDevnetSigningArms(),
        window.silfable.listAgentDevnetPreSignExecutions(),
      ]).then(([watches, agents, devnetSimulations, signingArms, preSignExecutions]) => {
        if (!active) return;
        setMarketWatches(watches.watches);
        setMarketWakeReceipts(watches.wakeReceipts);
        setAgentSessions(agents.sessions);
        setAgentEvaluations(agents.evaluations);
        setAgentDevnetSimulations(devnetSimulations.simulations);
        setAgentDevnetSigningArms(signingArms.arms);
        setAgentDevnetPreSignExecutions(preSignExecutions.executions);
      }).catch(() => undefined);
    }, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [status?.keystore]);

  if (status?.keystore !== "unlocked") return null;

  async function saveKey(): Promise<void> {
    if (!acknowledged) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.saveJupiterKey({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        apiKey,
        acknowledgedMainnetMarketData: true,
      });
      setApiKey("");
      setConfigured(true);
      setMessage("Jupiter key encrypted in the local OS keystore.");
    } catch {
      setApiKey("");
      setMessage("Jupiter key was rejected or secure storage is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.deleteJupiterKey({ schemaVersion: 1, requestId: crypto.randomUUID() });
      setConfigured(false);
      setApiKey("");
      setMessage("Jupiter key removed from the local keystore.");
    } catch {
      setMessage("Jupiter key could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.getJupiterShadowQuote({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        direction,
        amountAtomic: parseTokenUnits(amount, direction === "sol-to-usdc" ? 9 : 6),
        slippageBps: Number(slippageBps),
        maxPriceImpactBps: Number(maxImpactBps),
        maxFeeBps: Number(maxFeeBps),
        acknowledgedQuoteOnly: true,
      });
      setQuotes((await window.silfable.listJupiterShadowQuotes()).quotes);
      setMessage(
        response.quote.allowed
          ? "Mainnet quote passed the shadow rules. No transaction was requested, signed, or broadcast."
          : `Quote denied: ${response.quote.denialCodes.join(", ")}.`,
      );
    } catch {
      setMessage("Jupiter quote failed closed. No transaction, signing, or broadcast was attempted.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeShadowTrade(quoteId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    setAiProposal(null);
    try {
      const response = await window.silfable.proposeShadowTradeWithAi({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: aiProvider,
        quoteId,
        objective: aiObjective,
        acknowledgedExternalProcessing: true,
        acknowledgedQuoteOnly: true,
      });
      setAiProposal(response);
      setAiEvaluations((await window.silfable.listAiShadowTrades()).evaluations);
      setMessage(
        `AI proposed ${response.proposal.action}; deterministic outcome: ${response.receipt.outcome}. No signing or execution was attempted.`,
      );
    } catch {
      setMessage("AI shadow proposal failed closed. No signing or execution was attempted.");
    } finally {
      setBusy(false);
    }
  }

  async function createMarketObservation(quoteId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.createMarketObservation({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        quoteId,
        acknowledgedObservationOnly: true,
      });
      setMarketObservations((await window.silfable.listMarketObservations()).observations);
      setMessage(
        `Observation captured at ${response.observation.market.priceMicros} price-micros. No AI call, signing, or execution was attempted.`,
      );
    } catch {
      setMessage("Observation failed closed. Request a fresh allowed quote and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createMarketWatch(): Promise<void> {
    if (!watchAcknowledged) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.createMarketWatch({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        direction,
        condition: watchCondition,
        thresholdPriceMicros: parseTokenUnits(watchThreshold, 6),
        maxPriceImpactBps: Number(watchImpactBps),
        intervalSeconds: Number(watchIntervalMinutes) * 60,
        acknowledgedBackgroundMarketData: true,
        acknowledgedZeroAiCallsWhileSleeping: true,
        acknowledgedNoExecution: true,
      });
      const result = await window.silfable.listMarketWatches();
      setMarketWatches(result.watches);
      setMarketWakeReceipts(result.wakeReceipts);
      setWatchAcknowledged(false);
      setMessage("Background market watch activated. It calls Jupiter only; AI and execution remain disabled.");
    } catch {
      setMessage("Market watch could not be activated. Check the Jupiter key, limits, and existing active watch.");
    } finally {
      setBusy(false);
    }
  }

  async function pauseMarketWatch(watchId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.pauseMarketWatch({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        watchId,
        acknowledgedImmediatePause: true,
      });
      const result = await window.silfable.listMarketWatches();
      setMarketWatches(result.watches);
      setMarketWakeReceipts(result.wakeReceipts);
      setMessage("Market watch paused immediately.");
    } catch {
      setMessage("Market watch is no longer active or could not be paused.");
    } finally {
      setBusy(false);
    }
  }

  async function createAgentSession(): Promise<void> {
    if (!agentSessionAcknowledged) return;
    setBusy(true);
    setMessage(null);
    try {
      const durationHours = Number(agentDurationHours);
      await window.silfable.createAgentSession({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        provider: aiProvider,
        objective: agentObjective,
        maxActionNotionalUsdcMicros: parseTokenUnits(agentMaxNotional, 6),
        maxPriceImpactBps: Number(agentMaxImpactBps),
        maxVolatilityBps: Number(agentMaxVolatilityBps),
        deadlineAt: new Date(Date.now() + durationHours * 60 * 60_000).toISOString(),
        acknowledgedExternalAiProcessing: true,
        acknowledgedPerActionApproval: true,
        acknowledgedNoExecution: true,
      });
      const result = await window.silfable.listAgentSessions();
      setAgentSessions(result.sessions);
      setAgentEvaluations(result.evaluations);
      setAgentSessionAcknowledged(false);
      setMessage("Restricted agent session created. It cannot execute and every buy/sell intent requires approval.");
    } catch {
      setMessage("Agent session could not be created. Check provider configuration, deadline, limits, and active sessions.");
    } finally {
      setBusy(false);
    }
  }

  async function evaluateAgentObservation(observationId: string): Promise<void> {
    const session = agentSessions.find((candidate) => candidate.state === "active");
    if (session === undefined) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.evaluateAgentObservation({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: session.id,
        observationId,
        acknowledgedExternalAiProcessing: true,
        acknowledgedIntentOnly: true,
      });
      const result = await window.silfable.listAgentSessions();
      setAgentSessions(result.sessions);
      setAgentEvaluations(result.evaluations);
      setMessage(`Agent proposed ${response.evaluation.proposal.action}; outcome ${response.evaluation.receipt.outcome}. Execution remains disabled.`);
    } catch {
      setMessage("Agent evaluation failed closed. Use a fresh observation and an active configured session.");
    } finally {
      setBusy(false);
    }
  }

  async function haltAgentSession(sessionId: string): Promise<void> {
    setBusy(true);
    try {
      await window.silfable.haltAgentSession({ schemaVersion: 1, requestId: crypto.randomUUID(), sessionId, acknowledgedImmediateHalt: true });
      const result = await window.silfable.listAgentSessions();
      setAgentSessions(result.sessions);
      setAgentEvaluations(result.evaluations);
      setMessage("Restricted agent session halted immediately.");
    } catch {
      setMessage("Agent session is no longer active.");
    } finally {
      setBusy(false);
    }
  }

  async function decideAgentIntent(evaluation: AgentIntentEvaluationView, approve: boolean): Promise<void> {
    if (approve && !agentApprovalAcknowledged) return;
    setBusy(true);
    setMessage(null);
    try {
      const base = {
        schemaVersion: 1 as const,
        requestId: crypto.randomUUID(),
        evaluationId: evaluation.receipt.id,
        expectedProposalDigest: evaluation.receipt.proposalDigest,
      };
      if (approve) {
        await window.silfable.approveAgentIntent({
          ...base,
          acknowledgedIntentOnly: true,
          acknowledgedFreshQuoteRequired: true,
          acknowledgedNoExecution: true,
        });
        setAgentApprovalAcknowledged(false);
      } else {
        await window.silfable.rejectAgentIntent({ ...base, acknowledgedRejectionOrRevocation: true });
      }
      const result = await window.silfable.listAgentSessions();
      setAgentSessions(result.sessions);
      setAgentEvaluations(result.evaluations);
      setMessage(approve ? "Agent intent approved for review only; execution remains disabled." : "Agent intent rejected or revoked.");
    } catch {
      setMessage("Agent intent decision failed closed because state, digest, session, or expiry changed.");
    } finally {
      setBusy(false);
    }
  }

  async function simulateAgentIntentOnDevnet(evaluation: AgentIntentEvaluationView): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.simulateAgentIntentOnDevnet({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        evaluationId: evaluation.receipt.id,
        expectedProposalDigest: evaluation.receipt.proposalDigest,
        acknowledgedDevnetFixtureProofOnly: true,
        acknowledgedNoEconomicValueMapping: true,
        acknowledgedNoSigningOrBroadcast: true,
      });
      setAgentDevnetSimulations((await window.silfable.listAgentDevnetSimulations()).simulations);
      setMessage(
        response.simulation.outcome === "simulated"
          ? "Exact-message Devnet fixture simulation passed. It is not a market swap and nothing was signed or broadcast."
          : `Devnet proof failed closed: ${response.simulation.failureCode ?? "simulation-failed"}. Nothing was signed or broadcast.`,
      );
    } catch {
      setMessage("Devnet proof could not run. It requires the exact approved intent, an active reviewed fixture, and healthy Devnet; no signing or broadcast occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function armAgentDevnetSigning(simulation: AgentDevnetSimulationView): Promise<void> {
    if (!agentSigningArmAcks.every(Boolean) || simulation.messageHash === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await window.silfable.armAgentDevnetSigning({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        simulationId: simulation.id,
        expectedProposalDigest: simulation.proposalDigest,
        expectedMessageHash: simulation.messageHash,
        acknowledgedOneShotDevnetSigning: true,
        acknowledgedDedicatedHotWallet: true,
        acknowledgedNoMarketSwapOrEconomicMapping: true,
      });
      setAgentDevnetSigningArms((await window.silfable.listAgentDevnetSigningArms()).arms);
      setAgentSigningArmAcks([false, false, false]);
      setMessage(`One-shot Devnet signing arm active until ${response.arm.expiresAt}. Execution bridge remains disconnected.`);
    } catch {
      setAgentSigningArmAcks([false, false, false]);
      setMessage("Signing arm failed closed because the proof, approval, session, fixture, or expiry changed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAgentDevnetSigningArm(armId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.revokeAgentDevnetSigningArm({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        signingArmId: armId,
        acknowledgedImmediateRevocation: true,
      });
      setAgentDevnetSigningArms((await window.silfable.listAgentDevnetSigningArms()).arms);
      setMessage("Agent Devnet signing arm revoked locally. No transaction was signed or broadcast.");
    } catch {
      setMessage("Signing arm is no longer active or could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareAgentDevnetExecution(arm: AgentDevnetSigningArmView): Promise<void> {
    if (!agentPreSignAcks.every(Boolean)) return;
    setBusy(true); setMessage(null);
    try {
      const response = await window.silfable.prepareAgentDevnetExecution({
        schemaVersion: 1, requestId: crypto.randomUUID(), signingArmId: arm.id,
        expectedMessageHash: arm.messageHash, acknowledgedConsumesOneShotArm: true,
        acknowledgedPreSignOnly: true, acknowledgedNoSigningOrBroadcast: true,
      });
      const [arms, executions] = await Promise.all([
        window.silfable.listAgentDevnetSigningArms(), window.silfable.listAgentDevnetPreSignExecutions(),
      ]);
      setAgentDevnetSigningArms(arms.arms); setAgentDevnetPreSignExecutions(executions.executions);
      setAgentPreSignAcks([false, false, false]);
      setMessage(response.execution.state === "ready-for-signing"
        ? "Exact message revalidated and one-shot arm consumed atomically. Signing and broadcast remain disconnected."
        : `Pre-sign preparation failed closed: ${response.execution.failureCode}.`);
    } catch {
      setAgentPreSignAcks([false, false, false]);
      setMessage("Pre-sign preparation was rejected before any signing or broadcast.");
    } finally { setBusy(false); }
  }

  async function approveShadowTrade(evaluation: AiShadowTradeEvaluationView): Promise<void> {
    if (!aiApprovalAcknowledged) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.approveAiShadowTrade({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        evaluationId: evaluation.receipt.id,
        expectedProposalDigest: evaluation.receipt.proposalDigest,
        acknowledgedIntentOnly: true,
        acknowledgedFreshQuoteRequired: true,
        acknowledgedNoExecution: true,
      });
      setAiEvaluations((await window.silfable.listAiShadowTrades()).evaluations);
      setAiApprovalAcknowledged(false);
      setMessage("AI intent approved for review only. Signing and execution remain disabled.");
    } catch {
      setMessage("Approval failed closed. The intent may have expired or changed.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectShadowTrade(evaluation: AiShadowTradeEvaluationView): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.rejectAiShadowTrade({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        evaluationId: evaluation.receipt.id,
        expectedProposalDigest: evaluation.receipt.proposalDigest,
        acknowledgedRejectionOrRevocation: true,
      });
      setAiEvaluations((await window.silfable.listAiShadowTrades()).evaluations);
      setMessage(evaluation.approval.state === "approved" ? "Approval revoked." : "AI intent rejected.");
    } catch {
      setMessage("Rejection failed closed. Refresh the evaluation journal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shadowPanel">
      <div className="shadowIntro">
        <p className="eyebrow">Mainnet Shadow · Jupiter Swap V2</p>
        <h2>Observe the route. Never touch the signer.</h2>
        <p>
          Silfable requests a real Mainnet quote without a taker address. A transaction in the response is treated as a denial and is never exposed to the renderer.
        </p>
      </div>
      <div className="shadowForm">
        <div className="shadowStatus"><span>Provider</span><strong>{configured ? "configured" : "not configured"}</strong></div>
        <label className="shadowKey">
          <span>Jupiter API key · encrypted locally</span>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder="Get one from developers.jup.ag" />
        </label>
        <label className="riskAck">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>I understand the selected pair, amount, and limits are sent to Jupiter Mainnet for market-data quoting only.</span>
        </label>
        <div className="shadowActions">
          <button type="button" disabled={busy || !acknowledged || apiKey.trim().length < 8} onClick={() => void saveKey()}>Encrypt Jupiter key</button>
          {configured && <button type="button" disabled={busy} onClick={() => void deleteKey()}>Remove key</button>}
        </div>
        <div className="modeTabs" role="tablist" aria-label="Shadow quote direction">
          {(["sol-to-usdc", "usdc-to-sol"] as const).map((item) => (
            <button type="button" role="tab" aria-selected={direction === item} className={direction === item ? "active" : ""} onClick={() => setDirection(item)} key={item}>
              {item === "sol-to-usdc" ? "SOL → USDC" : "USDC → SOL"}
            </button>
          ))}
        </div>
        <div className="fieldGrid">
          <MissionField label={`Amount (${direction === "sol-to-usdc" ? "SOL" : "USDC"})`} value={amount} onChange={setAmount} />
          <MissionField label="Slippage (bps)" value={slippageBps} onChange={setSlippageBps} />
          <MissionField label="Max price impact (bps)" value={maxImpactBps} onChange={setMaxImpactBps} />
          <MissionField label="Max total fee (bps)" value={maxFeeBps} onChange={setMaxFeeBps} />
        </div>
        <button type="button" disabled={busy || !configured || !acknowledged} onClick={() => void requestQuote()}>Request quote-only shadow</button>
        <div className="aiPanelHeading">
          <div><span>AI shadow analyst</span><strong>Proposal only</strong></div>
          <em>{aiSettings.find((setting) => setting.provider === aiProvider)?.configured ? "configured" : "not configured"}</em>
        </div>
        <div className="modeTabs" role="tablist" aria-label="Shadow AI provider">
          {(["openai", "anthropic"] as const).map((provider) => (
            <button type="button" role="tab" aria-selected={aiProvider === provider} className={aiProvider === provider ? "active" : ""} onClick={() => setAiProvider(provider)} key={provider}>
              {provider}
            </button>
          ))}
        </div>
        <label className="aiPrompt">
          <span>Objective for the selected observation</span>
          <textarea value={aiObjective} onChange={(event) => setAiObjective(event.target.value)} rows={3} maxLength={2_000} />
        </label>
        {aiProposal !== null && (
          <div className="aiDraftBox">
            <span>{aiProposal.provider} · {aiProposal.model} · persisted locally: true</span>
            <strong>{aiProposal.proposal.action} · {aiProposal.receipt.outcome}</strong>
            <p>{aiProposal.proposal.rationale}</p>
            <code>confidence {aiProposal.proposal.confidenceBps} bps · signed=false · executed=false</code>
            {aiProposal.receipt.denialCodes.length > 0 && <small>{aiProposal.receipt.denialCodes.join(", ")}</small>}
          </div>
        )}
        <label className="riskAck">
          <input
            type="checkbox"
            checked={aiApprovalAcknowledged}
            onChange={(event) => setAiApprovalAcknowledged(event.target.checked)}
          />
          <span>Approval records intent only. A fresh quote and new policy checks are required; signing and execution stay disabled.</span>
        </label>
        <div className="aiPanelHeading">
          <div><span>Scheduled market wake</span><strong>Jupiter-only monitor</strong></div>
          <em>{marketWatches.some((watch) => watch.state === "active") ? "active" : "inactive"}</em>
        </div>
        <div className="modeTabs" role="tablist" aria-label="Market wake condition">
          {(["price-at-or-below", "price-at-or-above"] as const).map((condition) => (
            <button type="button" role="tab" aria-selected={watchCondition === condition} className={watchCondition === condition ? "active" : ""} onClick={() => setWatchCondition(condition)} key={condition}>
              {condition === "price-at-or-below" ? "Price ≤ target" : "Price ≥ target"}
            </button>
          ))}
        </div>
        <div className="fieldGrid">
          <MissionField label="Target USDC per SOL" value={watchThreshold} onChange={setWatchThreshold} />
          <MissionField label="Max impact (bps)" value={watchImpactBps} onChange={setWatchImpactBps} />
          <MissionField label="Poll interval (minutes)" value={watchIntervalMinutes} onChange={setWatchIntervalMinutes} />
        </div>
        <label className="riskAck">
          <input type="checkbox" checked={watchAcknowledged} onChange={(event) => setWatchAcknowledged(event.target.checked)} />
          <span>I allow periodic Jupiter market-data requests. Sleeping makes zero AI calls and a wake can never sign or trade.</span>
        </label>
        <button
          type="button"
          disabled={busy || !configured || !watchAcknowledged || marketWatches.some((watch) => watch.state === "active")}
          onClick={() => void createMarketWatch()}
        >
          Activate market watch
        </button>
        <div className="aiPanelHeading">
          <div><span>Restricted agent session</span><strong>Intent-only analyst</strong></div>
          <em>{agentSessions.find((session) => session.state === "active")?.state ?? "inactive"}</em>
        </div>
        <label className="aiPrompt">
          <span>Session objective</span>
          <textarea value={agentObjective} onChange={(event) => setAgentObjective(event.target.value)} rows={3} maxLength={2_000} />
        </label>
        <div className="fieldGrid">
          <MissionField label="Max per action (USDC)" value={agentMaxNotional} onChange={setAgentMaxNotional} />
          <MissionField label="Max impact (bps)" value={agentMaxImpactBps} onChange={setAgentMaxImpactBps} />
          <MissionField label="Max volatility (bps)" value={agentMaxVolatilityBps} onChange={setAgentMaxVolatilityBps} />
          <MissionField label="Session duration (hours)" value={agentDurationHours} onChange={setAgentDurationHours} />
        </div>
        <label className="riskAck">
          <input type="checkbox" checked={agentSessionAcknowledged} onChange={(event) => setAgentSessionAcknowledged(event.target.checked)} />
          <span>I allow observation data to be sent to the selected AI. Every buy/sell is intent-only, needs approval, and cannot execute.</span>
        </label>
        <button
          type="button"
          disabled={
            busy || !agentSessionAcknowledged || agentObjective.trim().length < 10
            || agentSessions.some((session) => session.state === "active")
            || !aiSettings.find((setting) => setting.provider === aiProvider)?.configured
          }
          onClick={() => void createAgentSession()}
        >
          Create restricted session
        </button>
        <label className="riskAck">
          <input type="checkbox" checked={agentApprovalAcknowledged} onChange={(event) => setAgentApprovalAcknowledged(event.target.checked)} />
          <span>I understand approval records intent only; execution requires a future fresh quote and separate guarded milestone.</span>
        </label>
        {message !== null && <p className="formMessage">{message}</p>}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Encrypted quote journal</p><h3>Recent observations</h3></div><span>{quotes.length} quotes</span></div>
        {quotes.length === 0 ? <p className="auditEmpty">No Mainnet shadow quotes recorded.</p> : (
          <div className="auditList">
            {quotes.slice(0, 8).map((quote) => (
              <article className="shadowRow" key={quote.id}>
                <div><span>Decision</span><strong>{quote.allowed ? "allowed" : "denied"}</strong></div>
                <div><span>Router</span><code>{quote.router} · {quote.routeLabels.join(" + ")}</code></div>
                <div><span>Output atomic</span><code>{quote.outAmount}</code></div>
                <div><span>Risk</span><code>{quote.priceImpactBps} impact bps · {quote.feeBps} fee bps</code></div>
                <div><span>Execution</span><code>signed=false · broadcast=false</code></div>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !quote.allowed ||
                    aiObjective.trim().length < 10 ||
                    !aiSettings.find((setting) => setting.provider === aiProvider)?.configured
                  }
                  onClick={() => void proposeShadowTrade(quote.id)}
                >
                  Ask AI: trade or hold
                </button>
                <button
                  type="button"
                  disabled={busy || !acknowledged || !quote.allowed || Date.parse(quote.expiresAt) <= Date.now()}
                  onClick={() => void createMarketObservation(quote.id)}
                >
                  Capture market observation
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Encrypted AI evaluation journal</p><h3>Restricted intent approvals</h3></div><span>{aiEvaluations.length} evaluations</span></div>
        {aiEvaluations.length === 0 ? <p className="auditEmpty">No AI shadow evaluations recorded.</p> : (
          <div className="auditList">
            {aiEvaluations.map((evaluation) => (
              <article className="shadowRow" key={evaluation.receipt.id}>
                <div><span>Proposal</span><strong>{evaluation.proposal.action}</strong></div>
                <div><span>Approval</span><code>{evaluation.approval.state} · execution=false</code></div>
                <div><span>Confidence</span><code>{evaluation.proposal.confidenceBps} bps</code></div>
                <div><span>Expiry</span><code>{evaluation.approval.expiresAt ?? "not applicable"}</code></div>
                <div><span>Receipt</span><code>{evaluation.receipt.id}</code></div>
                {evaluation.approval.state === "pending" && (
                  <div className="shadowActions">
                    <button type="button" disabled={busy || !aiApprovalAcknowledged} onClick={() => void approveShadowTrade(evaluation)}>Approve intent only</button>
                    <button type="button" disabled={busy} onClick={() => void rejectShadowTrade(evaluation)}>Reject</button>
                  </div>
                )}
                {evaluation.approval.state === "approved" && (
                  <button type="button" disabled={busy} onClick={() => void rejectShadowTrade(evaluation)}>Revoke approval</button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Encrypted market journal</p><h3>Main-owned observations</h3></div><span>{marketObservations.length} snapshots</span></div>
        {marketObservations.length === 0 ? <p className="auditEmpty">No market observation snapshots recorded.</p> : (
          <div className="auditList">
            {marketObservations.map((observation) => (
              <article className="shadowRow" key={observation.id}>
                <div><span>Price</span><strong>{observation.market.priceMicros} µUSDC/SOL</strong></div>
                <div><span>Liquidity proxy</span><code>{observation.market.liquidityProxy} · impact {observation.market.priceImpactBps} bps</code></div>
                <div><span>Volatility</span><code>{observation.market.volatility.status} · {observation.market.volatility.rangeBps ?? "n/a"} bps</code></div>
                <div><span>Freshness</span><code>{observation.freshnessStatus} · expires {observation.provenance.expiresAt}</code></div>
                <div><span>Wallet exposure</span><code>{observation.walletContext.reason}</code></div>
                <div className="observationDigest"><span>Digest</span><code>{observation.observationDigest}</code></div>
                <button
                  type="button"
                  disabled={busy || observation.freshnessStatus !== "fresh" || !agentSessions.some((session) => session.state === "active")}
                  onClick={() => void evaluateAgentObservation(observation.id)}
                >
                  Ask restricted agent
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Zero-AI wake scheduler</p><h3>Market watches</h3></div><span>{marketWatches.length} watches · {marketWakeReceipts.length} checks</span></div>
        {marketWatches.length === 0 ? <p className="auditEmpty">No scheduled market watch recorded.</p> : (
          <div className="auditList">
            {marketWatches.map((watch) => (
              <article className="shadowRow" key={watch.id}>
                <div><span>State</span><strong>{watch.state}</strong></div>
                <div><span>Condition</span><code>{watch.condition} {watch.thresholdPriceMicros} µUSDC</code></div>
                <div><span>Risk gate</span><code>impact ≤ {watch.maxPriceImpactBps} bps</code></div>
                <div><span>Schedule</span><code>{watch.intervalSeconds}s · next {watch.nextCheckAt}</code></div>
                <div><span>Boundary</span><code>AI=false · execution=false</code></div>
                {watch.state === "active" && <button type="button" disabled={busy} onClick={() => void pauseMarketWatch(watch.id)}>Pause watch</button>}
              </article>
            ))}
            {marketWakeReceipts.map((receipt) => (
              <article className="shadowRow" key={receipt.id}>
                <div><span>Check</span><strong>{receipt.outcome}</strong></div>
                <div><span>Price</span><code>{receipt.observedPriceMicros ?? "unavailable"}</code></div>
                <div><span>Impact</span><code>{receipt.priceImpactBps ?? "unavailable"} bps</code></div>
                <div><span>Failure</span><code>{receipt.failureCode ?? "none"}</code></div>
                <div><span>Evaluated</span><code>{receipt.evaluatedAt}</code></div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Restricted agent journal</p><h3>Sessions and intents</h3></div><span>{agentSessions.length} sessions · {agentEvaluations.length} intents</span></div>
        {agentSessions.length === 0 ? <p className="auditEmpty">No restricted agent session recorded.</p> : (
          <div className="auditList">
            {agentSessions.map((session) => (
              <article className="shadowRow" key={session.id}>
                <div><span>Session</span><strong>{session.state}</strong></div>
                <div><span>Provider</span><code>{session.provider} · {session.venue}</code></div>
                <div><span>Capital cap</span><code>{session.maxActionNotionalUsdcMicros} µUSDC/action</code></div>
                <div><span>Risk stops</span><code>{session.maxPriceImpactBps} impact · {session.maxVolatilityBps} volatility bps</code></div>
                <div><span>Deadline</span><code>{session.deadlineAt} · execution=false</code></div>
                {session.state === "active" && <button type="button" disabled={busy} onClick={() => void haltAgentSession(session.id)}>Halt session</button>}
              </article>
            ))}
            {agentEvaluations.map((evaluation) => (
              <article className="shadowRow" key={evaluation.receipt.id}>
                <div><span>Intent</span><strong>{evaluation.proposal.action}</strong></div>
                <div><span>Outcome</span><code>{evaluation.receipt.outcome} · {evaluation.approval.state}</code></div>
                <div><span>Notional</span><code>{evaluation.proposal.notionalUsdcMicros} µUSDC</code></div>
                <div><span>Confidence</span><code>{evaluation.proposal.confidenceBps} bps</code></div>
                <div><span>Boundary</span><code>signed=false · executed=false</code></div>
                {evaluation.approval.state === "pending" && (
                  <div className="shadowActions">
                    <button type="button" disabled={busy || !agentApprovalAcknowledged} onClick={() => void decideAgentIntent(evaluation, true)}>Approve intent only</button>
                    <button type="button" disabled={busy} onClick={() => void decideAgentIntent(evaluation, false)}>Reject</button>
                  </div>
                )}
                {evaluation.approval.state === "approved" && (
                  <div className="shadowActions">
                    <button
                      type="button"
                      disabled={busy || agentDevnetSimulations.some((simulation) => simulation.evaluationId === evaluation.receipt.id)}
                      onClick={() => void simulateAgentIntentOnDevnet(evaluation)}
                    >
                      Simulate Devnet proof
                    </button>
                    <button type="button" disabled={busy} onClick={() => void decideAgentIntent(evaluation, false)}>Revoke intent</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="shadowHistory">
        <div className="auditHeading"><div><p className="eyebrow">Encrypted Devnet proof journal</p><h3>Approved intent simulations</h3></div><span>{agentDevnetSimulations.length} proofs</span></div>
        {agentDevnetSimulations.some((simulation) => simulation.outcome === "simulated" && !agentDevnetSigningArms.some((arm) => arm.simulationId === simulation.id)) && (
          <div className="consentList">
            {[
              "I authorize one Devnet fixture signature bound to the exact simulated message.",
              "I understand this authority is for the dedicated Devnet hot wallet and expires automatically.",
              "I understand the fixture has no economic mapping to the AI intent and is not a market swap.",
            ].map((label, index) => (
              <label className="consent" key={label}>
                <input
                  type="checkbox"
                  checked={agentSigningArmAcks[index] ?? false}
                  onChange={(event) => setAgentSigningArmAcks((acks) => acks.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
        {agentDevnetSimulations.length === 0 ? <p className="auditEmpty">No approved agent intent has an exact-message Devnet proof.</p> : (
          <div className="auditList">
            {agentDevnetSimulations.map((simulation) => (
              <article className="shadowRow" key={simulation.id}>
                <div><span>Proof</span><strong>{simulation.outcome} · {simulation.agentAction}</strong></div>
                <div><span>Message</span><code>{simulation.messageHash ?? "unavailable"}</code></div>
                <div><span>Runtime</span><code>{simulation.unitsConsumed ?? "n/a"} units · {simulation.feeLamports ?? "n/a"} lamports</code></div>
                <div><span>Failure</span><code>{simulation.failureCode ?? "none"}</code></div>
                <div><span>Economic boundary</span><code>mapping=none · marketSwap=false</code></div>
                <div><span>Privilege boundary</span><code>signed=false · broadcast=false · executed=false</code></div>
                {simulation.outcome === "simulated" && !agentDevnetSigningArms.some((arm) => arm.simulationId === simulation.id) && (
                  <button type="button" disabled={busy || !agentSigningArmAcks.every(Boolean)} onClick={() => void armAgentDevnetSigning(simulation)}>
                    Arm one Devnet signature
                  </button>
                )}
              </article>
            ))}
            {agentDevnetSigningArms.map((arm) => (
              <article className="shadowRow" key={arm.id}>
                <div><span>Signing arm</span><strong>{arm.state}</strong></div>
                <div><span>Scope</span><code>{arm.scope}</code></div>
                <div><span>Message</span><code>{arm.messageHash}</code></div>
                <div><span>Expiry</span><code>{arm.expiresAt}</code></div>
                <div><span>Boundary</span><code>bridge=false · Mainnet=false · marketSwap=false</code></div>
                {arm.state === "active" && (
                  <>
                    <div className="consentList">
                      {["Consume this one-shot arm only after exact-message revalidation.", "Prepare a journal receipt only; do not sign.", "Do not broadcast or perform a market swap."].map((label, index) => (
                        <label className="consent" key={label}><input type="checkbox" checked={agentPreSignAcks[index] ?? false} onChange={(event) => setAgentPreSignAcks((acks) => acks.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span>{label}</span></label>
                      ))}
                    </div>
                    <div className="shadowActions">
                      <button type="button" disabled={busy || !agentPreSignAcks.every(Boolean)} onClick={() => void prepareAgentDevnetExecution(arm)}>Prepare exact message</button>
                      <button type="button" disabled={busy} onClick={() => void revokeAgentDevnetSigningArm(arm.id)}>Revoke signing arm</button>
                    </div>
                  </>
                )}
              </article>
            ))}
            {agentDevnetPreSignExecutions.map((execution) => (
              <article className="shadowRow" key={execution.id}>
                <div><span>Pre-sign journal</span><strong>{execution.state}</strong></div>
                <div><span>Arm</span><code>{execution.signingArmConsumed ? "consumed" : "not consumed"}</code></div>
                <div><span>Exact message</span><code>{execution.exactMessageRevalidated ? "revalidated" : "denied"}</code></div>
                <div><span>Failure</span><code>{execution.failureCode ?? "none"}</code></div>
                <div><span>Boundary</span><code>bridge=false · signed=false · broadcast=false</code></div>
              </article>
            ))}
          </div>
        )}
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
  const [guardedProofApproved, setGuardedProofApproved] = useState(false);
  const [guardedAuthorizations, setGuardedAuthorizations] = useState<GuardedMissionAuthorizationView[]>([]);
  const [guardedAuthorizationAcks, setGuardedAuthorizationAcks] = useState([false, false, false, false]);
  const [guardedRevocationAck, setGuardedRevocationAck] = useState(false);
  const [guardedSchedulerArms, setGuardedSchedulerArms] = useState<GuardedSchedulerArmView[]>([]);
  const [schedulerArmAcks, setSchedulerArmAcks] = useState([false, false, false]);
  const [schedulerArmRevocationAck, setSchedulerArmRevocationAck] = useState(false);
  const [guardedExecutions, setGuardedExecutions] = useState<GuardedExecutionView[]>([]);
  const current = missions[0] ?? null;
  const activeGuardedAuthorization = guardedAuthorizations.find((authorization) => authorization.state === "active") ?? null;
  const openSchedulerArm = guardedSchedulerArms.find((arm) => arm.state === "active" || arm.state === "consumed") ?? null;

  useEffect(() => {
    if (status?.keystore !== "unlocked") {
      setMissions([]);
      setAudit([]);
      setGuardedProofApproved(false);
      setGuardedAuthorizations([]);
      setGuardedSchedulerArms([]);
      setGuardedExecutions([]);
      return;
    }
    let active = true;
    const refresh = () => {
      window.silfable
        .listGuardedExecutions()
        .then((result) => active && setGuardedExecutions(result.executions))
        .catch(() => active && setMessage("Guarded execution audit is unavailable."));
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
    if (status?.keystore !== "unlocked") return;
    let active = true;
    Promise.all([
      window.silfable.getDevnetFixtureTransferApproval(),
      window.silfable.listGuardedMissionAuthorizations(),
      window.silfable.listGuardedSchedulerArms(),
      window.silfable.listGuardedExecutions(),
    ]).then(([proof, authorizations, arms, executions]) => {
      if (!active) return;
      setGuardedProofApproved(proof.approval !== null);
      setGuardedAuthorizations(authorizations.authorizations);
      setGuardedSchedulerArms(arms.arms);
      setGuardedExecutions(executions.executions);
    }).catch(() => active && setMessage("Guarded authorization prerequisites are unavailable."));
    return () => {
      active = false;
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

  async function refreshGuardedAuthorizations(): Promise<void> {
    const [proof, authorizations, arms, executions] = await Promise.all([
      window.silfable.getDevnetFixtureTransferApproval(),
      window.silfable.listGuardedMissionAuthorizations(),
      window.silfable.listGuardedSchedulerArms(),
      window.silfable.listGuardedExecutions(),
    ]);
    setGuardedProofApproved(proof.approval !== null);
    setGuardedAuthorizations(authorizations.authorizations);
    setGuardedSchedulerArms(arms.arms);
    setGuardedExecutions(executions.executions);
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
      await refreshGuardedAuthorizations();
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

  async function authorizeGuardedMission(): Promise<void> {
    if (current === null || !guardedAuthorizationAcks.every(Boolean)) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.authorizeGuardedMission({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        missionId: current.id,
        expectedRevision: current.revision,
        expectedPlanDigest: current.planDigest,
        acknowledgedExactMissionRevision: true,
        acknowledgedDeskRuleLimits: true,
        acknowledgedDedicatedHotWallet: true,
        acknowledgedSchedulerSigningRemainsDisabled: true,
      });
      setGuardedAuthorizationAcks([false, false, false, false]);
      await refreshGuardedAuthorizations();
      setMessage("Guarded authority recorded for this exact revision. A separate expiring one-shot arm is still required.");
    } catch {
      setGuardedAuthorizationAcks([false, false, false, false]);
      setMessage("Guarded authorization failed because its mission, proof, or digest prerequisites changed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeGuardedMission(): Promise<void> {
    if (activeGuardedAuthorization === null || !guardedRevocationAck) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.revokeGuardedMission({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        authorizationId: activeGuardedAuthorization.id,
        acknowledgedRevocation: true,
      });
      setGuardedRevocationAck(false);
      await refreshGuardedAuthorizations();
      setMessage("Guarded mission authority revoked locally. No network request was required.");
    } catch {
      setGuardedRevocationAck(false);
      setMessage("Guarded authority revocation failed closed or was already applied.");
    } finally {
      setBusy(false);
    }
  }

  async function armGuardedScheduler(): Promise<void> {
    if (activeGuardedAuthorization === null || !schedulerArmAcks.every(Boolean)) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.armGuardedScheduler({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        authorizationId: activeGuardedAuthorization.id,
        acknowledgedAutomaticSigning: true,
        acknowledgedHotWallet: true,
        acknowledgedDevnetFixtureOnly: true,
      });
      setSchedulerArmAcks([false, false, false]);
      await refreshGuardedAuthorizations();
      setMessage("One Devnet fixture signature authorized for 15 minutes. The next eligible due cycle may consume it.");
    } catch {
      setSchedulerArmAcks([false, false, false]);
      setMessage("Scheduler arm failed closed because its authority, expiry, or one-shot constraint changed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeGuardedSchedulerArm(): Promise<void> {
    if (openSchedulerArm === null || !schedulerArmRevocationAck) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.silfable.revokeGuardedSchedulerArm({
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        schedulerArmId: openSchedulerArm.id,
        acknowledgedImmediateRevocation: true,
      });
      setSchedulerArmRevocationAck(false);
      await refreshGuardedAuthorizations();
      setMessage("One-shot scheduler arm revoked locally. No network request was made.");
    } catch {
      setSchedulerArmRevocationAck(false);
      setMessage("Scheduler-arm revocation failed closed or was already applied.");
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

        {current !== null && (current.state === "authorized" || current.state === "halted") && guardedProofApproved && activeGuardedAuthorization === null && (
          <section className="guardedAuthorizationPanel">
            <span>Guarded authority · inactive execution path</span>
            <strong>Bind the approved proof to revision {current.revision}</strong>
            <small>This records revocable authority over the exact plan and Desk Rule digests. Authority alone cannot sign; a separate expiring one-shot arm is still required.</small>
            {[
              "I reviewed this exact mission revision and SHA-256 plan digest.",
              "I authorize only the displayed Desk Rule limits, caps, reserve, and failure policy.",
              "I confirm this mission uses a dedicated hot wallet funded only with bounded risk capital.",
              "I understand this authority alone cannot sign, and Mainnet execution remains disabled.",
            ].map((copy, index) => (
              <label className="riskAck" key={copy}>
                <input
                  type="checkbox"
                  checked={guardedAuthorizationAcks[index] ?? false}
                  onChange={(event) => setGuardedAuthorizationAcks((currentAcks) => currentAcks.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                />
                <span>{copy}</span>
              </label>
            ))}
            <button type="button" disabled={busy || !guardedAuthorizationAcks.every(Boolean)} onClick={() => void authorizeGuardedMission()}>
              Record revocable guarded authority
            </button>
          </section>
        )}

        {activeGuardedAuthorization !== null && (
          <section className="guardedAuthorizationPanel active">
            <span>Guarded authority · active record</span>
            <strong>Revision {activeGuardedAuthorization.missionRevision} is bound</strong>
            <code>plan {activeGuardedAuthorization.planDigest}</code>
            <code>rules {activeGuardedAuthorization.deskRuleDigest}</code>
            <small>Authority alone cannot sign · Mainnet disabled · authorized {activeGuardedAuthorization.authorizedAt}</small>
            <label className="riskAck">
              <input type="checkbox" checked={guardedRevocationAck} onChange={(event) => setGuardedRevocationAck(event.target.checked)} />
              <span>I revoke this guarded authority immediately. This action does not require network access.</span>
            </label>
            <button type="button" disabled={busy || !guardedRevocationAck} onClick={() => void revokeGuardedMission()}>
              Revoke guarded authority
            </button>
          </section>
        )}

        {activeGuardedAuthorization !== null && openSchedulerArm === null && (
          <section className="guardedAuthorizationPanel schedulerArm">
            <span>One-shot signing arm · Devnet fixture only</span>
            <strong>Authorize one bounded execution-path proof</strong>
            <small>This arm expires after 15 minutes and can be consumed by only one exact fixture-cycle proposal at the next eligible due cycle. It cannot enable Mainnet, choose a market, or alter Desk Rules.</small>
            {[
              "I explicitly authorize one automatic signature after the exact message passes simulation and every Desk Rule revalidation.",
              "I understand Silfable uses a dedicated local hot wallet and this proof can spend only the fixed Devnet fixture token.",
              "I understand this arm is Devnet-fixture-only, expires in 15 minutes, and never enables Mainnet.",
            ].map((copy, index) => (
              <label className="riskAck" key={copy}>
                <input
                  type="checkbox"
                  checked={schedulerArmAcks[index] ?? false}
                  onChange={(event) => setSchedulerArmAcks((acks) => acks.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))}
                />
                <span>{copy}</span>
              </label>
            ))}
            <button type="button" disabled={busy || !schedulerArmAcks.every(Boolean)} onClick={() => void armGuardedScheduler()}>
              Arm one Devnet fixture signature
            </button>
          </section>
        )}

        {openSchedulerArm !== null && (
          <section className="guardedAuthorizationPanel active schedulerArm">
            <span>One-shot signing arm · {openSchedulerArm.state}</span>
            <strong>{openSchedulerArm.state === "active" ? "Awaiting one exact fixture cycle" : "One-shot authority consumed"}</strong>
            <code>arm {openSchedulerArm.id}</code>
            <code>scope {openSchedulerArm.scope}</code>
            <small>Expires {openSchedulerArm.expiresAt} · Mainnet disabled · one eligible scheduler execution</small>
            <label className="riskAck">
              <input type="checkbox" checked={schedulerArmRevocationAck} onChange={(event) => setSchedulerArmRevocationAck(event.target.checked)} />
              <span>I revoke this scheduler arm immediately, including any unbroadcast consumed authorization.</span>
            </label>
            <button type="button" disabled={busy || !schedulerArmRevocationAck} onClick={() => void revokeGuardedSchedulerArm()}>
              Revoke scheduler arm
            </button>
          </section>
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
            <p className="eyebrow">Guarded Devnet execution</p>
            <h3>One-shot proof receipts</h3>
          </div>
          <span>{guardedExecutions.length} records</span>
        </div>
        {guardedExecutions.length === 0 ? (
          <p className="auditEmpty">No guarded fixture execution has been attempted.</p>
        ) : (
          <div className="auditList">
            {guardedExecutions.map((execution) => (
              <article className="auditRow" key={execution.id}>
                <div>
                  <span>Revision {execution.missionRevision} · Cycle {execution.cycle}</span>
                  <strong>{execution.state}</strong>
                </div>
                <div>
                  <span>Execution</span>
                  <code>{execution.id}</code>
                </div>
                <div>
                  <span>Attempts</span>
                  <code>sign={String(execution.signingAttempted)} · broadcast={String(execution.broadcastAttempted)}</code>
                </div>
                <div>
                  <span>Scope</span>
                  <code>fixture-only · market-swap=false · mainnet=false</code>
                </div>
                <div>
                  <span>{execution.failureCode === null ? "Timeline" : "Failure"}</span>
                  <code>{execution.failureCode ?? execution.events.map((event) => event.eventName).join(" → ")}</code>
                </div>
                <div>
                  <span>Updated</span>
                  <code>{execution.updatedAt}</code>
                </div>
              </article>
            ))}
          </div>
        )}

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
                {cycle.guardedReadiness !== null && (
                  <div>
                    <span>Guarded readiness</span>
                    <code>
                      {cycle.guardedReadiness.outcome} · {cycle.guardedReadiness.reasonCode} · signing=false
                    </code>
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

function parseTokenUnits(value: string, decimals: number): string {
  const pattern = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${decimals}}))?$`, "u");
  const match = pattern.exec(value.trim());
  if (match === null) throw new Error("Invalid token amount");
  const scale = 10n ** BigInt(decimals);
  const atomic = BigInt(match[1] ?? "0") * scale + BigInt((match[2] ?? "").padEnd(decimals, "0") || "0");
  if (atomic <= 0n) throw new Error("Token amount must be positive");
  return atomic.toString();
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
