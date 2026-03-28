import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { MercadoPagoConfig, Payment } from "mercadopago";
import mongoose from "mongoose";

// POST /api/payments/webhook — Notificaciones IPN de MercadoPago
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // MP envía { type: "payment", data: { id: "..." } }
    if (body.type !== "payment") return NextResponse.json({ ok: true });

    const paymentId = body.data?.id;
    if (!paymentId) return NextResponse.json({ ok: true });

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: paymentId });

    if (payment.status !== "approved") return NextResponse.json({ ok: true });

    const offerId = payment.external_reference;
    if (!offerId) return NextResponse.json({ ok: true });

    await connectDB();

    const offer = await Offer.findById(new mongoose.Types.ObjectId(offerId));
    if (!offer) return NextResponse.json({ ok: true });

    await Load.updateOne({ _id: offer.load_id }, { $set: { status: "in_transit" } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[payments/webhook]", err);
    // Siempre devolver 200 a MP para que no reintente
    return NextResponse.json({ ok: true });
  }
}
