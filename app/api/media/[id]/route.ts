import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticatedSession } from "@/lib/request-security";
import { safeStoragePath } from "@/lib/uploads";

type MediaRow = {
  storage_key: string;
  mime_type: string;
  is_approved: boolean;
  wallet_chain: string;
  wallet_address: string;
  user_id: string;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await query<MediaRow>(`
      SELECT m.storage_key, m.mime_type, m.is_approved, u.wallet_chain, u.wallet_address, u.id AS user_id
      FROM profile_media m
      JOIN profiles p ON p.id = m.profile_id
      JOIN users u ON u.id = p.user_id
      WHERE m.id = $1
    `, [id]);
    if (!result.rowCount) return new NextResponse(null, { status: 404 });
    const media = result.rows[0];
    const session = authenticatedSession(request);
    const ownsMedia = session?.userId === media.user_id
      || (session?.chain === media.wallet_chain && session.address === media.wallet_address);
    if (!media.is_approved && !ownsMedia) return new NextResponse(null, { status: 404 });
    const bytes = await fs.readFile(safeStoragePath(media.storage_key));
    return new NextResponse(bytes, {
      headers: {
        "content-type": media.mime_type,
        "content-length": String(bytes.length),
        "cache-control": media.is_approved ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Media read failed", error);
    return new NextResponse(null, { status: 404 });
  }
}
