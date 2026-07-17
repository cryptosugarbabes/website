import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";

type AlertAccountRow = {
  id: string;
  email: string | null;
  wallet_address: string | null;
  wallet_chain: string | null;
  account_type: string | null;
  display_name: string;
  enabled: boolean;
};

export async function GET(request: NextRequest) {
  const administrator = adminIdentity(request);
  if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });

  const accounts = await query<AlertAccountRow>(`
    SELECT u.id, u.email, u.wallet_address, u.wallet_chain, u.account_type,
      COALESCE(p.display_name, cp.display_name, u.email, 'Wallet account') AS display_name,
      COALESCE(alert.enabled, FALSE) AS enabled
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN admin_message_alert_settings alert ON alert.monitored_user_id = u.id
    WHERE u.status = 'ACTIVE'
    ORDER BY COALESCE(alert.enabled, FALSE) DESC,
      lower(COALESCE(p.display_name, cp.display_name, u.email, 'Wallet account'))
  `);

  return NextResponse.json({
    accounts: accounts.rows.map((account) => ({
      userId: account.id,
      name: account.display_name,
      email: account.email,
      walletAddress: account.wallet_address,
      walletChain: account.wallet_chain,
      accountType: account.account_type,
      enabled: account.enabled
    }))
  });
}

export async function POST(request: NextRequest) {
  const administrator = adminIdentity(request);
  if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const input = await request.json().catch(() => null) as { userId?: string; enabled?: boolean } | null;
  if (!input?.userId || typeof input.enabled !== "boolean") {
    return NextResponse.json({ error: "Choose an account and alert setting." }, { status: 400 });
  }

  try {
    await transaction(async (client) => {
      const account = await client.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'ACTIVE'`, [input.userId]);
      if (!account.rowCount) throw new Error("ACCOUNT_NOT_FOUND");
      await client.query(`
        INSERT INTO admin_message_alert_settings (monitored_user_id, enabled, updated_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (monitored_user_id) DO UPDATE
        SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()
      `, [input.userId, input.enabled, administrator]);
      await client.query(`
        INSERT INTO admin_message_alert_audit (id, monitored_user_id, actor_email, enabled)
        VALUES ($1, $2, $3, $4)
      `, [randomUUID(), input.userId, administrator, input.enabled]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "That account is no longer active." }, { status: 404 });
    }
    console.error("Message alert setting update failed", error);
    return NextResponse.json({ error: "Message alert settings could not be saved." }, { status: 503 });
  }
}
