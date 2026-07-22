import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, ParsedInstruction, PartiallyDecodedInstruction, PublicKey } from "@solana/web3.js";
import { base } from "viem/chains";
import { createPublicClient, decodeEventLog, getAddress, http, isHash } from "viem";
import { accountForSession } from "@/lib/accounts";
import { baseAtomicReceiptMatches } from "@/lib/base-payment-verification";
import { query, transaction } from "@/lib/db";
import { PAYMENT_CONFIG } from "@/lib/payment-config";
import { transferFallsWithinQuoteWindow } from "@/lib/payment-validation";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";
import { reportApplicationError } from "@/lib/observability";
import { sendPaymentReceivedEmail } from "@/lib/email-auth";

type QuoteRow = {
  id: string;
  buyer_user_id: string;
  creator_profile_id: string;
  kind: "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST" | "MESSAGE_UNLOCK";
  network: "BASE" | "SOLANA";
  gross_amount_usdc: string;
  creator_amount_usdc: string;
  platform_amount_usdc: string;
  status: string;
  created_at: Date;
  expires_at: Date;
  message_id: string | null;
  media_id: string | null;
  conversation_id: string | null;
  buyer_address: string;
  creator_address: string | null;
  creator_email: string | null;
  creator_name: string;
};

const transferEvent = [{
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" }
  ]
}] as const;
const MICRO_USDC = BigInt(1_000_000);

function decimalToMicros(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * MICRO_USDC + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

async function verifyBaseAtomicTransfer(hash: `0x${string}`, quoteId: string, from: string, creator: string, creatorAmount: bigint, platformAmount: bigint, grossAmount: bigint, splitterAddress: string) {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  const [receipt, sent] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash })]);
  if (receipt.status !== "success" || getAddress(sent.from) !== getAddress(from) || !sent.to || getAddress(sent.to) !== getAddress(splitterAddress)) return { valid: false, timestampMs: 0 };
  const valid = baseAtomicReceiptMatches(receipt.logs, {
    quoteId,
    payer: from,
    creator,
    treasury: PAYMENT_CONFIG.base.treasuryAddress,
    usdcAddress: PAYMENT_CONFIG.base.usdcContractAddress,
    splitterAddress,
    grossAmount,
    creatorAmount,
    platformAmount
  });
  const block = valid ? await client.getBlock({ blockNumber: receipt.blockNumber }) : null;
  return { valid, timestampMs: block ? Number(block.timestamp) * 1000 : 0 };
}

async function verifyBasePlatformTransfer(hash: `0x${string}`, from: string, grossAmount: bigint) {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  const [receipt, sent] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash })]);
  if (receipt.status !== "success" || getAddress(sent.from) !== getAddress(from) || !sent.to || getAddress(sent.to) !== PAYMENT_CONFIG.base.usdcContractAddress) return { valid: false, timestampMs: 0 };
  const valid = receipt.logs.some((log) => {
    if (getAddress(log.address) !== PAYMENT_CONFIG.base.usdcContractAddress) return false;
    try {
      const decoded = decodeEventLog({ abi: transferEvent, data: log.data, topics: log.topics });
      return decoded.eventName === "Transfer"
        && getAddress(decoded.args.from) === getAddress(from)
        && getAddress(decoded.args.to) === PAYMENT_CONFIG.base.treasuryAddress
        && decoded.args.value === grossAmount;
    } catch { return false; }
  });
  const block = valid ? await client.getBlock({ blockNumber: receipt.blockNumber }) : null;
  return { valid, timestampMs: block ? Number(block.timestamp) * 1000 : 0 };
}

async function verifySolanaTransfer(signature: string, buyer: string, creator: string, creatorAmount: bigint, platformAmount: bigint) {
  const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const parsed = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!parsed || parsed.meta?.err) return { valid: false, timestampMs: 0 };
  const mint = new PublicKey(PAYMENT_CONFIG.solana.usdcMintAddress);
  const creatorAta = getAssociatedTokenAddressSync(mint, new PublicKey(creator)).toString();
  const platformAta = getAssociatedTokenAddressSync(mint, new PublicKey(PAYMENT_CONFIG.solana.treasuryAddress)).toString();
  const outer = parsed.transaction.message.instructions;
  const inner = (parsed.meta?.innerInstructions || []).flatMap((group) => group.instructions);
  const instructions = [...outer, ...inner] as Array<ParsedInstruction | PartiallyDecodedInstruction>;
  const transfers = instructions.filter((instruction): instruction is ParsedInstruction => "parsed" in instruction && instruction.program === "spl-token" && instruction.parsed?.type === "transferChecked");
  const matches = (destination: string, amount: bigint) => transfers.some((instruction) => {
    const info = instruction.parsed.info as { authority?: string; destination?: string; mint?: string; tokenAmount?: { amount?: string } };
    return info.authority === buyer && info.destination === destination && info.mint === mint.toString() && info.tokenAmount?.amount === amount.toString();
  });
  const creatorValid = creatorAmount === BigInt(0) || matches(creatorAta, creatorAmount);
  return { valid: creatorValid && matches(platformAta, platformAmount), timestampMs: (parsed.blockTime || 0) * 1000 };
}

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect your wallet before confirming a payment." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { quoteId?: string; transactionHashes?: string[] } | null;
  if (!input?.quoteId || !Array.isArray(input.transactionHashes)) return NextResponse.json({ error: "Payment confirmation is incomplete." }, { status: 400 });

  try {
    const account = await accountForSession(session);
    if (!account) return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });
    const result = await query<QuoteRow>(`
      SELECT q.*, buyer.wallet_address AS buyer_address, creator.wallet_address AS creator_address,
        CASE WHEN creator.email_verified_at IS NOT NULL THEN creator.email ELSE NULL END AS creator_email,
        p.display_name AS creator_name
      FROM payment_quotes q
      JOIN users buyer ON buyer.id = q.buyer_user_id
      JOIN profiles p ON p.id = q.creator_profile_id
      JOIN users creator ON creator.id = p.user_id
      WHERE q.id = $1 AND q.buyer_user_id = $2
    `, [input.quoteId, account.id]);
    if (!result.rowCount) return NextResponse.json({ error: "That payment quote was not found." }, { status: 404 });
    const quote = result.rows[0];
    if (quote.status === "CONFIRMED") return NextResponse.json({ confirmed: true, quoteId: quote.id });
    if (quote.status !== "QUOTED") return NextResponse.json({ error: "That quote is no longer payable." }, { status: 409 });
    if (quote.kind !== "MESSAGE_UNLOCK" && !quote.creator_address) {
      return NextResponse.json({ error: "This creator has not connected a payout wallet. Gifts and paid likes are unavailable." }, { status: 409 });
    }
    const creatorAmount = decimalToMicros(quote.creator_amount_usdc);
    const platformAmount = decimalToMicros(quote.platform_amount_usdc);
    const grossAmount = decimalToMicros(quote.gross_amount_usdc);
    const expiryGraceMs = 2 * 60 * 1000;
    const expectedNetwork = session.chain === "evm" ? "BASE" : "SOLANA";
    if (expectedNetwork !== quote.network) return NextResponse.json({ error: `Reconnect the ${quote.network === "BASE" ? "Base" : "Solana"} wallet used to create this quote.` }, { status: 409 });
    const sessionMatchesBuyer = quote.network === "BASE"
      ? getAddress(session.address) === getAddress(quote.buyer_address)
      : session.address === quote.buyer_address;
    if (!sessionMatchesBuyer) return NextResponse.json({ error: "Reconnect the wallet used to create this payment quote." }, { status: 409 });

    let purposes: Array<{ purpose: "CREATOR" | "PLATFORM" | "ATOMIC"; hash: string }>;
    if (quote.network === "BASE") {
      if (quote.kind === "MESSAGE_UNLOCK") {
        if (input.transactionHashes.length !== 1 || !isHash(input.transactionHashes[0])) return NextResponse.json({ error: "One Base payment hash is required." }, { status: 400 });
        const hash = input.transactionHashes[0] as `0x${string}`;
        const transfer = await verifyBasePlatformTransfer(hash, quote.buyer_address, grossAmount);
        if (!transfer.valid) return NextResponse.json({ error: "The Base message-unlock payment could not be verified on-chain." }, { status: 409 });
        if (!transferFallsWithinQuoteWindow({ createdAtMs: quote.created_at.getTime(), expiresAtMs: quote.expires_at.getTime(), transferTimestampMs: transfer.timestampMs, expiryGraceMs })) {
          await query(`UPDATE payment_quotes SET status = 'EXPIRED' WHERE id = $1 AND status = 'QUOTED'`, [quote.id]);
          return NextResponse.json({ error: "That payment quote expired before the transfer was confirmed." }, { status: 409 });
        }
        purposes = [{ purpose: "PLATFORM", hash }];
      } else if (!PAYMENT_CONFIG.base.splitterAddress) {
        return NextResponse.json({
          error: "Base settlement is disabled until the atomic splitter is configured. No non-atomic payment will be accepted."
        }, { status: 503 });
      } else {
        if (input.transactionHashes.length !== 1 || !isHash(input.transactionHashes[0])) return NextResponse.json({ error: "One atomic Base payment hash is required." }, { status: 400 });
        const hash = input.transactionHashes[0] as `0x${string}`;
        if (!quote.creator_address) return NextResponse.json({ error: "The creator payout address is unavailable." }, { status: 409 });
        const transfer = await verifyBaseAtomicTransfer(hash, quote.id, quote.buyer_address, quote.creator_address, creatorAmount, platformAmount, grossAmount, PAYMENT_CONFIG.base.splitterAddress);
        if (!transfer.valid) return NextResponse.json({ error: "The atomic Base payment could not be verified on-chain." }, { status: 409 });
        if (!transferFallsWithinQuoteWindow({ createdAtMs: quote.created_at.getTime(), expiresAtMs: quote.expires_at.getTime(), transferTimestampMs: transfer.timestampMs, expiryGraceMs })) {
          await query(`UPDATE payment_quotes SET status = 'EXPIRED' WHERE id = $1 AND status = 'QUOTED'`, [quote.id]);
          return NextResponse.json({ error: "That payment quote expired before the atomic transfer was confirmed." }, { status: 409 });
        }
        purposes = [{ purpose: "ATOMIC", hash }];
      }
    } else {
      if (input.transactionHashes.length !== 1) return NextResponse.json({ error: "One Solana transaction signature is required." }, { status: 400 });
      const signature = input.transactionHashes[0];
      const transfer = await verifySolanaTransfer(signature, quote.buyer_address, quote.creator_address || PAYMENT_CONFIG.solana.treasuryAddress, creatorAmount, platformAmount);
      if (!transfer.valid) return NextResponse.json({ error: "The Solana transfer could not be verified on-chain." }, { status: 409 });
      if (!transferFallsWithinQuoteWindow({ createdAtMs: quote.created_at.getTime(), expiresAtMs: quote.expires_at.getTime(), transferTimestampMs: transfer.timestampMs, expiryGraceMs })) {
        await query(`UPDATE payment_quotes SET status = 'EXPIRED' WHERE id = $1 AND status = 'QUOTED'`, [quote.id]);
        return NextResponse.json({ error: "That payment quote expired before the transfer was confirmed." }, { status: 409 });
      }
      purposes = [{ purpose: quote.kind === "MESSAGE_UNLOCK" ? "PLATFORM" : "ATOMIC", hash: signature }];
    }

    const newlyConfirmed = await transaction(async (client) => {
      const locked = await client.query<{ status: string }>(`SELECT status FROM payment_quotes WHERE id = $1 FOR UPDATE`, [quote.id]);
      if (locked.rows[0]?.status === "CONFIRMED") return false;
      if (locked.rows[0]?.status !== "QUOTED") throw new Error("QUOTE_NO_LONGER_PAYABLE");
      for (const item of purposes) await client.query(`INSERT INTO payment_transactions (quote_id, purpose, transaction_hash) VALUES ($1, $2, $3)`, [quote.id, item.purpose, item.hash]);
      await client.query(`UPDATE payment_quotes SET status = 'CONFIRMED', confirmed_at = now() WHERE id = $1`, [quote.id]);
      if (quote.kind === "MESSAGE_UNLOCK") {
        if (!quote.conversation_id) throw new Error("MESSAGE_UNLOCK_CONVERSATION_REQUIRED");
        await client.query(`
          INSERT INTO message_unlocks (id, quote_id, conversation_id, sender_user_id)
          VALUES ($1, $2, $3, $4)
        `, [randomUUID(), quote.id, quote.conversation_id, quote.buyer_user_id]);
      } else {
        await client.query(`
          INSERT INTO support_events (id, quote_id, supporter_user_id, creator_profile_id, kind, gross_amount_usdc, media_id, message_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [randomUUID(), quote.id, quote.buyer_user_id, quote.creator_profile_id, quote.kind, quote.gross_amount_usdc, quote.media_id, quote.message_id]);
      }
      if (quote.kind === "PAID_LIKE") {
        if (!quote.media_id) throw new Error("PAID_LIKE_MEDIA_REQUIRED");
        await client.query(`UPDATE profile_media SET paid_likes = paid_likes + 1 WHERE id = $1 AND profile_id = $2`, [quote.media_id, quote.creator_profile_id]);
        await client.query(`UPDATE profiles SET photo_likes = photo_likes + 1, updated_at = now() WHERE id = $1`, [quote.creator_profile_id]);
      }
      if (quote.kind === "MESSAGE_BOOST") {
        if (!quote.message_id) throw new Error("MESSAGE_BOOST_LINK_REQUIRED");
        await client.query(`UPDATE messages SET boost_amount_usdc = $1, boosted_at = now() WHERE id = $2`, [quote.gross_amount_usdc, quote.message_id]);
      }
      if (quote.kind !== "MESSAGE_UNLOCK") {
        await client.query(`UPDATE customer_profiles SET generosity_points = generosity_points + floor($1::numeric)::bigint, updated_at = now() WHERE user_id = $2`, [quote.gross_amount_usdc, quote.buyer_user_id]);
      }
      return true;
    });
    if (newlyConfirmed && quote.kind !== "MESSAGE_UNLOCK" && quote.creator_email) {
      try {
        await sendPaymentReceivedEmail(quote.creator_email, {
          kind: quote.kind,
          profileName: quote.creator_name,
          grossAmountUsdc: quote.gross_amount_usdc,
          creatorAmountUsdc: quote.creator_amount_usdc,
          network: quote.network
        });
      } catch (error) {
        await reportApplicationError("payments:recipient-email", error);
        console.error("Payment recipient email could not be sent", error);
      }
    }
    return NextResponse.json({ confirmed: true, quoteId: quote.id, kind: quote.kind });
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTE_NO_LONGER_PAYABLE") return NextResponse.json({ error: "That quote is no longer payable." }, { status: 409 });
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "That blockchain transaction has already been used." }, { status: 409 });
    await reportApplicationError("payments:confirm", error);
    console.error("Payment confirmation failed", error);
    return NextResponse.json({ error: "That payment could not be confirmed safely." }, { status: 503 });
  }
}
