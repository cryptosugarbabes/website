import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { decryptMessage, encryptMessage } from "@/lib/message-crypto";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { sendNewMessageEmail } from "@/lib/email-auth";
import { sendPrivateMessagePush } from "@/lib/push-notifications";

type MessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
  status: string;
  boost_amount_usdc: string;
  created_at: Date;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { reason?: string } | null;
  const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  if (reason.length < 5) return NextResponse.json({ error: "Enter a specific access reason." }, { status: 400 });
  const { id } = await context.params;
  try {
    const conversation = await query<{
      id: string; creator_user_id: string; creator_name: string; creator_email: string | null;
      creator_alerts_enabled: boolean; customer_user_id: string; customer_name: string;
      customer_email: string | null; customer_alerts_enabled: boolean;
    }>(`
      SELECT c.id, p.user_id AS creator_user_id, p.display_name AS creator_name, creator.email AS creator_email,
        c.customer_user_id, COALESCE(cp.display_name, 'Private admirer') AS customer_name,
        customer.email AS customer_email,
        EXISTS (SELECT 1 FROM admin_message_alert_settings a WHERE a.monitored_user_id = p.user_id AND a.enabled = TRUE) AS creator_alerts_enabled,
        EXISTS (SELECT 1 FROM admin_message_alert_settings a WHERE a.monitored_user_id = c.customer_user_id AND a.enabled = TRUE) AS customer_alerts_enabled
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      JOIN users creator ON creator.id = p.user_id
      JOIN users customer ON customer.id = c.customer_user_id
      LEFT JOIN customer_profiles cp ON cp.user_id = customer.id
      WHERE c.id = $1
    `, [id]);
    if (!conversation.rowCount) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await query<MessageRow>(`
      SELECT id, sender_user_id, body, body_ciphertext, body_iv, body_tag, status,
        boost_amount_usdc::text, created_at
      FROM messages WHERE conversation_id = $1 ORDER BY created_at
    `, [id]);
    await query(`
      INSERT INTO admin_conversation_views (id, conversation_id, actor_email, reason)
      VALUES ($1, $2, $3, $4)
    `, [randomUUID(), id, actor, reason]);
    const details = conversation.rows[0];
    return NextResponse.json({
      conversation: {
        id: details.id,
        creator: { id: details.creator_user_id, name: details.creator_name, email: details.creator_email, alertsEnabled: details.creator_alerts_enabled },
        customer: { id: details.customer_user_id, name: details.customer_name, email: details.customer_email, alertsEnabled: details.customer_alerts_enabled },
        accessReason: reason,
        accessedBy: actor
      },
      messages: messages.rows.map((message) => ({
        id: message.id,
        senderRole: message.sender_user_id === details.creator_user_id ? "CREATOR" : "CUSTOMER",
        senderName: message.sender_user_id === details.creator_user_id ? details.creator_name : details.customer_name,
        body: decryptMessage(message),
        status: message.status,
        boostAmountUsdc: Number(message.boost_amount_usdc),
        createdAt: message.created_at
      }))
    });
  } catch (error) {
    console.error("Admin transcript load failed", error);
    return NextResponse.json({ error: "The transcript could not be opened." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { senderUserId?: string; body?: string; reason?: string } | null;
  const senderUserId = typeof input?.senderUserId === "string" ? input.senderUserId : "";
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 800) : "";
  const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  if (!senderUserId || !body) return NextResponse.json({ error: "Choose a monitored account and write a reply." }, { status: 400 });
  if (reason.length < 5) return NextResponse.json({ error: "A specific audited access reason is required." }, { status: 400 });
  const { id } = await context.params;

  try {
    const result = await transaction(async (client) => {
      const conversation = await client.query<{
        id: string; creator_profile_id: string; creator_user_id: string; creator_name: string; creator_status: string;
        customer_user_id: string; customer_name: string; customer_status: string;
      }>(`
        SELECT c.id, c.creator_profile_id, p.user_id AS creator_user_id, p.display_name AS creator_name,
          creator.status AS creator_status, c.customer_user_id,
          COALESCE(cp.display_name, 'Private admirer') AS customer_name, customer.status AS customer_status
        FROM conversations c
        JOIN profiles p ON p.id = c.creator_profile_id
        JOIN users creator ON creator.id = p.user_id
        JOIN users customer ON customer.id = c.customer_user_id
        LEFT JOIN customer_profiles cp ON cp.user_id = customer.id
        WHERE c.id = $1
        FOR UPDATE OF c
      `, [id]);
      const target = conversation.rows[0];
      if (!target) throw new Error("CONVERSATION_NOT_FOUND");
      if (![target.creator_user_id, target.customer_user_id].includes(senderUserId)) throw new Error("SENDER_NOT_FOUND");
      const senderStatus = senderUserId === target.creator_user_id ? target.creator_status : target.customer_status;
      if (senderStatus !== "ACTIVE") throw new Error("SENDER_UNAVAILABLE");
      const enabled = await client.query(`
        SELECT 1 FROM admin_message_alert_settings
        WHERE monitored_user_id = $1 AND enabled = TRUE
      `, [senderUserId]);
      if (!enabled.rowCount) throw new Error("ALERTS_DISABLED");

      const counterpartUserId = senderUserId === target.creator_user_id ? target.customer_user_id : target.creator_user_id;
      const blocked = await client.query(`
        SELECT 1 FROM user_blocks
        WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
           OR (blocker_user_id = $2 AND blocked_user_id = $1)
        LIMIT 1
      `, [senderUserId, counterpartUserId]);
      if (blocked.rowCount) throw new Error("CONVERSATION_BLOCKED");

      const counterpart = await client.query<{ email: string | null }>(`
        SELECT CASE WHEN email_verified_at IS NOT NULL THEN email ELSE NULL END AS email
        FROM users WHERE id = $1 AND status = 'ACTIVE'
      `, [counterpartUserId]);
      if (!counterpart.rowCount) throw new Error("COUNTERPART_UNAVAILABLE");
      const unread = await client.query<{ should_notify: boolean }>(`
        SELECT NOT EXISTS (
          SELECT 1 FROM messages
          WHERE conversation_id = $1 AND sender_user_id = $2 AND status = 'SENT'
        ) AS should_notify
      `, [id, senderUserId]);

      const encrypted = encryptMessage(body);
      const messageId = randomUUID();
      await client.query(`
        INSERT INTO messages (id, conversation_id, sender_user_id, body, body_ciphertext, body_iv, body_tag, body_hash)
        VALUES ($1, $2, $3, '[encrypted]', $4, $5, $6, $7)
      `, [messageId, id, senderUserId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.hash]);
      await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [id]);
      await client.query(`
        UPDATE profiles
        SET messages_sent = messages_sent + CASE WHEN user_id = $1 THEN 1 ELSE 0 END,
            messages_received = messages_received + CASE WHEN user_id <> $1 THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = $2
      `, [senderUserId, target.creator_profile_id]);
      await client.query(`
        INSERT INTO admin_conversation_replies
          (id, conversation_id, message_id, sender_user_id, actor_email, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), id, messageId, senderUserId, actor, reason]);

      const senderIsCreator = senderUserId === target.creator_user_id;
      return {
        message: {
          id: messageId,
          senderRole: senderIsCreator ? "CREATOR" : "CUSTOMER",
          senderName: senderIsCreator ? target.creator_name : target.customer_name,
          body,
          status: "SENT",
          boostAmountUsdc: 0,
          createdAt: new Date()
        },
        counterpartEmail: counterpart.rows[0].email,
        counterpartUserId,
        shouldNotify: Boolean(unread.rows[0]?.should_notify),
        senderName: senderIsCreator ? target.creator_name : target.customer_name
      };
    });

    if (result.shouldNotify && result.counterpartEmail) {
      try {
        await sendNewMessageEmail(result.counterpartEmail, result.senderName);
      } catch (error) {
        console.error("Admin reply email alert could not be sent", error);
      }
    }
    if (result.shouldNotify) {
      try {
        await sendPrivateMessagePush(result.counterpartUserId);
      } catch (error) {
        console.error("Admin reply push alert could not be sent", error);
      }
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CONVERSATION_NOT_FOUND") return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (["SENDER_NOT_FOUND", "SENDER_UNAVAILABLE", "COUNTERPART_UNAVAILABLE"].includes(message)) {
      return NextResponse.json({ error: "That account is not available for this conversation." }, { status: 409 });
    }
    if (message === "ALERTS_DISABLED") return NextResponse.json({ error: "Enable alerts for that account before replying as it." }, { status: 403 });
    if (message === "CONVERSATION_BLOCKED") return NextResponse.json({ error: "Messaging is blocked between these accounts." }, { status: 403 });
    console.error("Admin conversation reply failed", error);
    return NextResponse.json({ error: "The administrator reply could not be sent." }, { status: 503 });
  }
}
