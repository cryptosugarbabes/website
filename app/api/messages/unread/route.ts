import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { walletSession } from "@/lib/request-security";

export async function GET(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ unreadCount: 0, boostedUnreadCount: 0 });
  const account = await accountForSession(session);
  if (!account?.account_type) return NextResponse.json({ unreadCount: 0, boostedUnreadCount: 0 });
  const result = await query<{ unread_count: string; boosted_unread_count: string }>(`
    SELECT
      count(*)::text AS unread_count,
      count(*) FILTER (WHERE m.boosted_at >= now() - interval '24 hours')::text AS boosted_unread_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN profiles p ON p.id = c.creator_profile_id
    WHERE (c.customer_user_id = $1 OR p.user_id = $1)
      AND m.sender_user_id <> $1 AND m.status = 'SENT'
  `, [account.id]);
  return NextResponse.json({
    unreadCount: Number(result.rows[0]?.unread_count || 0),
    boostedUnreadCount: Number(result.rows[0]?.boosted_unread_count || 0)
  });
}

