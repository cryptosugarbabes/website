import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession, AccountType, ensureUser } from "@/lib/accounts";
import { transaction } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function GET(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ account: null });
  try {
    const account = await accountForSession(session);
    return NextResponse.json({
      account: account ? {
        type: account.account_type,
        displayName: account.display_name,
        bio: account.bio,
        generosityPoints: Number(account.generosity_points || 0),
        hasCreatorProfile: account.has_creator_profile
      } : null
    });
  } catch (error) {
    console.error("Account load failed", error);
    return NextResponse.json({ error: "Your account could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const type = body?.type === "CREATOR" || body?.type === "CUSTOMER" ? body.type as AccountType : null;
  const displayName = text(body?.displayName, 80);
  const bio = text(body?.bio, 300);
  if (!type || (type === "CUSTOMER" && !displayName)) {
    return NextResponse.json({ error: "Choose an account type and add your display name." }, { status: 400 });
  }
  try {
    const account = await transaction(async (client) => {
      const user = await ensureUser(client, session);
      if (user.account_type && user.account_type !== type) {
        throw new Error("ACCOUNT_TYPE_LOCKED");
      }
      await client.query(`UPDATE users SET account_type = $1, updated_at = now() WHERE id = $2`, [type, user.id]);
      if (type === "CUSTOMER") {
        await client.query(`
          INSERT INTO customer_profiles (id, user_id, display_name, bio)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, updated_at = now()
        `, [randomUUID(), user.id, displayName, bio]);
      }
      return { type, displayName: type === "CUSTOMER" ? displayName : null, bio: type === "CUSTOMER" ? bio : null };
    });
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_TYPE_LOCKED") {
      return NextResponse.json({ error: "This account already has a different account type." }, { status: 409 });
    }
    console.error("Account save failed", error);
    return NextResponse.json({ error: "Your account could not be saved." }, { status: 503 });
  }
}
