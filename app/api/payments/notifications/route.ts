import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { reportApplicationError } from "@/lib/observability";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

async function notificationAccount(request: NextRequest) {
  const session = authenticatedSession(request);
  return session ? accountForSession(session) : null;
}

export async function GET(request: NextRequest) {
  try {
    const account = await notificationAccount(request);
    if (!account) return NextResponse.json({ unseenCount: 0 });
    const result = await query<{ unseen_count: string }>(`
      SELECT count(*)::text AS unseen_count
      FROM support_events se
      JOIN profiles p ON p.id = se.creator_profile_id
      WHERE p.user_id = $1 AND se.recipient_seen_at IS NULL
    `, [account.id]);
    return NextResponse.json(
      { unseenCount: Number(result.rows[0]?.unseen_count || 0) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    await reportApplicationError("payments:notifications:get", error);
    return NextResponse.json({ unseenCount: 0, error: "Payment notifications are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  try {
    const account = await notificationAccount(request);
    if (!account) return NextResponse.json({ error: "Sign in to update payment notifications." }, { status: 401 });
    await query(`
      UPDATE support_events se
      SET recipient_seen_at = now()
      FROM profiles p
      WHERE p.id = se.creator_profile_id
        AND p.user_id = $1
        AND se.recipient_seen_at IS NULL
    `, [account.id]);
    return NextResponse.json({ unseenCount: 0 });
  } catch (error) {
    await reportApplicationError("payments:notifications:seen", error);
    return NextResponse.json({ error: "Payment notifications could not be updated." }, { status: 503 });
  }
}
