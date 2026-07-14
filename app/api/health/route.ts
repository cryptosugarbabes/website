import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "cryptosugarbabes",
    release: process.env.DEPLOY_SHA || "development"
  });
}
