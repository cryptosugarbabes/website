import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PoolClient } from "pg";
import { query, transaction } from "@/lib/db";
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
  is_own: boolean;
  media: Array<{ id: string; approved: boolean }>;
};

function publicProfile(row: ProfileRow) {
  const photos = row.media.map((item) => `/api/media/${item.id}`);
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
    messagesSent: Number(row.messages_sent),
    messagesReceived: Number(row.messages_received),
    photoLikes: Number(row.photo_likes),
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
        ${ownerClause} AS is_own,
        COALESCE(json_agg(json_build_object('id', m.id, 'approved', m.is_approved)
          ORDER BY m.sort_order, m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]') AS media
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN profile_media m ON m.profile_id = p.id
        AND (p.review_status <> 'APPROVED' OR m.is_approved = TRUE)
      WHERE p.review_status = 'APPROVED' OR ${ownerClause}
      GROUP BY p.id, u.wallet_chain, u.wallet_address
      ORDER BY CASE WHEN ${ownerClause} THEN 0 ELSE 1 END, p.updated_at DESC
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

async function upsertUser(client: PoolClient, chain: string, address: string) {
  const id = randomUUID();
  const result = await client.query<{ id: string }>(`
    INSERT INTO users (id, wallet_address, wallet_chain)
    VALUES ($1, $2, $3)
    ON CONFLICT (wallet_chain, wallet_address)
    DO UPDATE SET updated_at = now()
    RETURNING id
  `, [id, address, chain]);
  return result.rows[0].id;
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
      const userId = await upsertUser(client, session.chain, session.address);
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
    console.error("Profile save failed", error);
    return NextResponse.json({ error: "Your profile could not be saved. Please try again." }, { status: 503 });
  }
}
