import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.AUTH_SECRET || "velora-local-development-secret-change-before-deploy";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(address: string) {
  const payload = Buffer.from(
    JSON.stringify({ address: address.toLowerCase(), expiresAt: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  const expectedSignature = sign(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      address: string;
      expiresAt: number;
    };
    if (!parsed.address || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
