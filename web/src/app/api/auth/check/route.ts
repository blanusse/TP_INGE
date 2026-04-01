import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") ?? "";

  const res = await fetch(`${BACKEND_URL}/auth/check?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
