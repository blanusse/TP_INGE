import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// POST /api/payments/confirm?offerId=xxx&loadId=xxx
// Llamado desde la página de éxito de MP para marcar la carga como in_transit.
// El webhook de MP puede llegar antes — hacemos que ambos sean idempotentes.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const loadId = searchParams.get("loadId");
  const offerId = searchParams.get("offerId");
  if (!loadId || !offerId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

  // Marcar la carga como in_transit. Si el webhook ya lo hizo antes, puede retornar 4xx.
  // Tratamos ambos casos como éxito para el usuario.
  const transitRes = await apiFetch(`/loads/${loadId}/in-transit`, session.backendToken, {
    method: "PATCH",
  });

  if (!transitRes.ok) {
    const err = await transitRes.json();
    // 400 "La carga ya está en tránsito o no puede pasar a este estado" → el webhook ya actuó, OK
    const msg: string = err?.message ?? "";
    const alreadyDone = transitRes.status === 400 && (msg.includes("tránsito") || msg.includes("estado"));
    if (!alreadyDone) {
      return NextResponse.json(err, { status: transitRes.status });
    }
  }

  // Confirmar el pago en el registro (idempotente — si ya fue confirmado por webhook, se sobreescribe sin error)
  await apiFetch(`/payments/${offerId}/confirm`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify({}),
  });

  return NextResponse.json({ ok: true });
}
