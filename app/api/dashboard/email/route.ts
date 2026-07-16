import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { emailCodeHash, normalizeEmail, safeHashEqual, sendEmailChangeCode } from "@/lib/email-auth";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";
import { createEmailSessionToken, createSessionToken } from "@/lib/session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60
};

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const account = await accountForSession(session);
  if (!account) return NextResponse.json({ error: "Your account could not be found." }, { status: 404 });

  const body = await request.json().catch(() => null) as {
    action?: "REQUEST" | "CONFIRM";
    email?: string;
    code?: string;
    challengeId?: string;
  } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const rate = await takeRateLimit(
    `account-email:${account.id}:${clientAddress(request)}`,
    body?.action === "CONFIRM" ? 20 : 5,
    15 * 60 * 1000
  );
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });

  if (body?.action === "REQUEST") {
    const current = await query<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [account.id]);
    if (current.rows[0]?.email === email) {
      return NextResponse.json({ error: "This is already your verified account email." }, { status: 400 });
    }
    const claimed = await query(`SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1`, [email, account.id]);
    if (claimed.rowCount) return NextResponse.json({ error: "That email is already connected to another account." }, { status: 409 });

    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await query(`DELETE FROM account_email_challenges WHERE expires_at < now() - interval '24 hours'`).catch(() => undefined);
    await query(`
      INSERT INTO account_email_challenges (id, user_id, email, code_hash, expires_at)
      VALUES ($1, $2, $3, $4, now() + interval '10 minutes')
    `, [id, account.id, email, emailCodeHash(id, email, code)]);

    try {
      await sendEmailChangeCode(email, code);
    } catch (error) {
      await query(`DELETE FROM account_email_challenges WHERE id = $1`, [id]).catch(() => undefined);
      console.error("Account email verification failed to send", error);
      return NextResponse.json({ error: "Email verification is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ sent: true, challengeId: id });
  }

  if (body?.action !== "CONFIRM") {
    return NextResponse.json({ error: "Choose a valid email action." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
  if (!body.challengeId || code.length !== 6) {
    return NextResponse.json({ error: "Enter the six-digit code from your email." }, { status: 400 });
  }

  try {
    const result = await transaction(async (client) => {
      const challenge = await client.query<{
        id: string; code_hash: string; attempts: number; expires_at: Date; consumed_at: Date | null;
      }>(`
        SELECT id, code_hash, attempts, expires_at, consumed_at
        FROM account_email_challenges
        WHERE id = $1 AND user_id = $2 AND email = $3
        FOR UPDATE
      `, [body.challengeId, account.id, email]);
      const row = challenge.rows[0];
      if (!row || row.consumed_at || row.expires_at.getTime() < Date.now() || row.attempts >= 6) {
        return { error: "CODE_EXPIRED" as const };
      }
      if (!safeHashEqual(row.code_hash, emailCodeHash(row.id, email, code))) {
        await client.query(`UPDATE account_email_challenges SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
        return { error: "CODE_INVALID" as const };
      }

      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [email]);
      const claimed = await client.query(`SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1`, [email, account.id]);
      if (claimed.rowCount) return { error: "EMAIL_CLAIMED" as const };

      await client.query(`
        UPDATE users SET email = $1, email_verified_at = now(), updated_at = now()
        WHERE id = $2
      `, [email, account.id]);
      await client.query(`UPDATE account_email_challenges SET consumed_at = now() WHERE id = $1`, [row.id]);
      return { email };
    });

    if ("error" in result) {
      if (result.error === "CODE_INVALID") return NextResponse.json({ error: "That code is incorrect." }, { status: 401 });
      if (result.error === "EMAIL_CLAIMED") return NextResponse.json({ error: "That email is already connected to another account." }, { status: 409 });
      return NextResponse.json({ error: "That code has expired or has already been used." }, { status: 410 });
    }

    const response = NextResponse.json({ verified: true, email: result.email });
    const token = session.address && session.chain
      ? createSessionToken(session.address, session.chain, account.id, result.email)
      : createEmailSessionToken(account.id, result.email);
    response.cookies.set("velora_session", token, COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error("Account email update failed", error);
    return NextResponse.json({ error: "Your account email could not be updated." }, { status: 503 });
  }
}
