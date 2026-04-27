import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const secret = req.headers.get("x-internal-secret") ?? "";
  const res = await fetch(`${BACKEND_URL}/payments/internal/${id}/mark-paid`, {
    method: "POST",
    headers: { "x-internal-secret": secret },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
