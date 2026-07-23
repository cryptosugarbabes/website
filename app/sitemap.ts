import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type ForumSitemapRow = {
  id: string;
  updated_at: Date;
};

const publicPages: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.9, changeFrequency: "monthly" },
  { path: "/crypto-safety", priority: 0.8, changeFrequency: "monthly" },
  { path: "/crypto-payments", priority: 0.8, changeFrequency: "monthly" },
  { path: "/forums", priority: 0.8, changeFrequency: "daily" },
  { path: "/safety", priority: 0.6, changeFrequency: "monthly" },
  { path: "/disputes", priority: 0.5, changeFrequency: "monthly" },
  { path: "/anti-slavery", priority: 0.5, changeFrequency: "monthly" },
  { path: "/anti-trafficking", priority: 0.6, changeFrequency: "monthly" },
  { path: "/consumer-protection", priority: 0.6, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = publicPages.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  try {
    const topics = await query<ForumSitemapRow>(`
      SELECT id::text, updated_at
      FROM forum_topics
      WHERE status <> 'HIDDEN'
      ORDER BY updated_at DESC
      LIMIT 10000
    `);

    return [
      ...staticEntries,
      ...topics.rows.map((topic) => ({
        url: absoluteUrl(`/forums/${topic.id}`),
        lastModified: topic.updated_at,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    console.error("Forum topics could not be added to the sitemap", error);
    return staticEntries;
  }
}
