import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { query } from "@/lib/db";

type ReviewRow = {
  id: string;
  display_name: string;
  declared_age: number;
  city: string;
  country: string;
  headline: string;
  bio: string;
  interests: string[];
  review_status: string;
  rejection_reason: string | null;
  updated_at: string;
  media: Array<{ id: string; approved: boolean }>;
};

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 401 });
  try {
    const result = await query<ReviewRow>(`
      SELECT p.id, p.display_name, p.declared_age, p.city, p.country, p.headline, p.bio,
        p.interests, p.review_status, p.rejection_reason, p.updated_at,
        COALESCE(
          json_agg(json_build_object('id', m.id::text, 'approved', m.is_approved) ORDER BY m.sort_order)
            FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS media
      FROM profiles p
      JOIN users u ON u.id = p.user_id AND u.account_type = 'CREATOR'
      LEFT JOIN profile_media m ON m.profile_id = p.id
      GROUP BY p.id
      ORDER BY CASE p.review_status WHEN 'PENDING_REVIEW' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END, p.updated_at DESC
    `);
    return NextResponse.json({ profiles: result.rows.map((row) => ({
      id: row.id,
      name: row.display_name,
      age: row.declared_age,
      city: row.city,
      country: row.country,
      headline: row.headline,
      bio: row.bio,
      interests: row.interests,
      status: row.review_status,
      rejectionReason: row.rejection_reason,
      updatedAt: row.updated_at,
      photos: row.media.map((photo) => ({ id: photo.id, url: `/api/admin/media/${photo.id}`, approved: photo.approved }))
    })) });
  } catch (error) {
    console.error("Admin profile list failed", error);
    return NextResponse.json({ error: "Profiles are temporarily unavailable." }, { status: 503 });
  }
}
