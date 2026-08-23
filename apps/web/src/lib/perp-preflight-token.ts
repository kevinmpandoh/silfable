import { createHmac, timingSafeEqual } from "node:crypto";

type PerpPreflightProof = {
  sessionId: string;
  walletAddress: string;
  digest: string;
  expiresAt: number;
};

function proofSecret(): string {
  const value =
    process.env.PERP_PREFLIGHT_SECRET?.trim() ||
    process.env.INVESTMENT_RECOMMENDATION_SECRET?.trim() ||
    process.env.WORKER_ENCRYPTION_KEY?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!value || value.length < 24) {
    throw new Error("The server preflight signing secret is not configured.");
  }
  return value;
}

export function createPerpPreflightToken(proof: PerpPreflightProof): string {
  const payload = Buffer.from(JSON.stringify(proof), "utf8").toString("base64url");
  const signature = createHmac("sha256", proofSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPerpPreflightToken(
  token: string,
  expected: Omit<PerpPreflightProof, "expiresAt">,
): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0 || token.length > 4_096) return false;
  const payload = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expectedSignature = Buffer.from(
    createHmac("sha256", proofSecret()).update(payload).digest("base64url"),
  );
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PerpPreflightProof;
    return (
      parsed.sessionId === expected.sessionId &&
      parsed.walletAddress === expected.walletAddress &&
      parsed.digest === expected.digest
    );
  } catch {
    return false;
  }
}
