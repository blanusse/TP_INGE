import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { offerId } = await params;
  const body = await req.json();
  const res = await apiFetch(`/offers/${offerId}`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
