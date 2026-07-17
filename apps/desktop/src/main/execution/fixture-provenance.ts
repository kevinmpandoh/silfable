import { createHash } from "node:crypto";

import {
  AccountState,
  getMintDecoder,
  getTokenDecoder,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { address, isSome } from "@solana/kit";

import type { DevnetFixtureRpcPort } from "../rpc/devnet.js";
import type { GuardedSplTransferFixture } from "./spl-fixture.js";

export type GuardedFixtureManifest = {
  schemaVersion: 1;
  fixtureId: string;
  cluster: "devnet";
  mintAddress: string;
  mintDecimals: number;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  walletAuthority: string;
  destinationOwner: string;
  transferAmountAtomic: string;
  instructionFingerprint: string;
  reviewedAt: string;
};

export type GuardedFixtureObservation = {
  observedAt: string;
  contextSlot: string;
  mint: {
    address: string;
    programAddress: string;
    executable: boolean;
    decimals: number;
    initialized: boolean;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  };
  source: GuardedTokenAccountObservation;
  destination: GuardedTokenAccountObservation;
};

type GuardedTokenAccountObservation = {
  address: string;
  programAddress: string;
  executable: boolean;
  mint: string;
  owner: string;
  amountAtomic: string;
  state: "uninitialized" | "initialized" | "frozen";
  delegate: string | null;
  isNative: boolean;
};

export type FixtureProvenanceDenial =
  | "observation-stale"
  | "slot-invalid"
  | "instruction-mismatch"
  | "program-owner-mismatch"
  | "executable-account"
  | "mint-invalid"
  | "mint-authority-active"
  | "freeze-authority-active"
  | "token-account-mismatch"
  | "token-account-not-initialized"
  | "delegate-active"
  | "native-token-account"
  | "source-balance-insufficient";

export type FixtureProvenanceValidation = {
  allowed: boolean;
  manifestDigest: string;
  denialCodes: FixtureProvenanceDenial[];
  validatedAt: string;
};

export async function observeGuardedFixture(
  rpc: DevnetFixtureRpcPort,
  untrustedManifest: GuardedFixtureManifest,
  now = new Date(),
): Promise<GuardedFixtureObservation> {
  const manifest = parseGuardedFixtureManifest(untrustedManifest);
  const response = await rpc.getMultipleAccountsBase64([
    manifest.mintAddress,
    manifest.sourceTokenAccount,
    manifest.destinationTokenAccount,
  ]);
  const [mintAccount, sourceAccount, destinationAccount] = response.accounts;
  if (mintAccount === null || mintAccount === undefined || sourceAccount === null || sourceAccount === undefined || destinationAccount === null || destinationAccount === undefined) {
    throw new Error("Guarded Devnet fixture account does not exist");
  }
  let mintData: ReturnType<ReturnType<typeof getMintDecoder>["decode"]>;
  let sourceData: ReturnType<ReturnType<typeof getTokenDecoder>["decode"]>;
  let destinationData: ReturnType<ReturnType<typeof getTokenDecoder>["decode"]>;
  try {
    mintData = getMintDecoder().decode(Buffer.from(mintAccount.dataBase64, "base64"));
    sourceData = getTokenDecoder().decode(Buffer.from(sourceAccount.dataBase64, "base64"));
    destinationData = getTokenDecoder().decode(Buffer.from(destinationAccount.dataBase64, "base64"));
  } catch {
    throw new Error("Guarded Devnet fixture account data is invalid");
  }
  return {
    observedAt: now.toISOString(),
    contextSlot: response.contextSlot.toString(),
    mint: {
      address: mintAccount.address,
      programAddress: mintAccount.programAddress,
      executable: mintAccount.executable,
      decimals: mintData.decimals,
      initialized: mintData.isInitialized,
      mintAuthority: optionAddress(mintData.mintAuthority),
      freezeAuthority: optionAddress(mintData.freezeAuthority),
    },
    source: tokenObservation(sourceAccount, sourceData),
    destination: tokenObservation(destinationAccount, destinationData),
  };
}

export function validateGuardedFixtureProvenance(input: {
  manifest: GuardedFixtureManifest;
  observation: GuardedFixtureObservation;
  instruction: GuardedSplTransferFixture;
  now: Date;
}): FixtureProvenanceValidation {
  const manifest = parseGuardedFixtureManifest(input.manifest);
  const observation = input.observation;
  const denials: FixtureProvenanceDenial[] = [];
  const observationAge = input.now.getTime() - new Date(observation.observedAt).getTime();
  if (!Number.isFinite(observationAge) || observationAge < 0 || observationAge > 30_000) denials.push("observation-stale");
  if (!/^[1-9][0-9]*$/u.test(observation.contextSlot)) denials.push("slot-invalid");

  const decoded = input.instruction.decoded;
  if (
    input.instruction.fingerprint !== manifest.instructionFingerprint ||
    decoded.source !== manifest.sourceTokenAccount ||
    decoded.mint !== manifest.mintAddress ||
    decoded.destination !== manifest.destinationTokenAccount ||
    decoded.authority !== manifest.walletAuthority ||
    decoded.amount !== manifest.transferAmountAtomic ||
    decoded.decimals !== manifest.mintDecimals
  ) denials.push("instruction-mismatch");

  if ([observation.mint, observation.source, observation.destination].some(
    (account) => account.programAddress !== TOKEN_PROGRAM_ADDRESS,
  )) denials.push("program-owner-mismatch");
  if ([observation.mint, observation.source, observation.destination].some((account) => account.executable)) {
    denials.push("executable-account");
  }
  if (
    observation.mint.address !== manifest.mintAddress ||
    !observation.mint.initialized ||
    observation.mint.decimals !== manifest.mintDecimals
  ) denials.push("mint-invalid");
  if (observation.mint.mintAuthority !== null) denials.push("mint-authority-active");
  if (observation.mint.freezeAuthority !== null) denials.push("freeze-authority-active");

  if (
    observation.source.address !== manifest.sourceTokenAccount ||
    observation.destination.address !== manifest.destinationTokenAccount ||
    observation.source.mint !== manifest.mintAddress ||
    observation.destination.mint !== manifest.mintAddress ||
    observation.source.owner !== manifest.walletAuthority ||
    observation.destination.owner !== manifest.destinationOwner
  ) denials.push("token-account-mismatch");
  if (observation.source.state !== "initialized" || observation.destination.state !== "initialized") {
    denials.push("token-account-not-initialized");
  }
  if (observation.source.delegate !== null || observation.destination.delegate !== null) denials.push("delegate-active");
  if (observation.source.isNative || observation.destination.isNative) denials.push("native-token-account");
  if (BigInt(observation.source.amountAtomic) < BigInt(manifest.transferAmountAtomic)) {
    denials.push("source-balance-insufficient");
  }
  const denialCodes = [...new Set(denials)];
  return {
    allowed: denialCodes.length === 0,
    manifestDigest: getGuardedFixtureManifestDigest(manifest),
    denialCodes,
    validatedAt: input.now.toISOString(),
  };
}

export function getGuardedFixtureManifestDigest(untrustedManifest: GuardedFixtureManifest): string {
  const manifest = parseGuardedFixtureManifest(untrustedManifest);
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export function parseGuardedFixtureManifest(untrusted: unknown): GuardedFixtureManifest {
  if (typeof untrusted !== "object" || untrusted === null || Array.isArray(untrusted)) {
    throw new Error("Guarded Devnet fixture manifest is invalid");
  }
  const allowedKeys = [
    "cluster",
    "destinationOwner",
    "destinationTokenAccount",
    "fixtureId",
    "instructionFingerprint",
    "mintAddress",
    "mintDecimals",
    "reviewedAt",
    "schemaVersion",
    "sourceTokenAccount",
    "transferAmountAtomic",
    "walletAuthority",
  ];
  if (Object.keys(untrusted).sort().join("|") !== allowedKeys.join("|")) {
    throw new Error("Guarded Devnet fixture manifest is invalid");
  }
  const value = untrusted as Partial<GuardedFixtureManifest>;
  if (
    value.schemaVersion !== 1 ||
    value.cluster !== "devnet" ||
    typeof value.fixtureId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.fixtureId) ||
    typeof value.mintDecimals !== "number" ||
    !Number.isInteger(value.mintDecimals) ||
    value.mintDecimals < 0 ||
    value.mintDecimals > 9 ||
    typeof value.transferAmountAtomic !== "string" ||
    !/^[1-9][0-9]*$/u.test(value.transferAmountAtomic) ||
    typeof value.instructionFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.instructionFingerprint) ||
    typeof value.reviewedAt !== "string" ||
    !Number.isFinite(new Date(value.reviewedAt).getTime()) ||
    typeof value.mintAddress !== "string" ||
    typeof value.sourceTokenAccount !== "string" ||
    typeof value.destinationTokenAccount !== "string" ||
    typeof value.walletAuthority !== "string" ||
    typeof value.destinationOwner !== "string"
  ) throw new Error("Guarded Devnet fixture manifest is invalid");
  const addresses = [
    value.mintAddress,
    value.sourceTokenAccount,
    value.destinationTokenAccount,
    value.walletAuthority,
    value.destinationOwner,
  ];
  addresses.forEach((value) => address(value));
  if (new Set(addresses.slice(0, 3)).size !== 3) throw new Error("Guarded Devnet fixture addresses must be distinct");
  return value as GuardedFixtureManifest;
}

function tokenObservation(
  account: { address: string; programAddress: string; executable: boolean },
  data: ReturnType<ReturnType<typeof getTokenDecoder>["decode"]>,
): GuardedTokenAccountObservation {
  return {
    address: account.address,
    programAddress: account.programAddress,
    executable: account.executable,
    mint: data.mint,
    owner: data.owner,
    amountAtomic: data.amount.toString(),
    state: data.state === AccountState.Initialized ? "initialized" : data.state === AccountState.Frozen ? "frozen" : "uninitialized",
    delegate: optionAddress(data.delegate),
    isNative: isSome(data.isNative),
  };
}

function optionAddress(value: Parameters<typeof isSome<string>>[0]): string | null {
  return isSome(value) ? value.value : null;
}
