import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, passwordMatches } from "@/lib/admin-session";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { clearRateLimit, clientAddress, readRateLimit, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const client = clientAddress(request);
  const key = `admin-login:${client}`;
  const rate = await readRateLimit(key, 5);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { password?: string } | null;
  if (!passwordMatches(body?.password || "")) {
    await takeRateLimit(key, 5, 15 * 60 * 1000);
    return NextResponse.json({ error: "Incorrect administrator password." }, { status: 401 });
  }
  await clearRateLimit(key);
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
