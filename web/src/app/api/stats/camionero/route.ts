import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Rating } from "@/lib/models/Rating";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);

  const acceptedOffers = await Offer.find({ driver_id: userId, status: "accepted" }).lean();
  const loadIds = acceptedOffers.map((o) => o.load_id);

  const viajesCompletados = await Load.countDocuments({
    _id: { $in: loadIds },
    status: "delivered",
  });

  const ratingAgg = await Rating.aggregate([
    { $match: { to_user_id: userId } },
    { $group: { _id: null, avg: { $avg: "$score" } } },
  ]);
  const avg = ratingAgg[0]?.avg ?? null;

  const memberSince = new Date(userId.getTimestamp()).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });

  return NextResponse.json({
    viajesCompletados,
    calificacionPromedio: avg !== null ? Math.round(avg * 10) / 10 : null,
    memberSince,
  });
}
