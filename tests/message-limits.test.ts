import { describe, expect, it } from "vitest";
import { MESSAGE_UNLOCK_USDC_MICROS, unansweredMessageState } from "../lib/message-limits";

describe("unanswered message limits", () => {
  it("allows the first two unanswered messages", () => {
    expect(unansweredMessageState(0)).toBe("OPEN");
    expect(unansweredMessageState(1)).toBe("OPEN");
  });

  it("warns before the third unanswered message", () => {
    expect(unansweredMessageState(2)).toBe("WARNING");
  });

  it("requires a reply after the third message unless a paid unlock is ready", () => {
    expect(unansweredMessageState(3)).toBe("REPLY_REQUIRED");
    expect(unansweredMessageState(8, true)).toBe("PAID_UNLOCK_READY");
  });

  it("prices a weekly unlock at exactly ten USDC", () => {
    expect(MESSAGE_UNLOCK_USDC_MICROS).toBe(BigInt(10_000_000));
  });
});

