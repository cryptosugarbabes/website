import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";

const actions = [
  "PIN_TOPIC", "UNPIN_TOPIC", "LOCK_TOPIC", "UNLOCK_TOPIC",
  "HIDE_TOPIC", "RESTORE_TOPIC", "HIDE_POST", "RESTORE_POST"
] as const;
type ModerationAction = typeof actions[number];

type TopicRow = {
  id: string; category_name: string; title: string; body: string; status: string;
  is_pinned: boolean; author_name: string; author_email: string | null;
  reply_count: string; hidden_reply_count: string; created_at: string; last_activity_at: string;
};
type PostRow = {
  id: string; topic_id: string; body: string; status: string; author_name: string;
  author_email: string | null; created_at: string;
};
type AuditRow = {
  id: string; topic_id: string | null; post_id: string | null; action: string;
  reason: string | null; actor_email: string; created_at: string; topic_title: string | null;
};

function isAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && (actions as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  if (!adminIdentity(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });

  const [topics, posts, audit] = await Promise.all([
    query<TopicRow>(`
      SELECT t.id, c.name AS category_name, t.title, t.body, t.status, t.is_pinned,
        COALESCE(p.display_name, cp.display_name, u.email, 'Member') AS author_name,
        u.email AS author_email,
        (SELECT COUNT(*)::text FROM forum_posts fp WHERE fp.topic_id = t.id AND fp.status = 'PUBLISHED') AS reply_count,
        (SELECT COUNT(*)::text FROM forum_posts fp WHERE fp.topic_id = t.id AND fp.status = 'HIDDEN') AS hidden_reply_count,
        t.created_at, t.last_activity_at
      FROM forum_topics t
      JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN users u ON u.id = t.author_user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      ORDER BY t.last_activity_at DESC
      LIMIT 300
    `),
    query<PostRow>(`
      SELECT fp.id, fp.topic_id, fp.body, fp.status,
        COALESCE(p.display_name, cp.display_name, u.email, 'Member') AS author_name,
        u.email AS author_email, fp.created_at
      FROM forum_posts fp
      LEFT JOIN users u ON u.id = fp.author_user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      ORDER BY fp.created_at ASC
      LIMIT 1500
    `),
    query<AuditRow>(`
      SELECT a.id, a.topic_id, a.post_id, a.action, a.reason, a.actor_email, a.created_at,
        t.title AS topic_title
      FROM forum_moderation_audit a
      LEFT JOIN forum_topics t ON t.id = a.topic_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `)
  ]);

  const postsByTopic = new Map<string, PostRow[]>();
  for (const post of posts.rows) postsByTopic.set(post.topic_id, [...(postsByTopic.get(post.topic_id) || []), post]);

  return NextResponse.json({
    topics: topics.rows.map((topic) => ({
      id: topic.id,
      categoryName: topic.category_name,
      title: topic.title,
      body: topic.body,
      status: topic.status,
      pinned: topic.is_pinned,
      authorName: topic.author_name,
      authorEmail: topic.author_email,
      replyCount: Number(topic.reply_count),
      hiddenReplyCount: Number(topic.hidden_reply_count),
      createdAt: topic.created_at,
      lastActivityAt: topic.last_activity_at,
      posts: (postsByTopic.get(topic.id) || []).map((post) => ({
        id: post.id,
        topicId: post.topic_id,
        body: post.body,
        status: post.status,
        authorName: post.author_name,
        authorEmail: post.author_email,
        createdAt: post.created_at
      }))
    })),
    audit: audit.rows.map((entry) => ({
      id: entry.id,
      topicId: entry.topic_id,
      postId: entry.post_id,
      action: entry.action,
      reason: entry.reason,
      actorEmail: entry.actor_email,
      createdAt: entry.created_at,
      topicTitle: entry.topic_title
    }))
  });
}

export async function POST(request: NextRequest) {
  const administrator = adminIdentity(request);
  if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const input = await request.json().catch(() => null) as { action?: unknown; targetId?: unknown; reason?: unknown } | null;
  if (!isAction(input?.action) || typeof input?.targetId !== "string") {
    return NextResponse.json({ error: "Choose a valid forum moderation action." }, { status: 400 });
  }
  const action = input.action;
  const targetId = input.targetId;
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  if ((action === "HIDE_TOPIC" || action === "HIDE_POST") && reason.length < 3) {
    return NextResponse.json({ error: "Add a short private reason before hiding forum content." }, { status: 400 });
  }

  try {
    await transaction(async (client) => {
      let topicId: string | null = null;
      let postId: string | null = null;
      if (action.endsWith("_POST")) {
        const post = await client.query<{ id: string; topic_id: string }>(
          `SELECT id, topic_id FROM forum_posts WHERE id = $1 FOR UPDATE`, [targetId]
        );
        if (!post.rowCount) throw new Error("CONTENT_NOT_FOUND");
        topicId = post.rows[0].topic_id;
        postId = post.rows[0].id;
        await client.query(
          `UPDATE forum_posts SET status = $2, updated_at = now() WHERE id = $1`,
          [postId, action === "HIDE_POST" ? "HIDDEN" : "PUBLISHED"]
        );
      } else {
        const topic = await client.query<{ id: string; status: string }>(
          `SELECT id, status FROM forum_topics WHERE id = $1 FOR UPDATE`, [targetId]
        );
        if (!topic.rowCount) throw new Error("CONTENT_NOT_FOUND");
        topicId = topic.rows[0].id;
        if ((action === "LOCK_TOPIC" || action === "UNLOCK_TOPIC") && topic.rows[0].status === "HIDDEN") {
          throw new Error("HIDDEN_TOPIC");
        }
        if (action === "PIN_TOPIC" || action === "UNPIN_TOPIC") {
          await client.query(`UPDATE forum_topics SET is_pinned = $2, updated_at = now() WHERE id = $1`, [topicId, action === "PIN_TOPIC"]);
        } else {
          const status = action === "LOCK_TOPIC" ? "LOCKED" : action === "HIDE_TOPIC" ? "HIDDEN" : "PUBLISHED";
          await client.query(`UPDATE forum_topics SET status = $2, updated_at = now() WHERE id = $1`, [topicId, status]);
        }
      }
      await client.query(`
        INSERT INTO forum_moderation_audit (id, topic_id, post_id, action, reason, actor_email)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), topicId, postId, action, reason || null, administrator]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "CONTENT_NOT_FOUND") {
      return NextResponse.json({ error: "That forum content no longer exists." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "HIDDEN_TOPIC") {
      return NextResponse.json({ error: "Restore the hidden topic before changing its reply status." }, { status: 409 });
    }
    console.error("Forum moderation failed", error);
    return NextResponse.json({ error: "The forum moderation action could not be saved." }, { status: 503 });
  }
}
