import { createHash, randomUUID } from "node:crypto";
import { query } from "./db";

export const PRODUCT_EVENTS = ["PAGE_VIEW", "SIGN_IN_OPENED", "PROFILE_VIEWED"] as const;
export type ProductEvent = typeof PRODUCT_EVENTS[number];

export function normalizeObservabilityPath(value: string) {
  const path = value.split("?")[0].replace(/[\r\n]/g, "").slice(0, 300);
  return path.startsWith("/") ? path : "/";
}

export function normalizeErrorScope(value: string) {
  return value.replace(/[^a-zA-Z0-9_:/.[\]-]/g, "_").slice(0, 160) || "unknown";
}

export function sanitizeErrorForStorage(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown application error";
  return raw
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/0x[a-fA-F0-9]{32,}/g, "[wallet]")
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, "[identifier]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 500) || "Unknown application error";
}

export async function recordProductEvent(event: ProductEvent, pagePath = "/") {
  await query(
    `INSERT INTO product_events (id, event_name, page_path) VALUES ($1, $2, $3)`,
    [randomUUID(), event, normalizeObservabilityPath(pagePath)]
  );
}

export async function reportApplicationError(scope: string, error: unknown) {
  const normalizedScope = normalizeErrorScope(scope);
  const message = sanitizeErrorForStorage(error);
  const errorHash = createHash("sha256").update(`${normalizedScope}:${message}`).digest("hex");
  try {
    await query(`
      INSERT INTO application_errors (id, scope, error_hash, message)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (scope, error_hash) DO UPDATE SET
        occurrences = application_errors.occurrences + 1,
        last_seen_at = now()
    `, [randomUUID(), normalizedScope, errorHash, message]);
  } catch (reportingError) {
    console.error("Application error reporting failed", reportingError);
  }
}
