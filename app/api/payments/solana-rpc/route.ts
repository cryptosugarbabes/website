import { NextRequest, NextResponse } from "next/server";
import { reportApplicationError } from "@/lib/observability";
import { takeRateLimit } from "@/lib/rate-limit";
import { requestHasTrustedOrigin, walletSession } from "@/lib/request-security";
import { isAllowedSolanaRpcRequest } from "@/lib/solana-rpc-proxy";

const FALLBACK_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export async function POST(request: NextRequest) {
  const session = walletSession(request);
  if (!session || session.chain !== "solana") return NextResponse.json({ error: "Connect your Solana wallet before paying." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });

  const rate = await takeRateLimit(`solana-payment-rpc:${session.userId || session.address}`, 180, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Solana payment checks are temporarily rate-limited. Try again shortly." }, { status: 429 });

  const input = await request.json().catch(() => null);
  if (!isAllowedSolanaRpcRequest(input)) return NextResponse.json({ error: "Unsupported Solana payment check." }, { status: 400 });

  try {
    const upstream = await fetch(process.env.SOLANA_RPC_URL || FALLBACK_SOLANA_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
    const payload = await upstream.text();
    if (!upstream.ok) {
      await reportApplicationError("solana-rpc:upstream", new Error(`Solana RPC returned HTTP ${upstream.status}.`));
      return NextResponse.json({ error: "Solana payment checks are temporarily unavailable." }, { status: 502 });
    }
    return new NextResponse(payload, { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (error) {
    await reportApplicationError("solana-rpc:request", error);
    return NextResponse.json({ error: "Solana payment checks are temporarily unavailable." }, { status: 503 });
  }
}
