import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// POST /api/payments/confirm?offerId=xxx&loadId=xxx
// Llamado desde la página de éxito de MP para marcar la carga como in_transit
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const loadId = searchParams.get("loadId");
  const offerId = searchParams.get("offerId");
  if (!loadId || !offerId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

  const transitRes = await apiFetch(`/loads/${loadId}/in-transit`, session.backendToken, {
    method: "PATCH",
  });
  if (!transitRes.ok) {
    const err = await transitRes.json();
    return NextResponse.json(err, { status: transitRes.status });
  }

  // Confirmar el pago en el registro de pagos
  await apiFetch(`/payments/${offerId}/confirm`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify({}),
  });

  return NextResponse.json({ ok: true });
}
