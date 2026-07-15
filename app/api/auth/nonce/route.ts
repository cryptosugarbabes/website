import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { isSolanaAddress } from "@/lib/base58";
import { query } from "@/lib/db";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = takeRateLimit(`auth-nonce:${clientAddress(request)}`, 12, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in requests. Try again shortly." }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
  const body = (await request.json().catch(() => null)) as { address?: string; chain?: "evm" | "solana" } | null;
  const chain = body?.chain === "solana" ? "solana" : "evm";
  const validAddress = body?.address && (chain === "solana" ? isSolanaAddress(body.address) : isAddress(body.address));
  if (!body?.address || !validAddress) {
    return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });
  }

  const address = chain === "solana" ? body.address : getAddress(body.address);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = chain === "solana"
    ? `${host} wants you to sign in with your Solana account:\n${address}\n\nSign in to Crypto Sugar. This request will not trigger a blockchain transaction or cost SOL.\n\nURI: ${protocol}://${host}\nNetwork: Solana\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`
    : `${host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Crypto Sugar. This request will not trigger a blockchain transaction or cost gas.\n\nURI: ${protocol}://${host}\nVersion: 1\nChain ID: 8453\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;

  await query(`DELETE FROM auth_challenges WHERE expires_at < now() - interval '1 day'`);

  await query(`
    INSERT INTO auth_challenges (nonce, wallet_chain, wallet_address, message_hash, expires_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [nonce, chain, address, createHash("sha256").update(message).digest("hex"), expirationTime]);

  const response = NextResponse.json({ message });
  response.cookies.set("velora_nonce", `${chain}.${nonce}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
  return response;
}
