import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, passwordMatches } from "@/lib/admin-session";
import { requestHasTrustedOrigin } from "@/lib/request-security";

const globalAttempts = globalThis as unknown as { cryptoSugarAdminAttempts?: Map<string, { count: number; resetAt: number }> };
const attempts = globalAttempts.cryptoSugarAdminAttempts || new Map<string, { count: number; resetAt: number }>();
globalAttempts.cryptoSugarAdminAttempts = attempts;

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const current = attempts.get(client);
  if (current && current.resetAt > Date.now() && current.count >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { password?: string } | null;
  if (!passwordMatches(body?.password || "")) {
    attempts.set(client, current && current.resetAt > Date.now()
      ? { ...current, count: current.count + 1 }
      : { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    return NextResponse.json({ error: "Incorrect administrator password." }, { status: 401 });
  }
  attempts.delete(client);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("crypto_sugar_admin", createAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60
  });
  return response;
}
