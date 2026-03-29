import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "transportista") return NextResponse.json({ error: "Solo para transportistas" }, { status: 403 });

  await connectDB();

  const drivers = await User.find(
    { fleet_id: new mongoose.Types.ObjectId(session.user.id), role: "transportista" },
    "name email phone dni"
  ).lean();

  return NextResponse.json({
    drivers: drivers.map((d) => ({ ...d, _id: d._id.toString() })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "transportista") return NextResponse.json({ error: "Solo para transportistas" }, { status: 403 });

  const body = await req.json();
  const { name, email, phone, dni, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios." }, { status: 400 });
  }

  await connectDB();

  const existe = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existe) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const driver = await User.create({
    email: email.toLowerCase(),
    name,
    password_hash: hash,
    role: "transportista",
    phone: phone || undefined,
    dni: dni || undefined,
    fleet_id: new mongoose.Types.ObjectId(session.user.id),
  });

  return NextResponse.json({ ok: true, driver: { _id: driver._id.toString(), name: driver.name, email: driver.email } }, { status: 201 });
}
