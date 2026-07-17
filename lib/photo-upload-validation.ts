import sharp from "sharp";
import { ALLOWED_PHOTO_TYPES } from "./uploads";

export const MIN_PROFILE_PHOTO_EDGE = 320;
export const MAX_PROFILE_PHOTO_EDGE = 12_000;
export const MAX_PROFILE_PHOTO_PIXELS = 40_000_000;

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export class PhotoValidationError extends Error {}

export async function validateProfilePhoto(buffer: Buffer, declaredMime: string) {
  if (!ALLOWED_PHOTO_TYPES.has(declaredMime)) {
    throw new PhotoValidationError("Use a JPG, PNG, or WebP image.");
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_PROFILE_PHOTO_PIXELS
    }).metadata();
  } catch {
    throw new PhotoValidationError("That file is not a valid JPG, PNG, or WebP image.");
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const decodedMime = metadata.format ? MIME_BY_FORMAT[metadata.format] : undefined;
  if (!decodedMime || decodedMime !== declaredMime) {
    throw new PhotoValidationError("The image contents do not match the selected file type.");
  }
  if ((metadata.pages || 1) > 1) {
    throw new PhotoValidationError("Animated or multi-page images are not supported.");
  }
  if (width < MIN_PROFILE_PHOTO_EDGE || height < MIN_PROFILE_PHOTO_EDGE) {
    throw new PhotoValidationError(`Photos must be at least ${MIN_PROFILE_PHOTO_EDGE} pixels wide and high.`);
  }
  if (width > MAX_PROFILE_PHOTO_EDGE || height > MAX_PROFILE_PHOTO_EDGE || width * height > MAX_PROFILE_PHOTO_PIXELS) {
    throw new PhotoValidationError("That photo has unusually large dimensions. Resize it and try again.");
  }

  return { width, height, format: metadata.format };
}
