import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { acceptanceComplete } from "@/lib/legal-acceptance";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

type TopicRow = {
  id: string;
  category_id: string;
  category_name: string;
  title: string;
  body: string;
  status: "PUBLISHED" | "LOCKED";
  is_pinned: boolean;
  author_name: string;
  author_type: "CREATOR" | "CUSTOMER" | null;
  created_at: Date;
};

type PostRow = {
  id: string;
  body: string;
  author_name: string;
  author_type: "CREATOR" | "CUSTOMER" | null;
  created_at: Date;
};

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function GET(_request: NextRequest, context: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await context.params;
  try {
    const topic = await query<TopicRow>(`
      SELECT t.id, t.category_id, c.name AS category_name, t.title, t.body,
        t.status, t.is_pinned,
        COALESCE(p.display_name, cp.display_name, NULLIF(split_part(u.email, '@', 1), ''), 'Member') AS author_name,
        u.account_type AS author_type, t.created_at
      FROM forum_topics t
      JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN users u ON u.id = t.author_user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE t.id = $1 AND t.status <> 'HIDDEN'
      LIMIT 1
    `, [topicId]);
    if (!topic.rowCount) return NextResponse.json({ error: "Discussion not found." }, { status: 404 });

    const posts = await query<PostRow>(`
      SELECT fp.id, fp.body,
        COALESCE(p.display_name, cp.display_name, NULLIF(split_part(u.email, '@', 1), ''), 'Member') AS author_name,
        u.account_type AS author_type, fp.created_at
      FROM forum_posts fp
      LEFT JOIN users u ON u.id = fp.author_user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE fp.topic_id = $1 AND fp.status = 'PUBLISHED'
      ORDER BY fp.created_at
    `, [topicId]);

    const row = topic.rows[0];
    return NextResponse.json({
      topic: {
        id: row.id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        title: row.title,
        body: row.body,
        status: row.status,
        pinned: row.is_pinned,
        authorName: row.author_name,
        authorType: row.author_type,
        createdAt: row.created_at
      },
      posts: posts.rows.map((post) => ({
        id: post.id,
        body: post.body,
        authorName: post.author_name,
        authorType: post.author_type,
        createdAt: post.created_at
      }))
    });
  } catch (error) {
    console.error("Forum discussion load failed", error);
    return NextResponse.json({ error: "This discussion could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ topicId: string }> }) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to reply." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const { topicId } = await context.params;

  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ error: "Finish creating your member account first." }, { status: 403 });
    if (!acceptanceComplete(account)) return NextResponse.json({ error: "Accept the current membership terms from your dashboard first." }, { status: 403 });

    const rate = await takeRateLimit(`forum-reply:${account.id}:${clientAddress(request)}`, 30, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Please wait before posting another reply." }, {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) }
      });
    }

    const data = await request.json().catch(() => null) as Record<string, unknown> | null;
    const replyBody = cleanText(data?.body, 4000);
    if (replyBody.length < 2) return NextResponse.json({ error: "Write a reply before posting." }, { status: 400 });

    const id = randomUUID();
    await transaction(async (client) => {
      const topic = await client.query<{ status: string }>(`
        SELECT status FROM forum_topics WHERE id = $1 AND status <> 'HIDDEN' FOR UPDATE
      `, [topicId]);
      if (!topic.rowCount) throw new Error("TOPIC_NOT_FOUND");
      if (topic.rows[0].status === "LOCKED") throw new Error("TOPIC_LOCKED");
      await client.query(`
        INSERT INTO forum_posts (id, topic_id, author_user_id, body)
        VALUES ($1, $2, $3, $4)
      `, [id, topicId, account.id, replyBody]);
      await client.query(`UPDATE forum_topics SET last_activity_at = now(), updated_at = now() WHERE id = $1`, [topicId]);
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TOPIC_LOCKED") {
      return NextResponse.json({ error: "This discussion is closed to new replies." }, { status: 409 });
    }
    console.error("Forum reply creation failed", error);
    return NextResponse.json({ error: "Your reply could not be published." }, { status: 503 });
  }
}
