import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession, AccountType, ensureUser } from "@/lib/accounts";
import { transaction } from "@/lib/db";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";
import { acceptanceComplete, CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal-acceptance";

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
        hasCreatorProfile: account.has_creator_profile,
        acceptance: {
          complete: acceptanceComplete(account),
          adultAttestedAt: account.adult_attested_at,
          termsAcceptedAt: account.terms_accepted_at,
          privacyAcceptedAt: account.privacy_accepted_at,
          termsVersion: account.terms_version,
          privacyVersion: account.privacy_version
        }
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
  const acceptedAdult = body?.acceptedAdult === true;
  const acceptedTerms = body?.acceptedTerms === true;
  const acceptedPrivacy = body?.acceptedPrivacy === true;
  if (!type || (type === "CUSTOMER" && !displayName)) {
    return NextResponse.json({ error: "Choose an account type and add your display name." }, { status: 400 });
  }
  if (!acceptedAdult || !acceptedTerms || !acceptedPrivacy) {
    return NextResponse.json({ error: "Confirm that you are 18+ and accept the Terms and Privacy Policy." }, { status: 400 });
  }
  try {
    const account = await transaction(async (client) => {
      const user = await ensureUser(client, session);
      if (user.account_type && user.account_type !== type) {
        throw new Error("ACCOUNT_TYPE_LOCKED");
      }
      await client.query(`
        UPDATE users SET account_type = $1,
          adult_attested_at = now(),
          terms_accepted_at = now(), terms_version = $2,
          privacy_accepted_at = now(), privacy_version = $3,
          updated_at = now()
        WHERE id = $4
      `, [type, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, user.id]);
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
