import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { Offer } from "@/lib/models/Offer";
import mongoose from "mongoose";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const { loadId } = await params;
  const load = await Load.findById(new mongoose.Types.ObjectId(loadId)).lean();

  if (!load) return NextResponse.json({ error: "Carga no encontrada." }, { status: 404 });
  if (load.status !== "in_transit") {
    return NextResponse.json({ error: "La carga no está en tránsito." }, { status: 400 });
  }

  const shipper = await Shipper.findById(load.shipper_id).lean();
  if (!shipper || shipper.user_id.toString() !== session.user.id) {
    return NextResponse.json({ error: "Solo el dador de carga puede confirmar la llegada." }, { status: 403 });
  }

  await Load.updateOne({ _id: load._id }, { $set: { status: "delivered" } });

  const offer = await Offer.findOne({ load_id: load._id, status: "accepted" }).lean();

  return NextResponse.json({
    ok: true,
    offerId:      offer?._id.toString() ?? null,
    driverUserId: offer?.driver_id.toString() ?? null,
  });
}
