import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MIN_PROFILE_PHOTO_EDGE,
  PhotoValidationError,
  validateProfilePhoto
} from "../lib/photo-upload-validation";

async function jpeg(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 36, g: 12, b: 28 }
    }
  }).jpeg().toBuffer();
}

describe("profile photo content validation", () => {
  it("accepts a genuine image with safe dimensions", async () => {
    const result = await validateProfilePhoto(await jpeg(640, 800), "image/jpeg");
    expect(result).toMatchObject({ width: 640, height: 800, format: "jpeg" });
  });

  it("rejects a file whose contents do not match its declared type", async () => {
    await expect(validateProfilePhoto(await jpeg(640, 800), "image/png"))
      .rejects.toThrow("contents do not match");
  });

  it("rejects malformed files even if their name claims an allowed type", async () => {
    await expect(validateProfilePhoto(Buffer.from("not an image"), "image/jpeg"))
      .rejects.toBeInstanceOf(PhotoValidationError);
  });

  it("rejects images too small for safe profile presentation", async () => {
    await expect(validateProfilePhoto(
      await jpeg(MIN_PROFILE_PHOTO_EDGE - 1, MIN_PROFILE_PHOTO_EDGE),
      "image/jpeg"
    )).rejects.toThrow(`at least ${MIN_PROFILE_PHOTO_EDGE} pixels`);
  });
});
