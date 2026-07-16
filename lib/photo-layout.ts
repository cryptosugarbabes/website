export type PhotoLayoutInput = {
  id: string;
  focalX: number;
  focalY: number;
};

export type NormalizedPhotoLayout = PhotoLayoutInput & {
  sortOrder: number;
};

function percentage(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(100, Math.max(0, number)));
}

export function normalizePhotoLayout(value: unknown, maximum = 8): NormalizedPhotoLayout[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) return null;

  const seen = new Set<string>();
  const normalized: NormalizedPhotoLayout[] = [];
  for (const [sortOrder, item] of value.entries()) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const focalX = percentage(candidate.focalX);
    const focalY = percentage(candidate.focalY);
    if (!id || seen.has(id) || focalX === null || focalY === null) return null;
    seen.add(id);
    normalized.push({ id, focalX, focalY, sortOrder });
  }
  return normalized;
}

export function normalizeFocalPoint(x: unknown, y: unknown) {
  return {
    focalX: percentage(x) ?? 50,
    focalY: percentage(y) ?? 50
  };
}
