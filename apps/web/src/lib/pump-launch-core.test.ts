import assert from "node:assert/strict";
import test from "node:test";

import type { FeeConfig, Global } from "@pump-fun/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  buildPumpLaunchTransaction,
  buildPumpLaunchWithCreatorBuyFromGlobal,
  assertTransactionFitsPacket,
  inspectPumpLaunchBroadcastTransaction,
  inspectPumpLaunchTransaction,
  PUMP_PROGRAM_ID,
  transactionDigest,
} from "./pump-launch-core";

const creator = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
const mint = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 100 + index));
const blockhash = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 200 + index)).publicKey.toBase58();
const fixtureAddress = (seed: number) => Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => seed + index)).publicKey;
const globalFixture: Global = {
  initialized: true,
  authority: fixtureAddress(10),
  feeRecipient: fixtureAddress(20),
  initialVirtualTokenReserves: new BN("1073000000000000"),
  initialVirtualSolReserves: new BN("30000000000"),
  initialRealTokenReserves: new BN("793100000000000"),
  tokenTotalSupply: new BN("1000000000000000"),
  feeBasisPoints: new BN(100),
  withdrawAuthority: fixtureAddress(30),
  enableMigrate: true,
  poolMigrationFee: new BN(0),
  creatorFeeBasisPoints: new BN(0),
  feeRecipients: Array.from({ length: 7 }, (_, index) => fixtureAddress(40 + index)),
  setCreatorAuthority: fixtureAddress(60),
  adminSetCreatorAuthority: fixtureAddress(70),
  createV2Enabled: true,
  whitelistPda: PublicKey.default,
  reservedFeeRecipient: fixtureAddress(80),
  mayhemModeEnabled: false,
  reservedFeeRecipients: [],
  isCashbackEnabled: false,
  buybackFeeRecipients: [],
  buybackBasisPoints: new BN(0),
  initialVirtualQuoteReserves: new BN("30000000000"),
  whitelistedQuoteMints: [],
};
const feeConfigFixture: FeeConfig = {
  admin: fixtureAddress(90),
  flatFees: { lpFeeBps: new BN(0), protocolFeeBps: new BN(300), creatorFeeBps: new BN(100) },
  feeTiers: [{
    marketCapLamportsThreshold: new BN(0),
    fees: { lpFeeBps: new BN(0), protocolFeeBps: new BN(300), creatorFeeBps: new BN(100) },
  }],
};

test("builds a lookup-free Pump.fun create_v2 transaction with exactly two signers", () => {
  const built = buildPumpLaunchTransaction({
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "Mirae Test",
    symbol: "SLFB",
    metadataUri: "ipfs://bafybeigdyrzt4examplemetadata",
    recentBlockhash: blockhash,
    priorityFeeLamports: BigInt(100_000),
  });
  const inspected = inspectPumpLaunchTransaction(built.transaction, creator.publicKey.toBase58(), mint.publicKey.toBase58());
  assert.equal(inspected.creatorWallet, creator.publicKey.toBase58());
  assert.equal(inspected.mintAddress, mint.publicKey.toBase58());
  assert.equal(built.transaction.message.addressTableLookups.length, 0);
  assert.equal(built.transaction.message.header.numRequiredSignatures, 2);
  assert.equal(built.transaction.message.staticAccountKeys[built.transaction.message.compiledInstructions.at(-1)!.programIdIndex]!.toBase58(), PUMP_PROGRAM_ID.toBase58());
  assert.match(transactionDigest(built.transaction), /^[a-f0-9]{64}$/u);
});

test("rejects a changed create_v2 discriminator", () => {
  const { transaction } = buildPumpLaunchTransaction({
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "Mirae Test",
    symbol: "SLFB",
    metadataUri: "https://example.com/metadata.json",
    recentBlockhash: blockhash,
    priorityFeeLamports: BigInt(0),
  });
  transaction.message.compiledInstructions.at(-1)!.data[0] ^= 0xff;
  assert.throws(() => inspectPumpLaunchTransaction(transaction), /layout changed/u);
});

test("builds and inspects an atomic create_v2 creator buy", async () => {
  const built = await buildPumpLaunchWithCreatorBuyFromGlobal({
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "Mirae Creator Buy",
    symbol: "MIRAE",
    metadataUri: "ipfs://bafybeigdyrzt4creatorbuy",
    recentBlockhash: blockhash,
    priorityFeeLamports: 100_000n,
    creatorBuyLamports: 10_000_000n,
    global: globalFixture,
    feeConfig: feeConfigFixture,
  });

  assert.equal(built.transaction.message.header.numRequiredSignatures, 2);
  assert.equal(built.transaction.message.addressTableLookups.length, 0);
  assert.ok(BigInt(built.expectedCreatorTokensRaw) > 0n);
  assert.equal(built.maximumCreatorBuyLamports, "10100000");
  assert.equal(built.creatorBuySlippageBps, 100);
  assert.ok(built.writableAddresses.includes(creator.publicKey.toBase58()));
  assert.ok(assertTransactionFitsPacket(built.transaction) <= 1_232);
  assert.match(transactionDigest(built.transaction), /^[a-f0-9]{64}$/u);
  assert.deepEqual(
    inspectPumpLaunchBroadcastTransaction(built.transaction, creator.publicKey.toBase58(), mint.publicKey.toBase58()),
    { creatorWallet: creator.publicKey.toBase58(), mintAddress: mint.publicKey.toBase58(), creatorBuy: true },
  );
});

test("broadcast inspection rejects a changed atomic creator-buy instruction", async () => {
  const built = await buildPumpLaunchWithCreatorBuyFromGlobal({
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "Changed Creator Buy",
    symbol: "CHG",
    metadataUri: "ipfs://bafybeigdyrzt4changedcreatorbuy",
    recentBlockhash: blockhash,
    priorityFeeLamports: 0n,
    creatorBuyLamports: 10_000_000n,
    global: globalFixture,
    feeConfig: feeConfigFixture,
  });
  built.transaction.message.compiledInstructions[2]!.data[0] ^= 0xff;

  assert.throws(
    () => inspectPumpLaunchBroadcastTransaction(built.transaction, creator.publicKey.toBase58(), mint.publicKey.toBase58()),
    /buy instruction layout changed/u,
  );
});

test("accounts for the live Pump.fun fee tier in a creator-buy quote", async () => {
  const base = {
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "Fee Aware Buy",
    symbol: "FEE",
    metadataUri: "ipfs://bafybeigdyrzt4feeawarebuy",
    recentBlockhash: blockhash,
    priorityFeeLamports: 0n,
    creatorBuyLamports: 10_000_000n,
    global: globalFixture,
  };
  const withoutTier = await buildPumpLaunchWithCreatorBuyFromGlobal(base);
  const withTier = await buildPumpLaunchWithCreatorBuyFromGlobal({ ...base, feeConfig: feeConfigFixture });

  assert.ok(BigInt(withTier.expectedCreatorTokensRaw) < BigInt(withoutTier.expectedCreatorTokensRaw));
});

test("keeps a maximum-length creator-buy launch inside the Solana packet limit", async () => {
  const built = await buildPumpLaunchWithCreatorBuyFromGlobal({
    creatorWallet: creator.publicKey.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
    name: "max-name-32-characters-123456789",
    symbol: "ABCDEFGHIJ",
    metadataUri: "ipfs://bafybeigdyrzt4examplemetadata012345678901234567890123456789",
    recentBlockhash: blockhash,
    priorityFeeLamports: 0n,
    creatorBuyLamports: 10_000_000n,
    global: globalFixture,
  });

  assert.ok(assertTransactionFitsPacket(built.transaction) <= 1_232);
});
