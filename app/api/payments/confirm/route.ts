import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, ParsedInstruction, PartiallyDecodedInstruction, PublicKey } from "@solana/web3.js";
import { base } from "viem/chains";
import { createPublicClient, decodeEventLog, getAddress, http, isHash } from "viem";
import { accountForSession } from "@/lib/accounts";
import { query, transaction } from "@/lib/db";
import { PAYMENT_CONFIG } from "@/lib/payment-config";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";

type QuoteRow = {
  id: string;
  buyer_user_id: string;
  creator_profile_id: string;
  kind: "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST";
  network: "BASE" | "SOLANA";
  gross_amount_usdc: string;
  creator_amount_usdc: string;
  platform_amount_usdc: string;
  status: string;
  expires_at: Date;
  buyer_address: string;
  creator_address: string;
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

async function verifyBaseTransfer(hash: `0x${string}`, from: string, to: string, amount: bigint) {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  const [receipt, sent] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash })]);
  if (receipt.status !== "success" || getAddress(sent.from) !== getAddress(from) || !sent.to || getAddress(sent.to) !== PAYMENT_CONFIG.base.usdcContractAddress) return false;
  return receipt.logs.some((log) => {
    if (getAddress(log.address) !== PAYMENT_CONFIG.base.usdcContractAddress) return false;
    try {
      const decoded = decodeEventLog({ abi: transferEvent, data: log.data, topics: log.topics });
      return decoded.eventName === "Transfer" && getAddress(decoded.args.from) === getAddress(from) && getAddress(decoded.args.to) === getAddress(to) && decoded.args.value === amount;
    } catch {
      return false;
    }
  });
}

async function verifySolanaTransfer(signature: string, buyer: string, creator: string, creatorAmount: bigint, platformAmount: bigint) {
  const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const parsed = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!parsed || parsed.meta?.err) return false;
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
  return matches(creatorAta, creatorAmount) && matches(platformAta, platformAmount);
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
      SELECT q.*, buyer.wallet_address AS buyer_address, creator.wallet_address AS creator_address
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
    const creatorAmount = decimalToMicros(quote.creator_amount_usdc);
    const platformAmount = decimalToMicros(quote.platform_amount_usdc);

    let purposes: Array<{ purpose: "CREATOR" | "PLATFORM" | "ATOMIC"; hash: string }>;
    if (quote.network === "BASE") {
      if (input.transactionHashes.length !== 2 || !input.transactionHashes.every((hash) => isHash(hash))) return NextResponse.json({ error: "Both Base transfer hashes are required." }, { status: 400 });
      const creatorHash = input.transactionHashes[0] as `0x${string}`;
      const platformHash = input.transactionHashes[1] as `0x${string}`;
      const [creatorValid, platformValid] = await Promise.all([
        verifyBaseTransfer(creatorHash, quote.buyer_address, quote.creator_address, creatorAmount),
        verifyBaseTransfer(platformHash, quote.buyer_address, PAYMENT_CONFIG.base.treasuryAddress, platformAmount)
      ]);
      if (!creatorValid || !platformValid) return NextResponse.json({ error: "The Base transfers could not be verified on-chain." }, { status: 409 });
      purposes = [{ purpose: "CREATOR", hash: creatorHash }, { purpose: "PLATFORM", hash: platformHash }];
    } else {
      if (input.transactionHashes.length !== 1) return NextResponse.json({ error: "One Solana transaction signature is required." }, { status: 400 });
      const signature = input.transactionHashes[0];
      const valid = await verifySolanaTransfer(signature, quote.buyer_address, quote.creator_address, creatorAmount, platformAmount);
      if (!valid) return NextResponse.json({ error: "The Solana transfer could not be verified on-chain." }, { status: 409 });
      purposes = [{ purpose: "ATOMIC", hash: signature }];
    }

    await transaction(async (client) => {
      const locked = await client.query<{ status: string }>(`SELECT status FROM payment_quotes WHERE id = $1 FOR UPDATE`, [quote.id]);
      if (locked.rows[0]?.status === "CONFIRMED") return;
      for (const item of purposes) await client.query(`INSERT INTO payment_transactions (quote_id, purpose, transaction_hash) VALUES ($1, $2, $3)`, [quote.id, item.purpose, item.hash]);
      await client.query(`UPDATE payment_quotes SET status = 'CONFIRMED', confirmed_at = now() WHERE id = $1`, [quote.id]);
      await client.query(`
        INSERT INTO support_events (id, quote_id, supporter_user_id, creator_profile_id, kind, gross_amount_usdc)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), quote.id, quote.buyer_user_id, quote.creator_profile_id, quote.kind, quote.gross_amount_usdc]);
      if (quote.kind === "PAID_LIKE") await client.query(`UPDATE profiles SET photo_likes = photo_likes + 1, updated_at = now() WHERE id = $1`, [quote.creator_profile_id]);
      await client.query(`UPDATE customer_profiles SET generosity_points = generosity_points + floor($1::numeric)::bigint, updated_at = now() WHERE user_id = $2`, [quote.gross_amount_usdc, quote.buyer_user_id]);
    });
    return NextResponse.json({ confirmed: true, quoteId: quote.id, kind: quote.kind });
  } catch (error) {
    console.error("Payment confirmation failed", error);
    return NextResponse.json({ error: "That payment could not be confirmed safely." }, { status: 503 });
  }
}
