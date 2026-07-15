import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { query } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { decryptMessage } from "@/lib/message-crypto";

type ReportRow = {
  id: string;
  category: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: Date;
  reporter_wallet: string;
  reported_wallet: string | null;
  profile_name: string | null;
  message_body: string | null;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
};

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  const result = await query<ReportRow>(`
    SELECT r.id, r.category, r.details, r.status, r.admin_note, r.created_at,
      reporter.wallet_address AS reporter_wallet,
      reported.wallet_address AS reported_wallet,
      p.display_name AS profile_name,
      m.body AS message_body, m.body_ciphertext, m.body_iv, m.body_tag
    FROM safety_reports r
    JOIN users reporter ON reporter.id = r.reporter_user_id
    LEFT JOIN users reported ON reported.id = r.reported_user_id
    LEFT JOIN profiles p ON p.id = r.profile_id
    LEFT JOIN messages m ON m.id = r.message_id
    ORDER BY CASE r.status WHEN 'OPEN' THEN 0 WHEN 'REVIEWING' THEN 1 ELSE 2 END, r.created_at DESC
    LIMIT 250
  `);
  return NextResponse.json({ reports: result.rows.map((row) => ({
    id: row.id,
    category: row.category,
    details: row.details,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reporterWallet: row.reporter_wallet,
    reportedWallet: row.reported_wallet,
    profileName: row.profile_name,
    messageBody: row.message_body ? decryptMessage({ body: row.message_body, body_ciphertext: row.body_ciphertext, body_iv: row.body_iv, body_tag: row.body_tag }) : null
  })) });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { id?: string; status?: string; note?: string } | null;
  const allowed = new Set(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]);
  const status = String(input?.status || "").toUpperCase();
  const note = String(input?.note || "").trim().slice(0, 1500);
  if (!input?.id || !allowed.has(status)) return NextResponse.json({ error: "Choose a report and valid status." }, { status: 400 });
  const result = await query(`
    UPDATE safety_reports SET status = $2, admin_note = $3,
      reviewed_at = CASE WHEN $2 IN ('RESOLVED', 'DISMISSED') THEN now() ELSE reviewed_at END
    WHERE id = $1
  `, [input.id, status, note || null]);
  if (!result.rowCount) return NextResponse.json({ error: "That report was not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}
