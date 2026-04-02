import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // El frontend puede mandar ?email=... o ?field=email&value=...
  const email = searchParams.get("email") ?? searchParams.get("value") ?? "";

  console.log("[auth/check] BACKEND_URL =", BACKEND_URL);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/check?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("[auth/check] fetch failed:", err);
    return NextResponse.json({ error: "fetch_failed", detail: String(err) }, { status: 502 });
  }

  const text = await res.text();
  console.log("[auth/check] Railway response:", res.status, text.slice(0, 200));

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json", detail: text.slice(0, 200) }, { status: 502 });
  }

  return NextResponse.json(data, { status: res.status });
}
