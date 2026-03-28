import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { Offer } from "@/lib/models/Offer";
import { User } from "@/lib/models/User";

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

  const loadIds = loads.map((l) => l._id);

  // Conteo de ofertas pendientes
  const offerCounts = await Offer.aggregate([
    { $match: { load_id: { $in: loadIds }, status: { $in: ["pending", "countered"] } } },
    { $group: { _id: "$load_id", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(offerCounts.map((o) => [o._id.toString(), o.count]));

  // Oferta aceptada para cargas matched
  const matchedLoadIds = loads.filter((l) => l.status === "matched").map((l) => l._id);
  let acceptedOfferMap: Record<string, { offerId: string; driverId: string; precio: number }> = {};
  if (matchedLoadIds.length > 0) {
    const acceptedOffers = await Offer.find({ load_id: { $in: matchedLoadIds }, status: "accepted" }).lean();
    // Enriquecer con nombre del camionero
    const driverIds = acceptedOffers.map((o) => o.driver_id);
    const drivers = await User.find({ _id: { $in: driverIds } }, "name").lean();
    const driverMap = Object.fromEntries(drivers.map((d) => [d._id.toString(), d.name as string]));
    acceptedOfferMap = Object.fromEntries(
      acceptedOffers.map((o) => [o.load_id.toString(), {
        offerId: o._id.toString(),
        driverId: o.driver_id.toString(),
        driverName: driverMap[o.driver_id.toString()] ?? "Camionero",
        precio: o.price,
      }])
    );
  }

  const result = loads.map((l) => ({
    ...l,
    _id: l._id.toString(),
    shipper_id: l.shipper_id.toString(),
    offers_count: countMap[l._id.toString()] ?? 0,
    accepted_offer: acceptedOfferMap[l._id.toString()] ?? null,
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

  const PRECIO_MINIMO_ABSOLUTO = 30_000;
  if (body.precio && parseInt(body.precio) < PRECIO_MINIMO_ABSOLUTO) {
    return NextResponse.json({
      error: `El precio mínimo permitido es $${PRECIO_MINIMO_ABSOLUTO.toLocaleString("es-AR")} ARS. Si tu precio de referencia es más bajo, el mercado no lo tomará en serio y atraerás menos camioneros.`,
    }, { status: 400 });
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
