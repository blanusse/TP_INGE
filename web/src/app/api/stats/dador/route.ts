import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Shipper } from "@/lib/models/Shipper";
import { Load } from "@/lib/models/Load";
import { Rating } from "@/lib/models/Rating";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const shipper = await Shipper.findOne({ user_id: userId }).lean();

  if (!shipper) {
    return NextResponse.json({ totalCargas: 0, enTransito: 0, memberSince: "—", calificacionPromedio: null, razonSocial: null, cuit: null, address: null });
  }

  const [totalCargas, enTransito, ratingAgg] = await Promise.all([
    Load.countDocuments({ shipper_id: shipper._id, status: { $ne: "cancelled" } }),
    Load.countDocuments({ shipper_id: shipper._id, status: "in_transit" }),
    Rating.aggregate([
      { $match: { to_user_id: userId } },
      { $group: { _id: null, avg: { $avg: "$score" } } },
    ]),
  ]);

  const avg = ratingAgg[0]?.avg ?? null;

  const memberSince = new Date((shipper._id as mongoose.Types.ObjectId).getTimestamp())
    .toLocaleDateString("es-AR", { month: "short", year: "numeric" });

  return NextResponse.json({
    totalCargas,
    enTransito,
    memberSince,
    calificacionPromedio: avg !== null ? Math.round(avg * 10) / 10 : null,
    razonSocial: shipper.razon_social ?? null,
    cuit: shipper.cuit ?? shipper.cuil ?? null,
    address: shipper.address ?? null,
  });
}
