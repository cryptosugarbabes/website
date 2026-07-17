import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { encryptMessage } from "@/lib/message-crypto";
import {
  handleTelegramAccessCommand,
  parseTelegramAccessCommand,
  parseTelegramReply,
  parseTelegramTextMessage,
  sendTelegramLockedNotice,
  sendTelegramReplyConfirmation,
  sendTelegramRoutingHelp,
  telegramCommandMatchesConfiguredChat,
  telegramReplyMatchesConfiguredChat,
  telegramSessionIsUnlocked,
  telegramTextMatchesConfiguredChat,
  telegramWebhookIsAuthorized
} from "@/lib/telegram-chat";

type LinkRow = {
  conversation_id: string;
  website_user_id: string;
  creator_profile_id: string;
  customer_user_id: string;
  creator_user_id: string;
};

export async function POST(request: NextRequest) {
  if (!telegramWebhookIsAuthorized(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const command = parseTelegramAccessCommand(update);
  if (command) {
    if (telegramCommandMatchesConfiguredChat(command)) await handleTelegramAccessCommand(command);
    return NextResponse.json({ ok: true });
  }

  const reply = parseTelegramReply(update);
  if (!reply) {
    const message = parseTelegramTextMessage(update);
    if (message && telegramTextMatchesConfiguredChat(message)) {
      if (await telegramSessionIsUnlocked(message.chatId)) await sendTelegramRoutingHelp().catch(() => undefined);
      else await sendTelegramLockedNotice().catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }
  if (!telegramReplyMatchesConfiguredChat(reply)) {
    // Telegram retries non-2xx responses. Unsupported updates are intentionally acknowledged.
    return NextResponse.json({ ok: true });
  }

  if (!await telegramSessionIsUnlocked(reply.chatId)) {
    await sendTelegramLockedNotice().catch(() => undefined);
    return NextResponse.json({ ok: true });
  }

  try {
    const visitorLink = await query<{ visitor_session_id: string }>(`
      SELECT visitor_session_id FROM visitor_chat_telegram_links
      WHERE telegram_chat_id = $1 AND bot_message_id = $2
    `, [reply.chatId, reply.repliedToMessageId]);
    if (visitorLink.rowCount) {
      const created = await transaction(async (client) => {
        const processed = await client.query(`
          SELECT 1 FROM visitor_telegram_webhook_updates WHERE update_id = $1
        `, [reply.updateId]);
        if (processed.rowCount) return false;
        const link = await client.query<{ visitor_session_id: string }>(`
          SELECT l.visitor_session_id
          FROM visitor_chat_telegram_links l
          JOIN visitor_chat_sessions s ON s.id = l.visitor_session_id AND s.status = 'OPEN'
          WHERE l.telegram_chat_id = $1 AND l.bot_message_id = $2
          FOR UPDATE OF s
        `, [reply.chatId, reply.repliedToMessageId]);
        if (!link.rowCount) return false;
        const encrypted = encryptMessage(reply.body);
        const messageId = randomUUID();
        await client.query(`
          INSERT INTO visitor_chat_messages
            (id, session_id, sender, body, body_ciphertext, body_iv, body_tag, admin_actor)
          VALUES ($1, $2, 'ADMIN', '[encrypted]', $3, $4, $5, $6)
        `, [messageId, link.rows[0].visitor_session_id, encrypted.ciphertext, encrypted.iv, encrypted.tag, `telegram:${reply.senderId}`]);
        await client.query(`UPDATE visitor_chat_sessions SET last_seen_at = now() WHERE id = $1`, [link.rows[0].visitor_session_id]);
        await client.query(`
          INSERT INTO visitor_telegram_webhook_updates
            (update_id, telegram_chat_id, telegram_message_id, visitor_message_id)
          VALUES ($1, $2, $3, $4)
        `, [reply.updateId, reply.chatId, reply.messageId, messageId]);
        return true;
      });
      if (created) {
        await sendTelegramReplyConfirmation(`visitor ${visitorLink.rows[0].visitor_session_id.slice(0, 8)}`).catch(() => undefined);
      } else {
        await sendTelegramRoutingHelp().catch(() => undefined);
      }
      return NextResponse.json({ ok: true, created, visitorChat: true });
    }

    const created = await transaction(async (client) => {
      const processed = await client.query(`
        SELECT 1 FROM telegram_webhook_updates WHERE update_id = $1
      `, [reply.updateId]);
      if (processed.rowCount) return false;

      const link = await client.query<LinkRow>(`
        SELECT l.conversation_id, l.website_user_id, c.creator_profile_id,
          c.customer_user_id, p.user_id AS creator_user_id
        FROM telegram_message_links l
        JOIN conversations c ON c.id = l.conversation_id
        JOIN profiles p ON p.id = c.creator_profile_id
        JOIN users u ON u.id = l.website_user_id AND u.status = 'ACTIVE'
        JOIN admin_message_alert_settings alert
          ON alert.monitored_user_id = l.website_user_id AND alert.enabled = TRUE
        WHERE l.telegram_chat_id = $1 AND l.bot_message_id = $2
        FOR UPDATE OF c
      `, [reply.chatId, reply.repliedToMessageId]);
      const target = link.rows[0];
      if (!target || ![target.customer_user_id, target.creator_user_id].includes(target.website_user_id)) return false;

      const counterpartUserId = target.website_user_id === target.customer_user_id
        ? target.creator_user_id
        : target.customer_user_id;
      const blocked = await client.query(`
        SELECT 1 FROM user_blocks
        WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
           OR (blocker_user_id = $2 AND blocked_user_id = $1)
        LIMIT 1
      `, [target.website_user_id, counterpartUserId]);
      if (blocked.rowCount) return false;

      const encrypted = encryptMessage(reply.body);
      const messageId = randomUUID();
      await client.query(`
        INSERT INTO messages
          (id, conversation_id, sender_user_id, body, body_ciphertext, body_iv, body_tag, body_hash)
        VALUES ($1, $2, $3, '[encrypted]', $4, $5, $6, $7)
      `, [messageId, target.conversation_id, target.website_user_id,
        encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.hash]);
      await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [target.conversation_id]);
      await client.query(`
        UPDATE profiles
        SET messages_sent = messages_sent + CASE WHEN user_id = $1 THEN 1 ELSE 0 END,
            messages_received = messages_received + CASE WHEN user_id <> $1 THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = $2
      `, [target.website_user_id, target.creator_profile_id]);
      await client.query(`
        INSERT INTO telegram_webhook_updates
          (update_id, telegram_chat_id, telegram_message_id, site_message_id)
        VALUES ($1, $2, $3, $4)
      `, [reply.updateId, reply.chatId, reply.messageId, messageId]);
      return true;
    });
    if (created) await sendTelegramReplyConfirmation("the selected member conversation").catch(() => undefined);
    else await sendTelegramRoutingHelp().catch(() => undefined);
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("Telegram website-chat reply failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
