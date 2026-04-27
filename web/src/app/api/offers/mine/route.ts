import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

const COMMISSION_RATE = 0.10;
const grossToNet = (gross: number) => Math.round(gross * (1 - COMMISSION_RATE) * 100) / 100;

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/offers/mine", session.backendToken);
  const data = await res.json();

  if (!Array.isArray(data)) return NextResponse.json(data, { status: res.status });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offers = data.map((o: any) => ({
    id: o.id,
    titulo: o.load
      ? `${o.load.cargo_type ?? "Transporte"} — ${o.load.pickup_city ?? ""} → ${o.load.dropoff_city ?? ""}`
      : "Transporte",
    empresa: "Dador de carga",
    precioBase: o.load?.price_base != null ? grossToNet(Number(o.load.price_base)) : null,
    miOferta: o.price != null ? grossToNet(Number(o.price)) : null,
    fecha: o.created_at
      ? new Date(o.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "-",
    estado: o.status,
    counterPrice: o.counter_price != null ? grossToNet(Number(o.counter_price)) : null,
    nota: o.note ?? "",
  }));

  return NextResponse.json({ offers }, { status: res.status });
}
