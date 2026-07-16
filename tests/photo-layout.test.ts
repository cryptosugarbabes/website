import { describe, expect, it } from "vitest";
import { normalizeFocalPoint, normalizePhotoLayout } from "../lib/photo-layout";

describe("photo layout", () => {
  it("preserves submitted order and clamps focal positions", () => {
    expect(normalizePhotoLayout([
      { id: "photo-b", focalX: 120, focalY: 42.4 },
      { id: "photo-a", focalX: -8, focalY: 60 }
    ])).toEqual([
      { id: "photo-b", focalX: 100, focalY: 42, sortOrder: 0 },
      { id: "photo-a", focalX: 0, focalY: 60, sortOrder: 1 }
    ]);
  });

  it("rejects duplicates, empty layouts, and layouts over the limit", () => {
    expect(normalizePhotoLayout([])).toBeNull();
    expect(normalizePhotoLayout([
      { id: "same", focalX: 50, focalY: 50 },
      { id: "same", focalX: 20, focalY: 20 }
    ])).toBeNull();
    expect(normalizePhotoLayout(Array.from({ length: 9 }, (_, index) => ({ id: String(index), focalX: 50, focalY: 50 })))).toBeNull();
  });

  it("centers invalid focal points used during upload", () => {
    expect(normalizeFocalPoint("not-a-number", null)).toEqual({ focalX: 50, focalY: 50 });
  });
});
