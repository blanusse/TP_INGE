import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";
import { Rating } from "@/lib/models/Rating";
import mongoose from "mongoose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const driverId = new mongoose.Types.ObjectId(session.user.id);

  const offers = await Offer.find({ driver_id: driverId, status: "accepted" }).lean();
  if (!offers.length) return NextResponse.json({ enCurso: [], proximos: [], completados: [] });

  const loadIds = offers.map((o) => o.load_id);
  const loads   = await Load.find({ _id: { $in: loadIds } }).lean();
  const loadMap = Object.fromEntries(loads.map((l) => [l._id.toString(), l]));

  const shipperIds   = loads.map((l) => l.shipper_id);
  const shippers     = await Shipper.find({ _id: { $in: shipperIds } }).lean();
  const userIds      = shippers.map((s) => s.user_id);
  const shipperUsers = await User.find({ _id: { $in: userIds } }, "name").lean();
  const userNameMap  = Object.fromEntries(shipperUsers.map((u) => [u._id.toString(), u.name as string]));

  // Determinar qué viajes completados ya fueron calificados por este camionero
  const completedOfferIds = offers
    .filter((o) => loadMap[o.load_id.toString()]?.status === "delivered")
    .map((o) => o._id);

  const existingRatings = await Rating.find({
    offer_id:     { $in: completedOfferIds },
    from_user_id: driverId,
  }).lean();
  const ratedOfferIds = new Set(existingRatings.map((r) => r.offer_id.toString()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trips = offers.map((o) => {
    const load = loadMap[o.load_id.toString()];
    if (!load) return null;

    const shipperDoc = shippers.find((s) => s._id.toString() === load.shipper_id.toString());
    const empresa = shipperDoc?.razon_social ??
      (shipperDoc ? userNameMap[shipperDoc.user_id.toString()] ?? "Dador" : "Dador");

    const readyAt = load.ready_at ? new Date(load.ready_at) : null;

    // Clasificación considerando la fecha de retiro:
    // - "próximo" si el status es "matched" O si es "in_transit" con fecha de retiro futura
    // - "en curso" si es "in_transit" y la fecha ya pasó (o no tiene fecha)
    let clasificacion: "enCurso" | "proximos" | "completados";
    if (load.status === "delivered") {
      clasificacion = "completados";
    } else if (load.status === "in_transit") {
      clasificacion = readyAt && readyAt > today ? "proximos" : "enCurso";
    } else {
      // matched
      clasificacion = "proximos";
    }

    return {
      offerId:       o._id.toString(),
      loadId:        load._id.toString(),
      titulo:        `${load.cargo_type ?? "Carga"} — ${load.pickup_city} → ${load.dropoff_city}`,
      empresa,
      precio:        o.price,
      fechaRetiro:   readyAt ? readyAt.toLocaleDateString("es-AR") : "—",
      pickupCity:    load.pickup_city,
      dropoffCity:   load.dropoff_city,
      // Dirección exacta — disponible porque la oferta está aceptada
      pickupExact:   load.pickup_exact ?? null,
      dropoffExact:  load.dropoff_exact ?? null,
      status:        load.status,
      clasificacion,
      yaCalifiqué:   ratedOfferIds.has(o._id.toString()),
    };
  }).filter(Boolean);

  return NextResponse.json({
    enCurso:     trips.filter((t) => t!.clasificacion === "enCurso"),
    proximos:    trips.filter((t) => t!.clasificacion === "proximos"),
    completados: trips.filter((t) => t!.clasificacion === "completados"),
  });
}
