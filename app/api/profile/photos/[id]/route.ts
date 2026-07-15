import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";
import { safeStoragePath } from "@/lib/uploads";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect and verify your wallet first." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const { id } = await context.params;
  try {
    const media = await query<{ storage_key: string; profile_id: string }>(`
      SELECT m.storage_key, m.profile_id FROM profile_media m
      JOIN profiles p ON p.id = m.profile_id JOIN users u ON u.id = p.user_id
      WHERE m.id = $1 AND u.wallet_chain = $2 AND u.wallet_address = $3
    `, [id, session.chain, session.address]);
    if (!media.rowCount) return NextResponse.json({ error: "That photo was not found." }, { status: 404 });
    await transaction(async (client) => {
      await client.query(`DELETE FROM profile_media WHERE id = $1`, [id]);
      await client.query(`UPDATE profiles SET review_status = 'PENDING_REVIEW', reviewed_at = NULL, updated_at = now() WHERE id = $1`, [media.rows[0].profile_id]);
    });
    await fs.unlink(safeStoragePath(media.rows[0].storage_key)).catch(() => undefined);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Photo delete failed", error);
    return NextResponse.json({ error: "That photo could not be removed." }, { status: 503 });
  }
}
