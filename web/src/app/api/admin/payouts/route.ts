import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret") ?? "";
  const res = await fetch(`${BACKEND_URL}/payments/admin/payouts`, {
    headers: { "x-internal-secret": secret },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
