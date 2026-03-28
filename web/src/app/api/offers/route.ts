import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
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

  // Enriquecer con datos del camionero
  const driverIds = offers.map((o) => o.driver_id);
  const drivers   = await User.find({ _id: { $in: driverIds } }, "name").lean();
  const driverMap = Object.fromEntries(drivers.map((d) => [d._id.toString(), d.name]));

  const result = offers.map((o, i) => {
    const name = driverMap[o.driver_id.toString()] ?? "Camionero";
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return {
      id:           i + 1,
      offerId:      o._id.toString(),
      nombre:       name,
      iniciales:    initials,
      rating:       4.5,
      viajes:       0,
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
    // Duplicate key = ya ofertó
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "Ya enviaste una oferta para esta carga." }, { status: 409 });
    }
    console.error("[offers] POST error:", err);
    return NextResponse.json({ error: "Error al enviar la oferta." }, { status: 500 });
  }
}
