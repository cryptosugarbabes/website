export type QuoteWindow = {
  createdAtMs: number;
  expiresAtMs: number;
  transferTimestampMs: number;
  clockSkewMs?: number;
  expiryGraceMs?: number;
};

export function transferFallsWithinQuoteWindow({
  createdAtMs,
  expiresAtMs,
  transferTimestampMs,
  clockSkewMs = 60_000,
  expiryGraceMs = 120_000
}: QuoteWindow) {
  if (![createdAtMs, expiresAtMs, transferTimestampMs].every(Number.isFinite)) return false;
  if (createdAtMs <= 0 || expiresAtMs <= createdAtMs || transferTimestampMs <= 0) return false;
  return transferTimestampMs >= createdAtMs - clockSkewMs
    && transferTimestampMs <= expiresAtMs + expiryGraceMs;
}
