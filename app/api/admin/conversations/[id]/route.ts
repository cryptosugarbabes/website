import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { query } from "@/lib/db";
import { decryptMessage } from "@/lib/message-crypto";
import { requestHasTrustedOrigin } from "@/lib/request-security";

type MessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  body_ciphertext: string | null;
  body_iv: string | null;
  body_tag: string | null;
  status: string;
  is_automated: boolean;
  automation_rule_label: string | null;
  automation_matched: boolean | null;
  boost_amount_usdc: string;
  created_at: Date;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { reason?: string } | null;
  const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  if (reason.length < 5) return NextResponse.json({ error: "Enter a specific access reason." }, { status: 400 });
  const { id } = await context.params;
  try {
    const conversation = await query<{
      id: string; creator_user_id: string; creator_name: string; creator_email: string | null;
      customer_user_id: string; customer_name: string; customer_email: string | null;
    }>(`
      SELECT c.id, p.user_id AS creator_user_id, p.display_name AS creator_name, creator.email AS creator_email,
        c.customer_user_id, COALESCE(cp.display_name, 'Private admirer') AS customer_name,
        customer.email AS customer_email
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      JOIN users creator ON creator.id = p.user_id
      JOIN users customer ON customer.id = c.customer_user_id
      LEFT JOIN customer_profiles cp ON cp.user_id = customer.id
      WHERE c.id = $1
    `, [id]);
    if (!conversation.rowCount) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await query<MessageRow>(`
      SELECT id, sender_user_id, body, body_ciphertext, body_iv, body_tag, status, is_automated,
        automation_rule_label, automation_matched, boost_amount_usdc::text, created_at
      FROM messages WHERE conversation_id = $1 ORDER BY created_at
    `, [id]);
    await query(`
      INSERT INTO admin_conversation_views (id, conversation_id, actor_email, reason)
      VALUES ($1, $2, $3, $4)
    `, [randomUUID(), id, actor, reason]);
    const details = conversation.rows[0];
    return NextResponse.json({
      conversation: {
        id: details.id,
        creator: { id: details.creator_user_id, name: details.creator_name, email: details.creator_email },
        customer: { id: details.customer_user_id, name: details.customer_name, email: details.customer_email },
        accessReason: reason,
        accessedBy: actor
      },
      messages: messages.rows.map((message) => ({
        id: message.id,
        senderRole: message.sender_user_id === details.creator_user_id ? "CREATOR" : "CUSTOMER",
        senderName: message.sender_user_id === details.creator_user_id ? details.creator_name : details.customer_name,
        body: decryptMessage(message),
        status: message.status,
        automated: message.is_automated,
        automationRuleLabel: message.automation_rule_label,
        automationMatched: message.automation_matched,
        boostAmountUsdc: Number(message.boost_amount_usdc),
        createdAt: message.created_at
      }))
    });
  } catch (error) {
    console.error("Admin transcript load failed", error);
    return NextResponse.json({ error: "The transcript could not be opened." }, { status: 503 });
  }
}
