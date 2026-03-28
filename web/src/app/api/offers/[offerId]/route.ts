import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import mongoose from "mongoose";

async function getOfferAndRoles(offerId: string, userId: string) {
  const offer   = await Offer.findById(new mongoose.Types.ObjectId(offerId));
  if (!offer) return null;
  const load    = await Load.findById(offer.load_id);
  if (!load)  return null;
  const shipper = await Shipper.findOne({ user_id: new mongoose.Types.ObjectId(userId) });

  const isDriver  = offer.driver_id.toString() === userId;
  const isShipper = shipper?._id.toString() === load.shipper_id.toString();

  return { offer, load, isDriver, isShipper };
}

// PATCH /api/offers/[offerId]
// Dador:    { action: "accept" | "reject" | "counter", counterPrice? }
// Camionero: { action: "withdraw" | "accept_counter" | "reject_counter" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await params;
  const body = await req.json();
  const { action, counterPrice } = body;

  await connectDB();

  const ctx = await getOfferAndRoles(offerId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  const { offer, load, isDriver, isShipper } = ctx;

  // ── Acciones del dador ────────────────────────────────────────────────────
  if (action === "accept") {
    if (!isShipper) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    offer.status = "accepted";
    await offer.save();
    // Rechazar automáticamente las demás ofertas pendientes
    await Offer.updateMany(
      { load_id: offer.load_id, _id: { $ne: offer._id }, status: { $in: ["pending", "countered"] } },
      { $set: { status: "rejected" } }
    );
    // Marcar la carga como matched
    await Load.updateOne({ _id: offer.load_id }, { $set: { status: "matched" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (!isShipper) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    offer.status = "rejected";
    await offer.save();
    return NextResponse.json({ ok: true });
  }

  if (action === "counter") {
    if (!isShipper) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (!counterPrice || isNaN(Number(counterPrice))) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }
    offer.status        = "countered";
    offer.counter_price = Number(counterPrice);
    await offer.save();
    return NextResponse.json({ ok: true });
  }

  // ── Acciones del camionero ────────────────────────────────────────────────
  if (action === "withdraw") {
    if (!isDriver) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (!["pending", "countered"].includes(offer.status)) {
      return NextResponse.json({ error: "Solo podés retirar ofertas pendientes" }, { status: 400 });
    }
    offer.status = "withdrawn";
    await offer.save();
    return NextResponse.json({ ok: true });
  }

  if (action === "accept_counter") {
    if (!isDriver) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (offer.status !== "countered") {
      return NextResponse.json({ error: "No hay contraoferta activa" }, { status: 400 });
    }
    // El precio final es la contraoferta del dador
    offer.price  = offer.counter_price!;
    offer.status = "accepted";
    await offer.save();
    await Offer.updateMany(
      { load_id: offer.load_id, _id: { $ne: offer._id }, status: { $in: ["pending", "countered"] } },
      { $set: { status: "rejected" } }
    );
    await Load.updateOne({ _id: offer.load_id }, { $set: { status: "matched" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject_counter") {
    if (!isDriver) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    offer.status = "rejected";
    await offer.save();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

// DELETE /api/offers/[offerId] — camionero retira su oferta
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { offerId } = await params;

  await connectDB();

  const ctx = await getOfferAndRoles(offerId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

  const { offer, isDriver } = ctx;
  if (!isDriver) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  if (!["pending", "countered"].includes(offer.status)) {
    return NextResponse.json({ error: "Solo podés retirar ofertas pendientes" }, { status: 400 });
  }

  offer.status = "withdrawn";
  await offer.save();
  return NextResponse.json({ ok: true });
}
