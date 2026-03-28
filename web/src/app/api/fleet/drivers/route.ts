import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "flota") return NextResponse.json({ error: "Solo para empresas de flota" }, { status: 403 });

  await connectDB();

  const drivers = await User.find(
    { fleet_id: new mongoose.Types.ObjectId(session.user.id), role: "driver" },
    "name email phone dni"
  ).lean();

  return NextResponse.json({
    drivers: drivers.map((d) => ({ ...d, _id: d._id.toString() })),
  });
}
