import { describe, expect, it } from "vitest";
import {
  creatorShareUsdc,
  creatorSupportPoints,
  generosityLevel,
  photoLikePriceUsdc,
  platformShareUsdc,
  sugarCountLabel
} from "../lib/creator-economy";

describe("creator economy", () => {
  it("starts paid likes at 2 USDC and increases by 0.1% per completed 100", () => {
    expect(photoLikePriceUsdc(0)).toBe(2);
    expect(photoLikePriceUsdc(99)).toBe(2);
    expect(photoLikePriceUsdc(100)).toBe(2.002);
    expect(photoLikePriceUsdc(1_000)).toBe(2.02);
  });

  it("allocates 90% to the creator and 10% to the platform", () => {
    expect(creatorShareUsdc(5)).toBe(4.5);
    expect(platformShareUsdc(5)).toBe(0.5);
    expect(creatorShareUsdc(25) + platformShareUsdc(25)).toBe(25);
  });

  it("calculates creator and supporter reputation consistently", () => {
    expect(creatorSupportPoints(199, 24.99)).toBe(29);
    expect(generosityLevel(5)).toBe("Thoughtful Supporter");
    expect(generosityLevel(500)).toBe("Legendary Patron");
  });

  it("labels photo Sugars with correct singular and plural forms", () => {
    expect(sugarCountLabel(0)).toBe("0 Sugar");
    expect(sugarCountLabel(1)).toBe("1 Sugar");
    expect(sugarCountLabel(2)).toBe("2 Sugars");
  });
});
