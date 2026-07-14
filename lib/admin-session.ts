import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function signature(payload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "local-only")
    .update(`admin:${payload}`)
    .digest("base64url");
}

export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + ADMIN_TTL_MS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get("crypto_sugar_admin")?.value;
  if (!token) return false;
  const [payload, provided] = token.split(".");
  if (!payload || !provided) return false;
  const expected = signature(payload);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function passwordMatches(provided: string) {
  const configured = process.env.ADMIN_PASSWORD || "";
  if (!configured || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}
