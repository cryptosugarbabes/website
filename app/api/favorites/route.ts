import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";

export async function GET(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ profileIds: [] });
  try {
    const account = await accountForSession(session);
    if (!account) return NextResponse.json({ profileIds: [] });
    const result = await query<{ profile_id: string }>(`
      SELECT f.profile_id
      FROM favorites f
      JOIN profiles p ON p.id = f.profile_id
      JOIN users creator ON creator.id = p.user_id
      WHERE f.user_id = $1 AND p.review_status = 'APPROVED' AND creator.account_type = 'CREATOR'
    `, [account.id]);
    return NextResponse.json({ profileIds: result.rows.map((row) => row.profile_id) });
  } catch (error) {
    console.error("Favorite load failed", error);
    return NextResponse.json({ error: "Favorites could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect your wallet to save favorites." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { profileId?: string } | null;
  if (!body?.profileId) return NextResponse.json({ error: "Choose a profile." }, { status: 400 });

  try {
    const result = await transaction(async (client) => {
      const account = await accountForSession(session);
      if (!account) throw new Error("ACCOUNT_REQUIRED");
      const target = await client.query<{ id: string }>(`
        SELECT p.id FROM profiles p JOIN users u ON u.id = p.user_id
        WHERE p.id = $1 AND p.review_status = 'APPROVED' AND u.account_type = 'CREATOR'
      `, [body.profileId]);
      if (!target.rowCount) throw new Error("PROFILE_NOT_FOUND");
      const removed = await client.query(`DELETE FROM favorites WHERE user_id = $1 AND profile_id = $2 RETURNING profile_id`, [account.id, body.profileId]);
      if (removed.rowCount) return false;
      await client.query(`INSERT INTO favorites (user_id, profile_id) VALUES ($1, $2)`, [account.id, body.profileId]);
      return true;
    });
    return NextResponse.json({ favorited: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ACCOUNT_REQUIRED") return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });
    if (message === "PROFILE_NOT_FOUND") return NextResponse.json({ error: "That creator profile is not available." }, { status: 404 });
    console.error("Favorite save failed", error);
    return NextResponse.json({ error: "That favorite could not be saved." }, { status: 503 });
  }
}
