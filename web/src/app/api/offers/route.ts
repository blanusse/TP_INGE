import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const loadId = new URL(req.url).searchParams.get("loadId") ?? "";
  const res = await apiFetch(`/offers?loadId=${loadId}`, session.backendToken);
  const data = await res.json();
  const wrapped = Array.isArray(data) ? { offers: data } : data;
  return NextResponse.json(wrapped, { status: res.status });
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
