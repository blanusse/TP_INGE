import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import mongoose from "mongoose";

// PATCH /api/offers/[offerId]  — dador acepta o rechaza una oferta
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await params;
  const body = await req.json();
  const { status } = body; // "accepted" | "rejected"

  if (!["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  await connectDB();

  // Verificar que el dador es dueño de la carga
  const offer = await Offer.findById(new mongoose.Types.ObjectId(offerId));
  if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  const load = await Load.findById(offer.load_id);
  if (!load) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });

  const shipper = await Shipper.findOne({ user_id: new mongoose.Types.ObjectId(session.user.id) });
  if (!shipper || shipper._id.toString() !== load.shipper_id.toString()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  offer.status = status;
  await offer.save();

  // Si se aceptó, rechazar automáticamente las demás ofertas pendientes de la misma carga
  if (status === "accepted") {
    await Offer.updateMany(
      { load_id: offer.load_id, _id: { $ne: offer._id }, status: "pending" },
      { $set: { status: "rejected" } }
    );
    // Marcar la carga como matched
    await Load.updateOne({ _id: offer.load_id }, { $set: { status: "matched" } });
  }

  return NextResponse.json({ ok: true });
}
