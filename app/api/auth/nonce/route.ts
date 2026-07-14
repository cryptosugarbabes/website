import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { address?: string } | null;
  if (!body?.address || !isAddress(body.address)) {
    return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });
  }

  const address = getAddress(body.address);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = `${host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Crypto Sugar. This request will not trigger a blockchain transaction or cost gas.\n\nURI: ${protocol}://${host}\nVersion: 1\nChain ID: 8453\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;

  const response = NextResponse.json({ message });
  response.cookies.set("velora_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
  return response;
}
