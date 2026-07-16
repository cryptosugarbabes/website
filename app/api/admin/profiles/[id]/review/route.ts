import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { sendProfileReviewEmail } from "@/lib/email-auth";
import { requestHasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const action = body?.action === "approve" ? "APPROVED" : body?.action === "reject" ? "REJECTED" : null;
  if (!action) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (action === "REJECTED" && !reason) return NextResponse.json({ error: "Add a rejection reason for the creator." }, { status: 400 });

  try {
    const updated = await transaction(async (client) => {
      const lockedProfile = await client.query<{ id: string; display_name: string; review_status: string; email: string | null }>(`
        SELECT p.id, p.display_name, p.review_status, u.email
        FROM profiles p JOIN users u ON u.id = p.user_id
        WHERE p.id = $1 FOR UPDATE OF p
      `, [id]);
      if (!lockedProfile.rowCount) return null;
      if (action === "APPROVED") {
        const media = await client.query<{ total: string; pending: string }>(`
          SELECT count(*)::text AS total, count(*) FILTER (WHERE NOT is_approved)::text AS pending
          FROM profile_media WHERE profile_id = $1
        `, [id]);
        if (Number(media.rows[0]?.total || 0) < 1) throw new Error("PROFILE_PHOTO_REQUIRED");
        if (Number(media.rows[0]?.pending || 0) > 0) throw new Error("PROFILE_PHOTOS_PENDING");
      }
      await client.query(`
        UPDATE profiles SET review_status = $2, rejection_reason = $3, reviewed_at = now(), updated_at = now()
        WHERE id = $1
      `, [id, action, action === "REJECTED" ? reason : null]);
      await client.query("INSERT INTO moderation_audit (id, profile_id, action, note, actor_email) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), id, action, reason || null, actor]);
      const profile = lockedProfile.rows[0];
      return { email: profile.email, profileName: profile.display_name, notify: profile.review_status !== action };
    });
    if (!updated) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (updated.notify && updated.email) {
      try {
        await sendProfileReviewEmail(updated.email, { approved: action === "APPROVED", profileName: updated.profileName, reason });
      } catch (error) {
        console.error("Profile review email could not be sent", error);
      }
    }
    return NextResponse.json({ ok: true, status: action });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_PHOTO_REQUIRED") return NextResponse.json({ error: "Approve at least one profile photo before approving this profile." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFILE_PHOTOS_PENDING") return NextResponse.json({ error: "Review every profile photo before approving this profile." }, { status: 409 });
    console.error("Profile review failed", error);
    return NextResponse.json({ error: "That profile review could not be saved." }, { status: 503 });
  }
}
