import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function GET() {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const res = await apiFetch("/offers/mine", session.backendToken);
  const offers = await res.json();

  if (!Array.isArray(offers)) return NextResponse.json(offers, { status: res.status });

  const now = new Date();

  const toViaje = (o: any) => ({
    titulo: `${o.load?.cargo_type ?? "Transporte"} \u2014 ${o.load?.pickup_city ?? ""} \u2192 ${o.load?.dropoff_city ?? ""}`,
    empresa: "Dador de carga",
    precio: Number(o.price),
    fechaRetiro: o.load?.ready_at
      ? new Date(o.load.ready_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "-",
    pickupCity: o.load?.pickup_city ?? "",
    dropoffCity: o.load?.dropoff_city ?? "",
  });

  const enCurso = offers
    .filter((o: any) =>
      o.status === "accepted" && o.load?.status === "in_transit" &&
      (!o.load.ready_at || new Date(o.load.ready_at) <= now)
    )
    .map(toViaje);

  const proximos = offers
    .filter((o: any) =>
      o.status === "accepted" &&
      (o.load?.status === "matched" || (o.load?.status === "in_transit" && o.load.ready_at && new Date(o.load.ready_at) > now))
    )
    .map(toViaje);

  const completados = offers
    .filter((o: any) => o.status === "accepted" && o.load?.status === "delivered")
    .map(toViaje);

  return NextResponse.json({ enCurso, proximos, completados });
}
