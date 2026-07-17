import { timingSafeEqual } from "node:crypto";
import { query } from "./db";

type TelegramSendMessageResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
};

export type TelegramAccessCommand = {
  updateId: string;
  chatId: string;
  senderId: string;
  messageId: string;
  action: "unlock" | "lock" | "status";
  password: string;
};

export type TelegramReply = {
  updateId: string;
  chatId: string;
  senderId: string;
  messageId: string;
  repliedToMessageId: string;
  body: string;
};

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const password = process.env.TELEGRAM_BOT_PASSWORD?.trim();
  if (!token || !chatId || !webhookSecret || !password) return null;
  return { token, chatId, webhookSecret, password };
}

export function telegramBridgeIsConfigured() {
  return Boolean(telegramConfig());
}

export function telegramWebhookIsAuthorized(secret: string | null) {
  const expected = telegramConfig()?.webhookSecret;
  if (!expected || !secret) return false;
  const left = Buffer.from(secret);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseTelegramReply(input: unknown): TelegramReply | null {
  if (!input || typeof input !== "object") return null;
  const update = input as {
    update_id?: number;
    message?: {
      message_id?: number;
      text?: string;
      chat?: { id?: number };
      from?: { id?: number };
      reply_to_message?: { message_id?: number };
    };
  };
  const message = update.message;
  const body = typeof message?.text === "string" ? message.text.trim().slice(0, 800) : "";
  const updateId = update.update_id;
  const messageId = message?.message_id;
  const chatId = message?.chat?.id;
  const senderId = message?.from?.id;
  const repliedToMessageId = message?.reply_to_message?.message_id;
  if (!Number.isSafeInteger(updateId) || !Number.isSafeInteger(messageId)
    || !Number.isSafeInteger(chatId) || !Number.isSafeInteger(senderId)
    || !Number.isSafeInteger(repliedToMessageId)
    || !body) return null;
  return {
    updateId: String(updateId),
    chatId: String(chatId),
    senderId: String(senderId),
    messageId: String(messageId),
    repliedToMessageId: String(repliedToMessageId),
    body
  };
}

export function parseTelegramAccessCommand(input: unknown): TelegramAccessCommand | null {
  if (!input || typeof input !== "object") return null;
  const update = input as {
    update_id?: number;
    message?: {
      message_id?: number;
      text?: string;
      chat?: { id?: number };
      from?: { id?: number };
    };
  };
  const text = typeof update.message?.text === "string" ? update.message.text.trim() : "";
  const match = text.match(/^\/(unlock|lock|start|help)(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  const updateId = update.update_id;
  const messageId = update.message?.message_id;
  const chatId = update.message?.chat?.id;
  const senderId = update.message?.from?.id;
  if (!match || !Number.isSafeInteger(updateId) || !Number.isSafeInteger(messageId)
    || !Number.isSafeInteger(chatId) || !Number.isSafeInteger(senderId)) return null;
  const requested = match[1].toLowerCase();
  return {
    updateId: String(updateId),
    chatId: String(chatId),
    senderId: String(senderId),
    messageId: String(messageId),
    action: requested === "unlock" ? "unlock" : requested === "lock" ? "lock" : "status",
    password: (match[2] || "").trim()
  };
}

export function telegramReplyMatchesConfiguredChat(reply: TelegramReply) {
  const chatId = telegramConfig()?.chatId;
  // This bridge intentionally supports a one-to-one bot chat, not a Telegram group.
  return Boolean(chatId && chatId === reply.chatId && chatId === reply.senderId);
}

export function telegramCommandMatchesConfiguredChat(command: TelegramAccessCommand) {
  const chatId = telegramConfig()?.chatId;
  return Boolean(chatId && chatId === command.chatId && chatId === command.senderId);
}

function passwordMatches(provided: string, expected: string) {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  const config = telegramConfig();
  if (!config) throw new Error("TELEGRAM_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000)
    });
  } catch {
    throw new Error("TELEGRAM_REQUEST_FAILED:NETWORK");
  }
  const result = await response.json().catch(() => null) as TelegramSendMessageResponse | null;
  if (!response.ok || !result?.ok) throw new Error(`TELEGRAM_REQUEST_FAILED:${result?.description || response.status}`);
  return result;
}

async function sendTelegramBotText(text: string) {
  const config = telegramConfig();
  if (!config) return false;
  await telegramApi("sendMessage", { chat_id: config.chatId, text, disable_web_page_preview: true });
  return true;
}

async function deleteTelegramCommand(command: TelegramAccessCommand) {
  try {
    await telegramApi("deleteMessage", { chat_id: command.chatId, message_id: Number(command.messageId) });
  } catch {
    // Password commands are best-effort deleted; access still depends on the server-side check.
  }
}

export async function telegramSessionIsUnlocked(chatId: string) {
  const session = await query(`
    SELECT 1 FROM telegram_access_sessions
    WHERE telegram_chat_id = $1 AND expires_at > now()
  `, [chatId]);
  return Boolean(session.rowCount);
}

export async function sendTelegramLockedNotice() {
  return sendTelegramBotText("Bot locked. Send /unlock followed by your password. The password message will be deleted after it is checked.");
}

export async function handleTelegramAccessCommand(command: TelegramAccessCommand) {
  const config = telegramConfig();
  if (!config || !telegramCommandMatchesConfiguredChat(command)) return false;

  if (command.action === "lock") {
    await query(`DELETE FROM telegram_access_sessions WHERE telegram_chat_id = $1`, [command.chatId]);
    await sendTelegramBotText("Bot locked. Website messages will remain available in the administrator dashboard.");
    return true;
  }

  if (command.action === "status") {
    const unlocked = await telegramSessionIsUnlocked(command.chatId);
    await sendTelegramBotText(unlocked
      ? "Bot unlocked. Reply directly to a website-message notification to answer that conversation. Send /lock when finished."
      : "Private bot locked. Send /unlock followed by your password. The password message will be deleted after it is checked.");
    return true;
  }

  await deleteTelegramCommand(command);
  const current = await query<{ failed_attempts: number; locked_until: Date | null }>(`
    SELECT failed_attempts, locked_until
    FROM telegram_access_sessions WHERE telegram_chat_id = $1
  `, [command.chatId]);
  const state = current.rows[0];
  if (state?.locked_until && state.locked_until.getTime() > Date.now()) {
    await sendTelegramBotText("Too many incorrect passwords. Try again in 15 minutes.");
    return true;
  }

  if (!passwordMatches(command.password, config.password)) {
    const failedAttempts = (state?.locked_until ? 0 : state?.failed_attempts || 0) + 1;
    const lockNow = failedAttempts >= 5;
    await query(`
      INSERT INTO telegram_access_sessions
        (telegram_chat_id, authenticated_at, expires_at, failed_attempts, locked_until)
      VALUES ($1, to_timestamp(0), to_timestamp(0), $2, CASE WHEN $3 THEN now() + interval '15 minutes' ELSE NULL END)
      ON CONFLICT (telegram_chat_id) DO UPDATE
      SET authenticated_at = to_timestamp(0), expires_at = to_timestamp(0),
          failed_attempts = EXCLUDED.failed_attempts, locked_until = EXCLUDED.locked_until
    `, [command.chatId, failedAttempts, lockNow]);
    await sendTelegramBotText(lockNow
      ? "Too many incorrect passwords. The bot is locked for 15 minutes."
      : `Incorrect password. ${5 - failedAttempts} attempt${5 - failedAttempts === 1 ? "" : "s"} remaining.`);
    return true;
  }

  await query(`
    INSERT INTO telegram_access_sessions
      (telegram_chat_id, authenticated_at, expires_at, failed_attempts, locked_until)
    VALUES ($1, now(), 'infinity'::timestamptz, 0, NULL)
    ON CONFLICT (telegram_chat_id) DO UPDATE
    SET authenticated_at = now(), expires_at = 'infinity'::timestamptz,
        failed_attempts = 0, locked_until = NULL
  `, [command.chatId]);
  await sendTelegramBotText("Bot unlocked until you send /lock. New monitored-account messages will appear here. Reply directly to an alert to answer it.");
  return true;
}

export async function sendTelegramMessageAlert(input: {
  recipientUserId: string;
  conversationId: string;
  sourceMessageId: string;
  senderName: string;
  body: string;
}) {
  const config = telegramConfig();
  if (!config) return false;
  if (!await telegramSessionIsUnlocked(config.chatId)) return false;

  const senderName = input.senderName.replace(/[\r\n]+/g, " ").trim() || "Website visitor";
  const text = [
    "New website chat message",
    `From: ${senderName}`,
    "",
    input.body,
    "",
    "Reply directly to this Telegram message. Your reply will appear in the website chat."
  ].join("\n");
  const result = await telegramApi("sendMessage", {
    chat_id: config.chatId,
    text,
    disable_web_page_preview: true
  });
  const botMessageId = result?.result?.message_id;
  if (!Number.isSafeInteger(botMessageId)) throw new Error("TELEGRAM_SEND_FAILED:NO_MESSAGE_ID");

  await query(`
    INSERT INTO telegram_message_links
      (telegram_chat_id, bot_message_id, conversation_id, website_user_id, source_message_id)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (telegram_chat_id, bot_message_id) DO NOTHING
  `, [config.chatId, String(botMessageId), input.conversationId, input.recipientUserId, input.sourceMessageId]);
  return true;
}
