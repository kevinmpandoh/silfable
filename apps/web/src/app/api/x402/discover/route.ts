import { NextRequest, NextResponse } from "next/server";
import { X402DiscoverRequestSchema, X402DiscoverResponseSchema, X402_DEFAULT_MAX_RESOURCE_ATOMIC } from "@mirae/contracts";
import { isAuthFailure, requireWalletAuth } from "@/lib/wallet-auth";
import { discoverMiraeCatalog } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = X402DiscoverRequestSchema.parse(await request.json());
    const auth = await requireWalletAuth(request);
    if (isAuthFailure(auth)) return auth;
    const requestedAtomic = BigInt(Math.round((input.maxUsdPrice ?? 0.03) * 1_000_000));
    const result = await discoverMiraeCatalog({ query: input.query, maxAtomic: requestedAtomic > BigInt(X402_DEFAULT_MAX_RESOURCE_ATOMIC) ? BigInt(X402_DEFAULT_MAX_RESOURCE_ATOMIC) : requestedAtomic, limit: input.limit });
    return NextResponse.json(X402DiscoverResponseSchema.parse({ schemaVersion: 1, requestId: input.requestId, ...result }));
  } catch (error) {
    const failureCode = nestedErrorCode(error);
    const tlsMismatch = failureCode === "ERR_TLS_CERT_ALTNAME_INVALID" || failureCode === "CERT_HAS_EXPIRED" || failureCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    const timedOut = failureCode === "UND_ERR_CONNECT_TIMEOUT" || failureCode === "ABORT_ERR";
    return NextResponse.json({
      error: tlsMismatch
        ? "An x402 provider failed TLS verification because DNS returned a certificate for another domain. Use a trusted DNS resolver or VPN; TLS verification was not bypassed."
        : timedOut
        ? "The x402 provider connection timed out. Check the server network, DNS, firewall, or VPN and retry."
        : error instanceof Error ? error.message : "x402 discovery failed safely",
      code: tlsMismatch ? "X402_DISCOVERY_DNS_TLS_FAILED" : timedOut ? "X402_DISCOVERY_TIMEOUT" : "X402_DISCOVERY_FAILED",
      ...(failureCode ? { upstreamCode: failureCode } : {}),
    }, { status: 400 });
  }
}

function nestedErrorCode(value: unknown): string | null {
  let current: unknown = value;
  const visited = new Set<object>();
  for (let depth = 0; depth < 6 && typeof current === "object" && current !== null && !visited.has(current); depth += 1) {
    visited.add(current);
    const record = current as Record<string, unknown>;
    if (typeof record.code === "string" && record.code.length <= 80) return record.code;
    current = record.cause;
  }
  return null;
}
