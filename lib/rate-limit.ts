import { NextRequest } from "next/server";
import { query } from "@/lib/db";

export function clientAddress(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "local";
}

export async function takeRateLimit(key: string, limit: number, windowMs: number) {
  const resetAt = new Date(Date.now() + windowMs);
  const result = await query<{ count: number; reset_at: Date }>(`
    INSERT INTO rate_limit_buckets (bucket_key, count, reset_at)
    VALUES ($1, 1, $2)
    ON CONFLICT (bucket_key) DO UPDATE SET
      count = CASE WHEN rate_limit_buckets.reset_at <= now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
      reset_at = CASE WHEN rate_limit_buckets.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit_buckets.reset_at END
    RETURNING count, reset_at
  `, [key, resetAt]);
  const bucket = result.rows[0];
  const allowed = bucket.count <= limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.reset_at.getTime() - Date.now()) / 1000))
  };
}

export async function readRateLimit(key: string, limit: number) {
  const result = await query<{ count: number; reset_at: Date }>(`
    SELECT count, reset_at FROM rate_limit_buckets
    WHERE bucket_key = $1 AND reset_at > now()
  `, [key]);
  const bucket = result.rows[0];
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: bucket.count < limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.reset_at.getTime() - Date.now()) / 1000))
  };
}

export async function clearRateLimit(key: string) {
  await query(`DELETE FROM rate_limit_buckets WHERE bucket_key = $1`, [key]);
}
