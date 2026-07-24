import { describe, expect, it } from "vitest";
import { validAndroidPushToken } from "../lib/push-notifications";

describe("Android push registration", () => {
  it("accepts realistic FCM registration tokens", () => {
    expect(validAndroidPushToken("abcDEF0123456789abcDEF0123456789:APA91b_test-token.value")).toBe(true);
  });

  it("rejects short, structured, and whitespace-bearing input", () => {
    expect(validAndroidPushToken("short")).toBe(false);
    expect(validAndroidPushToken({ token: "abc" })).toBe(false);
    expect(validAndroidPushToken(`${"a".repeat(40)} bad`)).toBe(false);
  });
});
