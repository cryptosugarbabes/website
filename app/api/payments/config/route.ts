import { NextResponse } from "next/server";

import { PAYMENT_CONFIG } from "@/lib/payment-config";

export async function GET() {
  return NextResponse.json(PAYMENT_CONFIG);
}
