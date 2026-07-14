import { NextRequest } from "next/server";
import { readSessionToken, WalletChain } from "@/lib/session";

export type WalletSession = { address: string; chain: WalletChain };

export function walletSession(request: NextRequest): WalletSession | null {
  const session = readSessionToken(request.cookies.get("velora_session")?.value);
  return session ? { address: session.address, chain: session.chain } : null;
}

export function requestHasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  const allowed = new Set([
    new URL(request.url).origin,
    process.env.APP_ORIGIN,
    process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined
  ].filter(Boolean));
  return allowed.has(origin);
}
