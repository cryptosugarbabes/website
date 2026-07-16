import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticatedSession } from "@/lib/request-security";
import { acceptanceComplete, type AcceptanceRecord } from "@/lib/legal-acceptance";

type UserRow = AcceptanceRecord & {
  id: string;
  email: string | null;
  wallet_address: string | null;
  wallet_chain: string | null;
  account_type: "CREATOR" | "CUSTOMER" | null;
  status: "ACTIVE" | "SUSPENDED";
  suspension_reason: string | null;
  deletion_requested_at: Date | null;
  created_at: Date;
  customer_name: string | null;
  customer_bio: string | null;
  generosity_points: string | null;
};

export async function GET(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to open your dashboard." }, { status: 401 });

  try {
    const userResult = await query<UserRow>(`
      SELECT u.id, u.email, u.wallet_address, u.wallet_chain, u.account_type, u.status,
        u.adult_attested_at, u.terms_accepted_at, u.terms_version,
        u.privacy_accepted_at, u.privacy_version,
        u.suspension_reason, u.deletion_requested_at, u.created_at,
        cp.display_name AS customer_name, cp.bio AS customer_bio,
        cp.generosity_points::text
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE ($1::uuid IS NOT NULL AND u.id = $1)
         OR ($1::uuid IS NULL AND u.wallet_chain = $2 AND u.wallet_address = $3)
      LIMIT 1
    `, [session.userId || null, session.chain || null, session.address || null]);
    if (!userResult.rowCount) return NextResponse.json({ error: "Your account could not be found." }, { status: 404 });
    const user = userResult.rows[0];

    const [profile, totals, favorites, activity, reports, visibility] = await Promise.all([
      query<{
        id: string; display_name: string; declared_age: number; region: string; country: string;
        headline: string; bio: string; interests: string[]; review_status: string;
        rejection_reason: string | null; messages_sent: string; messages_received: string;
        photo_likes: string; media: Array<{ id: string; approved: boolean; paidLikes: number; focalX: number; focalY: number; sortOrder: number }>;
      }>(`
        SELECT p.id, p.display_name, p.declared_age, p.region, p.country, p.headline, p.bio,
          p.interests, p.review_status, p.rejection_reason, p.messages_sent::text,
          p.messages_received::text, p.photo_likes::text,
          COALESCE(json_agg(json_build_object(
            'id', m.id, 'approved', m.is_approved, 'paidLikes', m.paid_likes,
            'focalX', m.focal_x, 'focalY', m.focal_y, 'sortOrder', m.sort_order
          )
            ORDER BY m.sort_order, m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]') AS media
        FROM profiles p
        LEFT JOIN profile_media m ON m.profile_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
      `, [user.id]),
      query<{
        conversations: string; unread: string; favorites: string; messages: string;
        support_sent: string; creator_earnings: string; platform_fees: string;
      }>(`
        SELECT
          (SELECT count(*) FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
            WHERE c.customer_user_id = $1 OR p.user_id = $1)::text AS conversations,
          (SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
            JOIN profiles p ON p.id = c.creator_profile_id
            WHERE (c.customer_user_id = $1 OR p.user_id = $1) AND m.sender_user_id <> $1 AND m.status = 'SENT')::text AS unread,
          (SELECT count(*) FROM favorites WHERE user_id = $1)::text AS favorites,
          (SELECT count(*) FROM messages WHERE sender_user_id = $1)::text AS messages,
          COALESCE((SELECT sum(q.gross_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id WHERE se.supporter_user_id = $1), 0)::text AS support_sent,
          COALESCE((SELECT sum(q.creator_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id JOIN profiles p ON p.id = se.creator_profile_id WHERE p.user_id = $1), 0)::text AS creator_earnings,
          COALESCE((SELECT sum(q.platform_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id JOIN profiles p ON p.id = se.creator_profile_id WHERE p.user_id = $1), 0)::text AS platform_fees
      `, [user.id]),
      query<{ id: string; name: string; region: string; country: string; headline: string; photo_id: string | null }>(`
        SELECT p.id, p.display_name AS name, p.region, p.country, p.headline,
          (SELECT m.id FROM profile_media m WHERE m.profile_id = p.id AND m.is_approved = TRUE ORDER BY m.sort_order, m.created_at LIMIT 1) AS photo_id
        FROM favorites f JOIN profiles p ON p.id = f.profile_id JOIN users creator ON creator.id = p.user_id
        WHERE f.user_id = $1 AND p.review_status = 'APPROVED' AND creator.status = 'ACTIVE'
        ORDER BY f.created_at DESC LIMIT 100
      `, [user.id]),
      query<{
        id: string; direction: string; kind: string; gross: string; creator_share: string;
        platform_share: string; profile_name: string; network: string; created_at: Date; hashes: string[];
      }>(`
        SELECT se.id,
          CASE WHEN se.supporter_user_id = $1 THEN 'SENT' ELSE 'RECEIVED' END AS direction,
          se.kind, q.gross_amount_usdc::text AS gross, q.creator_amount_usdc::text AS creator_share,
          q.platform_amount_usdc::text AS platform_share, p.display_name AS profile_name,
          q.network, se.created_at,
          COALESCE(array_agg(pt.transaction_hash ORDER BY pt.purpose) FILTER (WHERE pt.transaction_hash IS NOT NULL), '{}') AS hashes
        FROM support_events se
        JOIN payment_quotes q ON q.id = se.quote_id
        JOIN profiles p ON p.id = se.creator_profile_id
        LEFT JOIN payment_transactions pt ON pt.quote_id = q.id
        WHERE se.supporter_user_id = $1 OR p.user_id = $1
        GROUP BY se.id, q.id, p.id
        ORDER BY se.created_at DESC LIMIT 100
      `, [user.id]),
      query<{ id: string; category: string; status: string; created_at: Date }>(`
        SELECT id, category, status, created_at FROM safety_reports
        WHERE reporter_user_id = $1 ORDER BY created_at DESC LIMIT 50
      `, [user.id]),
      query<{ rank: string; creator_count: string; total_points: string; points_24h: string }>(`
        WITH support AS (
          SELECT p.id,
            COALESCE(SUM(se.gross_amount_usdc) FILTER (WHERE se.kind IN ('GIFT', 'MESSAGE_BOOST')), 0) AS total_support,
            COALESCE(SUM(se.gross_amount_usdc) FILTER (WHERE se.kind IN ('GIFT', 'MESSAGE_BOOST') AND se.created_at >= now() - interval '24 hours'), 0) AS support_24h,
            COUNT(*) FILTER (WHERE se.kind = 'PAID_LIKE' AND se.created_at >= now() - interval '24 hours') AS likes_24h
          FROM profiles p LEFT JOIN support_events se ON se.creator_profile_id = p.id GROUP BY p.id
        ), scores AS (
          SELECT p.id, p.user_id,
            (floor(p.photo_likes::numeric / 100) * 5 + floor(s.total_support)) AS total_points,
            (((floor(p.photo_likes::numeric / 100) - floor(GREATEST(p.photo_likes - s.likes_24h, 0)::numeric / 100)) * 5)
              + floor(s.total_support) - floor(GREATEST(s.total_support - s.support_24h, 0))) AS points_24h,
            rank() OVER (ORDER BY
              (((floor(p.photo_likes::numeric / 100) - floor(GREATEST(p.photo_likes - s.likes_24h, 0)::numeric / 100)) * 5)
                + floor(s.total_support) - floor(GREATEST(s.total_support - s.support_24h, 0))) DESC,
              (floor(p.photo_likes::numeric / 100) * 5 + floor(s.total_support)) DESC,
              p.updated_at DESC) AS rank,
            count(*) OVER () AS creator_count
          FROM profiles p JOIN users u ON u.id = p.user_id JOIN support s ON s.id = p.id
          WHERE p.review_status = 'APPROVED' AND u.status = 'ACTIVE'
        )
        SELECT rank::text, creator_count::text, total_points::text, points_24h::text
        FROM scores WHERE user_id = $1
      `, [user.id])
    ]);

    const creator = profile.rows[0];
    const stats = totals.rows[0];
    const position = visibility.rows[0];
    return NextResponse.json({
      identity: {
        email: user.email,
        walletAddress: user.wallet_address,
        walletChain: user.wallet_chain,
        status: user.status,
        suspensionReason: user.suspension_reason,
        deletionRequestedAt: user.deletion_requested_at,
        createdAt: user.created_at,
        acceptanceComplete: acceptanceComplete(user),
        adultAttestedAt: user.adult_attested_at,
        termsAcceptedAt: user.terms_accepted_at,
        privacyAcceptedAt: user.privacy_accepted_at,
        termsVersion: user.terms_version,
        privacyVersion: user.privacy_version
      },
      account: {
        type: user.account_type,
        displayName: user.customer_name,
        bio: user.customer_bio,
        generosityPoints: Number(user.generosity_points || 0)
      },
      creatorProfile: creator ? {
        id: creator.id,
        name: creator.display_name,
        age: creator.declared_age,
        region: creator.region,
        country: creator.country,
        headline: creator.headline,
        bio: creator.bio,
        interests: creator.interests,
        reviewStatus: creator.review_status,
        rejectionReason: creator.rejection_reason,
        messagesSent: Number(creator.messages_sent),
        messagesReceived: Number(creator.messages_received),
        photoLikes: Number(creator.photo_likes),
        photos: creator.media.map((item) => ({
          id: item.id,
          url: `/api/media/${item.id}`,
          approved: item.approved,
          paidLikes: Number(item.paidLikes || 0),
          focalX: Number(item.focalX ?? 50),
          focalY: Number(item.focalY ?? 50),
          sortOrder: Number(item.sortOrder || 0)
        })),
        discoveryRank: position ? Number(position.rank) : null,
        creatorCount: position ? Number(position.creator_count) : null,
        totalPoints: position ? Number(position.total_points) : 0,
        points24h: position ? Number(position.points_24h) : 0
      } : null,
      stats: {
        conversations: Number(stats?.conversations || 0),
        unread: Number(stats?.unread || 0),
        favorites: Number(stats?.favorites || 0),
        messagesSent: Number(stats?.messages || 0),
        supportSentUsdc: Number(stats?.support_sent || 0),
        creatorEarningsUsdc: Number(stats?.creator_earnings || 0),
        platformFeesUsdc: Number(stats?.platform_fees || 0)
      },
      favorites: favorites.rows.map((item) => ({ ...item, imageUrl: item.photo_id ? `/api/media/${item.photo_id}` : null })),
      activity: activity.rows.map((item) => ({
        id: item.id, direction: item.direction, kind: item.kind, grossUsdc: Number(item.gross),
        creatorShareUsdc: Number(item.creator_share), platformShareUsdc: Number(item.platform_share),
        profileName: item.profile_name, network: item.network, createdAt: item.created_at, transactionHashes: item.hashes
      })),
      reports: reports.rows.map((item) => ({ id: item.id, category: item.category, status: item.status, createdAt: item.created_at }))
    });
  } catch (error) {
    console.error("Member dashboard load failed", error);
    return NextResponse.json({ error: "Your dashboard is temporarily unavailable." }, { status: 503 });
  }
}
