import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Truck } from "@/lib/models/Truck";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "flota") return NextResponse.json({ error: "Solo para empresas de flota" }, { status: 403 });

  await connectDB();

  const trucks = await Truck.find({ owner_id: new mongoose.Types.ObjectId(session.user.id) }).lean();
  return NextResponse.json({
    trucks: trucks.map((t: Record<string, unknown>) => ({
      ...t,
      _id: String(t._id),
      owner_id: String(t.owner_id),
    })),
  });
}
