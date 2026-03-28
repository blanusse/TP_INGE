import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";

// GET /api/offers/mine — camionero ve sus propias ofertas
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const offers = await Offer.find({
    driver_id: new mongoose.Types.ObjectId(session.user.id),
  })
    .sort({ created_at: -1 })
    .lean();

  if (offers.length === 0) return NextResponse.json({ offers: [] });

  // Enriquecer con datos de la carga y el shipper
  const loadIds = offers.map((o) => o.load_id);
  const loads = await Load.find({ _id: { $in: loadIds } }).lean();
  const loadMap = Object.fromEntries(loads.map((l) => [l._id.toString(), l]));

  const shipperIds = [...new Set(loads.map((l) => l.shipper_id.toString()))];
  const shippers = await Shipper.find({ _id: { $in: shipperIds } }).lean();
  const userIds = shippers.map((s) => s.user_id.toString());
  const users = await User.find({ _id: { $in: userIds } }, "name").lean();

  const shipperMap = Object.fromEntries(
    shippers.map((s) => {
      const u = users.find((u) => u._id.toString() === s.user_id.toString());
      return [s._id.toString(), s.razon_social ?? u?.name ?? "Dador de carga"];
    })
  );

  const result = offers.map((o) => {
    const load = loadMap[o.load_id.toString()];
    const empresa = load ? (shipperMap[load.shipper_id.toString()] ?? "Dador de carga") : "Dador de carga";
    const titulo = load
      ? `${load.cargo_type ?? "Carga"} — ${load.pickup_city} → ${load.dropoff_city}`
      : "Carga eliminada";
    const fecha = new Date(o.created_at).toLocaleDateString("es-AR");
    return {
      id:         o._id.toString(),
      titulo,
      empresa,
      precioBase: load?.price_base ?? 0,
      miOferta:   o.price,
      fecha,
      estado:     o.status as "pending" | "accepted" | "rejected",
      nota:       o.note ?? "",
    };
  });

  return NextResponse.json({ offers: result });
}
