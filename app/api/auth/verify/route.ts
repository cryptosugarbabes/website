import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, verifyMessage } from "viem";
import { createSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    address?: string;
    message?: string;
    signature?: `0x${string}`;
  } | null;
  const nonce = request.cookies.get("velora_nonce")?.value;

  if (!body?.address || !isAddress(body.address) || !body.message || !body.signature || !nonce) {
    return NextResponse.json({ error: "The sign-in request is incomplete or expired." }, { status: 400 });
  }
  if (!body.message.includes(`Nonce: ${nonce}`) || !body.message.includes(getAddress(body.address))) {
    return NextResponse.json({ error: "The sign-in message does not match this session." }, { status: 400 });
  }

  const valid = await verifyMessage({
    address: getAddress(body.address),
    message: body.message,
    signature: body.signature
  }).catch(() => false);

  if (!valid) {
    return NextResponse.json({ error: "The wallet signature could not be verified." }, { status: 401 });
  }

  const response = NextResponse.json({ address: getAddress(body.address) });
  response.cookies.set("velora_session", createSessionToken(body.address), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
  response.cookies.delete("velora_nonce");
  return response;
}
