import { beforeAll, describe, expect, it } from "vitest";
import { decryptMessage, encryptMessage, messageHash } from "../lib/message-crypto";

beforeAll(() => {
  process.env.MESSAGE_ENCRYPTION_SECRET = "test-only-message-encryption-secret";
});

describe("message encryption", () => {
  it("encrypts authenticated ciphertext and decrypts it for participants", () => {
    const encrypted = encryptMessage("Meet me in Lisbon");
    expect(encrypted.ciphertext).not.toContain("Lisbon");
    expect(decryptMessage({ body: "[encrypted]", body_ciphertext: encrypted.ciphertext, body_iv: encrypted.iv, body_tag: encrypted.tag })).toBe("Meet me in Lisbon");
  });

  it("does not decrypt modified ciphertext", () => {
    const encrypted = encryptMessage("Private message");
    const changed = `${encrypted.ciphertext.slice(0, -2)}AA`;
    expect(decryptMessage({ body: "[encrypted]", body_ciphertext: changed, body_iv: encrypted.iv, body_tag: encrypted.tag })).toBe("[Message unavailable]");
  });

  it("normalizes message hashes used for repeated-spam detection", () => {
    expect(messageHash(" Hello ")).toBe(messageHash("hello"));
  });
});
