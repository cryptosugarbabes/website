import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { query } from "@/lib/db";
import { pushNotificationsConfigured, validAndroidPushToken } from "@/lib/push-notifications";
import { authenticatedSession, requestHasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before enabling app notifications." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { token?: unknown; platform?: unknown; appVersion?: unknown } | null;
  if (!validAndroidPushToken(input?.token) || input?.platform !== "ANDROID") {
    return NextResponse.json({ error: "Invalid Android notification registration." }, { status: 400 });
  }
  const appVersion = typeof input.appVersion === "string" ? input.appVersion.trim().slice(0, 40) : "unknown";

  const account = await accountForSession(session);
  if (!account) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
  await query(`
    INSERT INTO app_push_devices (token, user_id, platform, app_version)
    VALUES ($1, $2, 'ANDROID', $3)
    ON CONFLICT (token) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      app_version = EXCLUDED.app_version,
      enabled = TRUE,
      updated_at = now(),
      last_seen_at = now()
  `, [input.token, account.id, appVersion || "unknown"]);
  return NextResponse.json({ registered: true, serverConfigured: pushNotificationsConfigured() });
}

export async function DELETE(request: NextRequest) {
  const session = authenticatedSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before changing app notifications." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { token?: unknown } | null;
  if (!validAndroidPushToken(input?.token)) return NextResponse.json({ error: "Invalid Android notification registration." }, { status: 400 });
  const account = await accountForSession(session);
  if (!account) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
  await query(`DELETE FROM app_push_devices WHERE token = $1 AND user_id = $2`, [input.token, account.id]);
  return NextResponse.json({ registered: false });
}
