import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role, phone, dni, razon_social, cuit, address, trucks, tipo_dador } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const dbRole = role === "dador" ? "shipper" : role === "flota" ? "carrier_admin" : "driver";

  // ── Crear usuario en Supabase Auth ───────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError || !authData.user) {
    console.error("[register] auth.signUp error:", authError);
    if (authError?.message?.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }

  const userId = authData.user.id;

  // ── Insertar en public.users (sin password_hash — lo maneja Supabase Auth) ──
  const { error: userError } = await supabaseAdmin
    .from("users")
    .insert({ id: userId, email, name, phone: phone ?? null, dni: dni ?? null, role: dbRole });

  if (userError) {
    console.error("[register] public.users insert error:", userError);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }

  // ── Camionero / Flota: crear camiones ───────────────────────────────────
  if ((role === "camionero" || role === "flota") && Array.isArray(trucks) && trucks.length > 0) {
    const rows = trucks.map((t: Record<string, string>) => ({
      owner_id:      userId,
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

    const { error: truckError } = await supabaseAdmin.from("trucks").insert(rows);
    if (truckError) {
      await supabaseAdmin.from("users").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error al guardar los datos del camión." }, { status: 500 });
    }
  }

  // ── Dador empresa: crear shipper ─────────────────────────────────────────
  if (role === "dador" && tipo_dador === "empresa") {
    const { error: shipperError } = await supabaseAdmin
      .from("shippers")
      .insert({ user_id: userId, cuit, razon_social, address: address ?? null, tipo: "empresa" });

    if (shipperError) {
      await supabaseAdmin.from("users").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error al guardar los datos de la empresa." }, { status: 500 });
    }
  }

  // ── Dador personal: crear shipper ────────────────────────────────────────
  if (role === "dador" && tipo_dador === "personal") {
    const { error: shipperError } = await supabaseAdmin
      .from("shippers")
      .insert({ user_id: userId, cuil: dni ?? null, tipo: "persona" });

    if (shipperError) {
      await supabaseAdmin.from("users").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error al guardar los datos del dador." }, { status: 500 });
    }
  }

  // ── Flota: crear empresa y vincular ──────────────────────────────────────
  if (role === "flota") {
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({ razon_social, cuit, contact_name: name, contact_email: email, contact_phone: phone ?? null })
      .select("id")
      .single();

    if (companyError || !company) {
      await supabaseAdmin.from("users").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error al guardar los datos de la empresa." }, { status: 500 });
    }

    await supabaseAdmin.from("company_drivers").insert({ company_id: company.id, driver_id: userId });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
