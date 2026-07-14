export const BASE_MESSAGE_PRICE_USDC = 0.3;
export const RATING_POINTS_PER_100_MESSAGES = 5;
export const PRICE_INCREASE_PER_POINT = 0.001;
export const PHOTO_LIKE_PRICE_USDC = 0.11;
export const PHOTO_LIKE_PLATFORM_FEE_USDC = 0.01;
export const PHOTO_LIKE_CREATOR_SHARE_USDC = PHOTO_LIKE_PRICE_USDC - PHOTO_LIKE_PLATFORM_FEE_USDC;
const BASE_MESSAGE_PRICE_MICRO_USDC = 300_000;

export function creatorRatingPoints(messagesSent: number, messagesReceived: number) {
  return Math.floor((messagesSent + messagesReceived) / 100) * RATING_POINTS_PER_100_MESSAGES;
}

export function messagePriceUsdc(points: number) {
  const priceIncreaseMicroUsdc = Math.round(BASE_MESSAGE_PRICE_MICRO_USDC * PRICE_INCREASE_PER_POINT * points);
  return (BASE_MESSAGE_PRICE_MICRO_USDC + priceIncreaseMicroUsdc) / 1_000_000;
}

export function formatUsdc(value: number) {
  return value.toFixed(value === Math.round(value * 100) / 100 ? 2 : 4);
}
