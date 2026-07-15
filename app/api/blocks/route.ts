import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

async function counterpart(accountId: string, conversationId: string) {
  const result = await query<{ counterpart_id: string }>(`
    SELECT CASE WHEN c.customer_user_id = $1 THEN p.user_id ELSE c.customer_user_id END AS counterpart_id
    FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
    WHERE c.id = $2 AND (c.customer_user_id = $1 OR p.user_id = $1)
  `, [accountId, conversationId]);
  return result.rows[0]?.counterpart_id || null;
}

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { conversationId?: string; blocked?: boolean } | null;
  if (!input?.conversationId || typeof input.blocked !== "boolean") return NextResponse.json({ error: "Choose a conversation and block action." }, { status: 400 });
  const account = await accountForSession(session);
  if (!account?.account_type) return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });
  const other = await counterpart(account.id, input.conversationId);
  if (!other) return NextResponse.json({ error: "That conversation is not available." }, { status: 404 });
  if (input.blocked) {
    await query(`INSERT INTO user_blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [account.id, other]);
  } else {
    await query(`DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`, [account.id, other]);
  }
  return NextResponse.json({ blocked: input.blocked });
}
