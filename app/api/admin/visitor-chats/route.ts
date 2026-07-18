import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { decryptMessage, encryptMessage } from "@/lib/message-crypto";
import { requestHasTrustedOrigin } from "@/lib/request-security";

type VisitorAdminMessageRow = {
  id: string;
  sender: "VISITOR" | "ADMIN";
  body: string;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
  admin_actor: string | null;
  created_at: Date;
};

function mapMessage(message: VisitorAdminMessageRow) {
  return {
    id: message.id,
    sender: message.sender,
    body: decryptMessage(message),
    adminActor: message.admin_actor,
    createdAt: message.created_at
  };
}

export async function GET(request: NextRequest) {
  if (!adminIdentity(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  const archived = request.nextUrl.searchParams.get("view") === "archive";
  try {
    const [sessions, counts] = await Promise.all([query<{
      id: string; status: string; page_path: string; created_at: Date; last_seen_at: Date;
      visitor_email: string | null; archived_at: Date | null;
      member_user_id: string | null; member_email: string | null; member_account_type: string | null; member_display_name: string | null;
      message_count: string; visitor_message_count: string;
    }>(`
      SELECT s.id, s.status, s.page_path, s.created_at, s.last_seen_at,
        s.visitor_email, s.archived_at,
        s.member_user_id, u.email AS member_email, u.account_type AS member_account_type,
        COALESCE(p.display_name, cp.display_name) AS member_display_name,
        count(m.id)::text AS message_count,
        count(m.id) FILTER (WHERE m.sender = 'VISITOR')::text AS visitor_message_count
      FROM visitor_chat_sessions s
      LEFT JOIN users u ON u.id = s.member_user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN visitor_chat_messages m ON m.session_id = s.id
      WHERE ($1::boolean AND s.archived_at IS NOT NULL)
         OR (NOT ($1::boolean) AND s.archived_at IS NULL)
      GROUP BY s.id, u.email, u.account_type, p.display_name, cp.display_name
      ORDER BY s.last_seen_at DESC
      LIMIT 250
    `, [archived]), query<{ inbox_count: string; archive_count: string }>(`
      SELECT
        count(*) FILTER (WHERE archived_at IS NULL)::text AS inbox_count,
        count(*) FILTER (WHERE archived_at IS NOT NULL)::text AS archive_count
      FROM visitor_chat_sessions
    `)]);
    return NextResponse.json({
      counts: {
        inbox: Number(counts.rows[0]?.inbox_count || 0),
        archive: Number(counts.rows[0]?.archive_count || 0)
      },
      sessions: sessions.rows.map((session) => ({
        id: session.id,
        shortId: session.id.slice(0, 8),
        status: session.status,
        pagePath: session.page_path,
        email: session.visitor_email,
        archivedAt: session.archived_at,
        loggedIn: Boolean(session.member_user_id),
        memberName: session.member_display_name,
        memberEmail: session.member_email,
        memberAccountType: session.member_account_type,
        messageCount: Number(session.message_count),
        visitorMessageCount: Number(session.visitor_message_count),
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at
      }))
    });
  } catch (error) {
    console.error("Admin visitor chat list failed", error);
    return NextResponse.json({ error: "Pop-up chats could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { action?: string; sessionId?: string; reason?: string; body?: string } | null;
  const sessionId = typeof input?.sessionId === "string" ? input.sessionId : "";
  if (!sessionId) return NextResponse.json({ error: "Choose a pop-up chat." }, { status: 400 });

  if (input?.action === "OPEN") {
    const reason = "Opened from the Pop-up Chat dashboard";
    try {
      const session = await query<{ id: string; status: string; page_path: string; visitor_email: string | null; archived_at: Date | null; member_user_id: string | null; member_email: string | null; member_account_type: string | null; member_display_name: string | null; created_at: Date; last_seen_at: Date }>(`
        SELECT s.id, s.status, s.page_path, s.visitor_email, s.archived_at,
          s.member_user_id, u.email AS member_email, u.account_type AS member_account_type,
          COALESCE(p.display_name, cp.display_name) AS member_display_name,
          s.created_at, s.last_seen_at
        FROM visitor_chat_sessions s
        LEFT JOIN users u ON u.id = s.member_user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE s.id = $1
      `, [sessionId]);
      if (!session.rowCount) return NextResponse.json({ error: "Pop-up chat not found." }, { status: 404 });
      const messages = await query<VisitorAdminMessageRow>(`
        SELECT id, sender, body, body_ciphertext, body_iv, body_tag, admin_actor, created_at
        FROM visitor_chat_messages WHERE session_id = $1 ORDER BY created_at
      `, [sessionId]);
      await query(`
        INSERT INTO visitor_chat_admin_views (id, visitor_session_id, actor_email, reason)
        VALUES ($1, $2, $3, $4)
      `, [randomUUID(), sessionId, actor, reason]);
      return NextResponse.json({
        session: {
          id: session.rows[0].id,
          status: session.rows[0].status,
          pagePath: session.rows[0].page_path,
          email: session.rows[0].visitor_email,
          archivedAt: session.rows[0].archived_at,
          loggedIn: Boolean(session.rows[0].member_user_id),
          memberName: session.rows[0].member_display_name,
          memberEmail: session.rows[0].member_email,
          memberAccountType: session.rows[0].member_account_type,
          createdAt: session.rows[0].created_at,
          lastSeenAt: session.rows[0].last_seen_at,
          shortId: sessionId.slice(0, 8),
          accessReason: reason,
          accessedBy: actor
        },
        messages: messages.rows.map(mapMessage)
      });
    } catch (error) {
      console.error("Admin visitor chat open failed", error);
      return NextResponse.json({ error: "The pop-up chat could not be opened." }, { status: 503 });
    }
  }

  if (input?.action === "ARCHIVE" || input?.action === "RESTORE") {
    const archive = input.action === "ARCHIVE";
    try {
      const updated = await transaction(async (client) => {
        const session = await client.query<{ id: string }>(`
          UPDATE visitor_chat_sessions
          SET archived_at = CASE WHEN $2::boolean THEN now() ELSE NULL END,
              archived_by = CASE WHEN $2::boolean THEN $3 ELSE NULL END
          WHERE id = $1
          RETURNING id
        `, [sessionId, archive, actor]);
        if (!session.rowCount) return false;
        await client.query(`
          INSERT INTO visitor_chat_archive_events
            (id, visitor_session_id, action, actor_email)
          VALUES ($1, $2, $3, $4)
        `, [randomUUID(), sessionId, archive ? "ARCHIVE" : "RESTORE", actor]);
        return true;
      });
      if (!updated) return NextResponse.json({ error: "Pop-up chat not found." }, { status: 404 });
      return NextResponse.json({ ok: true, archived: archive });
    } catch (error) {
      console.error("Admin visitor chat archive update failed", error);
      return NextResponse.json({ error: "The pop-up chat could not be moved." }, { status: 503 });
    }
  }

  if (input?.action === "REPLY") {
    const body = typeof input.body === "string" ? input.body.trim().slice(0, 800) : "";
    if (!body) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
    try {
      const message = await transaction(async (client) => {
        const session = await client.query(`
          SELECT 1 FROM visitor_chat_sessions WHERE id = $1 AND status = 'OPEN' FOR UPDATE
        `, [sessionId]);
        if (!session.rowCount) throw new Error("VISITOR_CHAT_NOT_FOUND");
        const encrypted = encryptMessage(body);
        const messageId = randomUUID();
        await client.query(`
          INSERT INTO visitor_chat_messages
            (id, session_id, sender, body, body_ciphertext, body_iv, body_tag, admin_actor)
          VALUES ($1, $2, 'ADMIN', '[encrypted]', $3, $4, $5, $6)
        `, [messageId, sessionId, encrypted.ciphertext, encrypted.iv, encrypted.tag, actor]);
        await client.query(`UPDATE visitor_chat_sessions SET last_seen_at = now() WHERE id = $1`, [sessionId]);
        return { id: messageId, sender: "ADMIN", body, adminActor: actor, createdAt: new Date() };
      });
      return NextResponse.json({ ok: true, message });
    } catch (error) {
      if (error instanceof Error && error.message === "VISITOR_CHAT_NOT_FOUND") {
        return NextResponse.json({ error: "This pop-up chat is closed or unavailable." }, { status: 404 });
      }
      console.error("Admin visitor chat reply failed", error);
      return NextResponse.json({ error: "The visitor reply could not be sent." }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Unsupported pop-up chat action." }, { status: 400 });
}
