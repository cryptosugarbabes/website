import { NextRequest } from "next/server";
import { AuthSession, readSessionToken, WalletChain } from "@/lib/session";

export type WalletSession = AuthSession & { address: string; chain: WalletChain };

export function authenticatedSession(request: NextRequest): AuthSession | null {
  return readSessionToken(request.cookies.get("velora_session")?.value);
}

export function walletSession(request: NextRequest): WalletSession | null {
  const session = authenticatedSession(request);
  return session?.address && session.chain ? { ...session, address: session.address, chain: session.chain } : null;
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
