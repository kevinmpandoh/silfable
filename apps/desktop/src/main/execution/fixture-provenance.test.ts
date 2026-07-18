import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountState,
  getMintEncoder,
  getTokenEncoder,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { generateKeyPairSigner, type ReadonlyUint8Array } from "@solana/kit";

import type { DevnetFixtureRpcPort } from "../rpc/devnet";
import {
  getGuardedFixtureManifestDigest,
  observeGuardedFixture,
  parseGuardedFixtureManifest,
  validateGuardedFixtureProvenance,
  type GuardedFixtureManifest,
  type GuardedFixtureObservation,
} from "./fixture-provenance";
import { buildGuardedSplTransferFixture } from "./spl-fixture";

test("official SPL account codecs produce a valid immutable Devnet fixture observation", async () => {
  const context = await fixtureContext();
  const rpc: DevnetFixtureRpcPort = {
    async getMultipleAccountsBase64(addresses) {
      assert.deepEqual(addresses, [
        context.manifest.mintAddress,
        context.manifest.sourceTokenAccount,
        context.manifest.destinationTokenAccount,
      ]);
      return {
        contextSlot: 12345n,
        accounts: [
          encodedAccount(context.manifest.mintAddress, getMintEncoder().encode({
            mintAuthority: null,
            supply: 1_000_000n,
            decimals: 6,
            isInitialized: true,
            freezeAuthority: null,
          })),
          encodedAccount(context.manifest.sourceTokenAccount, getTokenEncoder().encode({
            mint: context.mint.address,
            owner: context.authority.address,
            amount: 1_000n,
            delegate: null,
            state: AccountState.Initialized,
            isNative: null,
            delegatedAmount: 0n,
            closeAuthority: null,
          })),
          encodedAccount(context.manifest.destinationTokenAccount, getTokenEncoder().encode({
            mint: context.mint.address,
            owner: context.destinationOwner.address,
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
  const now = new Date("2026-07-17T01:00:00.000Z");
  const observation = await observeGuardedFixture(rpc, context.manifest, now);
  const result = validateGuardedFixtureProvenance({
    manifest: context.manifest,
    observation,
    instruction: context.instruction,
    now,
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.denialCodes, []);
  assert.equal(result.manifestDigest, getGuardedFixtureManifestDigest(context.manifest));
  assert.equal(observation.contextSlot, "12345");
  assert.equal(observation.source.amountAtomic, "1000");
});

test("fixture provenance fails closed on authority, owner, state, balance, and instruction changes", async () => {
  const context = await fixtureContext();
  const now = new Date("2026-07-17T01:00:00.000Z");
  const valid = validObservation(context, now);
  const changedInstruction = buildGuardedSplTransferFixture({
    source: context.source.address,
    mint: context.mint.address,
    destination: context.destination.address,
    authority: context.authority,
    amount: 101n,
    decimals: 6,
  });
  const result = validateGuardedFixtureProvenance({
    manifest: context.manifest,
    observation: {
      ...valid,
      observedAt: "2026-07-17T00:00:00.000Z",
      mint: { ...valid.mint, freezeAuthority: context.authority.address },
      source: {
        ...valid.source,
        programAddress: context.destinationOwner.address,
        owner: context.destinationOwner.address,
        amountAtomic: "99",
        state: "frozen",
        delegate: context.destinationOwner.address,
        isNative: true,
      },
    },
    instruction: changedInstruction,
    now,
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.denialCodes, [
    "observation-stale",
    "instruction-mismatch",
    "program-owner-mismatch",
    "freeze-authority-active",
    "token-account-mismatch",
    "token-account-not-initialized",
    "delegate-active",
    "native-token-account",
    "source-balance-insufficient",
  ]);
});

test("missing or malformed on-chain fixture accounts are rejected before policy validation", async () => {
  const context = await fixtureContext();
  await assert.rejects(
    observeGuardedFixture({
      async getMultipleAccountsBase64() {
        return { contextSlot: 1n, accounts: [null, null, null] };
      },
    }, context.manifest),
    /does not exist/u,
  );
  await assert.rejects(
    observeGuardedFixture({
      async getMultipleAccountsBase64() {
        const malformed = encodedAccount(context.mint.address, new Uint8Array([1, 2, 3]));
        return { contextSlot: 1n, accounts: [malformed, malformed, malformed] };
      },
    }, context.manifest),
    /account data is invalid/u,
  );
  assert.throws(
    () => parseGuardedFixtureManifest({ ...context.manifest, mainnetOverride: true }),
    /manifest is invalid/u,
  );
});

async function fixtureContext() {
  const [authority, source, mint, destination, destinationOwner] = await Promise.all([
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
    authority,
    amount: 100n,
    decimals: 6,
  });
  const manifest: GuardedFixtureManifest = {
    schemaVersion: 1,
    fixtureId: "00000000-0000-4000-8000-000000000201",
    cluster: "devnet",
    mintAddress: mint.address,
    mintDecimals: 6,
    sourceTokenAccount: source.address,
    destinationTokenAccount: destination.address,
    walletAuthority: authority.address,
    destinationOwner: destinationOwner.address,
    transferAmountAtomic: "100",
    instructionFingerprint: instruction.fingerprint,
    reviewedAt: "2026-07-17T00:30:00.000Z",
  };
  return { authority, source, mint, destination, destinationOwner, instruction, manifest };
}

function validObservation(
  context: Awaited<ReturnType<typeof fixtureContext>>,
  now: Date,
): GuardedFixtureObservation {
  const base = { programAddress: TOKEN_PROGRAM_ADDRESS, executable: false };
  return {
    observedAt: now.toISOString(),
    contextSlot: "12345",
    mint: {
      ...base,
      address: context.mint.address,
      decimals: 6,
      initialized: true,
      mintAuthority: null,
      freezeAuthority: null,
    },
    source: {
      ...base,
      address: context.source.address,
      mint: context.mint.address,
      owner: context.authority.address,
      amountAtomic: "1000",
      state: "initialized",
      delegate: null,
      isNative: false,
    },
    destination: {
      ...base,
      address: context.destination.address,
      mint: context.mint.address,
      owner: context.destinationOwner.address,
      amountAtomic: "0",
      state: "initialized",
      delegate: null,
      isNative: false,
    },
  };
}

function encodedAccount(address: string, data: ReadonlyUint8Array) {
  return {
    address,
    programAddress: TOKEN_PROGRAM_ADDRESS,
    executable: false,
    dataBase64: Buffer.from(data).toString("base64"),
  };
}
