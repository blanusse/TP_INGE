import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Rating } from "@/lib/models/Rating";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";

// GET /api/offers?loadId=xxx  — dador ve las ofertas de una carga
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const loadId = new URL(req.url).searchParams.get("loadId");
  if (!loadId) return NextResponse.json({ error: "Falta loadId" }, { status: 400 });

  await connectDB();

  const offers = await Offer.find({ load_id: new mongoose.Types.ObjectId(loadId), status: { $in: ["pending", "countered"] } })
    .sort({ created_at: 1 })
    .lean();

  const driverIds = offers.map((o) => o.driver_id);

  const [drivers, ratingsAgg, acceptedOffers] = await Promise.all([
    User.find({ _id: { $in: driverIds } }, "name").lean(),
    // Average rating per driver
    Rating.aggregate([
      { $match: { to_user_id: { $in: driverIds } } },
      { $group: { _id: "$to_user_id", avg: { $avg: "$score" } } },
    ]),
    // Accepted offers by these drivers to count completed trips
    Offer.find({ driver_id: { $in: driverIds }, status: "accepted" }).lean(),
  ]);

  const driverMap  = Object.fromEntries(drivers.map((d) => [d._id.toString(), d.name as string]));
  const ratingMap  = Object.fromEntries(ratingsAgg.map((r) => [r._id.toString(), Math.round(r.avg * 10) / 10]));

  // Count delivered loads per driver
  const acceptedLoadIds = acceptedOffers.map((o) => o.load_id);
  const deliveredLoads  = await Load.find({ _id: { $in: acceptedLoadIds }, status: "delivered" }).lean();
  const deliveredSet    = new Set(deliveredLoads.map((l) => l._id.toString()));

  const tripsMap: Record<string, number> = {};
  for (const o of acceptedOffers) {
    if (deliveredSet.has(o.load_id.toString())) {
      const did = o.driver_id.toString();
      tripsMap[did] = (tripsMap[did] ?? 0) + 1;
    }
  }

  const result = offers.map((o, i) => {
    const driverId = o.driver_id.toString();
    const name     = driverMap[driverId] ?? "Camionero";
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return {
      id:           i + 1,
      offerId:      o._id.toString(),
      nombre:       name,
      iniciales:    initials,
      rating:       ratingMap[driverId] ?? 0,
      viajes:       tripsMap[driverId] ?? 0,
      precio:       o.price,
      counterPrice: o.counter_price ?? null,
      status:       o.status,
      nota:         o.note ?? "",
    };
  });

  return NextResponse.json({ offers: result });
}

// POST /api/offers  — camionero hace una oferta
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.loadId || !body.price) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  await connectDB();

  try {
    const offer = await Offer.create({
      load_id:   new mongoose.Types.ObjectId(body.loadId),
      driver_id: new mongoose.Types.ObjectId(session.user.id),
      price:     parseInt(body.price),
      note:      body.note || undefined,
    });
    return NextResponse.json({ offer: offer.toObject() }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "Ya enviaste una oferta para esta carga." }, { status: 409 });
    }
    console.error("[offers] POST error:", err);
    return NextResponse.json({ error: "Error al enviar la oferta." }, { status: 500 });
  }
}
