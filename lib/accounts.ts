import { PoolClient, QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { AuthSession } from "@/lib/session";
import { type AcceptanceRecord } from "@/lib/legal-acceptance";

export type AccountType = "CREATOR" | "CUSTOMER";

export type AccountRow = QueryResultRow & AcceptanceRecord & {
  id: string;
  account_type: AccountType | null;
  status: "ACTIVE" | "SUSPENDED";
  display_name: string | null;
  bio: string | null;
  generosity_points: string | null;
  monthly_support_sent: string;
  has_creator_profile: boolean;
};

export async function accountForSession(session: AuthSession) {
  const result = await query<AccountRow>(`
    SELECT u.id, u.account_type, u.status, u.adult_attested_at, u.terms_accepted_at,
      u.terms_version, u.privacy_accepted_at, u.privacy_version,
      cp.display_name, cp.bio, cp.generosity_points::text,
      COALESCE((
        SELECT sum(q.gross_amount_usdc)
        FROM support_events se
        JOIN payment_quotes q ON q.id = se.quote_id
        WHERE se.supporter_user_id = u.id
          AND q.status = 'CONFIRMED'
          AND q.confirmed_at >= date_trunc('month', now())
          AND q.confirmed_at < date_trunc('month', now()) + interval '1 month'
      ), 0)::text AS monthly_support_sent,
      EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS has_creator_profile
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE ($1::uuid IS NOT NULL AND u.id = $1)
       OR ($1::uuid IS NULL AND u.wallet_chain = $2 AND u.wallet_address = $3)
    LIMIT 1
  `, [session.userId || null, session.chain || null, session.address || null]);
  const account = result.rows[0] || null;
  return account?.status === "ACTIVE" ? account : null;
}

export async function ensureUser(client: PoolClient, session: AuthSession) {
  if (session.userId) {
    const existing = await client.query<{ id: string; account_type: AccountType | null; status: string }>(`
      SELECT id, account_type, status FROM users WHERE id = $1
    `, [session.userId]);
    if (!existing.rowCount) throw new Error("SESSION_USER_NOT_FOUND");
    if (existing.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");
    return existing.rows[0];
  }
  if (!session.address || !session.chain) throw new Error("WALLET_REQUIRED");
  const id = randomUUID();
  const result = await client.query<{ id: string; account_type: AccountType | null; status: string }>(`
    INSERT INTO users (id, wallet_address, wallet_chain)
    VALUES ($1, $2, $3)
    ON CONFLICT (wallet_chain, wallet_address)
    DO UPDATE SET updated_at = now()
    RETURNING id, account_type, status
  `, [id, session.address, session.chain]);
  if (result.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");
  return result.rows[0];
}
