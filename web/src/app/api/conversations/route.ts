import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";
import { Message } from "@/lib/models/Message";
import mongoose from "mongoose";

// GET /api/conversations — lista conversaciones del usuario actual
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const role   = session.user.role; // "dador" | "camionero"

  let offerQuery: Record<string, unknown>;

  if (role === "dador") {
    // Buscar cargas del dador
    const shipper = await Shipper.findOne({ user_id: userId });
    if (!shipper) return NextResponse.json({ conversations: [] });
    const loads = await Load.find({ shipper_id: shipper._id }, "_id").lean();
    const loadIds = loads.map((l) => l._id);
    offerQuery = { load_id: { $in: loadIds }, status: "accepted" };
  } else {
    // Camionero: sus ofertas aceptadas
    offerQuery = { driver_id: userId, status: "accepted" };
  }

  const offers = await Offer.find(offerQuery).sort({ created_at: -1 }).lean();
  if (offers.length === 0) return NextResponse.json({ conversations: [] });

  // Cargas
  const loadIds   = offers.map((o) => o.load_id);
  const loads     = await Load.find({ _id: { $in: loadIds } }).lean();
  const loadMap   = Object.fromEntries(loads.map((l) => [l._id.toString(), l]));

  // Usuarios del otro lado
  const driverIds   = offers.map((o) => o.driver_id);
  const shipperDocs = await Shipper.find({ _id: { $in: loads.map((l) => l.shipper_id) } }).lean();
  const shipperUserIds = shipperDocs.map((s) => s.user_id);
  const allUserIds  = [...new Set([...driverIds.map((id) => id.toString()), ...shipperUserIds.map((id) => id.toString())])];
  const users       = await User.find({ _id: { $in: allUserIds } }, "name").lean();
  const userMap     = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));

  const shipperUserMap = Object.fromEntries(
    shipperDocs.map((s) => [s._id.toString(), s.user_id.toString()])
  );

  // Último mensaje por oferta
  const offerObjectIds = offers.map((o) => o._id);
  const lastMessages   = await Message.aggregate([
    { $match: { offer_id: { $in: offerObjectIds } } },
    { $sort:  { created_at: -1 } },
    { $group: { _id: "$offer_id", content: { $first: "$content" }, created_at: { $first: "$created_at" } } },
  ]);
  const lastMsgMap = Object.fromEntries(
    lastMessages.map((m) => [m._id.toString(), { content: m.content, time: new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }])
  );

  const conversations = offers.map((o) => {
    const load = loadMap[o.load_id.toString()];
    const titulo = load ? `${load.cargo_type ?? "Carga"} — ${load.pickup_city} → ${load.dropoff_city}` : "Carga";

    let otherUserName = "Usuario";
    if (role === "dador") {
      otherUserName = userMap[o.driver_id.toString()] ?? "Camionero";
    } else {
      const shipperDoc = shipperDocs.find((s) => s._id.toString() === load?.shipper_id.toString());
      if (shipperDoc) otherUserName = userMap[shipperUserMap[shipperDoc._id.toString()]] ?? "Dador";
    }

    const lastMsg = lastMsgMap[o._id.toString()];
    return {
      offerId:       o._id.toString(),
      cargaTitulo:   titulo,
      otherUserName,
      precio:        o.price,
      lastMessage:   lastMsg?.content ?? null,
      lastMessageTime: lastMsg?.time ?? null,
    };
  });

  return NextResponse.json({ conversations });
}
