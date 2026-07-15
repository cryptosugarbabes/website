import { PoolClient, QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { WalletSession } from "@/lib/request-security";

export type AccountType = "CREATOR" | "CUSTOMER";

export type AccountRow = QueryResultRow & {
  id: string;
  account_type: AccountType | null;
  display_name: string | null;
  bio: string | null;
  generosity_points: string | null;
};

export async function accountForSession(session: WalletSession) {
  const result = await query<AccountRow>(`
    SELECT u.id, u.account_type, cp.display_name, cp.bio, cp.generosity_points::text
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.wallet_chain = $1 AND u.wallet_address = $2
  `, [session.chain, session.address]);
  return result.rows[0] || null;
}

export async function ensureUser(client: PoolClient, session: WalletSession) {
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
