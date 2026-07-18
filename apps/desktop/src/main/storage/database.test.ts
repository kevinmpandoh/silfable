import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeDatabase } from "./database";

test("SQLite migrations persist one Devnet wallet record", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-db-test-"));
  const path = join(directory, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    assert.equal(database.hasWallet("devnet-simulation"), false);
    database.insertWallet({
      id: "wallet-1",
      profileId: "devnet-simulation",
      ciphertext: "ciphertext-with-auth-tag",
      nonce: "nonce",
      keyId: "local-data-key-v1",
      createdAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(database.hasWallet("devnet-simulation"), true);
    assert.throws(() =>
      database.insertWallet({
        id: "wallet-2",
        profileId: "devnet-simulation",
        ciphertext: "different-ciphertext",
        nonce: "different-nonce",
        keyId: "local-data-key-v1",
        createdAt: "2026-07-16T00:00:01.000Z",
      }),
    );
    database.close();

    const reopened = await RuntimeDatabase.open(path);
    assert.equal(reopened.hasWallet("devnet-simulation"), true);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("AI shadow trade evaluations are append-only and cannot claim execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-ai-shadow-db-test-"));
  const path = join(directory, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    const quoteId = "00000000-0000-4000-8000-000000000001";
    database.insertJupiterShadowQuote({
      id: quoteId,
      encryptedPayload: "encrypted-quote",
      payloadNonce: "quote-nonce",
      keyId: "local-data-key-v1",
      allowed: true,
      createdAt: "2026-07-18T00:00:00.000Z",
    });
    database.insertAiShadowTradeEvaluation({
      id: "00000000-0000-4000-8000-000000000002",
      quoteId,
      proposalDigest: "a".repeat(64),
      outcome: "hold",
      encryptedPayload: "encrypted-evaluation",
      payloadNonce: "evaluation-nonce",
      keyId: "local-data-key-v1",
      signingAttempted: false,
      executionAttempted: false,
      evaluatedAt: "2026-07-18T00:00:01.000Z",
      approvalState: "not-actionable",
      approvalExpiresAt: null,
      decidedAt: null,
    });
    assert.throws(() => database.insertAiShadowTradeEvaluation({
      id: "00000000-0000-4000-8000-000000000002",
      quoteId,
      proposalDigest: "b".repeat(64),
      outcome: "would-execute",
      encryptedPayload: "replacement",
      payloadNonce: "replacement-nonce",
      keyId: "local-data-key-v1",
      signingAttempted: false,
      executionAttempted: false,
      evaluatedAt: "2026-07-18T00:00:02.000Z",
      approvalState: "pending",
      approvalExpiresAt: "2026-07-18T01:00:02.000Z",
      decidedAt: null,
    }));
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("AI shadow intent approval is digest-bound, revocable, and expires closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silfable-ai-approval-db-test-"));
  const path = join(directory, "runtime.sqlite3");
  try {
    const database = await RuntimeDatabase.open(path);
    const quoteId = "00000000-0000-4000-8000-000000000011";
    database.insertJupiterShadowQuote({
      id: quoteId,
      encryptedPayload: "encrypted-quote",
      payloadNonce: "quote-nonce",
      keyId: "local-data-key-v1",
      allowed: true,
      createdAt: "2026-07-18T00:00:00.000Z",
    });
    const insertPending = (id: string, digest: string, expiry: string) => database.insertAiShadowTradeEvaluation({
      id,
      quoteId,
      proposalDigest: digest,
      outcome: "would-execute",
      encryptedPayload: "encrypted-evaluation",
      payloadNonce: "evaluation-nonce",
      keyId: "local-data-key-v1",
      signingAttempted: false,
      executionAttempted: false,
      evaluatedAt: "2026-07-18T00:00:01.000Z",
      approvalState: "pending",
      approvalExpiresAt: expiry,
      decidedAt: null,
    });

    const approvedId = "00000000-0000-4000-8000-000000000012";
    const approvedDigest = "c".repeat(64);
    insertPending(approvedId, approvedDigest, "2026-07-18T01:00:00.000Z");
    assert.throws(() => database.approveAiShadowTradeEvaluation({
      id: approvedId,
      expectedProposalDigest: "d".repeat(64),
      decidedAt: "2026-07-18T00:10:00.000Z",
    }));
    assert.equal(database.approveAiShadowTradeEvaluation({
      id: approvedId,
      expectedProposalDigest: approvedDigest,
      decidedAt: "2026-07-18T00:10:00.000Z",
    }).approvalState, "approved");
    assert.equal(database.rejectAiShadowTradeEvaluation({
      id: approvedId,
      expectedProposalDigest: approvedDigest,
      decidedAt: "2026-07-18T00:11:00.000Z",
    }).approvalState, "rejected");
    assert.throws(() => database.approveAiShadowTradeEvaluation({
      id: approvedId,
      expectedProposalDigest: approvedDigest,
      decidedAt: "2026-07-18T00:12:00.000Z",
    }));

    const expiredId = "00000000-0000-4000-8000-000000000013";
    const expiredDigest = "e".repeat(64);
    insertPending(expiredId, expiredDigest, "2026-07-18T00:05:00.000Z");
    assert.equal(database.expireOpenAiShadowTradeApprovals("2026-07-18T00:06:00.000Z"), 1);
    assert.equal(database.getAiShadowTradeEvaluation(expiredId)?.approvalState, "expired");
    assert.throws(() => database.approveAiShadowTradeEvaluation({
      id: expiredId,
      expectedProposalDigest: expiredDigest,
      decidedAt: "2026-07-18T00:07:00.000Z",
    }));
    database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
