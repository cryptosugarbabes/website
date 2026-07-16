import { describe, expect, it } from "vitest";
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from "../vendor/bigint-buffer/dist/node";

describe("safe bigint buffer compatibility", () => {
  it("round-trips big-endian and little-endian values", () => {
    const value = 0x0102030405n;
    expect(toBigIntBE(toBufferBE(value, 8))).toBe(value);
    expect(toBigIntLE(toBufferLE(value, 8))).toBe(value);
  });

  it("rejects values that cannot fit in the requested width", () => {
    expect(() => toBufferBE(256n, 1)).toThrow(RangeError);
    expect(() => toBufferLE(1n, 0)).toThrow(RangeError);
  });
});
