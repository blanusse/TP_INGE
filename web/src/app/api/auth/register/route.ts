import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";
import { Shipper } from "@/lib/models/Shipper";
import { Truck } from "@/lib/models/Truck";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role, phone, dni, razon_social, cuit, address, trucks, tipo_dador } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const dbRole = role === "dador" ? "shipper" : role === "flota" ? "carrier_admin" : "driver";

  try {
    await connectDB();

    // Verificar email duplicado
    const existe = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existe) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
    }

    // Crear usuario
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

    // Camionero / Flota: crear camiones
    if ((role === "camionero" || role === "flota") && Array.isArray(trucks) && trucks.length > 0) {
      const rows = trucks.map((t: Record<string, string>) => ({
        owner_id:      userId,
        patente:       t.patente,
        marca:         t.marca         || undefined,
        modelo:        t.modelo        || undefined,
        año:           t.año           ? parseInt(t.año) : undefined,
        truck_type:    t.truck_type,
        capacity_kg:   t.capacity_kg   ? parseFloat(t.capacity_kg) : undefined,
        vtv_vence:     t.vtv_vence     || undefined,
        seguro_poliza: t.seguro_poliza || undefined,
        seguro_vence:  t.seguro_vence  || undefined,
      }));
      await Truck.insertMany(rows);
    }

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
