import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Rating } from "@/lib/models/Rating";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { offerId, score } = body;

  if (!offerId || !score || score < 1 || score > 5) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const offer = await Offer.findById(offerId).lean();
  if (!offer) return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });

  const load = await Load.findById(offer.load_id).lean();
  if (!load || load.status !== "delivered") {
    return NextResponse.json({ error: "La carga debe estar entregada para calificar." }, { status: 400 });
  }

  const shipper = await Shipper.findById(load.shipper_id).lean();
  if (!shipper) return NextResponse.json({ error: "Dador no encontrado." }, { status: 404 });

  const driverId = offer.driver_id;
  const shipperUserId = new mongoose.Types.ObjectId(shipper.user_id.toString());

  let toUserId: mongoose.Types.ObjectId;
  if (userId.equals(driverId)) {
    toUserId = shipperUserId;
  } else if (userId.equals(shipperUserId)) {
    toUserId = new mongoose.Types.ObjectId(driverId.toString());
  } else {
    return NextResponse.json({ error: "No estás autorizado para calificar este viaje." }, { status: 403 });
  }

  try {
    await Rating.create({
      load_id:      offer.load_id,
      offer_id:     new mongoose.Types.ObjectId(offerId),
      from_user_id: userId,
      to_user_id:   toUserId,
      score:        Math.round(score),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "Ya calificaste este viaje." }, { status: 409 });
    }
    console.error("[ratings] POST error:", err);
    return NextResponse.json({ error: "Error al guardar la calificación." }, { status: 500 });
  }
}
