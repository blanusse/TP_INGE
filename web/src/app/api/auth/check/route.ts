import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(req: NextRequest) {
  if (!BACKEND_URL) {
    console.error("[check] BACKEND_URL no configurado");
    return NextResponse.json({ available: true }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field") ?? "email";
  const value = searchParams.get("value") ?? searchParams.get("email") ?? "";

  try {
    const res  = await fetch(`${BACKEND_URL}/auth/check?field=${field}&value=${encodeURIComponent(value)}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ available: true }, { status: 200 });
  }
}
