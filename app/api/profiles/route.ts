import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { ensureUser } from "@/lib/accounts";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";

type ProfileRow = {
  id: string;
  display_name: string;
  declared_age: number;
  city: string;
  country: string;
  headline: string;
  bio: string;
  interests: string[];
  review_status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  messages_sent: string;
  messages_received: string;
  photo_likes: string;
  support_usdc: string;
  creator_points: string;
  points_24h: string;
  is_own: boolean;
  media: Array<{ id: string; approved: boolean; paidLikes: number }>;
};

function publicProfile(row: ProfileRow) {
  const photos = row.media.map((item) => `/api/media/${item.id}`);
  const media = row.media.map((item) => ({ id: item.id, url: `/api/media/${item.id}`, paidLikes: Number(item.paidLikes || 0) }));
  const name = row.display_name;
  return {
    id: row.id,
    name,
    age: row.declared_age,
    city: row.city,
    country: row.country,
    headline: row.headline,
    bio: row.bio,
    initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    verified: row.review_status === "APPROVED",
    online: false,
    tags: row.interests.length ? row.interests : ["New member"],
    colors: ["#d69286", "#6e2949", "#1d1019"],
    motif: "night",
    imageUrl: photos[0],
    photos,
    media,
    messagesSent: Number(row.messages_sent),
    messagesReceived: Number(row.messages_received),
    photoLikes: Number(row.photo_likes),
    giftsUsdc: Number(row.support_usdc),
    creatorPoints: Number(row.creator_points),
    points24h: Number(row.points_24h),
    reviewStatus: row.review_status,
    isOwn: row.is_own
  };
}

export async function GET(request: NextRequest) {
  const session = walletSession(request);
  const values: unknown[] = [];
  let ownerClause = "FALSE";
  if (session) {
    values.push(session.chain, session.address);
    ownerClause = `(u.wallet_chain = $1 AND u.wallet_address = $2)`;
  }

  try {
    const result = await query<ProfileRow>(`
      SELECT p.id, p.display_name, p.declared_age, p.city, p.country, p.headline, p.bio,
        p.interests, p.review_status, p.messages_sent, p.messages_received, p.photo_likes,
        support_stats.support_total AS support_usdc,
        (floor(p.photo_likes::numeric / 100) * 5 + floor(support_stats.support_total)) AS creator_points,
        (
          (
            floor(p.photo_likes::numeric / 100)
            - floor(GREATEST(p.photo_likes - support_stats.likes_24h, 0)::numeric / 100)
          ) * 5
          + floor(support_stats.support_total)
          - floor(GREATEST(support_stats.support_total - support_stats.support_24h, 0))
        ) AS points_24h,
        ${ownerClause} AS is_own,
        COALESCE(json_agg(json_build_object('id', m.id, 'approved', m.is_approved, 'paidLikes', m.paid_likes)
          ORDER BY m.sort_order, m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]') AS media
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE se.kind = 'PAID_LIKE'
              AND se.created_at >= now() - interval '24 hours'
          ) AS likes_24h,
          COALESCE(SUM(se.gross_amount_usdc) FILTER (
            WHERE se.kind IN ('GIFT', 'MESSAGE_BOOST')
          ), 0) AS support_total,
          COALESCE(SUM(se.gross_amount_usdc) FILTER (
            WHERE se.kind IN ('GIFT', 'MESSAGE_BOOST')
              AND se.created_at >= now() - interval '24 hours'
          ), 0) AS support_24h
        FROM support_events se
        WHERE se.creator_profile_id = p.id
      ) support_stats ON TRUE
      LEFT JOIN profile_media m ON m.profile_id = p.id
        AND (p.review_status <> 'APPROVED' OR m.is_approved = TRUE)
      WHERE (p.review_status = 'APPROVED' AND u.account_type = 'CREATOR') OR ${ownerClause}
      GROUP BY p.id, u.wallet_chain, u.wallet_address,
        support_stats.likes_24h, support_stats.support_total, support_stats.support_24h
      ORDER BY CASE WHEN ${ownerClause} THEN 0 ELSE 1 END,
        points_24h DESC, creator_points DESC, p.updated_at DESC
    `, values);
    return NextResponse.json({ profiles: result.rows.map(publicProfile) });
  } catch (error) {
    console.error("Profile list failed", error);
    return NextResponse.json({ error: "Profiles are temporarily unavailable." }, { status: 503 });
  }
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect and verify your wallet first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const displayName = text(body?.name, 80);
  const city = text(body?.city, 100);
  const country = text(body?.country, 100);
  const headline = text(body?.headline, 90);
  const bio = text(body?.bio, 500);
  const age = Number(body?.age);
  const interests = Array.isArray(body?.interests)
    ? body.interests.map((item) => text(item, 40)).filter(Boolean).slice(0, 5)
    : [];

  if (!displayName || !city || !country || !headline || !bio || !Number.isInteger(age) || age < 18 || age > 99) {
    return NextResponse.json({ error: "Complete every required field and confirm you are at least 18." }, { status: 400 });
  }

  try {
    const profile = await transaction(async (client) => {
      const user = await ensureUser(client, session);
      if (user.account_type === "CUSTOMER") throw new Error("CUSTOMER_PROFILE");
      if (!user.account_type) await client.query(`UPDATE users SET account_type = 'CREATOR', updated_at = now() WHERE id = $1`, [user.id]);
      const userId = user.id;
      const profileId = randomUUID();
      const result = await client.query<{ id: string; review_status: string }>(`
        INSERT INTO profiles (id, user_id, display_name, declared_age, city, country, headline, bio, interests, review_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_REVIEW')
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          declared_age = EXCLUDED.declared_age,
          city = EXCLUDED.city,
          country = EXCLUDED.country,
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          interests = EXCLUDED.interests,
          review_status = 'PENDING_REVIEW',
          rejection_reason = NULL,
          reviewed_at = NULL,
          updated_at = now()
        RETURNING id, review_status
      `, [profileId, userId, displayName, age, city, country, headline, bio, interests]);
      return result.rows[0];
    });
    return NextResponse.json({ profileId: profile.id, reviewStatus: profile.review_status });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_PROFILE") {
      return NextResponse.json({ error: "Customer accounts stay private and cannot publish creator profiles." }, { status: 409 });
    }
    console.error("Profile save failed", error);
    return NextResponse.json({ error: "Your profile could not be saved. Please try again." }, { status: 503 });
  }
}
