import { describe, expect, it } from "vitest";
import { normalizeErrorScope, normalizeObservabilityPath, sanitizeErrorForStorage } from "../lib/observability";

describe("privacy-conscious observability", () => {
  it("drops query strings from recorded paths", () => {
    expect(normalizeObservabilityPath("/profile?email=private@example.com")).toBe("/profile");
  });

  it("normalizes invalid paths and error scopes", () => {
    expect(normalizeObservabilityPath("https://example.com/private")).toBe("/");
    expect(normalizeErrorScope("browser: /sign in")).toBe("browser:_/sign_in");
  });

  it("removes personal identifiers from error messages", () => {
    const result = sanitizeErrorForStorage(new Error("User private@example.com failed for 0x1234567890abcdef1234567890abcdef at https://example.com/path?token=secret"));
    expect(result).toContain("[email]");
    expect(result).toContain("[wallet]");
    expect(result).toContain("[url]");
    expect(result).not.toContain("private@example.com");
    expect(result).not.toContain("token=secret");
  });
});
