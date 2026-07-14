import { NextRequest, NextResponse } from "next/server";
import { readSessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = readSessionToken(request.cookies.get("velora_session")?.value);
  return NextResponse.json({ address: session?.address || null, chain: session?.chain || null });
}
