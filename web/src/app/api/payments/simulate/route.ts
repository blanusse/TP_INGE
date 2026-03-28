import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "offerId requerido" }, { status: 400 });

  await connectDB();

  const offer = await Offer.findById(offerId);
  if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  if (offer.status !== "accepted") {
    offer.status = "accepted";
    await offer.save();
    await Offer.updateMany(
      { load_id: offer.load_id, _id: { $ne: offer._id }, status: { $in: ["pending", "countered"] } },
      { $set: { status: "rejected" } }
    );
  }

  await Load.findByIdAndUpdate(offer.load_id, { status: "in_transit" });

  return NextResponse.json({ ok: true });
}
