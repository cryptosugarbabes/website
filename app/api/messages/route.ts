import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";

type ConversationRow = {
  id: string;
  creator_profile_id: string;
  creator_name: string;
  creator_photo_id: string | null;
  customer_name: string;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  status: string;
  created_at: Date;
};

export async function GET(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ accountType: null, conversations: [] });
  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ accountType: null, conversations: [] });

    const conversations = await query<ConversationRow>(`
      SELECT c.id, c.creator_profile_id, p.display_name AS creator_name,
        (SELECT m.id FROM profile_media m WHERE m.profile_id = p.id AND m.is_approved = TRUE ORDER BY m.sort_order, m.created_at LIMIT 1) AS creator_photo_id,
        COALESCE(cp.display_name, 'Private admirer') AS customer_name,
        c.updated_at
      FROM conversations c
      JOIN profiles p ON p.id = c.creator_profile_id
      LEFT JOIN customer_profiles cp ON cp.user_id = c.customer_user_id
      WHERE c.customer_user_id = $1 OR p.user_id = $1
      ORDER BY c.updated_at DESC
    `, [account.id]);

    const ids = conversations.rows.map((row) => row.id);
    const messages = ids.length ? await query<MessageRow>(`
      SELECT id, conversation_id, sender_user_id, body, status, created_at
      FROM messages
      WHERE conversation_id = ANY($1::uuid[])
      ORDER BY created_at
    `, [ids]) : { rows: [] as MessageRow[] };

    if (ids.length) {
      await query(`
        UPDATE messages SET status = 'READ', read_at = COALESCE(read_at, now())
        WHERE conversation_id = ANY($1::uuid[]) AND sender_user_id <> $2 AND status = 'SENT'
      `, [ids, account.id]);
    }

    return NextResponse.json({
      accountType: account.account_type,
      conversations: conversations.rows.map((conversation) => ({
        id: conversation.id,
        profileId: conversation.creator_profile_id,
        counterpartName: account.account_type === "CREATOR" ? conversation.customer_name : conversation.creator_name,
        creatorName: conversation.creator_name,
        imageUrl: conversation.creator_photo_id ? `/api/media/${conversation.creator_photo_id}` : null,
        updatedAt: conversation.updated_at,
        messages: messages.rows.filter((message) => message.conversation_id === conversation.id).map((message) => ({
          id: message.id,
          body: message.body,
          mine: message.sender_user_id === account.id,
          status: message.status,
          createdAt: message.created_at
        }))
      }))
    });
  } catch (error) {
    console.error("Message load failed", error);
    return NextResponse.json({ error: "Messages could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect your wallet to send a message." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { profileId?: string; conversationId?: string; body?: string } | null;
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 800) : "";
  if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  try {
    const result = await transaction(async (client) => {
      const account = await accountForSession(session);
      if (!account?.account_type) throw new Error("ACCOUNT_REQUIRED");
      let conversationId = input?.conversationId || "";
      let creatorProfileId = "";

      if (account.account_type === "CUSTOMER") {
        if (!input?.profileId) throw new Error("PROFILE_REQUIRED");
        const creator = await client.query<{ id: string; user_id: string }>(`
          SELECT p.id, p.user_id FROM profiles p JOIN users u ON u.id = p.user_id
          WHERE p.id = $1 AND p.review_status = 'APPROVED' AND u.account_type = 'CREATOR'
        `, [input.profileId]);
        if (!creator.rowCount || creator.rows[0].user_id === account.id) throw new Error("PROFILE_NOT_FOUND");
        creatorProfileId = creator.rows[0].id;
        const conversation = await client.query<{ id: string }>(`
          INSERT INTO conversations (id, customer_user_id, creator_profile_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (customer_user_id, creator_profile_id)
          DO UPDATE SET updated_at = now()
          RETURNING id
        `, [randomUUID(), account.id, creatorProfileId]);
        conversationId = conversation.rows[0].id;
      } else {
        if (!conversationId) throw new Error("CONVERSATION_REQUIRED");
        const conversation = await client.query<{ creator_profile_id: string }>(`
          SELECT c.creator_profile_id
          FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
          WHERE c.id = $1 AND p.user_id = $2
        `, [conversationId, account.id]);
        if (!conversation.rowCount) throw new Error("CONVERSATION_NOT_FOUND");
        creatorProfileId = conversation.rows[0].creator_profile_id;
      }

      const id = randomUUID();
      await client.query(`
        INSERT INTO messages (id, conversation_id, sender_user_id, body)
        VALUES ($1, $2, $3, $4)
      `, [id, conversationId, account.id, body]);
      await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
      await client.query(`
        UPDATE profiles
        SET messages_sent = messages_sent + CASE WHEN user_id = $1 THEN 1 ELSE 0 END,
            messages_received = messages_received + CASE WHEN user_id <> $1 THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = $2
      `, [account.id, creatorProfileId]);
      return { id, conversationId };
    });
    return NextResponse.json({ ...result, body, createdAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ACCOUNT_REQUIRED") return NextResponse.json({ error: "Choose whether this is a creator or customer account first." }, { status: 409 });
    if (["PROFILE_REQUIRED", "PROFILE_NOT_FOUND"].includes(message)) return NextResponse.json({ error: "That creator profile is not available." }, { status: 404 });
    if (["CONVERSATION_REQUIRED", "CONVERSATION_NOT_FOUND"].includes(message)) return NextResponse.json({ error: "That conversation is not available." }, { status: 404 });
    console.error("Message send failed", error);
    return NextResponse.json({ error: "Your message could not be sent." }, { status: 503 });
  }
}
