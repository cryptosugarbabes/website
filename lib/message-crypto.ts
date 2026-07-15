import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const source = process.env.MESSAGE_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!source) throw new Error("MESSAGE_ENCRYPTION_SECRET or AUTH_SECRET is required.");
  return createHash("sha256").update(`crypto-sugar-messages:${source}`).digest();
}

export function messageHash(body: string) {
  return createHash("sha256").update(body.trim().toLowerCase()).digest("hex");
}

export function encryptMessage(body: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    hash: messageHash(body)
  };
}

export function decryptMessage(row: { body: string; body_ciphertext?: string | null; body_iv?: string | null; body_tag?: string | null }) {
  if (!row.body_ciphertext || !row.body_iv || !row.body_tag) return row.body;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.body_iv, "base64"));
    decipher.setAuthTag(Buffer.from(row.body_tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(row.body_ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "[Message unavailable]";
  }
}

