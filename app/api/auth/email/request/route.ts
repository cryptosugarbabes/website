import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { emailCodeHash, normalizeEmail, sendSignInCode } from "@/lib/email-auth";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { requestHasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const ipRate = takeRateLimit(`email-request-ip:${clientAddress(request)}`, 8, 15 * 60 * 1000);
  const emailRate = takeRateLimit(`email-request-address:${email}`, 4, 15 * 60 * 1000);
  if (!ipRate.allowed || !emailRate.allowed) {
    return NextResponse.json({ error: "Too many code requests. Please wait and try again." }, { status: 429 });
  }

  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query(`
    INSERT INTO email_auth_challenges (id, email, code_hash, expires_at)
    VALUES ($1, $2, $3, now() + interval '10 minutes')
  `, [id, email, emailCodeHash(id, email, code)]);

  try {
    await sendSignInCode(email, code);
  } catch (error) {
    await query(`DELETE FROM email_auth_challenges WHERE id = $1`, [id]).catch(() => undefined);
    console.error("Sign-in email failed", error);
    return NextResponse.json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }

  return NextResponse.json({ sent: true, challengeId: id });
}
