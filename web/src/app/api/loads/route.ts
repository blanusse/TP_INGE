import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/loads", session.backendToken);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json();

  // Mapear campos del frontend (español) al esquema del backend
  const payload = {
    pickup_city: body.origenZona ?? body.origen,
    dropoff_city: body.destinoZona ?? body.destino,
    pickup_exact: body.origen,
    dropoff_exact: body.destino,
    pickup_lat: body.origenLat,
    pickup_lon: body.origenLon,
    dropoff_lat: body.destinoLat,
    dropoff_lon: body.destinoLon,
    cargo_type: body.tipoCarga,
    truck_type_required: body.tipoCamion,
    weight_kg: body.peso ? Number(body.peso) : undefined,
    price_base: body.precio ? Number(body.precio) : undefined,
    ready_at: body.retiro || undefined,
    description: body.descripcion,
  };

  let res: Response;
  try {
    res = await apiFetch("/loads", session.backendToken, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[loads POST] fetch failed:", err);
    return NextResponse.json({ error: "fetch_failed", detail: String(err) }, { status: 502 });
  }

  const text = await res.text();
  console.log("[loads POST] Railway response:", res.status, text.slice(0, 300));

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json", detail: text.slice(0, 200) }, { status: 502 });
  }

  return NextResponse.json(data, { status: res.status });
}
