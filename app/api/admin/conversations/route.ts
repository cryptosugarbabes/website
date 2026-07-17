import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { query } from "@/lib/db";

type ConversationRow = {
  id: string;
  creator_name: string;
  creator_email: string | null;
  creator_wallet: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_wallet: string | null;
  message_count: string;
  report_count: string;
  updated_at: Date;
};

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  const search = (request.nextUrl.searchParams.get("search") || "").trim().slice(0, 100);
  try {
    const conversations = await query<ConversationRow>(`
      SELECT c.id,
        p.display_name AS creator_name,
        creator.email AS creator_email,
        creator.wallet_address AS creator_wallet,
        COALESCE(cp.display_name, 'Private admirer') AS customer_name,
        customer.email AS customer_email,
        customer.wallet_address AS customer_wallet,
        count(DISTINCT m.id)::text AS message_count,
        count(DISTINCT r.id)::text AS report_count,
        c.updated_at
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      JOIN users creator ON creator.id = p.user_id
      JOIN users customer ON customer.id = c.customer_user_id
      LEFT JOIN customer_profiles cp ON cp.user_id = customer.id
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN safety_reports r ON r.conversation_id = c.id
      WHERE $1 = '' OR concat_ws(' ', c.id::text, p.display_name, creator.email, creator.wallet_address,
        cp.display_name, customer.email, customer.wallet_address) ILIKE '%' || $1 || '%'
      GROUP BY c.id, p.display_name, creator.email, creator.wallet_address, cp.display_name,
        customer.email, customer.wallet_address, c.updated_at
      ORDER BY c.updated_at DESC
      LIMIT 250
    `, [search]);
    return NextResponse.json({
      conversations: conversations.rows.map((row) => ({
        id: row.id,
        creatorName: row.creator_name,
        creatorEmail: row.creator_email,
        creatorWallet: row.creator_wallet,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerWallet: row.customer_wallet,
        messageCount: Number(row.message_count),
        reportCount: Number(row.report_count),
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error("Admin conversations load failed", error);
    return NextResponse.json({ error: "Conversations could not be loaded." }, { status: 503 });
  }
}
