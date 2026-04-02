import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const loadId = new URL(req.url).searchParams.get("loadId") ?? "";
  const res = await apiFetch(`/offers?loadId=${loadId}`, session.backendToken);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { offers: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json();
  const res = await apiFetch("/offers", session.backendToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
