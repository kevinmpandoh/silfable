import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeDatabase } from "../storage/database.js";
import { SessionService } from "./service.js";

class MemorySecrets {
  value: string | null = null;
  async getSecret() { return this.value; }
  async setSecret(_name: "session-data-key", value: string) { this.value = value; }
}

test("sessions survive reopen while message plaintext stays out of SQLite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-sessions-"));
  const path = join(directory, "runtime.sqlite3");
  const secrets = new MemorySecrets();
  const session = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Wallet review",
    mode: "mission" as const,
    permission: "restricted" as const,
    workspace: "pump" as const,
    pumpConfig: {
      scope: "exact-mint" as const,
      objective: "monitor" as const,
      tokenMint: "So11111111111111111111111111111111111111112",
      lifecycle: "proposal-only" as const,
    },
    walletAddress: null,
    messages: [
      { id: "00000000-0000-4000-8000-000000000002", role: "user" as const, text: "private session question", at: "2026-07-21T00:00:00.000Z" },
      {
        id: "00000000-0000-4000-8000-000000000003",
        role: "assistant" as const,
        text: "Pump simulation passed without signing.",
        at: "2026-07-21T00:01:00.000Z",
        pumpSimulation: {
          status: "passed" as const,
          simulationSlot: 434_000_000,
          unitsConsumed: 123_456,
          networkFeeLamports: 5_000,
          rentLamports: 2_039_280,
          networkFeePercent: 0.5,
          totalKnownFeeLamports: "2056780",
          feeRisk: "reasonable" as const,
          invokedPrograms: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"],
          logs: ["private finalized Pump simulation evidence"],
          error: null,
          transactionSigned: false as const,
          broadcastAttempted: false as const,
          simulatedAt: "2026-07-21T00:01:00.000Z",
        },
      },
    ],
    startedAt: "2026-07-21T00:00:00.000Z",
    usage: { input: 0, output: 0, total: 0, cost: null },
  };
  try {
    const database = await RuntimeDatabase.open(path);
    await new SessionService(database, secrets).upsert(session);
    database.close();
    assert.equal((await readFile(path)).includes(Buffer.from("private session question")), false);
    assert.equal((await readFile(path)).includes(Buffer.from("private finalized Pump simulation evidence")), false);
    const reopened = await RuntimeDatabase.open(path);
    assert.deepEqual(await new SessionService(reopened, secrets).list(), [session]);
    reopened.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
