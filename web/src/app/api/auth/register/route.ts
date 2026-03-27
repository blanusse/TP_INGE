import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role, phone, dni, razon_social, cuit, address, trucks, tipo_dador } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  // Verificar email duplicado
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const dbRole = role === "dador" ? "shipper" : "driver";

  // ── Crear usuario ────────────────────────────────────────────────────────
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ email, name, phone: phone ?? null, dni: dni ?? null, role: dbRole, password_hash })
    .select("id")
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }

  // ── Camionero / Flota: crear camiones ───────────────────────────────────
  if ((role === "camionero" || role === "flota") && Array.isArray(trucks) && trucks.length > 0) {
    const rows = trucks.map((t: Record<string, string>) => ({
      owner_id:      user.id,
      patente:       t.patente,
      marca:         t.marca         || null,
      modelo:        t.modelo        || null,
      año:           t.año           ? parseInt(t.año)           : null,
      truck_type:    t.truck_type,
      capacity_kg:   t.capacity_kg   ? parseFloat(t.capacity_kg) : null,
      vtv_vence:     t.vtv_vence     || null,
      seguro_poliza: t.seguro_poliza || null,
      seguro_vence:  t.seguro_vence  || null,
    }));

    const { error: truckError } = await supabase.from("trucks").insert(rows);
    if (truckError) {
      await supabase.from("users").delete().eq("id", user.id);
      return NextResponse.json({ error: "Error al guardar los datos del camión." }, { status: 500 });
    }
  }

  // ── Dador empresa: crear shipper ─────────────────────────────────────────
  if (role === "dador" && tipo_dador === "empresa") {
    const { error: shipperError } = await supabase
      .from("shippers")
      .insert({ user_id: user.id, cuit, razon_social, address: address ?? null });

    if (shipperError) {
      await supabase.from("users").delete().eq("id", user.id);
      return NextResponse.json({ error: "Error al guardar los datos de la empresa." }, { status: 500 });
    }
  }

  // ── Flota: crear empresa y vincular ──────────────────────────────────────
  if (role === "flota") {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ razon_social, cuit, contact_name: name, contact_email: email, contact_phone: phone ?? null })
      .select("id")
      .single();

    if (companyError || !company) {
      await supabase.from("users").delete().eq("id", user.id);
      return NextResponse.json({ error: "Error al guardar los datos de la empresa." }, { status: 500 });
    }

    await supabase.from("company_drivers").insert({ company_id: company.id, driver_id: user.id });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
