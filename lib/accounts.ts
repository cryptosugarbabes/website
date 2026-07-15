import { PoolClient, QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { AuthSession } from "@/lib/session";

export type AccountType = "CREATOR" | "CUSTOMER";

export type AccountRow = QueryResultRow & {
  id: string;
  account_type: AccountType | null;
  display_name: string | null;
  bio: string | null;
  generosity_points: string | null;
};

export async function accountForSession(session: AuthSession) {
  const result = await query<AccountRow>(`
    SELECT u.id, u.account_type, cp.display_name, cp.bio, cp.generosity_points::text
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE ($1::uuid IS NOT NULL AND u.id = $1)
       OR ($1::uuid IS NULL AND u.wallet_chain = $2 AND u.wallet_address = $3)
    LIMIT 1
  `, [session.userId || null, session.chain || null, session.address || null]);
  return result.rows[0] || null;
}

export async function ensureUser(client: PoolClient, session: AuthSession) {
  if (session.userId) {
    const existing = await client.query<{ id: string; account_type: AccountType | null }>(`
      SELECT id, account_type FROM users WHERE id = $1
    `, [session.userId]);
    if (!existing.rowCount) throw new Error("SESSION_USER_NOT_FOUND");
    return existing.rows[0];
  }
  if (!session.address || !session.chain) throw new Error("WALLET_REQUIRED");
  const id = randomUUID();
  const result = await client.query<{ id: string; account_type: AccountType | null }>(`
    INSERT INTO users (id, wallet_address, wallet_chain)
    VALUES ($1, $2, $3)
    ON CONFLICT (wallet_chain, wallet_address)
    DO UPDATE SET updated_at = now()
    RETURNING id, account_type
  `, [id, session.address, session.chain]);
  return result.rows[0];
}
