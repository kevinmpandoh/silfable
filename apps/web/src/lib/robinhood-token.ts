const RPC_URL = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_NATIVE_ETH = "0x0000000000000000000000000000000000000000";
export const ROBINHOOD_USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const ADDRESS = /^0x[0-9a-f]{40}$/iu;

export interface RobinhoodToken {
  address: string;
  symbol: string;
  decimals: number;
  native: boolean;
}

async function rpc(method: string, params: unknown[]): Promise<string> {
  const response = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const payload = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || payload.error || typeof payload.result !== "string") throw new Error(payload.error?.message || `Robinhood RPC ${method} failed.`);
  return payload.result;
}

function decodeSymbol(hex: string, address: string): string {
  const clean = hex.replace(/^0x/u, "");
  try {
    let bytes = "";
    if (clean.length === 64) bytes = clean;
    else if (clean.length >= 128) {
      const length = Number.parseInt(clean.slice(64, 128), 16);
      if (!Number.isSafeInteger(length) || length < 1 || length > 32) throw new Error("invalid symbol length");
      bytes = clean.slice(128, 128 + length * 2);
    }
    const decoded = Buffer.from(bytes.replace(/(?:00)+$/u, ""), "hex").toString("utf8").trim();
    return /^[\x20-\x7E]{1,32}$/u.test(decoded) ? decoded : `${address.slice(0, 6)}…${address.slice(-4)}`;
  } catch {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}

export async function resolveRobinhoodToken(value: unknown): Promise<RobinhoodToken | null> {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (/^ETH$/iu.test(token)) return { address: ROBINHOOD_NATIVE_ETH, symbol: "ETH", decimals: 18, native: true };
  if (/^USDG$/iu.test(token) || /^USD$/iu.test(token)) return { address: ROBINHOOD_USDG, symbol: "USDG", decimals: 6, native: false };
  if (!ADDRESS.test(token) || token.toLowerCase() === ROBINHOOD_NATIVE_ETH) return null;
  const address = token.toLowerCase();
  const [code, decimalsHex, symbolHex] = await Promise.all([
    rpc("eth_getCode", [address, "latest"]),
    rpc("eth_call", [{ to: address, data: "0x313ce567" }, "latest"]),
    rpc("eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]).catch(() => "0x"),
  ]);
  if (code === "0x" || code === "0x0" || !/^0x[0-9a-f]+$/iu.test(decimalsHex)) return null;
  const decimals = Number(BigInt(decimalsHex));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  return { address, symbol: decodeSymbol(symbolHex, address), decimals, native: false };
}
