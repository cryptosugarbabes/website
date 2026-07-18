import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { decryptMessage, encryptMessage } from "@/lib/message-crypto";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { takeRateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sendAdminVisitorChatEmail } from "@/lib/email-auth";
import { sendTelegramVisitorAlert } from "@/lib/telegram-chat";
import {
  createVisitorChatToken,
  visitorAddressHash,
  visitorChatCookieOptions,
  visitorChatSessionId,
  VISITOR_CHAT_COOKIE
} from "@/lib/visitor-chat";

type VisitorMessageRow = {
  id: string;
  sender: "VISITOR" | "ADMIN";
  body: string;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
  created_at: Date;
};

function safePagePath(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.replace(/[\r\n]+/g, " ").trim().slice(0, 500);
  return path.startsWith("/") ? path : "/";
}

async function visitorMessages(sessionId: string) {
  const messages = await query<VisitorMessageRow>(`
    SELECT id, sender, body, body_ciphertext, body_iv, body_tag, created_at
    FROM visitor_chat_messages WHERE session_id = $1 ORDER BY created_at
  `, [sessionId]);
  return messages.rows.map((message) => ({
    id: message.id,
    body: decryptMessage(message),
    mine: message.sender === "VISITOR",
    createdAt: message.created_at
  }));
}

export async function GET(request: NextRequest) {
  const sessionId = visitorChatSessionId(request);
  if (!sessionId) return NextResponse.json({ session: null, messages: [] });
  try {
    const session = await query<{ id: string; status: string; visitor_email: string | null }>(`
      UPDATE visitor_chat_sessions SET last_seen_at = now()
      WHERE id = $1 RETURNING id, status, visitor_email
    `, [sessionId]);
    if (!session.rowCount) return NextResponse.json({ session: null, messages: [] });
    return NextResponse.json({
      session: { id: sessionId.slice(0, 8), status: session.rows[0].status, email: session.rows[0].visitor_email },
      messages: await visitorMessages(sessionId)
    });
  } catch (error) {
    console.error("Visitor chat load failed", error);
    return NextResponse.json({ error: "Visitor chat is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { action?: string; pagePath?: string; body?: string; email?: string } | null;
  const action = input?.action;
  const pagePath = safePagePath(input?.pagePath);
  const addressHash = visitorAddressHash(request);

  if (action === "OPEN") {
    let sessionId = visitorChatSessionId(request);
    let setCookie = false;
    if (!sessionId) {
      const opening = await takeRateLimit(`visitor-chat-open:${addressHash}`, 6, 24 * 60 * 60 * 1000);
      if (!opening.allowed) return NextResponse.json({ error: "Visitor chat is unavailable for a while." }, { status: 429 });
      sessionId = randomUUID();
      setCookie = true;
    }
    try {
      const result = await transaction(async (client) => {
        const current = await client.query<{ id: string; presence_notified_at: Date | null; visitor_email: string | null }>(`
          SELECT id, presence_notified_at, visitor_email FROM visitor_chat_sessions WHERE id = $1 FOR UPDATE
        `, [sessionId]);
        const notifyPresence = !current.rows[0]?.presence_notified_at
          || current.rows[0].presence_notified_at.getTime() < Date.now() - 30 * 60 * 1000;
        if (!current.rowCount) {
          await client.query(`
            INSERT INTO visitor_chat_sessions
              (id, page_path, ip_hash, user_agent, presence_notified_at)
            VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END)
          `, [sessionId, pagePath, addressHash, request.headers.get("user-agent")?.slice(0, 500) || null, notifyPresence]);
        } else {
          await client.query(`
            UPDATE visitor_chat_sessions
            SET page_path = $2, last_seen_at = now(), status = 'OPEN',
                presence_notified_at = CASE WHEN $3 THEN now() ELSE presence_notified_at END
            WHERE id = $1
          `, [sessionId, pagePath, notifyPresence]);
        }
        return { notifyPresence, visitorEmail: current.rows[0]?.visitor_email || null };
      });
      if (result.notifyPresence) {
        const presenceLimit = await takeRateLimit(`visitor-chat-presence:${addressHash}`, 12, 24 * 60 * 60 * 1000);
        if (presenceLimit.allowed) {
          await Promise.allSettled([
            sendAdminVisitorChatEmail({ kind: "PRESENCE", sessionId, pagePath, visitorEmail: result.visitorEmail }),
            sendTelegramVisitorAlert({ sessionId, pagePath, visitorEmail: result.visitorEmail })
          ]);
        }
      }
      const response = NextResponse.json({
        session: { id: sessionId.slice(0, 8), status: "OPEN", email: result.visitorEmail },
        messages: await visitorMessages(sessionId)
      });
      if (setCookie) response.cookies.set(VISITOR_CHAT_COOKIE, createVisitorChatToken(sessionId), visitorChatCookieOptions);
      return response;
    } catch (error) {
      console.error("Visitor chat open failed", error);
      return NextResponse.json({ error: "Visitor chat is temporarily unavailable." }, { status: 503 });
    }
  }

  if (action === "EMAIL") {
    const sessionId = visitorChatSessionId(request);
    if (!sessionId) return NextResponse.json({ error: "Open the chat before saving an email address." }, { status: 409 });
    const email = normalizeEmail(input?.email);
    if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const limit = await takeRateLimit(`visitor-chat-email:${sessionId}`, 8, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "The email address was changed too many times." }, { status: 429 });
    try {
      const saved = await query<{ page_path: string }>(`
        UPDATE visitor_chat_sessions
        SET visitor_email = $2,
            visitor_email_updated_at = CASE WHEN visitor_email IS DISTINCT FROM $2 THEN now() ELSE visitor_email_updated_at END,
            last_seen_at = now()
        WHERE id = $1 AND status = 'OPEN'
        RETURNING page_path
      `, [sessionId, email]);
      if (!saved.rowCount) return NextResponse.json({ error: "This visitor chat is no longer available." }, { status: 404 });
      await sendAdminVisitorChatEmail({
        kind: "CONTACT",
        sessionId,
        pagePath: saved.rows[0].page_path,
        visitorEmail: email
      }).catch(() => undefined);
      return NextResponse.json({ email });
    } catch (error) {
      console.error("Visitor email save failed", error);
      return NextResponse.json({ error: "Your email address could not be saved." }, { status: 503 });
    }
  }

  if (action === "MESSAGE") {
    const sessionId = visitorChatSessionId(request);
    if (!sessionId) return NextResponse.json({ error: "Open the chat before sending a message." }, { status: 409 });
    const body = typeof input?.body === "string" ? input.body.trim().slice(0, 800) : "";
    if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
    if ((body.match(/https?:\/\//gi) || []).length > 2) return NextResponse.json({ error: "Please remove extra links." }, { status: 422 });
    const minute = await takeRateLimit(`visitor-chat-message-minute:${sessionId}`, 6, 60_000);
    const hour = await takeRateLimit(`visitor-chat-message-hour:${sessionId}`, 40, 60 * 60 * 1000);
    if (!minute.allowed || !hour.allowed) return NextResponse.json({ error: "Messages are being sent too quickly." }, { status: 429 });
    try {
      const encrypted = encryptMessage(body);
      const messageId = randomUUID();
      const session = await transaction(async (client) => {
        const current = await client.query<{ page_path: string; visitor_email: string | null; archived_at: Date | null }>(`
          SELECT page_path, visitor_email, archived_at
          FROM visitor_chat_sessions WHERE id = $1 AND status = 'OPEN' FOR UPDATE
        `, [sessionId]);
        if (!current.rowCount) throw new Error("VISITOR_SESSION_NOT_FOUND");
        await client.query(`
          INSERT INTO visitor_chat_messages
            (id, session_id, sender, body, body_ciphertext, body_iv, body_tag)
          VALUES ($1, $2, 'VISITOR', '[encrypted]', $3, $4, $5)
        `, [messageId, sessionId, encrypted.ciphertext, encrypted.iv, encrypted.tag]);
        await client.query(`
          UPDATE visitor_chat_sessions
          SET last_seen_at = now(), archived_at = NULL, archived_by = NULL
          WHERE id = $1
        `, [sessionId]);
        if (current.rows[0].archived_at) {
          await client.query(`
            INSERT INTO visitor_chat_archive_events (id, visitor_session_id, action)
            VALUES ($1, $2, 'AUTO_RESTORE')
          `, [randomUUID(), sessionId]);
        }
        return current.rows[0];
      });
      await Promise.allSettled([
        sendAdminVisitorChatEmail({ kind: "MESSAGE", sessionId, pagePath: session.page_path, visitorEmail: session.visitor_email }),
        sendTelegramVisitorAlert({ sessionId, sourceMessageId: messageId, pagePath: session.page_path, body, visitorEmail: session.visitor_email })
      ]);
      return NextResponse.json({
        message: { id: messageId, body, mine: true, createdAt: new Date().toISOString() }
      });
    } catch (error) {
      if (error instanceof Error && error.message === "VISITOR_SESSION_NOT_FOUND") {
        return NextResponse.json({ error: "This visitor chat is no longer available." }, { status: 404 });
      }
      console.error("Visitor message send failed", error);
      return NextResponse.json({ error: "Your message could not be sent." }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Unsupported visitor chat action." }, { status: 400 });
}
