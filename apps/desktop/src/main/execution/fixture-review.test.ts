import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AccountState, getMintEncoder, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { generateKeyPairSigner, type Address, type ReadonlyUint8Array } from "@solana/kit";

import type { DevnetFixtureRpcPort } from "../rpc/devnet";
import { RuntimeDatabase } from "../storage/database";
import { LocalDataCipher } from "../storage/encryption";
import { buildGuardedSplTransferFixture } from "./spl-fixture";
import { FixtureReviewService } from "./fixture-review";

class MemoryKeystore {
  value: string | null = null;
  isLocked() { return false; }
  async getSecret() { return this.value; }
  async setSecret(_name: "database-data-key", value: string) { this.value = value; }
}

test("confirmed provision becomes active only after fresh on-chain provenance review", async () => {
  const fixture = await setupReview(null);
  try {
    const review = await fixture.service.reviewAndActivate(fixture.provisionId);
    assert.equal(review.active, true);
    assert.equal(review.mintAddress, fixture.mintAddress);
    assert.match(review.manifestDigest, /^[a-f0-9]{64}$/u);
    assert.equal(review.observedSlot, "777");
    assert.equal(review.encryptedPayload.includes(fixture.mintAddress), false);
    assert.deepEqual(await fixture.service.reviewAndActivate(fixture.provisionId), review);
    assert.equal(fixture.service.getActive()?.manifestDigest, review.manifestDigest);
    const plaintext = JSON.parse(await fixture.cipher.decryptString({
      ciphertext: review.encryptedPayload,
      nonce: review.payloadNonce,
      keyId: "local-data-key-v1",
    })) as { validation: { allowed: boolean }; manifest: { mintAddress: string } };
    assert.equal(plaintext.validation.allowed, true);
    assert.equal(plaintext.manifest.mintAddress, fixture.mintAddress);
  } finally {
    await fixture.close();
  }
});

test("active mint authority fails review and creates no activation record", async () => {
  const fixture = await setupReview("active");
  try {
    await assert.rejects(
      fixture.service.reviewAndActivate(fixture.provisionId),
      /mint-authority-active/u,
    );
    assert.equal(fixture.service.getActive(), null);
  } finally {
    await fixture.close();
  }
});

async function setupReview(mintAuthorityMode: "active" | null) {
  const directory = await mkdtemp(join(tmpdir(), "silfable-fixture-review-"));
  const database = await RuntimeDatabase.open(join(directory, "runtime.sqlite3"));
  const cipher = new LocalDataCipher(new MemoryKeystore());
  const [wallet, mint, source, destination, destinationOwner] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const instruction = buildGuardedSplTransferFixture({
    source: source.address,
    mint: mint.address,
    destination: destination.address,
    authority: wallet,
    amount: 1_000_000n,
    decimals: 6,
  });
  const provisionId = "00000000-0000-4000-8000-000000000501";
  const provision = database.createFixtureProvision({
    id: provisionId,
    mintAddress: mint.address,
    messageHash: "a".repeat(64),
    lastValidBlockHeight: "1000",
    now: new Date().toISOString(),
  });
  const envelope = await cipher.encryptString(JSON.stringify({
    schemaVersion: 1,
    walletAuthority: wallet.address,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    destinationOwner: destinationOwner.address,
    decimals: 6,
    supplyAtomic: "1000000000",
    transferAmountAtomic: "1000000",
    instructionFingerprint: instruction.fingerprint,
    wireTransaction: "encrypted-wire-evidence",
    signature: "encrypted-signature-evidence",
  }));
  database.updateFixtureProvision({
    id: provision.id,
    expectedState: "proposed",
    state: "simulated",
    simulationUnits: "100",
    now: new Date().toISOString(),
  });
  database.updateFixtureProvision({
    id: provision.id,
    expectedState: "simulated",
    state: "signed",
    encryptedPayload: envelope.ciphertext,
    payloadNonce: envelope.nonce,
    keyId: envelope.keyId,
    signingAttempted: true,
    now: new Date().toISOString(),
  });
  database.updateFixtureProvision({
    id: provision.id,
    expectedState: "signed",
    state: "broadcast",
    broadcastAttempted: true,
    now: new Date().toISOString(),
  });
  database.updateFixtureProvision({
    id: provision.id,
    expectedState: "broadcast",
    state: "confirmed",
    now: new Date().toISOString(),
  });
  const rpc: DevnetFixtureRpcPort = {
    async getMultipleAccountsBase64() {
      return {
        contextSlot: 777n,
        accounts: [
          encoded(mint.address, getMintEncoder().encode({
            mintAuthority: mintAuthorityMode === "active" ? wallet.address : null,
            supply: 1_000_000_000n,
            decimals: 6,
            isInitialized: true,
            freezeAuthority: null,
          })),
          encoded(source.address, getTokenEncoder().encode({
            mint: mint.address,
            owner: wallet.address,
            amount: 1_000_000_000n,
            delegate: null,
            state: AccountState.Initialized,
            isNative: null,
            delegatedAmount: 0n,
            closeAuthority: null,
          })),
          encoded(destination.address, getTokenEncoder().encode({
            mint: mint.address,
            owner: destinationOwner.address,
            amount: 0n,
            delegate: null,
            state: AccountState.Initialized,
            isNative: null,
            delegatedAmount: 0n,
            closeAuthority: null,
          })),
        ],
      };
    },
  };
  const service = new FixtureReviewService({
    database,
    cipher,
    rpc,
    keystore: { isLocked: () => false },
    health: { isHealthyFresh: () => true },
  });
  return {
    service,
    cipher,
    provisionId,
    mintAddress: mint.address,
    async close() {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function encoded(accountAddress: Address, data: ReadonlyUint8Array) {
  return {
    address: accountAddress,
    programAddress: TOKEN_PROGRAM_ADDRESS,
    executable: false,
    dataBase64: Buffer.from(data).toString("base64"),
  };
}
