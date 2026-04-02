import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get("cargo_type")) params.set("cargo_type", searchParams.get("cargo_type")!);
  if (searchParams.get("origin"))     params.set("origin", searchParams.get("origin")!);

  const res = await fetch(`${BACKEND_URL}/loads/available?${params}`);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { loads: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}
