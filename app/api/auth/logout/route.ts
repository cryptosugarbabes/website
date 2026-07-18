import { NextResponse } from "next/server";
import { VISITOR_CHAT_COOKIE } from "@/lib/visitor-chat";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("velora_session");
  response.cookies.delete(VISITOR_CHAT_COOKIE);
  return response;
}
