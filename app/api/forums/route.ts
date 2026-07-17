import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { acceptanceComplete } from "@/lib/legal-acceptance";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

type CategoryRow = {
  id: string;
  name: string;
  description: string;
  topic_count: string;
};

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
  reply_count: string;
  last_activity_at: Date;
  created_at: Date;
};

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function GET() {
  try {
    const [categories, topics] = await Promise.all([
      query<CategoryRow>(`
        SELECT c.id, c.name, c.description, count(t.id)::text AS topic_count
        FROM forum_categories c
        LEFT JOIN forum_topics t ON t.category_id = c.id AND t.status <> 'HIDDEN'
        GROUP BY c.id, c.name, c.description, c.position
        ORDER BY c.position, c.name
      `),
      query<TopicRow>(`
        SELECT t.id, t.category_id, c.name AS category_name, t.title, t.body,
          t.status, t.is_pinned,
          COALESCE(p.display_name, cp.display_name, NULLIF(split_part(u.email, '@', 1), ''), 'Member') AS author_name,
          u.account_type AS author_type,
          count(fp.id)::text AS reply_count,
          t.last_activity_at, t.created_at
        FROM forum_topics t
        JOIN forum_categories c ON c.id = t.category_id
        LEFT JOIN users u ON u.id = t.author_user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN forum_posts fp ON fp.topic_id = t.id AND fp.status = 'PUBLISHED'
        WHERE t.status <> 'HIDDEN'
        GROUP BY t.id, c.name, p.display_name, cp.display_name, u.email, u.account_type
        ORDER BY t.is_pinned DESC, t.last_activity_at DESC
        LIMIT 100
      `)
    ]);

    return NextResponse.json({
      categories: categories.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        topicCount: Number(row.topic_count)
      })),
      topics: topics.rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        title: row.title,
        excerpt: row.body.length > 190 ? `${row.body.slice(0, 187)}…` : row.body,
        status: row.status,
        pinned: row.is_pinned,
        authorName: row.author_name,
        authorType: row.author_type,
        replyCount: Number(row.reply_count),
        lastActivityAt: row.last_activity_at,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("Forum load failed", error);
    return NextResponse.json({ error: "The forums could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to start a discussion." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ error: "Finish creating your member account first." }, { status: 403 });
    if (!acceptanceComplete(account)) return NextResponse.json({ error: "Accept the current membership terms from your dashboard first." }, { status: 403 });

    const rate = await takeRateLimit(`forum-topic:${account.id}:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Please wait before starting another discussion." }, {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) }
      });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const categoryId = cleanText(body?.categoryId, 40);
    const title = cleanText(body?.title, 140);
    const topicBody = cleanText(body?.body, 4000);
    if (title.length < 5) return NextResponse.json({ error: "Give your discussion a title of at least five characters." }, { status: 400 });
    if (topicBody.length < 10) return NextResponse.json({ error: "Add a little more detail to your discussion." }, { status: 400 });

    const category = await query<{ id: string }>(`SELECT id FROM forum_categories WHERE id = $1`, [categoryId]);
    if (!category.rowCount) return NextResponse.json({ error: "Choose a valid forum category." }, { status: 400 });

    const id = randomUUID();
    await query(`
      INSERT INTO forum_topics (id, category_id, author_user_id, title, body)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, categoryId, account.id, title, topicBody]);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Forum topic creation failed", error);
    return NextResponse.json({ error: "Your discussion could not be published." }, { status: 503 });
  }
}
