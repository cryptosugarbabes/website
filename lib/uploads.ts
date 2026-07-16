export const MAX_PROFILE_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function uploadRoot() {
  return process.env.UPLOAD_ROOT || "/tmp/cryptosugar-local-uploads";
}

export function safeStoragePath(storageKey: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(storageKey)) throw new Error("Unsafe storage path.");
  return `${uploadRoot().replace(/\/+$/, "")}/${storageKey}`;
}
