import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { query, transaction } from "@/lib/db";
import { accountForSession } from "@/lib/accounts";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";
import { normalizeFocalPoint, normalizePhotoLayout } from "@/lib/photo-layout";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PROFILE_PHOTOS, safeStoragePath, uploadRoot } from "@/lib/uploads";

type OwnerRow = { id: string; photo_count: string };

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before uploading photos." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const upload = form?.get("photo");
  const focalPoint = normalizeFocalPoint(form?.get("focalX"), form?.get("focalY"));
  if (!(upload instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!ALLOWED_PHOTO_TYPES.has(upload.type) || upload.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image no larger than 5 MB." }, { status: 400 });
  }

  try {
    const account = await accountForSession(session);
    if (!account || account.account_type !== "CREATOR") {
      return NextResponse.json({ error: "Choose a creator account before uploading photos." }, { status: 403 });
    }
    const owner = await query<OwnerRow>(`
      SELECT p.id, COUNT(m.id)::text AS photo_count
      FROM profiles p
      LEFT JOIN profile_media m ON m.profile_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
    `, [account.id]);
    if (!owner.rowCount) return NextResponse.json({ error: "Save your profile details before adding photos." }, { status: 404 });
    if (Number(owner.rows[0].photo_count) >= MAX_PROFILE_PHOTOS) {
      return NextResponse.json({ error: `A profile can contain up to ${MAX_PROFILE_PHOTOS} photos.` }, { status: 409 });
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
        await client.query(`SELECT id FROM profiles WHERE id = $1 FOR UPDATE`, [profileId]);
        const current = await client.query<{ photo_count: string }>(`
          SELECT COUNT(*)::text AS photo_count FROM profile_media WHERE profile_id = $1
        `, [profileId]);
        const order = Number(current.rows[0].photo_count);
        if (order >= MAX_PROFILE_PHOTOS) throw new Error("PHOTO_LIMIT");
        await client.query(`
          INSERT INTO profile_media (id, profile_id, storage_key, mime_type, byte_size, sort_order, is_approved, focal_x, focal_y)
          VALUES ($1, $2, $3, 'image/webp', $4, $5, TRUE, $6, $7)
        `, [mediaId, profileId, storageKey, processed.length, order, focalPoint.focalX, focalPoint.focalY]);
        await client.query(`
          UPDATE profiles
          SET moderation_reviewed_at = CASE WHEN review_status = 'REJECTED' THEN moderation_reviewed_at ELSE NULL END,
              updated_at = now()
          WHERE id = $1
        `, [profileId]);
        await client.query(
          "INSERT INTO moderation_audit (id, profile_id, action, note, actor_email) VALUES ($1, $2, 'PHOTO_AUTO_PUBLISHED', $3, $4)",
          [randomUUID(), profileId, `Photo ${mediaId} published automatically and retained for retrospective administrator review.`, "system:auto-publish"]
        );
      });
    } catch (error) {
      await fs.unlink(outputPath).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ id: mediaId, url: `/api/media/${mediaId}` });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_LIMIT") {
      return NextResponse.json({ error: `A profile can contain up to ${MAX_PROFILE_PHOTOS} photos.` }, { status: 409 });
    }
    console.error("Photo upload failed", error);
    return NextResponse.json({ error: "That photo could not be processed. Try a different image." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before arranging photos." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const body = await request.json().catch(() => null) as { photos?: unknown } | null;
  const layout = normalizePhotoLayout(body?.photos, MAX_PROFILE_PHOTOS);
  if (!layout) return NextResponse.json({ error: "Choose a valid order and position for every current photo." }, { status: 400 });

  try {
    const account = await accountForSession(session);
    if (!account || account.account_type !== "CREATOR") {
      return NextResponse.json({ error: "Only creator accounts can arrange profile photos." }, { status: 403 });
    }

    await transaction(async (client) => {
      const profile = await client.query<{ id: string }>(
        `SELECT id FROM profiles WHERE user_id = $1 FOR UPDATE`,
        [account.id]
      );
      if (!profile.rowCount) throw new Error("PROFILE_NOT_FOUND");

      const current = await client.query<{ id: string }>(
        `SELECT id FROM profile_media WHERE profile_id = $1 ORDER BY sort_order, created_at FOR UPDATE`,
        [profile.rows[0].id]
      );
      const submittedIds = new Set(layout.map((photo) => photo.id));
      if (current.rowCount !== layout.length || current.rows.some((photo) => !submittedIds.has(photo.id))) {
        throw new Error("STALE_PHOTO_LAYOUT");
      }

      for (const photo of layout) {
        await client.query(
          `UPDATE profile_media
           SET sort_order = $2, focal_x = $3, focal_y = $4
           WHERE id = $1 AND profile_id = $5`,
          [photo.id, photo.sortOrder, photo.focalX, photo.focalY, profile.rows[0].id]
        );
      }
      await client.query(`UPDATE profiles SET updated_at = now() WHERE id = $1`, [profile.rows[0].id]);
    });

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "Save your profile before arranging photos." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_PHOTO_LAYOUT") {
      return NextResponse.json({ error: "Your photo list changed. Refresh the dashboard and try again." }, { status: 409 });
    }
    console.error("Photo layout update failed", error);
    return NextResponse.json({ error: "Your photo arrangement could not be saved." }, { status: 503 });
  }
}
