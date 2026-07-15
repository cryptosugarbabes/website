import { describe, expect, it } from "vitest";
import { decimalToMicros, microsToDecimal, paidLikePriceMicros, splitPaymentMicros } from "../lib/payment-math";

describe("payment math", () => {
  it("parses and formats USDC without floating point arithmetic", () => {
    expect(decimalToMicros("5.005")).toBe(BigInt(5_005_000));
    expect(decimalToMicros("1.000001")).toBe(BigInt(1_000_001));
    expect(decimalToMicros("1.0000001")).toBeNull();
    expect(microsToDecimal(BigInt(5_005_000))).toBe("5.005000");
  });

  it("preserves every micro-USDC in the 90/10 split", () => {
    for (const gross of [BigInt(1), BigInt(1_000_001), BigInt(5_005_000)]) {
      const split = splitPaymentMicros(gross);
      expect(split.creatorMicros + split.platformMicros).toBe(gross);
      expect(split.platformMicros).toBe((gross + BigInt(5)) / BigInt(10));
    }
  });

  it("uses the same scaled paid-like price as the public economy", () => {
    expect(paidLikePriceMicros(0)).toBe(BigInt(5_000_000));
    expect(paidLikePriceMicros(100)).toBe(BigInt(5_005_000));
    expect(paidLikePriceMicros(1_000)).toBe(BigInt(5_050_000));
  });
});
