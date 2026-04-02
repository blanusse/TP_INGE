import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const offerId = new URL(req.url).searchParams.get("offerId") ?? "";
  const res = await apiFetch(`/messages?offerId=${offerId}`, session.backendToken);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { messages: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json();
  const payload = {
    offer_id: body.offerId ?? body.offer_id,
    content: body.content,
  };
  const res = await apiFetch("/messages", session.backendToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
