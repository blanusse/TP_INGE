import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log("[auth/register] BACKEND_URL =", BACKEND_URL);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[auth/register] fetch failed:", err);
    return NextResponse.json({ error: "fetch_failed", detail: String(err) }, { status: 502 });
  }

  const text = await res.text();
  console.log("[auth/register] Railway response:", res.status, text.slice(0, 200));

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json", detail: text.slice(0, 200) }, { status: 502 });
  }

  return NextResponse.json(data, { status: res.status });
}
