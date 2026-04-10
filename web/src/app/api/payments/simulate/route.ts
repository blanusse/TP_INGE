import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// POST /api/payments/simulate
// Simula un pago exitoso sin pasar por MercadoPago (útil para desarrollo/testing)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "offerId requerido" }, { status: 400 });

  // 1. Aceptar la oferta (NestJS verifica permisos, rechaza otras, pone carga en matched)
  const acceptRes = await apiFetch(`/offers/${offerId}`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify({ action: "accept" }),
  });

  if (!acceptRes.ok) {
    const err = await acceptRes.json();
    return NextResponse.json(err, { status: acceptRes.status });
  }

  const offer = await acceptRes.json();
  const loadId = offer.load_id;

  // 2. Registrar el pago como pending
  await apiFetch("/payments", session.backendToken, {
    method: "POST",
    body: JSON.stringify({ offerId, amount: Number(offer.price), mpPreferenceId: "simulate" }),
  });

  // 3. Pasar la carga a in_transit (simula confirmación de pago)
  const transitRes = await apiFetch(`/loads/${loadId}/in-transit`, session.backendToken, {
    method: "PATCH",
  });

  if (!transitRes.ok) {
    const err = await transitRes.json();
    return NextResponse.json(err, { status: transitRes.status });
  }

  // 4. Confirmar el pago en el registro
  await apiFetch(`/payments/${offerId}/confirm`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify({}),
  });

  return NextResponse.json({ ok: true });
}
