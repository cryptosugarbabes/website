import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return "velora-local-development-secret-change-before-deploy";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type WalletChain = "evm" | "solana";

export type AuthSession = {
  userId?: string;
  email?: string;
  address?: string;
  chain?: WalletChain;
  expiresAt: number;
};

export function createSessionToken(address: string, chain: WalletChain = "evm", userId?: string, email?: string) {
  const payload = Buffer.from(
    JSON.stringify({
      address: chain === "evm" ? address.toLowerCase() : address,
      chain,
      userId,
      email,
      expiresAt: Date.now() + SESSION_TTL_MS
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function createEmailSessionToken(userId: string, email: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    email: email.toLowerCase(),
    expiresAt: Date.now() + SESSION_TTL_MS
  })).toString("base64url");
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
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
    if ((!parsed.address && !parsed.userId) || parsed.expiresAt < Date.now()) return null;
    return {
      ...parsed,
      email: parsed.email?.toLowerCase(),
      chain: parsed.address ? parsed.chain || "evm" : undefined
    };
  } catch {
    return null;
  }
}
