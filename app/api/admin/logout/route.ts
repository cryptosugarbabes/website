import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("crypto_sugar_admin");
  response.cookies.delete("velora_session");
  return response;
}
