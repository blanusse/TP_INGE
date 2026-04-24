import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const loadId = new URL(req.url).searchParams.get("loadId") ?? "";
  const res = await apiFetch(`/offers?loadId=${loadId}`, session.backendToken);
  const data = await res.json();
  if (!Array.isArray(data)) return NextResponse.json(data, { status: res.status });

  // Transformar al formato que espera el frontend (Oferta type)
  const offers = data.map((o: Record<string, unknown>) => {
    const driver = o.driver as Record<string, string> | null;
    const name = driver?.name ?? "Camionero";
    const iniciales = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return {
      id: o.id,
      offerId: o.id,
      nombre: name,
      iniciales,
      rating: o.avg_rating ? Number(o.avg_rating) : 0,
      viajes: o.rating_count ? Number(o.rating_count) : 0,
      precio: Number(o.price),
      counterPrice: o.counter_price ? Number(o.counter_price) : null,
      status: o.status,
      nota: o.note ?? "",
      telefono: driver?.phone ?? null,
      email: driver?.email ?? null,
      dni: driver?.dni ?? null,
    };
  });
  return NextResponse.json({ offers }, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json();
  // Mapear campos del frontend al esquema del backend
  const payload = {
    load_id: body.loadId ?? body.load_id,
    price: body.price,
    truck_id: body.truckId ?? body.truck_id,
    note: body.note,
  };
  const res = await apiFetch("/offers", session.backendToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
