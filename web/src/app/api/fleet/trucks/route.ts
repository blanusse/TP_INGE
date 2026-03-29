import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Truck } from "@/lib/models/Truck";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "transportista") return NextResponse.json({ error: "Solo para transportistas" }, { status: 403 });

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "transportista") return NextResponse.json({ error: "Solo para transportistas" }, { status: 403 });

  const body = await req.json();
  const { patente, marca, modelo, año, truck_type, capacity_kg, vtv_vence, seguro_poliza, seguro_vence, patente_remolque } = body;

  if (!patente || !truck_type) {
    return NextResponse.json({ error: "Patente y tipo de camión son obligatorios." }, { status: 400 });
  }

  await connectDB();

  const truck = await Truck.create({
    owner_id:      new mongoose.Types.ObjectId(session.user.id),
    patente:       patente.toUpperCase(),
    marca:         marca         || undefined,
    modelo:        modelo        || undefined,
    año:           año           ? parseInt(año) : undefined,
    truck_type,
    capacity_kg:   capacity_kg   ? parseFloat(capacity_kg) : undefined,
    vtv_vence:     vtv_vence     || undefined,
    seguro_poliza: seguro_poliza || undefined,
    seguro_vence:  seguro_vence  || undefined,
    patente_remolque: patente_remolque || undefined,
  });

  return NextResponse.json({
    ok: true,
    truck: { ...truck.toObject(), _id: truck._id.toString(), owner_id: String(truck.owner_id) },
  }, { status: 201 });
}
