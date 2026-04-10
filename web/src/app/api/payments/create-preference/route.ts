import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { MercadoPagoConfig, Preference } from "mercadopago";

// POST /api/payments/create-preference
// Acepta la oferta en NestJS y crea la preferencia de pago en MercadoPago
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId, loadId, titulo } = await req.json();
  if (!offerId || !loadId) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });

  // 1. Aceptar la oferta en NestJS (verifica permisos, rechaza otras, pone carga en matched)
  const acceptRes = await apiFetch(`/offers/${offerId}`, session.backendToken, {
    method: "PATCH",
    body: JSON.stringify({ action: "accept" }),
  });

  if (!acceptRes.ok) {
    const err = await acceptRes.json();
    return NextResponse.json(err, { status: acceptRes.status });
  }

  const offer = await acceptRes.json();
  const price = Number(offer.price);

  // 2. Crear preferencia en MercadoPago
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
  const preference = new Preference(client);

  try {
    const response = await preference.create({
      body: {
        items: [
          {
            id: offerId,
            title: `CargaBack: ${titulo ?? "Transporte de carga"}`,
            quantity: 1,
            unit_price: price,
            currency_id: "ARS",
          },
        ],
        external_reference: offerId,
        back_urls: {
          success: `${appUrl}/pago/exito?offerId=${offerId}&loadId=${loadId}`,
          failure: `${appUrl}/pago/fallo`,
          pending: `${appUrl}/pago/fallo`,
        },
        auto_return: "approved",
        statement_descriptor: "CARGABACK",
      },
    });

    // Registrar el pago como pending en NestJS
    await apiFetch("/payments", session.backendToken, {
      method: "POST",
      body: JSON.stringify({
        offerId,
        amount: price,
        mpPreferenceId: response.id,
      }),
    });

    return NextResponse.json({
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      preference_id: response.id,
    });
  } catch (err) {
    console.error("[payments/create-preference]", err);
    return NextResponse.json({ error: "Error al crear preferencia de pago." }, { status: 500 });
  }
}
