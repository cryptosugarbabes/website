import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const VISITOR_CHAT_COOKIE = "crypto_sugar_visitor_chat";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return value || "visitor-chat-local-only";
}

function signature(sessionId: string) {
  return createHmac("sha256", secret()).update(`visitor-chat:${sessionId}`).digest("base64url");
}

export function createVisitorChatToken(sessionId: string) {
  return `${sessionId}.${signature(sessionId)}`;
}

export function readVisitorChatToken(token: string | undefined) {
  if (!token) return null;
  const [sessionId, provided] = token.split(".");
  if (!sessionId || !provided || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const expected = signature(sessionId);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right) ? sessionId : null;
}

export function visitorChatSessionId(request: NextRequest) {
  return readVisitorChatToken(request.cookies.get(VISITOR_CHAT_COOKIE)?.value);
}

export function visitorAddressHash(request: NextRequest) {
  const address = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "local";
  return createHmac("sha256", secret()).update(`visitor-address:${address}`).digest("hex");
}

export const visitorChatCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 30 * 24 * 60 * 60
};
