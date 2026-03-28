import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipoCarga = searchParams.get("tipoCarga");
  const origen    = searchParams.get("origen");

  await connectDB();

  const filter: Record<string, unknown> = { status: "available" };
  if (tipoCarga) filter.cargo_type  = { $regex: tipoCarga, $options: "i" };
  if (origen)    filter.pickup_city = { $regex: origen,    $options: "i" };

  const loads = await Load.find(filter).sort({ created_at: -1 }).lean();

  // Enriquecer con datos del shipper
  const shipperIds = [...new Set(loads.map((l) => l.shipper_id.toString()))];
  const shippers   = await Shipper.find({ _id: { $in: shipperIds } }).lean();
  const userIds    = shippers.map((s) => s.user_id.toString());
  const users      = await User.find({ _id: { $in: userIds } }, "name").lean();

  const shipperMap = Object.fromEntries(
    shippers.map((s) => {
      const u = users.find((u) => u._id.toString() === s.user_id.toString());
      return [s._id.toString(), { razon_social: s.razon_social ?? u?.name ?? "Dador de carga" }];
    })
  );

  const result = loads.map((l) => ({
    _id:        l._id.toString(),
    shipper_id: l.shipper_id.toString(),
    // Zona pública — sin dirección exacta
    pickup_city:  l.pickup_city,
    dropoff_city: l.dropoff_city,
    // Coordenadas para calcular distancia del recorrido en el cliente
    pickup_lat:  l.pickup_lat  ?? null,
    pickup_lon:  l.pickup_lon  ?? null,
    dropoff_lat: l.dropoff_lat ?? null,
    dropoff_lon: l.dropoff_lon ?? null,
    // pickup_exact / dropoff_exact NO se incluyen aquí intencionalmente
    cargo_type:          l.cargo_type          ?? null,
    truck_type_required: l.truck_type_required ?? null,
    weight_kg:           l.weight_kg           ?? null,
    price_base:          l.price_base          ?? null,
    ready_at:            l.ready_at            ?? null,
    description:         l.description         ?? null,
    status:              l.status,
    created_at:          l.created_at,
    shipper:             shipperMap[l.shipper_id.toString()] ?? null,
  }));

  return NextResponse.json({ loads: result });
}
