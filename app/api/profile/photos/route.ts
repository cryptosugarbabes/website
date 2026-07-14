import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PROFILE_PHOTOS, safeStoragePath, uploadRoot } from "@/lib/uploads";

type OwnerRow = { id: string; photo_count: string };

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect and verify your wallet first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const upload = form?.get("photo");
  if (!(upload instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!ALLOWED_PHOTO_TYPES.has(upload.type) || upload.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image no larger than 5 MB." }, { status: 400 });
  }

  try {
    const owner = await query<OwnerRow>(`
      SELECT p.id, COUNT(m.id)::text AS photo_count
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN profile_media m ON m.profile_id = p.id
      WHERE u.wallet_chain = $1 AND u.wallet_address = $2
      GROUP BY p.id
    `, [session.chain, session.address]);
    if (!owner.rowCount) return NextResponse.json({ error: "Save your profile details before adding photos." }, { status: 404 });
    if (Number(owner.rows[0].photo_count) >= MAX_PROFILE_PHOTOS) {
      return NextResponse.json({ error: "A profile can contain up to 20 photos." }, { status: 409 });
    }

    const profileId = owner.rows[0].id;
    const mediaId = randomUUID();
    const storageKey = `${profileId}/${mediaId}.webp`;
    const outputPath = safeStoragePath(storageKey);
    await fs.mkdir(`${uploadRoot().replace(/\/+$/, "")}/${profileId}`, { recursive: true });
    const processed = await sharp(Buffer.from(await upload.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
    await fs.writeFile(outputPath, processed, { flag: "wx" });

    try {
      await transaction(async (client) => {
        const order = Number(owner.rows[0].photo_count);
        await client.query(`
          INSERT INTO profile_media (id, profile_id, storage_key, mime_type, byte_size, sort_order)
          VALUES ($1, $2, $3, 'image/webp', $4, $5)
        `, [mediaId, profileId, storageKey, processed.length, order]);
        await client.query(`UPDATE profiles SET review_status = 'PENDING_REVIEW', reviewed_at = NULL, updated_at = now() WHERE id = $1`, [profileId]);
      });
    } catch (error) {
      await fs.unlink(outputPath).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ id: mediaId, url: `/api/media/${mediaId}` });
  } catch (error) {
    console.error("Photo upload failed", error);
    return NextResponse.json({ error: "That photo could not be processed. Try a different image." }, { status: 503 });
  }
}
