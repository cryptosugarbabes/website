import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_EVENTS, recordProductEvent, reportApplicationError, type ProductEvent } from "@/lib/observability";
import { clientAddress, takeRateLimit } from "@/lib/rate-limit";
import { requestHasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const rate = await takeRateLimit(`observability:${clientAddress(request)}`, 90, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ accepted: false }, { status: 429 });
  const input = await request.json().catch(() => null) as { event?: string; error?: string; pagePath?: string } | null;
  const pagePath = typeof input?.pagePath === "string" ? input.pagePath : "/";

  if (input?.event && PRODUCT_EVENTS.includes(input.event as ProductEvent)) {
    await recordProductEvent(input.event as ProductEvent, pagePath).catch((error) => reportApplicationError("observability:event", error));
    return NextResponse.json({ accepted: true }, { status: 202 });
  }
  if (typeof input?.error === "string" && input.error.trim()) {
    await reportApplicationError(`browser:${pagePath.split("?")[0]}`, input.error);
    return NextResponse.json({ accepted: true }, { status: 202 });
  }
  return NextResponse.json({ error: "Unsupported observability event." }, { status: 400 });
}
