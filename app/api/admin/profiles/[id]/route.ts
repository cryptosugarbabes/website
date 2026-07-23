import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { sendProfileDeletionEmail } from "@/lib/email-auth";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { safeStoragePath } from "@/lib/uploads";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { confirmation?: string; reason?: string } | null;
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm profile deletion." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) return NextResponse.json({ error: "Add a deletion reason." }, { status: 400 });

  try {
    const deleted = await transaction(async (client) => {
      const profile = await client.query<{
        id: string;
        display_name: string;
        email: string | null;
      }>(`
        SELECT p.id, p.display_name, u.email
        FROM profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1 AND p.deleted_at IS NULL
        FOR UPDATE OF p
      `, [id]);
      if (!profile.rowCount) return null;
      const media = await client.query<{ storage_key: string }>(
        "SELECT storage_key FROM profile_media WHERE profile_id = $1",
        [id]
      );

      await client.query("DELETE FROM favorites WHERE profile_id = $1", [id]);
      await client.query("DELETE FROM profile_media WHERE profile_id = $1", [id]);
      await client.query(`
        UPDATE profiles
        SET display_name = 'Deleted profile',
          declared_age = 18,
          city = '',
          country = 'Removed',
          headline = 'Profile deleted',
          bio = 'This profile was deleted by an administrator.',
          interests = '{}',
          review_status = 'REJECTED',
          rejection_reason = $2,
          reviewed_at = now(),
          moderation_reviewed_at = now(),
          deleted_at = now(),
          deletion_reason = $2,
          updated_at = now()
        WHERE id = $1
      `, [id, reason]);
      await client.query(
        "INSERT INTO moderation_audit (id, profile_id, action, note, actor_email) VALUES ($1, $2, 'DELETE_PROFILE', $3, $4)",
        [randomUUID(), id, reason, actor]
      );
      return { ...profile.rows[0], storage_keys: media.rows.map((item) => item.storage_key) };
    });

    if (!deleted) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    await Promise.all(deleted.storage_keys.map(async (storageKey) => {
      await fs.unlink(safeStoragePath(storageKey)).catch((error) => {
        console.error("Deleted profile photo file could not be removed", { storageKey, error });
      });
    }));

    if (deleted.email) {
      try {
        await sendProfileDeletionEmail(deleted.email, { profileName: deleted.display_name, reason });
      } catch (error) {
        console.error("Profile deletion email could not be sent", error);
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Admin profile deletion failed", error);
    return NextResponse.json({ error: "That profile could not be deleted." }, { status: 503 });
  }
}
