import { NextRequest, NextResponse } from "next/server";
import { createHash, createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";
import { decodeBase58, isSolanaAddress } from "@/lib/base58";
import { createSessionToken, readSessionToken, WalletChain } from "@/lib/session";
import { query, transaction } from "@/lib/db";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = await takeRateLimit(`auth-verify:${clientAddress(request)}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Try again shortly." }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
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

  const challenge = await query<{ wallet_chain: WalletChain; wallet_address: string; message_hash: string; expires_at: Date; consumed_at: Date | null }>(`
    SELECT wallet_chain, wallet_address, message_hash, expires_at, consumed_at
    FROM auth_challenges WHERE nonce = $1
  `, [nonce]);
  const expected = challenge.rows[0];
  const messageHash = createHash("sha256").update(body.message).digest("hex");
  if (!expected || expected.consumed_at || expected.expires_at.getTime() < Date.now()
    || expected.wallet_chain !== chain || expected.wallet_address !== normalizedAddress
    || expected.message_hash !== messageHash) {
    return NextResponse.json({ error: "The sign-in request is incomplete, altered, used, or expired." }, { status: 400 });
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

  const existingSession = readSessionToken(request.cookies.get("velora_session")?.value);
  const walletAddress = chain === "evm" ? normalizedAddress.toLowerCase() : normalizedAddress;
  let linkedUser: { id: string; email: string | null };
  try {
    linkedUser = await transaction(async (client) => {
      const consumed = await client.query(`
        UPDATE auth_challenges SET consumed_at = now()
        WHERE nonce = $1 AND consumed_at IS NULL AND expires_at > now()
      `, [nonce]);
      if (!consumed.rowCount) throw new Error("CHALLENGE_USED");

      const walletOwner = await client.query<{ id: string; email: string | null; status: string }>(`
        SELECT u.id, u.email, u.status
        FROM user_wallets uw
        JOIN users u ON u.id = uw.user_id
        WHERE uw.wallet_chain = $1 AND uw.wallet_address = $2
        FOR UPDATE OF u
      `, [chain, walletAddress]);
      const legacyOwner = walletOwner.rowCount ? walletOwner : await client.query<{ id: string; email: string | null; status: string }>(`
        SELECT id, email, status FROM users
        WHERE wallet_chain = $1 AND wallet_address = $2
        FOR UPDATE
      `, [chain, walletAddress]);

      if (existingSession?.userId) {
        const current = await client.query<{ id: string; email: string | null; email_verified_at: Date | null; wallet_chain: WalletChain | null; wallet_address: string | null; status: string }>(`
          SELECT id, email, email_verified_at, wallet_chain, wallet_address, status FROM users WHERE id = $1 FOR UPDATE
        `, [existingSession.userId]);
        if (!current.rowCount) throw new Error("SESSION_USER_NOT_FOUND");
        if (current.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");
        if (legacyOwner.rowCount && legacyOwner.rows[0].id !== current.rows[0].id) throw new Error("WALLET_ALREADY_LINKED");
        const alreadyOwned = legacyOwner.rows[0]?.id === current.rows[0].id;
        if (!current.rows[0].email_verified_at && !alreadyOwned) throw new Error("EMAIL_REQUIRED");

        const existingOnChain = await client.query<{ is_primary: boolean }>(`
          SELECT is_primary FROM user_wallets
          WHERE user_id = $1 AND wallet_chain = $2
          ORDER BY is_primary DESC, created_at
          LIMIT 1
        `, [current.rows[0].id, chain]);
        const linked = await client.query(`
          INSERT INTO user_wallets (id, user_id, wallet_chain, wallet_address, is_primary)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (wallet_chain, wallet_address)
          DO UPDATE SET updated_at = now()
          WHERE user_wallets.user_id = EXCLUDED.user_id
          RETURNING user_id
        `, [randomUUID(), current.rows[0].id, chain, walletAddress, !existingOnChain.rowCount]);
        if (!linked.rowCount) throw new Error("WALLET_ALREADY_LINKED");
        if (!current.rows[0].wallet_address) {
          await client.query(`UPDATE users SET wallet_chain = $1, wallet_address = $2, updated_at = now() WHERE id = $3`, [chain, walletAddress, current.rows[0].id]);
        }
        return { id: current.rows[0].id, email: current.rows[0].email };
      }

      if (!legacyOwner.rowCount) throw new Error("EMAIL_REQUIRED");
      if (legacyOwner.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");
      await client.query(`
        INSERT INTO user_wallets (id, user_id, wallet_chain, wallet_address, is_primary)
        VALUES ($1, $2, $3, $4, NOT EXISTS (
          SELECT 1 FROM user_wallets WHERE user_id = $2 AND wallet_chain = $3
        ))
        ON CONFLICT (wallet_chain, wallet_address)
        DO UPDATE SET updated_at = now()
      `, [randomUUID(), legacyOwner.rows[0].id, chain, walletAddress]);
      return legacyOwner.rows[0];
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CHALLENGE_USED") return NextResponse.json({ error: "That sign-in request has already been used or expired." }, { status: 409 });
    if (message === "WALLET_ALREADY_LINKED") return NextResponse.json({ error: "That wallet is already linked to another account." }, { status: 409 });
    if (message === "EMAIL_REQUIRED") return NextResponse.json({
      error: "Verify your email first, then connect this wallet from the same account.",
      code: "EMAIL_REQUIRED"
    }, { status: 409 });
    if (message === "ACCOUNT_SUSPENDED") return NextResponse.json({ error: "This account is suspended. Contact safety support if you believe this is an error." }, { status: 403 });
    throw error;
  }

  const response = NextResponse.json({ address: normalizedAddress, chain, email: linkedUser.email });
  response.cookies.set("velora_session", createSessionToken(normalizedAddress, chain, linkedUser.id, linkedUser.email || undefined), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
  response.cookies.delete("velora_nonce");
  return response;
}
