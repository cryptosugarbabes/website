import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";
import { decodeBase58, isSolanaAddress } from "@/lib/base58";
import { createSessionToken, WalletChain } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    address?: string;
    message?: string;
    signature?: string;
    chain?: WalletChain;
  } | null;
  const nonceCookie = request.cookies.get("velora_nonce")?.value;
  const [cookieChain, nonce] = nonceCookie?.includes(".") ? nonceCookie.split(".", 2) : ["evm", nonceCookie];
  const chain: WalletChain = body?.chain === "solana" ? "solana" : "evm";

  const addressValid = body?.address && (chain === "solana" ? isSolanaAddress(body.address) : isAddress(body.address));
  if (!body?.address || !addressValid || !body.message || !body.signature || !nonce || cookieChain !== chain) {
    return NextResponse.json({ error: "The sign-in request is incomplete or expired." }, { status: 400 });
  }
  const normalizedAddress = chain === "solana" ? body.address : getAddress(body.address);
  if (!body.message.includes(`Nonce: ${nonce}`) || !body.message.includes(normalizedAddress)) {
    return NextResponse.json({ error: "The sign-in message does not match this session." }, { status: 400 });
  }

  const valid = chain === "solana"
    ? (() => {
        try {
          const publicKeyBytes = Buffer.from(decodeBase58(body.address));
          const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
          const publicKey = createPublicKey({ key: Buffer.concat([spkiPrefix, publicKeyBytes]), format: "der", type: "spki" });
          return verifySignature(null, Buffer.from(body.message), publicKey, Buffer.from(body.signature, "base64"));
        } catch {
          return false;
        }
      })()
    : await verifyMessage({
        address: getAddress(body.address),
        message: body.message,
        signature: body.signature as `0x${string}`
      }).catch(() => false);

  if (!valid) {
    return NextResponse.json({ error: "The wallet signature could not be verified." }, { status: 401 });
  }

  const response = NextResponse.json({ address: normalizedAddress, chain });
  response.cookies.set("velora_session", createSessionToken(normalizedAddress, chain), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
  response.cookies.delete("velora_nonce");
  return response;
}
