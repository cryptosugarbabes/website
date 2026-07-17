import { afterEach, describe, expect, it } from "vitest";
import {
  parseTelegramAccessCommand,
  parseTelegramReply,
  telegramCommandMatchesConfiguredChat,
  telegramReplyMatchesConfiguredChat,
  telegramWebhookIsAuthorized
} from "../lib/telegram-chat";

const previous = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  password: process.env.TELEGRAM_BOT_PASSWORD,
  secret: process.env.TELEGRAM_WEBHOOK_SECRET
};

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("TELEGRAM_BOT_TOKEN", previous.token);
  restore("TELEGRAM_CHAT_ID", previous.chatId);
  restore("TELEGRAM_BOT_PASSWORD", previous.password);
  restore("TELEGRAM_WEBHOOK_SECRET", previous.secret);
});

describe("Telegram website-chat replies", () => {
  it("extracts a direct text reply", () => {
    expect(parseTelegramReply({
      update_id: 90,
      message: {
        message_id: 45,
        text: "  Hello from Telegram  ",
        chat: { id: 1234 },
        from: { id: 1234 },
        reply_to_message: { message_id: 22 }
      }
    })).toEqual({
      updateId: "90",
      chatId: "1234",
      senderId: "1234",
      messageId: "45",
      repliedToMessageId: "22",
      body: "Hello from Telegram"
    });
  });

  it("ignores commands and messages that are not replies", () => {
    expect(parseTelegramReply({
      update_id: 90,
      message: { message_id: 45, text: "hello", chat: { id: 1234 }, from: { id: 1234 } }
    })).toBeNull();
    expect(parseTelegramReply({ update_id: 91, message: { message_id: 46, chat: { id: 1234 } } })).toBeNull();
  });

  it("authenticates the webhook and restricts replies to the configured chat", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "1234";
    process.env.TELEGRAM_BOT_PASSWORD = "private-password";
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const reply = parseTelegramReply({
      update_id: 90,
      message: {
        message_id: 45,
        text: "hello",
        chat: { id: 1234 },
        from: { id: 1234 },
        reply_to_message: { message_id: 22 }
      }
    });
    expect(telegramWebhookIsAuthorized("webhook-secret")).toBe(true);
    expect(telegramWebhookIsAuthorized("wrong-secret")).toBe(false);
    expect(reply && telegramReplyMatchesConfiguredChat(reply)).toBe(true);
    expect(reply && telegramReplyMatchesConfiguredChat({ ...reply, senderId: "9999" })).toBe(false);
  });

  it("parses private-chat access commands without treating them as replies", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "1234";
    process.env.TELEGRAM_BOT_PASSWORD = "private-password";
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const command = parseTelegramAccessCommand({
      update_id: 92,
      message: {
        message_id: 47,
        text: "/unlock private-password",
        chat: { id: 1234 },
        from: { id: 1234 }
      }
    });
    expect(command).toEqual({
      updateId: "92",
      chatId: "1234",
      senderId: "1234",
      messageId: "47",
      action: "unlock",
      password: "private-password"
    });
    expect(command && telegramCommandMatchesConfiguredChat(command)).toBe(true);
    expect(command && telegramCommandMatchesConfiguredChat({ ...command, chatId: "9999" })).toBe(false);
  });
});
