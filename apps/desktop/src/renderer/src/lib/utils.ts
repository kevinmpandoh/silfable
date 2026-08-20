import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shorten(value: string): string {
  if (!value || value.length < 10) return value;
  return value.slice(0, 4) + '...' + value.slice(-4);
}

export const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  // Solana
  "So11111111111111111111111111111111111111112": "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp": "AAPLx",
  "xaapL5RKeptHp1ErTtNuivj4AiJyNWupkK4YBNZzSTj": "AAPLx",
  "xtsLaRz65FBPbEk1J4p5u2hUgw5R4E7a4m1uUspump1": "xTSLA",
  "xnvdaP785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xNVDA",
  "xmsftH864mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xMSFT",
  "xamznK785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xAMZN",
  "xgoogP785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xGOOGL",
  "xmetaK864mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xMETA",
  "xamdP785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xAMD",
  "xspyK785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xSPY",
  "xqqqP785mR387Wd92iUoXv5pA9xNu23L7yF1Mspump": "xQQQ",
  // EVM
  "0x0000000000000000000000000000000000000000": "ETH",
  "0x5fc5360d0400a0fd4f2af552add042d716f1d168": "USDG",
  "0x2d7882bedcbfddce29ba99965dd3cdf7fcb002e2": "AAPL",
  "0x1b44f3514812d835eb1bdb0acb33d3fa3351ee43": "TSLA",
  "0x43d4876793f7a1ed718afee7f637f763c449e256": "NVDA",
};

export function resolveTokenSymbol(mintOrAddress?: string | null): string {
  if (!mintOrAddress) return "???";
  const exact = KNOWN_TOKEN_SYMBOLS[mintOrAddress];
  if (exact) return exact;
  const lower = KNOWN_TOKEN_SYMBOLS[mintOrAddress.toLowerCase()];
  if (lower) return lower;
  return shorten(mintOrAddress);
}

export function formatTokenPair(inputMint: string, outputMint: string): string {
  return `${resolveTokenSymbol(inputMint)} → ${resolveTokenSymbol(outputMint)}`;
}

export function cleanErrorMessage(error: unknown): string {
  if (!error) return "";
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^Error invoking remote method '[^']+'?:\s*/iu, "")
    .replace(/^Error:\s*/iu, "")
    .trim();
}

