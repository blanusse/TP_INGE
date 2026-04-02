import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // El frontend puede mandar ?email=... o ?field=email&value=...
  const email = searchParams.get("email") ?? searchParams.get("value") ?? "";

  const res = await fetch(`${BACKEND_URL}/auth/check?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
