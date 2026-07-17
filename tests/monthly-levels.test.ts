import { describe, expect, it } from "vitest";
import { sugarBabeMonthlyLevel, sugarDaddyMonthlyLevel } from "../lib/monthly-levels";

describe("monthly member levels", () => {
  it("assigns every Sugar Daddy level at the agreed thresholds", () => {
    expect(sugarDaddyMonthlyLevel(0).name).toBe("New to Sugaring");
    expect(sugarDaddyMonthlyLevel(499.99).name).toBe("New to Sugaring");
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
});
