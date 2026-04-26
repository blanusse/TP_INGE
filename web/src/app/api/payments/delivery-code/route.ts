import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// GET /api/payments/delivery-code?loadId=xxx
// El dador obtiene el código de entrega para mostrárselo al destinatario.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const loadId = new URL(req.url).searchParams.get("loadId");
  if (!loadId) return NextResponse.json({ error: "Falta loadId" }, { status: 400 });

  const res = await apiFetch(`/payments/delivery-code?loadId=${loadId}`, session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
