import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { action?: string; confirmation?: string } | null;
  if (!input || !["REQUEST_DELETION", "CANCEL_DELETION"].includes(input.action || "")) {
    return NextResponse.json({ error: "Choose a valid account action." }, { status: 400 });
  }
  if (input.action === "REQUEST_DELETION" && input.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm your request." }, { status: 400 });
  }

  const result = await query<{ deletion_requested_at: Date | null }>(`
    UPDATE users SET deletion_requested_at = CASE WHEN $4 = 'REQUEST_DELETION' THEN now() ELSE NULL END,
      updated_at = now()
    WHERE ($1::uuid IS NOT NULL AND id = $1)
       OR ($1::uuid IS NULL AND wallet_chain = $2 AND wallet_address = $3)
    RETURNING deletion_requested_at
  `, [session.userId || null, session.chain || null, session.address || null, input.action]);
  if (!result.rowCount) return NextResponse.json({ error: "Your account could not be found." }, { status: 404 });
  return NextResponse.json({ deletionRequestedAt: result.rows[0].deletion_requested_at });
}
