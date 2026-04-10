import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

// POST /api/payments/webhook — Notificaciones IPN de MercadoPago
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type !== "payment") return NextResponse.json({ ok: true });

    const paymentId = body.data?.id;
    if (!paymentId) return NextResponse.json({ ok: true });

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: paymentId });

    if (payment.status !== "approved") return NextResponse.json({ ok: true });

    const offerId = payment.external_reference;
    if (!offerId) return NextResponse.json({ ok: true });

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
    const internalHeaders = {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_SECRET ?? "",
    };

    await fetch(`${backendUrl}/loads/internal/by-offer/${offerId}`, {
      method: "PATCH",
      headers: internalHeaders,
    });

    await fetch(`${backendUrl}/payments/internal/${offerId}/confirm`, {
      method: "PATCH",
      headers: internalHeaders,
      body: JSON.stringify({ mpPaymentId: String(paymentId) }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[payments/webhook]", err);
    // Siempre devolver 200 a MP para que no reintente
    return NextResponse.json({ ok: true });
  }
}
