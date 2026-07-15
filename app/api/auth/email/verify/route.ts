import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { emailCodeHash, normalizeEmail, safeHashEqual } from "@/lib/email-auth";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { createEmailSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const rate = takeRateLimit(`email-verify:${clientAddress(request)}`, 20, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Please wait and try again." }, { status: 429 });

  const body = await request.json().catch(() => null) as { email?: string; code?: string; challengeId?: string } | null;
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
  if (!email || !body?.challengeId || code.length !== 6) return NextResponse.json({ error: "Enter the six-digit code from your email." }, { status: 400 });

  try {
    const user = await transaction(async (client) => {
      const challenge = await client.query<{ id: string; code_hash: string; attempts: number; expires_at: Date; consumed_at: Date | null }>(`
        SELECT id, code_hash, attempts, expires_at, consumed_at
        FROM email_auth_challenges
        WHERE id = $1 AND email = $2
        FOR UPDATE
      `, [body.challengeId, email]);
      const row = challenge.rows[0];
      if (!row || row.consumed_at || row.expires_at.getTime() < Date.now() || row.attempts >= 6) throw new Error("CODE_EXPIRED");
      if (!safeHashEqual(row.code_hash, emailCodeHash(row.id, email, code))) {
        await client.query(`UPDATE email_auth_challenges SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
        throw new Error("CODE_INVALID");
      }
      await client.query(`UPDATE email_auth_challenges SET consumed_at = now() WHERE id = $1`, [row.id]);

      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [email]);
      const existing = await client.query<{ id: string; status: string }>(`SELECT id, status FROM users WHERE email = $1 FOR UPDATE`, [email]);
      if (existing.rowCount) {
        if (existing.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");
        await client.query(`UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = $1`, [existing.rows[0].id]);
        return existing.rows[0];
      }
      const created = await client.query<{ id: string }>(`
        INSERT INTO users (id, email, email_verified_at)
        VALUES ($1, $2, now())
        RETURNING id
      `, [randomUUID(), email]);
      return created.rows[0];
    });

    const response = NextResponse.json({ authenticated: true, email });
    response.cookies.set("velora_session", createEmailSessionToken(user.id, email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CODE_INVALID") {
      await query(`UPDATE email_auth_challenges SET attempts = attempts + 1 WHERE id = $1 AND consumed_at IS NULL`, [body.challengeId]).catch(() => undefined);
      return NextResponse.json({ error: "That code is incorrect." }, { status: 401 });
    }
    if (message === "CODE_EXPIRED") return NextResponse.json({ error: "That code has expired or has already been used." }, { status: 410 });
    if (message === "ACCOUNT_SUSPENDED") return NextResponse.json({ error: "This account is suspended. Contact safety support if you believe this is an error." }, { status: 403 });
    console.error("Email verification failed", error);
    return NextResponse.json({ error: "Your email could not be verified." }, { status: 503 });
  }
}
