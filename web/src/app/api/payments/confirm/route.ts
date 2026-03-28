import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import mongoose from "mongoose";

// POST /api/payments/confirm?offerId=xxx
// Llamado desde la página de éxito de MP para marcar el pago como confirmado
export async function POST(req: NextRequest) {
  const offerId = new URL(req.url).searchParams.get("offerId");
  if (!offerId) return NextResponse.json({ error: "Falta offerId" }, { status: 400 });

  await connectDB();

  const offer = await Offer.findById(new mongoose.Types.ObjectId(offerId));
  if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  // Pasar la carga a in_transit (pago confirmado)
  await Load.updateOne({ _id: offer.load_id }, { $set: { status: "in_transit" } });

  return NextResponse.json({ ok: true });
}
