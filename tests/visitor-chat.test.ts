import { afterEach, describe, expect, it } from "vitest";
import { createVisitorChatToken, readVisitorChatToken } from "../lib/visitor-chat";

const originalSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

describe("anonymous visitor chat session", () => {
  it("accepts a signed visitor session and rejects tampering", () => {
    process.env.AUTH_SECRET = "visitor-chat-test-secret";
    const id = "11111111-2222-4333-8444-555555555555";
    const token = createVisitorChatToken(id);
    expect(readVisitorChatToken(token)).toBe(id);
    expect(readVisitorChatToken(token.replace("11111111", "99999999"))).toBeNull();
    expect(readVisitorChatToken(`${id}.invalid`)).toBeNull();
  });
});
