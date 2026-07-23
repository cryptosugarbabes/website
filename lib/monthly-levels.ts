export type MonthlyLevel = {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  minimumUsdc: number;
  nextMinimumUsdc: number | null;
};

export type MonthlyRatingTier = MonthlyLevel & {
  minimumRating: number;
  maximumRating: number | null;
};

const THRESHOLDS = [0, 500, 1_000, 5_000, 10_000] as const;
const SUGAR_DADDY_LEVELS = ["Sugar Starter", "Sugar Boy", "Sugar Bro", "Sugar Meister", "Sugar Daddy"] as const;
const SUGAR_BABE_LEVELS = ["Sugar Babe", "Sugar Honey", "Sugar Princess", "Sugar Angel", "Sugar Queen"] as const;

function monthlyLevel(totalUsdc: number, names: readonly string[]): MonthlyLevel {
  const total = Number.isFinite(totalUsdc) ? Math.max(0, totalUsdc) : 0;
  let index = 0;

  for (let candidate = 1; candidate < THRESHOLDS.length; candidate += 1) {
    if (total < THRESHOLDS[candidate]) break;
    index = candidate;
  }

  return {
    level: (index + 1) as MonthlyLevel["level"],
    name: names[index],
    minimumUsdc: THRESHOLDS[index],
    nextMinimumUsdc: THRESHOLDS[index + 1] ?? null
  };
}

export function sugarDaddyMonthlyLevel(totalSpentUsdc: number) {
  return monthlyLevel(totalSpentUsdc, SUGAR_DADDY_LEVELS);
}

export function monthlySugarRating(totalSpentUsdc: number) {
  const total = Number.isFinite(totalSpentUsdc) ? Math.max(0, totalSpentUsdc) : 0;
  return Math.round(total * 100) / 100;
}

export function formatMonthlySugarRating(totalSpentUsdc: number) {
  return monthlySugarRating(totalSpentUsdc).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function sugarBabeMonthlyLevel(totalEarnedUsdc: number) {
  return monthlyLevel(totalEarnedUsdc, SUGAR_BABE_LEVELS);
}

function monthlyRatingTiers(names: readonly string[]): MonthlyRatingTier[] {
  return names.map((name, index) => ({
    level: (index + 1) as MonthlyLevel["level"],
    name,
    minimumUsdc: THRESHOLDS[index],
    nextMinimumUsdc: THRESHOLDS[index + 1] ?? null,
    minimumRating: THRESHOLDS[index],
    maximumRating: THRESHOLDS[index + 1] ? THRESHOLDS[index + 1] - 0.01 : null
  }));
}

export function sugarDaddyMonthlyRatingTiers() {
  return monthlyRatingTiers(SUGAR_DADDY_LEVELS);
}

export function sugarBabeMonthlyRatingTiers() {
  return monthlyRatingTiers(SUGAR_BABE_LEVELS);
}
