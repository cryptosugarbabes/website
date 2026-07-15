import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
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

  const updated = await transaction(async (client) => {
    const result = await client.query(`
      UPDATE profiles SET review_status = $2, rejection_reason = $3, reviewed_at = now(), updated_at = now()
      WHERE id = $1
    `, [id, action, action === "REJECTED" ? reason : null]);
    if (!result.rowCount) return false;
    await client.query("UPDATE profile_media SET is_approved = $2 WHERE profile_id = $1", [id, action === "APPROVED"]);
    await client.query("INSERT INTO moderation_audit (id, profile_id, action, note, actor_email) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), id, action, reason || null, actor]);
    return true;
  });
  return updated ? NextResponse.json({ ok: true, status: action }) : NextResponse.json({ error: "Profile not found." }, { status: 404 });
}
