export const MICRO_USDC = BigInt(1_000_000);

export function decimalToMicros(value: unknown) {
  const source = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^\d+(\.\d{1,6})?$/.test(source)) return null;
  const [whole, fraction = ""] = source.split(".");
  return BigInt(whole) * MICRO_USDC + BigInt(fraction.padEnd(6, "0"));
}

export function microsToDecimal(value: bigint) {
  const whole = value / MICRO_USDC;
  const fraction = (value % MICRO_USDC).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export function splitPaymentMicros(grossMicros: bigint) {
  if (grossMicros <= 0) throw new Error("Payment amount must be positive.");
  const platformMicros = (grossMicros + BigInt(5)) / BigInt(10);
  return { creatorMicros: grossMicros - platformMicros, platformMicros };
}

export function paidLikePriceMicros(paidLikes: number | bigint) {
  const normalized = typeof paidLikes === "bigint" ? paidLikes : BigInt(Math.max(0, Math.floor(paidLikes)));
  const completedHundreds = normalized / BigInt(100);
  return BigInt(5_000_000) + completedHundreds * BigInt(5_000);
}
