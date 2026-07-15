import { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const globalBuckets = globalThis as unknown as { cryptoSugarRateLimits?: Map<string, Bucket> };
const buckets = globalBuckets.cryptoSugarRateLimits || new Map<string, Bucket>();
globalBuckets.cryptoSugarRateLimits = buckets;

export function clientAddress(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "local";
}

export function takeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

