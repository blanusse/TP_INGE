import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Message } from "@/lib/models/Message";
import { Offer } from "@/lib/models/Offer";
import { Load } from "@/lib/models/Load";
import { Shipper } from "@/lib/models/Shipper";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";

// Verifica que el usuario es parte de la conversación (dador o camionero de la oferta)
async function canAccess(userId: string, offerId: string) {
  const offer = await Offer.findById(new mongoose.Types.ObjectId(offerId));
  if (!offer) return null;
  const load  = await Load.findById(offer.load_id);
  if (!load)  return null;
  const shipper = await Shipper.findById(load.shipper_id);

  const isDriver  = offer.driver_id.toString() === userId;
  const isShipper = shipper?.user_id.toString() === userId;

  if (!isDriver && !isShipper) return null;
  return offer;
}

// GET /api/messages?offerId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const offerId = new URL(req.url).searchParams.get("offerId");
  if (!offerId) return NextResponse.json({ error: "Falta offerId" }, { status: 400 });

  await connectDB();

  const offer = await canAccess(session.user.id, offerId);
  if (!offer) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const messages = await Message.find({ offer_id: new mongoose.Types.ObjectId(offerId) })
    .sort({ created_at: 1 })
    .lean();

  // Enriquecer con nombre del sender
  const senderIds = [...new Set(messages.map((m) => m.sender_id.toString()))];
  const users     = await User.find({ _id: { $in: senderIds } }, "name").lean();
  const userMap   = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));

  const result = messages.map((m) => ({
    id:        m._id.toString(),
    senderId:  m.sender_id.toString(),
    senderName: userMap[m.sender_id.toString()] ?? "Usuario",
    content:   m.content,
    hora:      new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  }));

  return NextResponse.json({ messages: result });
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.offerId || !body.content?.trim()) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  await connectDB();

  const offer = await canAccess(session.user.id, body.offerId);
  if (!offer) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const msg = await Message.create({
    offer_id:  new mongoose.Types.ObjectId(body.offerId),
    sender_id: new mongoose.Types.ObjectId(session.user.id),
    content:   body.content.trim(),
  });

  return NextResponse.json({
    message: {
      id:        msg._id.toString(),
      senderId:  session.user.id,
      content:   msg.content,
      hora:      new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    }
  }, { status: 201 });
}
