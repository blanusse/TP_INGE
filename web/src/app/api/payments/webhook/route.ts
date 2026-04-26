import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import crypto from "crypto";

// Verifica la firma HMAC-SHA256 que MP incluye en el header x-signature.
// Solo se aplica si MP_WEBHOOK_SECRET está configurado.
function verifyMpSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado, omitir verificación

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  // Formato: "ts=1234567890,v1=abc123..."
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return computed === v1;
}

// POST /api/payments/webhook — Notificaciones IPN de MercadoPago
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type !== "payment") return NextResponse.json({ ok: true });

    const paymentId = body.data?.id;
    if (!paymentId) return NextResponse.json({ ok: true });

    if (!verifyMpSignature(req, String(paymentId))) {
      console.warn("[payments/webhook] Firma inválida, ignorando notificación.");
      return NextResponse.json({ ok: true }); // devolver 200 igual para que MP no reintente
    }

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
