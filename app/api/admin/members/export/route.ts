import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { csvRow } from "@/lib/csv";
import { query } from "@/lib/db";

type MemberRow = {
  email: string;
  account_type: string | null;
  status: string;
  display_name: string | null;
  created_at: Date;
  email_verified_at: Date;
};

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });

  try {
    const members = await query<MemberRow>(`
      SELECT u.email, u.account_type, u.status,
        COALESCE(p.display_name, cp.display_name) AS display_name,
        u.created_at, u.email_verified_at
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.email IS NOT NULL AND u.email_verified_at IS NOT NULL
      ORDER BY u.created_at DESC
    `);
    const lines = [
      csvRow(["Email", "Account type", "Account status", "Display name", "Joined at", "Email verified at"]),
      ...members.rows.map((member) => csvRow([
        member.email,
        member.account_type || "Not selected",
        member.status,
        member.display_name || "",
        member.created_at.toISOString(),
        member.email_verified_at.toISOString()
      ]))
    ];
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="crypto-sugar-babes-members-${date}.csv"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Member export failed", error);
    return NextResponse.json({ error: "The member export is temporarily unavailable." }, { status: 503 });
  }
}
