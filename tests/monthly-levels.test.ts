import { describe, expect, it } from "vitest";
import {
  formatMonthlySugarRating,
  monthlySugarRating,
  sugarBabeMonthlyLevel,
  sugarBabeMonthlyRatingTiers,
  sugarDaddyMonthlyLevel,
  sugarDaddyMonthlyRatingTiers
} from "../lib/monthly-levels";

describe("monthly member levels", () => {
  it("assigns every Sugar Daddy level at the agreed thresholds", () => {
    expect(sugarDaddyMonthlyLevel(0).name).toBe("Sugar Starter");
    expect(sugarDaddyMonthlyLevel(499.99).name).toBe("Sugar Starter");
    expect(sugarDaddyMonthlyLevel(500).name).toBe("Sugar Boy");
    expect(sugarDaddyMonthlyLevel(1_000).name).toBe("Sugar Bro");
    expect(sugarDaddyMonthlyLevel(5_000).name).toBe("Sugar Meister");
    expect(sugarDaddyMonthlyLevel(10_000).name).toBe("Sugar Daddy");
  });

  it("assigns every Sugar Babe level at the agreed thresholds", () => {
    expect(sugarBabeMonthlyLevel(0).name).toBe("Sugar Babe");
    expect(sugarBabeMonthlyLevel(499.99).name).toBe("Sugar Babe");
    expect(sugarBabeMonthlyLevel(500).name).toBe("Sugar Honey");
    expect(sugarBabeMonthlyLevel(1_000).name).toBe("Sugar Princess");
    expect(sugarBabeMonthlyLevel(5_000).name).toBe("Sugar Angel");
    expect(sugarBabeMonthlyLevel(10_000).name).toBe("Sugar Queen");
  });

  it("safely treats invalid and negative totals as zero", () => {
    expect(sugarDaddyMonthlyLevel(-100)).toMatchObject({ level: 1, minimumUsdc: 0, nextMinimumUsdc: 500 });
    expect(sugarBabeMonthlyLevel(Number.NaN)).toMatchObject({ level: 1, minimumUsdc: 0, nextMinimumUsdc: 500 });
  });

  it("converts monthly customer spending into a unitless one-to-one Sugar Rating", () => {
    expect(monthlySugarRating(20)).toBe(20);
    expect(formatMonthlySugarRating(7)).toBe("7");
    expect(formatMonthlySugarRating(7.5)).toBe("7.5");
    expect(formatMonthlySugarRating(-1)).toBe("0");
  });

  it("publishes the monthly customer and creator rating lists", () => {
    expect(sugarDaddyMonthlyRatingTiers()).toEqual([
      expect.objectContaining({ level: 1, name: "Sugar Starter", minimumRating: 0, maximumRating: 499.99 }),
      expect.objectContaining({ level: 2, name: "Sugar Boy", minimumRating: 500, maximumRating: 999.99 }),
      expect.objectContaining({ level: 3, name: "Sugar Bro", minimumRating: 1_000, maximumRating: 4_999.99 }),
      expect.objectContaining({ level: 4, name: "Sugar Meister", minimumRating: 5_000, maximumRating: 9_999.99 }),
      expect.objectContaining({ level: 5, name: "Sugar Daddy", minimumRating: 10_000, maximumRating: null })
    ]);
    expect(sugarBabeMonthlyRatingTiers().map((tier) => tier.name)).toEqual([
      "Sugar Babe",
      "Sugar Honey",
      "Sugar Princess",
      "Sugar Angel",
      "Sugar Queen"
    ]);
  });
});
