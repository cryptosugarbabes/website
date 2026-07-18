import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";
import { decryptMessage, encryptMessage, messageHash } from "@/lib/message-crypto";
import { sendAdminMonitoredMessageEmail, sendNewMessageEmail } from "@/lib/email-auth";
import { FREE_UNANSWERED_MESSAGES, MESSAGE_UNLOCK_DAYS, unansweredMessageState } from "@/lib/message-limits";
import { sendTelegramMessageAlert, telegramBridgeIsConfigured } from "@/lib/telegram-chat";
import { reportApplicationError } from "@/lib/observability";

type ConversationRow = {
  id: string;
  creator_profile_id: string;
  creator_name: string;
  creator_photo_id: string | null;
  customer_name: string;
  customer_user_id: string;
  creator_user_id: string;
  blocked_by_me: boolean;
  blocked_me: boolean;
  priority_boost_usdc: string;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
  status: string;
  boost_amount_usdc: string;
  boosted_at: Date | null;
  created_at: Date;
};

type MessageUnlockRow = {
  conversation_id: string;
  has_unused: boolean;
  last_unlock_at: Date;
};

class MessageGateError extends Error {
  constructor(
    public code: "UNANSWERED_WARNING" | "REPLY_REQUIRED",
    public conversationId: string,
    public consecutiveMessages: number,
    public hasPaidUnlock = false,
    public canPurchaseUnlock = false,
    public nextUnlockAt: Date | null = null
  ) { super(code); }
}

function consecutiveMessagesFromSender(messages: MessageRow[], senderUserId: string) {
  let count = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].status === "MODERATED") continue;
    if (messages[index].sender_user_id !== senderUserId) break;
    count += 1;
  }
  return count;
}

export async function GET(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ accountType: null, conversations: [] });
  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ accountType: null, conversations: [] });

    const conversations = await query<ConversationRow>(`
      SELECT c.id, c.creator_profile_id, p.display_name AS creator_name,
        (SELECT m.id FROM profile_media m WHERE m.profile_id = p.id AND m.is_approved = TRUE ORDER BY m.sort_order, m.created_at LIMIT 1) AS creator_photo_id,
        COALESCE(cp.display_name, 'Private admirer') AS customer_name,
        c.customer_user_id, p.user_id AS creator_user_id,
        EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE b.blocker_user_id = $1
            AND b.blocked_user_id = CASE WHEN c.customer_user_id = $1 THEN p.user_id ELSE c.customer_user_id END
        ) AS blocked_by_me,
        EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE b.blocked_user_id = $1
            AND b.blocker_user_id = CASE WHEN c.customer_user_id = $1 THEN p.user_id ELSE c.customer_user_id END
        ) AS blocked_me,
        COALESCE((
          SELECT MAX(msg.boost_amount_usdc) FROM messages msg
          WHERE msg.conversation_id = c.id AND msg.sender_user_id <> $1
            AND msg.status = 'SENT' AND msg.boosted_at >= now() - interval '24 hours'
        ), 0)::text AS priority_boost_usdc,
        c.updated_at
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      LEFT JOIN customer_profiles cp ON cp.user_id = c.customer_user_id
      WHERE c.customer_user_id = $1 OR p.user_id = $1
      ORDER BY COALESCE((
        SELECT MAX(msg.boost_amount_usdc) FROM messages msg
        WHERE msg.conversation_id = c.id AND msg.sender_user_id <> $1
          AND msg.status = 'SENT' AND msg.boosted_at >= now() - interval '24 hours'
      ), 0) DESC, c.updated_at DESC
    `, [account.id]);

    const ids = conversations.rows.map((row) => row.id);
    const messages = ids.length ? await query<MessageRow>(`
      SELECT id, conversation_id, sender_user_id, body, body_ciphertext, body_iv, body_tag, status,
        boost_amount_usdc::text, boosted_at, created_at
      FROM messages
      WHERE conversation_id = ANY($1::uuid[])
      ORDER BY created_at
    `, [ids]) : { rows: [] as MessageRow[] };

    const unlocks = ids.length ? await query<MessageUnlockRow>(`
      SELECT conversation_id, bool_or(used_message_id IS NULL) AS has_unused,
        max(created_at) AS last_unlock_at
      FROM message_unlocks
      WHERE conversation_id = ANY($1::uuid[]) AND sender_user_id = $2
        AND created_at >= now() - interval '${MESSAGE_UNLOCK_DAYS} days'
      GROUP BY conversation_id
    `, [ids, account.id]) : { rows: [] as MessageUnlockRow[] };

    if (ids.length) {
      await query(`
        UPDATE messages SET status = 'READ', read_at = COALESCE(read_at, now())
        WHERE conversation_id = ANY($1::uuid[]) AND sender_user_id <> $2 AND status = 'SENT'
      `, [ids, account.id]);
    }

    return NextResponse.json({
      accountType: account.account_type,
      conversations: conversations.rows.map((conversation) => {
        const conversationMessages = messages.rows.filter((message) => message.conversation_id === conversation.id);
        const consecutiveMessages = consecutiveMessagesFromSender(conversationMessages, account.id);
        const recentUnlock = unlocks.rows.find((unlock) => unlock.conversation_id === conversation.id);
        const messageGate = unansweredMessageState(consecutiveMessages, Boolean(recentUnlock?.has_unused));
        const nextUnlockAt = recentUnlock?.last_unlock_at
          ? new Date(recentUnlock.last_unlock_at.getTime() + MESSAGE_UNLOCK_DAYS * 24 * 60 * 60 * 1000)
          : null;
        return {
        id: conversation.id,
        profileId: conversation.creator_profile_id,
        counterpartName: account.account_type === "CREATOR" ? conversation.customer_name : conversation.creator_name,
        creatorName: conversation.creator_name,
        imageUrl: conversation.creator_photo_id ? `/api/media/${conversation.creator_photo_id}` : null,
        blockedByMe: conversation.blocked_by_me,
        blockedMe: conversation.blocked_me,
        priorityBoostUsdc: Number(conversation.priority_boost_usdc),
        consecutiveMessages,
        messageGate,
        hasPaidUnlock: Boolean(recentUnlock?.has_unused),
        canPurchaseUnlock: !recentUnlock,
        nextUnlockAt,
        updatedAt: conversation.updated_at,
        messages: conversationMessages.map((message) => ({
          id: message.id,
          body: decryptMessage(message),
          mine: message.sender_user_id === account.id,
          status: message.status,
          boostAmountUsdc: Number(message.boost_amount_usdc),
          boostedAt: message.boosted_at,
          createdAt: message.created_at
        }))
      }})
    });
  } catch (error) {
    console.error("Message load failed", error);
    return NextResponse.json({ error: "Messages could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as {
    profileId?: string;
    conversationId?: string;
    body?: string;
    acknowledgeUnansweredWarning?: boolean;
    usePaidUnlock?: boolean;
  } | null;
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 800) : "";
  if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  try {
    const encrypted = encryptMessage(body);
    const result = await transaction(async (client) => {
      const account = await accountForSession(session);
      if (!account?.account_type) throw new Error("ACCOUNT_REQUIRED");
      let conversationId = input?.conversationId || "";
      let creatorProfileId = "";
      let counterpartUserId = "";

      if (account.account_type === "CUSTOMER") {
        if (conversationId) {
          const conversation = await client.query<{ creator_profile_id: string; creator_user_id: string }>(`
            SELECT c.creator_profile_id, p.user_id AS creator_user_id
            FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
            WHERE c.id = $1 AND c.customer_user_id = $2
            FOR UPDATE OF c
          `, [conversationId, account.id]);
          if (!conversation.rowCount) throw new Error("CONVERSATION_NOT_FOUND");
          creatorProfileId = conversation.rows[0].creator_profile_id;
          counterpartUserId = conversation.rows[0].creator_user_id;
        } else {
          if (!input?.profileId) throw new Error("PROFILE_REQUIRED");
          const creator = await client.query<{ id: string; user_id: string }>(`
            SELECT p.id, p.user_id FROM profiles p JOIN users u ON u.id = p.user_id
            WHERE p.id = $1 AND p.review_status = 'APPROVED' AND u.account_type = 'CREATOR' AND u.status = 'ACTIVE'
          `, [input.profileId]);
          if (!creator.rowCount || creator.rows[0].user_id === account.id) throw new Error("PROFILE_NOT_FOUND");
          creatorProfileId = creator.rows[0].id;
          counterpartUserId = creator.rows[0].user_id;
          const existing = await client.query<{ id: string }>(`
            SELECT id FROM conversations WHERE customer_user_id = $1 AND creator_profile_id = $2
          `, [account.id, creatorProfileId]);
          if (!existing.rowCount) {
            const recentConversations = await client.query<{ count: string }>(`
              SELECT count(*)::text FROM conversations
              WHERE customer_user_id = $1 AND created_at >= now() - interval '24 hours'
            `, [account.id]);
            if (Number(recentConversations.rows[0].count) >= 10) throw new Error("CONVERSATION_LIMIT");
          }
          const conversation = await client.query<{ id: string }>(`
            INSERT INTO conversations (id, customer_user_id, creator_profile_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (customer_user_id, creator_profile_id)
            DO UPDATE SET updated_at = now()
            RETURNING id
          `, [randomUUID(), account.id, creatorProfileId]);
          conversationId = conversation.rows[0].id;
        }
      } else {
        if (!conversationId) throw new Error("CONVERSATION_REQUIRED");
        const conversation = await client.query<{ creator_profile_id: string; customer_user_id: string }>(`
          SELECT c.creator_profile_id, c.customer_user_id
          FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
          WHERE c.id = $1 AND p.user_id = $2
          FOR UPDATE OF c
        `, [conversationId, account.id]);
        if (!conversation.rowCount) throw new Error("CONVERSATION_NOT_FOUND");
        creatorProfileId = conversation.rows[0].creator_profile_id;
        counterpartUserId = conversation.rows[0].customer_user_id;
      }

      const counterpart = await client.query<{ status: string; email: string | null; display_name: string | null }>(`
        SELECT u.status, CASE WHEN u.email_verified_at IS NOT NULL THEN u.email ELSE NULL END AS email,
          COALESCE(p.display_name, cp.display_name) AS display_name
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
      `, [counterpartUserId]);
      if (!counterpart.rowCount || counterpart.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_UNAVAILABLE");

      const blocked = await client.query(`
        SELECT 1 FROM user_blocks
        WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
           OR (blocker_user_id = $2 AND blocked_user_id = $1)
        LIMIT 1
      `, [account.id, counterpartUserId]);
      if (blocked.rowCount) throw new Error("CONVERSATION_BLOCKED");

      const unanswered = await client.query<{ count: string }>(`
        SELECT count(*)::text
        FROM messages m
        WHERE m.conversation_id = $1 AND m.sender_user_id = $2 AND m.status <> 'MODERATED'
          AND m.created_at > COALESCE((
            SELECT max(reply.created_at) FROM messages reply
            WHERE reply.conversation_id = $1 AND reply.sender_user_id = $3
              AND reply.status <> 'MODERATED'
          ), to_timestamp(0))
      `, [conversationId, account.id, counterpartUserId]);
      const consecutiveMessages = Number(unanswered.rows[0]?.count || 0);
      if (consecutiveMessages === FREE_UNANSWERED_MESSAGES - 1 && !input?.acknowledgeUnansweredWarning) {
        throw new MessageGateError("UNANSWERED_WARNING", conversationId, consecutiveMessages);
      }

      let paidUnlockId: string | null = null;
      if (consecutiveMessages >= FREE_UNANSWERED_MESSAGES) {
        const recentUnlock = await client.query<{ id: string; used_message_id: string | null; created_at: Date }>(`
          SELECT id, used_message_id, created_at
          FROM message_unlocks
          WHERE conversation_id = $1 AND sender_user_id = $2
            AND created_at >= now() - interval '${MESSAGE_UNLOCK_DAYS} days'
          ORDER BY created_at DESC LIMIT 1
          FOR UPDATE
        `, [conversationId, account.id]);
        const unlock = recentUnlock.rows[0];
        if (input?.usePaidUnlock && unlock && !unlock.used_message_id) paidUnlockId = unlock.id;
        else {
          const nextUnlockAt = unlock ? new Date(unlock.created_at.getTime() + MESSAGE_UNLOCK_DAYS * 24 * 60 * 60 * 1000) : null;
          throw new MessageGateError("REPLY_REQUIRED", conversationId, consecutiveMessages, Boolean(unlock && !unlock.used_message_id), !unlock, nextUnlockAt);
        }
      }

      const messageRate = await client.query<{ recent_minute: string; recent_hour: string; repeated: string }>(`
        SELECT
          count(*) FILTER (WHERE created_at >= now() - interval '1 minute')::text AS recent_minute,
          count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::text AS recent_hour,
          count(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND (body_hash = $2 OR (body_hash IS NULL AND lower(body) = lower($3))))::text AS repeated
        FROM messages WHERE sender_user_id = $1
      `, [account.id, messageHash(body), body]);
      const counts = messageRate.rows[0];
      if (Number(counts.recent_minute) >= 6 || Number(counts.recent_hour) >= 60) throw new Error("MESSAGE_LIMIT");
      if (Number(counts.repeated) >= 2 || (body.match(/https?:\/\//gi) || []).length > 2) throw new Error("SPAM_DETECTED");

      const unread = await client.query<{ should_notify: boolean }>(`
        SELECT NOT EXISTS (
          SELECT 1 FROM messages
          WHERE conversation_id = $1 AND sender_user_id = $2 AND status = 'SENT'
        ) AS should_notify
      `, [conversationId, account.id]);
      const sender = await client.query<{ display_name: string | null }>(`
        SELECT COALESCE(p.display_name, cp.display_name) AS display_name
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
      `, [account.id]);

      const id = randomUUID();
      await client.query(`
        INSERT INTO messages (id, conversation_id, sender_user_id, body, body_ciphertext, body_iv, body_tag, body_hash)
        VALUES ($1, $2, $3, '[encrypted]', $4, $5, $6, $7)
      `, [id, conversationId, account.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.hash]);
      if (paidUnlockId) {
        await client.query(`
          UPDATE message_unlocks SET used_message_id = $1, used_at = now()
          WHERE id = $2 AND used_message_id IS NULL
        `, [id, paidUnlockId]);
      }
      await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
      await client.query(`
        UPDATE profiles
        SET messages_sent = messages_sent + CASE WHEN user_id = $1 THEN 1 ELSE 0 END,
            messages_received = messages_received + CASE WHEN user_id <> $1 THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = $2
      `, [account.id, creatorProfileId]);

      const alert = await client.query<{ enabled: boolean }>(`
        SELECT enabled FROM admin_message_alert_settings
        WHERE monitored_user_id = $1 AND enabled = TRUE
      `, [counterpartUserId]);
      return {
        id,
        conversationId,
        recipientUserId: counterpartUserId,
        recipientEmail: counterpart.rows[0].email,
        recipientName: counterpart.rows[0].display_name || "A monitored member",
        senderName: sender.rows[0]?.display_name || "A member",
        shouldNotify: Boolean(unread.rows[0]?.should_notify),
        notifyAdmin: true,
        notifyTelegram: Boolean(alert.rowCount) && telegramBridgeIsConfigured(),
        messageNotice: consecutiveMessages === FREE_UNANSWERED_MESSAGES - 1
          ? "Your third unanswered message was sent. Please wait for a reply before sending another, or use the weekly paid-message option."
          : paidUnlockId
            ? "Your weekly paid-message unlock was used. Further messages now require a reply."
            : null
      };
    });
    if (result.shouldNotify && result.recipientEmail) {
      try {
        await sendNewMessageEmail(result.recipientEmail, result.senderName);
      } catch (error) {
        console.error("New message email could not be sent", error);
      }
    }
    if (result.notifyAdmin) {
      try {
        await sendAdminMonitoredMessageEmail({
          recipientName: result.recipientName,
          recipientUserId: result.recipientUserId,
          senderName: result.senderName,
          conversationId: result.conversationId
        });
      } catch (error) {
        console.error("Administrator monitored-message alert could not be sent", error);
      }
    }
    if (result.notifyTelegram) {
      try {
        await sendTelegramMessageAlert({
          recipientUserId: result.recipientUserId,
          conversationId: result.conversationId,
          sourceMessageId: result.id,
          senderName: result.senderName,
          body
        });
      } catch (error) {
        console.error("Telegram website-chat alert could not be sent", error);
      }
    }
    return NextResponse.json({ id: result.id, conversationId: result.conversationId, body, messageNotice: result.messageNotice, createdAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof MessageGateError) {
      const warning = error.code === "UNANSWERED_WARNING";
      return NextResponse.json({
        code: error.code,
        conversationId: error.conversationId,
        consecutiveMessages: error.consecutiveMessages,
        hasPaidUnlock: error.hasPaidUnlock,
        canPurchaseUnlock: error.canPurchaseUnlock,
        nextUnlockAt: error.nextUnlockAt,
        unlockAmountUsdc: 10,
        error: warning
          ? "You have sent two messages without a reply. Sending a third is allowed, but please be considerate—after that you must wait for a reply."
          : error.hasPaidUnlock
            ? "You have sent three messages without a reply. Use your paid-message unlock or wait for a reply."
            : error.canPurchaseUnlock
              ? "You have sent three messages without a reply. Wait for a reply, or unlock one additional message for 10 USDC."
              : "You have sent three messages without a reply and used this week's paid message. Please wait for a reply."
      }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "ACCOUNT_REQUIRED") return NextResponse.json({ error: "Choose whether this is a creator or customer account first." }, { status: 409 });
    if (["PROFILE_REQUIRED", "PROFILE_NOT_FOUND"].includes(message)) return NextResponse.json({ error: "That creator profile is not available." }, { status: 404 });
    if (["CONVERSATION_REQUIRED", "CONVERSATION_NOT_FOUND"].includes(message)) return NextResponse.json({ error: "That conversation is not available." }, { status: 404 });
    if (message === "CONVERSATION_BLOCKED") return NextResponse.json({ error: "Messaging is unavailable because one of these accounts has blocked the other." }, { status: 403 });
    if (message === "ACCOUNT_UNAVAILABLE") return NextResponse.json({ error: "That account is not currently available for messaging." }, { status: 403 });
    if (message === "CONVERSATION_LIMIT") return NextResponse.json({ error: "You have reached the new-conversation limit for today. Try again later." }, { status: 429 });
    if (message === "MESSAGE_LIMIT") return NextResponse.json({ error: "You are sending messages too quickly. Pause before trying again." }, { status: 429 });
    if (message === "SPAM_DETECTED") return NextResponse.json({ error: "That message looks repetitive or contains too many links." }, { status: 422 });
    await reportApplicationError("messages:send", error);
    console.error("Message send failed", error);
    return NextResponse.json({ error: "Your message could not be sent." }, { status: 503 });
  }
}
