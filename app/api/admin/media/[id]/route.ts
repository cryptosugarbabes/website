import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-session";
import { query } from "@/lib/db";
import { safeStoragePath } from "@/lib/uploads";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  const result = await query<{ storage_key: string; mime_type: string }>("SELECT storage_key, mime_type FROM profile_media WHERE id = $1", [id]);
  if (!result.rowCount) return new NextResponse(null, { status: 404 });
  try {
    const bytes = await fs.readFile(safeStoragePath(result.rows[0].storage_key));
    return new NextResponse(bytes, { headers: { "content-type": result.rows[0].mime_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
