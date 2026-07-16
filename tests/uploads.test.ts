import { describe, expect, it } from "vitest";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PROFILE_PHOTOS } from "../lib/uploads";

describe("creator photo policy", () => {
  it("allows no more than eight profile photos", () => {
    expect(MAX_PROFILE_PHOTOS).toBe(8);
  });

  it("keeps the documented image formats and five-megabyte limit", () => {
    expect([...ALLOWED_PHOTO_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });
});
