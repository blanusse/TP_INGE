import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/loads", session.backendToken);
  const data = await res.json();
  // El frontend espera { loads: [...] }
  const wrapped = Array.isArray(data) ? { loads: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { loadId } = await req.json();
  if (!loadId) return NextResponse.json({ error: "loadId requerido." }, { status: 400 });

  const res = await apiFetch(`/loads/${loadId}`, session.backendToken, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json({ deleted: true });
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

  const res = await apiFetch("/loads", session.backendToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  // El frontend espera { load: <objeto> }
  const wrapped = res.ok ? { load: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
}
