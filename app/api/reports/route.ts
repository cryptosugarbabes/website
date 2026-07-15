import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

const categories = new Set(["HARASSMENT", "SPAM", "SCAM", "EXTORTION", "UNDERAGE", "TRAFFICKING", "IMPERSONATION", "OTHER"]);

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before reporting." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { profileId?: string; conversationId?: string; messageId?: string; category?: string; details?: string } | null;
  const category = String(input?.category || "OTHER").toUpperCase();
  const details = String(input?.details || "").trim().slice(0, 1500);
  if (!categories.has(category) || details.length < 10) return NextResponse.json({ error: "Choose a report category and add at least 10 characters of detail." }, { status: 400 });
  const account = await accountForSession(session);
  if (!account?.account_type) return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });

  let reportedUserId: string | null = null;
  let profileId: string | null = input?.profileId || null;
  let conversationId: string | null = input?.conversationId || null;
  let messageId: string | null = input?.messageId || null;

  if (messageId || conversationId) {
    const target = await query<{ conversation_id: string; profile_id: string; reported_user_id: string }>(`
      SELECT c.id AS conversation_id, p.id AS profile_id,
        CASE
          WHEN $3::uuid IS NOT NULL THEN m.sender_user_id
          WHEN c.customer_user_id = $1 THEN p.user_id
          ELSE c.customer_user_id
        END AS reported_user_id
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      LEFT JOIN messages m ON m.conversation_id = c.id AND m.id = $3
      WHERE c.id = COALESCE($2::uuid, m.conversation_id)
        AND (c.customer_user_id = $1 OR p.user_id = $1)
        AND ($3::uuid IS NULL OR m.id IS NOT NULL)
    `, [account.id, conversationId, messageId]);
    if (!target.rowCount || target.rows[0].reported_user_id === account.id) return NextResponse.json({ error: "That conversation or message is not reportable." }, { status: 404 });
    conversationId = target.rows[0].conversation_id;
    profileId = target.rows[0].profile_id;
    reportedUserId = target.rows[0].reported_user_id;
  } else if (profileId) {
    const target = await query<{ user_id: string }>(`SELECT user_id FROM profiles WHERE id = $1`, [profileId]);
    if (!target.rowCount || target.rows[0].user_id === account.id) return NextResponse.json({ error: "That profile is not reportable." }, { status: 404 });
    reportedUserId = target.rows[0].user_id;
  } else {
    return NextResponse.json({ error: "Choose a profile, conversation, or message to report." }, { status: 400 });
  }

  const id = randomUUID();
  await query(`
    INSERT INTO safety_reports (id, reporter_user_id, reported_user_id, profile_id, conversation_id, message_id, category, details)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, account.id, reportedUserId, profileId, conversationId, messageId, category, details]);
  return NextResponse.json({ reported: true, reportId: id });
}
