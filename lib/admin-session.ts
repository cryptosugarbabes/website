import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { readSessionToken } from "@/lib/session";

const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function signature(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return createHmac("sha256", secret || "local-only")
    .update(`admin:${payload}`)
    .digest("base64url");
}

export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + ADMIN_TTL_MS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function isAdminRequest(request: NextRequest) {
  return Boolean(adminIdentity(request));
}

export function adminIdentity(request: NextRequest) {
  const member = readSessionToken(request.cookies.get("velora_session")?.value);
  const allowedEmails = new Set((process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
  if (member?.email && allowedEmails.has(member.email.toLowerCase())) return member.email.toLowerCase();

  const token = request.cookies.get("crypto_sugar_admin")?.value;
  if (!token) return null;
  const [payload, provided] = token.split(".");
  if (!payload || !provided) return null;
  const expected = signature(payload);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).expiresAt > Date.now()
      ? "emergency-password"
      : null;
  } catch {
    return null;
  }
}

export function passwordMatches(provided: string) {
  const configured = process.env.ADMIN_PASSWORD || "";
  if (!configured || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}
