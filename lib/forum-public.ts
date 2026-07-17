import { cache } from "react";
import { query } from "@/lib/db";

export type PublicForumTopic = {
  id: string;
  categoryName: string;
  title: string;
  body: string;
  status: "PUBLISHED" | "LOCKED";
  authorName: string;
  authorType: "CREATOR" | "CUSTOMER" | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicForumPost = {
  id: string;
  body: string;
  authorName: string;
  authorType: "CREATOR" | "CUSTOMER" | null;
  createdAt: Date;
};

type TopicRow = {
  id: string;
  category_name: string;
  title: string;
  body: string;
  status: "PUBLISHED" | "LOCKED";
  author_name: string;
  author_type: "CREATOR" | "CUSTOMER" | null;
  created_at: Date;
  updated_at: Date;
};

type PostRow = {
  id: string;
  body: string;
  author_name: string;
  author_type: "CREATOR" | "CUSTOMER" | null;
  created_at: Date;
};

export const getPublicForumTopic = cache(async (topicId: string): Promise<{
  topic: PublicForumTopic;
  posts: PublicForumPost[];
} | null> => {
  const topic = await query<TopicRow>(`
    SELECT t.id::text, c.name AS category_name, t.title, t.body, t.status,
      COALESCE(p.display_name, cp.display_name, NULLIF(split_part(u.email, '@', 1), ''), 'Member') AS author_name,
      u.account_type AS author_type, t.created_at, t.updated_at
    FROM forum_topics t
    JOIN forum_categories c ON c.id = t.category_id
    LEFT JOIN users u ON u.id = t.author_user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE t.id = $1 AND t.status <> 'HIDDEN'
    LIMIT 1
  `, [topicId]);

  if (!topic.rowCount) return null;

  const posts = await query<PostRow>(`
    SELECT fp.id::text, fp.body,
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
  return {
    topic: {
      id: row.id,
      categoryName: row.category_name,
      title: row.title,
      body: row.body,
      status: row.status,
      authorName: row.author_name,
      authorType: row.author_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    posts: posts.rows.map((post) => ({
      id: post.id,
      body: post.body,
      authorName: post.author_name,
      authorType: post.author_type,
      createdAt: post.created_at,
    })),
  };
});
