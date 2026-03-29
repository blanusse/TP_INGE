import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";
import { Shipper } from "@/lib/models/Shipper";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role, phone, dni, razon_social, cuit, address, tipo_dador } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const dbRole = role === "dador" ? "shipper" : "transportista";

  try {
    await connectDB();

    const existe = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existe) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      name,
      password_hash: hash,
      role: dbRole,
      phone: phone || undefined,
      dni:   dni   || undefined,
    });
    const userId = user._id;

    // Dador empresa
    if (role === "dador" && tipo_dador === "empresa") {
      await Shipper.create({ user_id: userId, tipo: "empresa", cuit, razon_social, address: address || undefined });
    }

    // Dador personal
    if (role === "dador" && tipo_dador === "personal") {
      await Shipper.create({ user_id: userId, tipo: "persona", cuil: dni || undefined });
    }

    return NextResponse.json({ ok: true }, { status: 201 });

  } catch (err: unknown) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }
}
