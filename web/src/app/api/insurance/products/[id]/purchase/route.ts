import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.backendToken)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await apiFetch(`/insurance/products/${id}/purchase`, session.backendToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
