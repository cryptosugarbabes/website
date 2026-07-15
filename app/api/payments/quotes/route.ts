import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountForSession } from "@/lib/accounts";
import { PAYMENT_CONFIG } from "@/lib/payment-config";
import { query } from "@/lib/db";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";

type PaymentKind = "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST";
const MICRO_USDC = BigInt(1_000_000);

type CreatorRow = {
  id: string;
  photo_likes: string;
  wallet_chain: "evm" | "solana";
  wallet_address: string;
};

function decimalToMicros(value: unknown) {
  const source = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^\d+(\.\d{1,6})?$/.test(source)) return null;
  const [whole, fraction = ""] = source.split(".");
  return BigInt(whole) * MICRO_USDC + BigInt(fraction.padEnd(6, "0"));
}

function microsToDecimal(value: bigint) {
  const whole = value / MICRO_USDC;
  const fraction = (value % MICRO_USDC).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session) return NextResponse.json({ error: "Connect your wallet before paying." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!PAYMENT_CONFIG.settlementEnabled) return NextResponse.json({ error: "Settlement is temporarily unavailable." }, { status: 503 });

  const input = await request.json().catch(() => null) as { profileId?: string; kind?: PaymentKind; amountUsdc?: string | number } | null;
  const kind = input?.kind;
  if (!input?.profileId || !kind || !["PAID_LIKE", "GIFT", "MESSAGE_BOOST"].includes(kind)) {
    return NextResponse.json({ error: "That payment request is incomplete." }, { status: 400 });
  }

  try {
    const account = await accountForSession(session);
    if (!account?.account_type) return NextResponse.json({ error: "Choose your account type first." }, { status: 409 });
    if (account.account_type !== "CUSTOMER") return NextResponse.json({ error: "Creator accounts cannot pay their own profiles." }, { status: 403 });

    const creator = await query<CreatorRow>(`
      SELECT p.id, p.photo_likes::text, u.wallet_chain, u.wallet_address
      FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.review_status = 'APPROVED' AND u.account_type = 'CREATOR'
    `, [input.profileId]);
    if (!creator.rowCount) return NextResponse.json({ error: "That creator profile is not available." }, { status: 404 });
    const target = creator.rows[0];
    if (target.wallet_chain !== session.chain) {
      return NextResponse.json({ error: `This creator receives on ${target.wallet_chain === "solana" ? "Solana" : "Base"}. Connect a matching wallet to pay.` }, { status: 409 });
    }
    if (target.wallet_address.toLowerCase() === session.address.toLowerCase()) {
      return NextResponse.json({ error: "You cannot pay your own wallet." }, { status: 409 });
    }

    let grossMicros: bigint;
    if (kind === "PAID_LIKE") {
      const completedHundreds = BigInt(Math.floor(Number(target.photo_likes) / 100));
      grossMicros = BigInt(5_000_000) + completedHundreds * BigInt(5_000);
    } else {
      const parsed = decimalToMicros(input.amountUsdc);
      if (parsed === null || parsed < BigInt(1_000_000) || parsed > BigInt(100_000_000_000)) {
        return NextResponse.json({ error: "Choose an amount between 1 and 100,000 USDC." }, { status: 400 });
      }
      grossMicros = parsed;
    }

    const platformMicros = (grossMicros + BigInt(5)) / BigInt(10);
    const creatorMicros = grossMicros - platformMicros;
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await query(`
      INSERT INTO payment_quotes
        (id, buyer_user_id, creator_profile_id, kind, network, gross_amount_usdc, creator_amount_usdc, platform_amount_usdc, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, account.id, target.id, kind, session.chain === "solana" ? "SOLANA" : "BASE", microsToDecimal(grossMicros), microsToDecimal(creatorMicros), microsToDecimal(platformMicros), expiresAt]);

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
      creatorAddress: target.wallet_address,
      treasuryAddress: session.chain === "solana" ? PAYMENT_CONFIG.solana.treasuryAddress : PAYMENT_CONFIG.base.treasuryAddress,
      tokenAddress: session.chain === "solana" ? PAYMENT_CONFIG.solana.usdcMintAddress : PAYMENT_CONFIG.base.usdcContractAddress,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error("Payment quote failed", error);
    return NextResponse.json({ error: "A secure payment quote could not be created." }, { status: 503 });
  }
}
