export const BASE_PHOTO_LIKE_PRICE_USDC = 2;
export const LIKE_PRICE_INCREASE_PER_100 = 0.001;
export const CREATOR_SHARE_BPS = 9_000;
export const PLATFORM_SHARE_BPS = 1_000;
export const CREATOR_POINTS_PER_100_LIKES = 5;

function roundUsdc(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function photoLikePriceUsdc(paidLikes: number) {
  const completedHundreds = Math.floor(Math.max(0, paidLikes) / 100);
  return roundUsdc(BASE_PHOTO_LIKE_PRICE_USDC * (1 + completedHundreds * LIKE_PRICE_INCREASE_PER_100));
}

export function creatorShareUsdc(amount: number) {
  return roundUsdc(amount * CREATOR_SHARE_BPS / 10_000);
}

export function platformShareUsdc(amount: number) {
  return roundUsdc(amount * PLATFORM_SHARE_BPS / 10_000);
}

export function creatorSupportPoints(paidLikes: number, giftsUsdc: number) {
  return Math.floor(Math.max(0, paidLikes) / 100) * CREATOR_POINTS_PER_100_LIKES + Math.floor(Math.max(0, giftsUsdc));
}

export function generosityPoints(totalSupportUsdc: number) {
  return Math.floor(Math.max(0, totalSupportUsdc));
}

export function generosityLevel(points: number) {
  if (points >= 500) return "Legendary Patron";
  if (points >= 100) return "Golden Patron";
  if (points >= 25) return "Generous Gentleman";
  if (points >= 5) return "Thoughtful Supporter";
  return "New Supporter";
}

export function formatUsdc(value: number) {
  return value.toFixed(value === Math.round(value * 100) / 100 ? 2 : 4);
}

export function sugarCountLabel(value: number) {
  const count = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${count.toLocaleString("en-US")} ${count <= 1 ? "Sugar" : "Sugars"}`;
}
