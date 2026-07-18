import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { PAYMENT_CONFIG } from "@/lib/payment-config";
import { query, transaction } from "@/lib/db";
import { decimalToMicros, microsToDecimal, paidLikePriceMicros, splitPaymentMicros } from "@/lib/payment-math";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";
import { FREE_UNANSWERED_MESSAGES, MESSAGE_UNLOCK_DAYS, MESSAGE_UNLOCK_USDC_MICROS } from "@/lib/message-limits";
import { reportApplicationError } from "@/lib/observability";

type PaymentKind = "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST" | "MESSAGE_UNLOCK";
type CreatorRow = {
  id: string;
  photo_likes: string;
  wallet_chain: "evm" | "solana" | null;
  wallet_address: string | null;
};

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect your wallet before paying." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!PAYMENT_CONFIG.settlementEnabled) return NextResponse.json({ error: "Settlement is temporarily unavailable." }, { status: 503 });

  const input = await request.json().catch(() => null) as { profileId?: string; conversationId?: string; kind?: PaymentKind; amountUsdc?: string | number; mediaId?: string; messageId?: string } | null;
  const kind = input?.kind;
  if (!kind || !["PAID_LIKE", "GIFT", "MESSAGE_BOOST", "MESSAGE_UNLOCK"].includes(kind)
    || (kind === "MESSAGE_UNLOCK" ? !input?.conversationId : !input?.profileId)) {
    return NextResponse.json({ error: "That payment request is incomplete." }, { status: 400 });
  }

  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });
    if (kind !== "MESSAGE_UNLOCK" && account.account_type !== "CUSTOMER") return NextResponse.json({ error: "Creator accounts cannot pay their own profiles." }, { status: 403 });

    let profileId = input.profileId || "";
    let conversationId: string | null = null;
    if (kind === "MESSAGE_UNLOCK") {
      const conversation = await query<{ creator_profile_id: string; counterpart_user_id: string }>(`
        SELECT c.creator_profile_id,
          CASE WHEN c.customer_user_id = $2 THEN p.user_id ELSE c.customer_user_id END AS counterpart_user_id
        FROM conversations c JOIN profiles p ON p.id = c.creator_profile_id
        WHERE c.id = $1 AND (c.customer_user_id = $2 OR p.user_id = $2)
      `, [input.conversationId, account.id]);
      if (!conversation.rowCount) return NextResponse.json({ error: "That conversation is not available." }, { status: 404 });
      conversationId = input.conversationId || null;
      profileId = conversation.rows[0].creator_profile_id;
      const unanswered = await query<{ count: string }>(`
        SELECT count(*)::text FROM messages m
        WHERE m.conversation_id = $1 AND m.sender_user_id = $2 AND m.status <> 'MODERATED'
          AND m.created_at > COALESCE((
            SELECT max(reply.created_at) FROM messages reply
            WHERE reply.conversation_id = $1 AND reply.sender_user_id = $3 AND reply.status <> 'MODERATED'
          ), to_timestamp(0))
      `, [conversationId, account.id, conversation.rows[0].counterpart_user_id]);
      if (Number(unanswered.rows[0]?.count || 0) < FREE_UNANSWERED_MESSAGES) {
        return NextResponse.json({ error: "A paid unlock is only needed after three unanswered messages." }, { status: 409 });
      }
      const recentUnlock = await query(`
        SELECT 1 FROM message_unlocks
        WHERE conversation_id = $1 AND sender_user_id = $2
          AND created_at >= now() - interval '${MESSAGE_UNLOCK_DAYS} days'
        LIMIT 1
      `, [conversationId, account.id]);
      if (recentUnlock.rowCount) return NextResponse.json({ error: "The weekly paid-message option has already been used or is ready to use for this conversation." }, { status: 409 });
    }

    const creator = await query<CreatorRow>(`
      SELECT p.id, p.photo_likes::text, u.wallet_chain, u.wallet_address
      FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.review_status = 'APPROVED' AND u.account_type = 'CREATOR' AND u.status = 'ACTIVE'
    `, [profileId]);
    if (!creator.rowCount) return NextResponse.json({ error: "That creator profile is not available." }, { status: 404 });
    const target = creator.rows[0];
    if (kind !== "MESSAGE_UNLOCK" && (!target.wallet_chain || !target.wallet_address)) {
      return NextResponse.json({ error: "This creator has not connected a payout wallet yet. Free messaging is still available." }, { status: 409 });
    }
    if (kind !== "MESSAGE_UNLOCK" && target.wallet_chain !== session.chain) {
      return NextResponse.json({ error: `This creator receives on ${target.wallet_chain === "solana" ? "Solana" : "Base"}. Connect a matching wallet to pay.` }, { status: 409 });
    }
    if (kind !== "MESSAGE_UNLOCK" && session.chain === "evm" && !PAYMENT_CONFIG.base.atomicSettlementEnabled) {
      return NextResponse.json({
        error: "Base payments are temporarily unavailable while atomic 90/10 settlement is being completed. Base login and free messaging still work."
      }, { status: 503 });
    }
    if (kind !== "MESSAGE_UNLOCK" && target.wallet_address?.toLowerCase() === session.address.toLowerCase()) {
      return NextResponse.json({ error: "You cannot pay your own wallet." }, { status: 409 });
    }

    let mediaId: string | null = null;
    let messageId: string | null = null;
    if (kind === "PAID_LIKE") {
      if (!input.mediaId) return NextResponse.json({ error: "Choose the photograph you want to like." }, { status: 400 });
      const media = await query(`SELECT 1 FROM profile_media WHERE id = $1 AND profile_id = $2 AND is_approved = TRUE`, [input.mediaId, target.id]);
      if (!media.rowCount) return NextResponse.json({ error: "That photograph is not available for paid likes." }, { status: 404 });
      mediaId = input.mediaId;
    }
    if (kind === "MESSAGE_BOOST") {
      if (!input.messageId) return NextResponse.json({ error: "Choose the message you want to boost." }, { status: 400 });
      const message = await query(`
        SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND m.sender_user_id = $2 AND c.customer_user_id = $2
          AND c.creator_profile_id = $3 AND m.created_at >= now() - interval '30 minutes'
          AND m.boosted_at IS NULL
      `, [input.messageId, account.id, target.id]);
      if (!message.rowCount) return NextResponse.json({ error: "That message cannot be boosted." }, { status: 409 });
      messageId = input.messageId;
    }

    let grossMicros: bigint;
    if (kind === "MESSAGE_UNLOCK") {
      grossMicros = MESSAGE_UNLOCK_USDC_MICROS;
    } else if (kind === "PAID_LIKE") {
      grossMicros = paidLikePriceMicros(BigInt(target.photo_likes));
    } else {
      const parsed = decimalToMicros(input.amountUsdc);
      if (parsed === null || parsed < BigInt(1_000_000) || parsed > BigInt(100_000_000_000)) {
        return NextResponse.json({ error: "Choose an amount between 1 and 100,000 USDC." }, { status: 400 });
      }
      grossMicros = parsed;
    }

    const split = kind === "MESSAGE_UNLOCK"
      ? { creatorMicros: BigInt(0), platformMicros: grossMicros }
      : splitPaymentMicros(grossMicros);
    const { creatorMicros, platformMicros } = split;
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const quoteValues = [id, account.id, target.id, kind, session.chain === "solana" ? "SOLANA" : "BASE", microsToDecimal(grossMicros), microsToDecimal(creatorMicros), microsToDecimal(platformMicros), expiresAt, mediaId, messageId, conversationId];
    const insertQuote = `
      INSERT INTO payment_quotes
        (id, buyer_user_id, creator_profile_id, kind, network, gross_amount_usdc, creator_amount_usdc, platform_amount_usdc, expires_at, media_id, message_id, conversation_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    if (kind === "MESSAGE_UNLOCK" && conversationId) {
      await transaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${conversationId}:${account.id}:message-unlock`]);
        await client.query(`UPDATE payment_quotes SET status = 'EXPIRED' WHERE buyer_user_id = $1 AND kind = 'MESSAGE_UNLOCK' AND status = 'QUOTED' AND expires_at < now()`, [account.id]);
        const recent = await client.query(`SELECT 1 FROM message_unlocks WHERE conversation_id = $1 AND sender_user_id = $2 AND created_at >= now() - interval '${MESSAGE_UNLOCK_DAYS} days' LIMIT 1`, [conversationId, account.id]);
        if (recent.rowCount) throw new Error("MESSAGE_UNLOCK_WEEKLY_LIMIT");
        const pending = await client.query(`SELECT 1 FROM payment_quotes WHERE conversation_id = $1 AND buyer_user_id = $2 AND kind = 'MESSAGE_UNLOCK' AND status = 'QUOTED' AND expires_at >= now() LIMIT 1`, [conversationId, account.id]);
        if (pending.rowCount) throw new Error("MESSAGE_UNLOCK_PENDING");
        await client.query(insertQuote, quoteValues);
      });
    } else {
      await query(`UPDATE payment_quotes SET status = 'EXPIRED' WHERE buyer_user_id = $1 AND status = 'QUOTED' AND expires_at < now()`, [account.id]);
      await query(insertQuote, quoteValues);
    }

    return NextResponse.json({
      quoteId: id,
      kind,
      network: session.chain === "solana" ? "SOLANA" : "BASE",
      grossMicros: grossMicros.toString(),
      creatorMicros: creatorMicros.toString(),
      platformMicros: platformMicros.toString(),
      grossAmountUsdc: microsToDecimal(grossMicros),
      creatorAmountUsdc: microsToDecimal(creatorMicros),
      platformAmountUsdc: microsToDecimal(platformMicros),
      creatorAddress: target.wallet_address || (session.chain === "solana" ? PAYMENT_CONFIG.solana.treasuryAddress : PAYMENT_CONFIG.base.treasuryAddress),
      treasuryAddress: session.chain === "solana" ? PAYMENT_CONFIG.solana.treasuryAddress : PAYMENT_CONFIG.base.treasuryAddress,
      tokenAddress: session.chain === "solana" ? PAYMENT_CONFIG.solana.usdcMintAddress : PAYMENT_CONFIG.base.usdcContractAddress,
      splitterAddress: session.chain === "evm" ? PAYMENT_CONFIG.base.splitterAddress : null,
      mediaId,
      messageId,
      conversationId,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MESSAGE_UNLOCK_WEEKLY_LIMIT") return NextResponse.json({ error: "The weekly paid-message option has already been used or is ready for this conversation." }, { status: 409 });
    if (error instanceof Error && error.message === "MESSAGE_UNLOCK_PENDING") return NextResponse.json({ error: "A message-unlock payment is already awaiting wallet approval. Wait for it to expire before starting another." }, { status: 409 });
    await reportApplicationError("payments:quote", error);
    console.error("Payment quote failed", error);
    return NextResponse.json({ error: "A secure payment quote could not be created." }, { status: 503 });
  }
}
