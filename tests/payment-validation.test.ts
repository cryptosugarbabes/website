import { describe, expect, it } from "vitest";
import { transferFallsWithinQuoteWindow } from "../lib/payment-validation";

describe("payment quote window", () => {
  const createdAtMs = Date.UTC(2026, 6, 16, 12, 0, 0);
  const expiresAtMs = createdAtMs + 10 * 60_000;

  it("accepts a transfer made during the quote window", () => {
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: createdAtMs + 30_000 })).toBe(true);
  });

  it("allows small blockchain clock skew and confirmation grace", () => {
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: createdAtMs - 45_000 })).toBe(true);
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: expiresAtMs + 90_000 })).toBe(true);
  });

  it("rejects transfers from before the quote and transfers confirmed too late", () => {
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: createdAtMs - 61_000 })).toBe(false);
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: expiresAtMs + 121_000 })).toBe(false);
  });

  it("rejects missing and invalid timestamps", () => {
    expect(transferFallsWithinQuoteWindow({ createdAtMs, expiresAtMs, transferTimestampMs: 0 })).toBe(false);
    expect(transferFallsWithinQuoteWindow({ createdAtMs: expiresAtMs, expiresAtMs, transferTimestampMs: expiresAtMs })).toBe(false);
  });
});
