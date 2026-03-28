import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { MercadoPagoConfig, Preference } from "mercadopago";
import mongoose from "mongoose";

// POST /api/payments/create-preference
// Crea preferencia en MercadoPago y acepta la oferta en DB (bloquea la carga)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "Falta offerId" }, { status: 400 });

  await connectDB();

  const offer = await Offer.findById(new mongoose.Types.ObjectId(offerId));
  if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  const load = await Load.findById(offer.load_id);
  if (!load) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });

  // Verificar que el usuario es el shipper de esa carga
  const shipper = await Shipper.findOne({ user_id: new mongoose.Types.ObjectId(session.user.id) });
  if (!shipper || shipper._id.toString() !== load.shipper_id.toString()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Aceptar la oferta en DB si aún no está aceptada
  if (offer.status !== "accepted") {
    offer.status = "accepted";
    await offer.save();
    // Rechazar las demás ofertas de esta carga
    await Offer.updateMany(
      { load_id: offer.load_id, _id: { $ne: offer._id }, status: { $in: ["pending", "countered"] } },
      { $set: { status: "rejected" } }
    );
    // Marcar carga como matched (reservada, esperando pago)
    await Load.updateOne({ _id: offer.load_id }, { $set: { status: "matched" } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const titulo = `${load.cargo_type ?? "Carga"} — ${load.pickup_city} → ${load.dropoff_city}`;

  // Crear preferencia en MercadoPago
  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  });

  const preference = new Preference(client);

  try {
    const response = await preference.create({
      body: {
        items: [
          {
            id:         offerId,
            title:      `CargaBack: ${titulo}`,
            quantity:   1,
            unit_price: offer.price,
            currency_id: "ARS",
          },
        ],
        external_reference: offerId,
        back_urls: {
          success: `${appUrl}/pago/exito`,
          failure: `${appUrl}/pago/fallo`,
          pending: `${appUrl}/pago/fallo`,
        },
        auto_return: "approved",
        statement_descriptor: "CARGABACK",
        metadata: {
          offer_id:  offerId,
          load_id:   load._id.toString(),
          shipper_id: shipper._id.toString(),
        },
      },
    });

    return NextResponse.json({
      init_point:   response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      preference_id: response.id,
    });
  } catch (err) {
    console.error("[payments/create-preference]", err);
    return NextResponse.json({ error: "Error al crear preferencia de pago." }, { status: 500 });
  }
}
