import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity, isAdminRequest } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { safeStoragePath } from "@/lib/uploads";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  const result = await query<{ storage_key: string; mime_type: string }>("SELECT storage_key, mime_type FROM profile_media WHERE id = $1", [id]);
  if (!result.rowCount) return new NextResponse(null, { status: 404 });
  try {
    const bytes = await fs.readFile(safeStoragePath(result.rows[0].storage_key));
    return new NextResponse(bytes, { headers: { "content-type": result.rows[0].mime_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const { id } = await context.params;
  const input = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const approved = input?.action === "approve" ? true : input?.action === "reject" ? false : null;
  if (approved === null) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  if (!approved && !reason) return NextResponse.json({ error: "Add a reason for rejecting this photo." }, { status: 400 });

  try {
    const updated = await transaction(async (client) => {
      const media = await client.query<{ profile_id: string }>("SELECT profile_id FROM profile_media WHERE id = $1 FOR UPDATE", [id]);
      if (!media.rowCount) return null;
      const profileId = media.rows[0].profile_id;
      await client.query("UPDATE profile_media SET is_approved = $2 WHERE id = $1", [id, approved]);
      if (!approved) {
        await client.query("UPDATE profiles SET review_status = 'REJECTED', rejection_reason = $2, reviewed_at = now(), updated_at = now() WHERE id = $1", [profileId, reason]);
      } else {
        await client.query("UPDATE profiles SET review_status = CASE WHEN review_status = 'APPROVED' THEN review_status ELSE 'PENDING_REVIEW' END, updated_at = now() WHERE id = $1", [profileId]);
      }
      await client.query(
        "INSERT INTO moderation_audit (id, profile_id, action, note, actor_email) VALUES ($1, $2, $3, $4, $5)",
        [randomUUID(), profileId, approved ? "PHOTO_APPROVED" : "PHOTO_REJECTED", reason || `Photo ${id}`, actor]
      );
      return profileId;
    });
    return updated ? NextResponse.json({ ok: true, approved, profileId: updated }) : NextResponse.json({ error: "Photo not found." }, { status: 404 });
  } catch (error) {
    console.error("Photo review failed", error);
    return NextResponse.json({ error: "That photo review could not be saved." }, { status: 503 });
  }
}
