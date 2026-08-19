import { NextResponse } from "next/server";
import { WALLET_AUTH_COOKIE } from "@/lib/wallet-auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(WALLET_AUTH_COOKIE);
  return response;
}
