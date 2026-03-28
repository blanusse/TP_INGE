import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { Offer } from "@/lib/models/Offer";

const TRUCK_TYPE_MAP: Record<string, string | null> = {
  "Cualquiera":     null,
  "Granelero":      null,
  "Furgón cerrado": "camion",
  "Plataforma":     "semi",
  "Refrigerado":    "frigorifico",
  "Cisterna":       "cisterna",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const shipper = await Shipper.findOne({ user_id: session.user.id }).lean();
  if (!shipper) return NextResponse.json({ loads: [] });

  const loads = await Load.find({ shipper_id: shipper._id, status: { $ne: "cancelled" } })
    .sort({ created_at: -1 })
    .lean();

  // Agregar conteo de ofertas por carga
  const loadIds = loads.map((l) => l._id);
  const offerCounts = await Offer.aggregate([
    { $match: { load_id: { $in: loadIds }, status: "pending" } },
    { $group: { _id: "$load_id", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(offerCounts.map((o) => [o._id.toString(), o.count]));

  const result = loads.map((l) => ({
    ...l,
    _id: l._id.toString(),
    shipper_id: l.shipper_id.toString(),
    offers_count: countMap[l._id.toString()] ?? 0,
  }));

  return NextResponse.json({ loads: result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.origen || !body.destino) {
    return NextResponse.json({ error: "Origen y destino son obligatorios." }, { status: 400 });
  }

  await connectDB();

  const shipper = await Shipper.findOne({ user_id: session.user.id }).lean();
  if (!shipper) {
    return NextResponse.json({ error: "No tenés perfil de dador registrado." }, { status: 403 });
  }

  const load = await Load.create({
    shipper_id:          shipper._id,
    pickup_city:         body.origen,
    dropoff_city:        body.destino,
    cargo_type:          body.tipoCarga  || undefined,
    truck_type_required: TRUCK_TYPE_MAP[body.tipoCamion] ?? undefined,
    weight_kg:           body.peso    ? parseFloat(body.peso)  : undefined,
    price_base:          body.precio  ? parseInt(body.precio)  : undefined,
    ready_at:            body.retiro  ? new Date(body.retiro)  : undefined,
    description:         body.descripcion || undefined,
    status:              "available",
  });

  return NextResponse.json({ load: { ...load.toObject(), _id: load._id.toString() } }, { status: 201 });
}
